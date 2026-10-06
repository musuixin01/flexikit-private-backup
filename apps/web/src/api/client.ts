import axios, { type AxiosError } from 'axios';
import { getApiBaseUrl } from './runtime';
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  isStoredAccessTokenExpired,
  persistAccessToken,
  type AccessTokenLifecycle,
} from '@/auth/accessToken';
import {
  clearStoredRefreshToken,
  getStoredRefreshToken,
  hasStoredRefreshSession,
  isStoredRefreshTokenExpired,
  persistRefreshToken,
  type RefreshTokenLifecycle,
} from '@/auth/refreshToken';
import {
  browserCookieAuthRequestOptions,
  isBrowserCookieAuthRuntime,
  withBrowserRefreshLock,
} from '@/auth/browserCookieAuth';
import { markApiReachable, markApiUnavailable } from '@/network/connectivity';

export interface ApiSuccessResponse<T> {
  code: 0;
  message: 'success';
  data: T;
}

function isApiSuccessResponse(value: unknown): value is ApiSuccessResponse<unknown> {
  if (!value || typeof value !== 'object') return false;
  const body = value as Record<string, unknown>;
  return body.code === 0 && body.message === 'success' && 'data' in body;
}

interface AuthSessionLifecycle extends AccessTokenLifecycle, RefreshTokenLifecycle {}

function isAuthSessionLifecycle(value: unknown): value is AuthSessionLifecycle {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;

  const refreshToken = session.refresh_token;

  return typeof session.access_token === 'string'
    && session.token_type === 'Bearer'
    && typeof session.expires_in === 'number'
    && typeof session.expires_at === 'string'
    && (refreshToken === undefined || typeof refreshToken === 'string')
    && typeof session.refresh_expires_in === 'number'
    && typeof session.refresh_expires_at === 'string';
}

export interface ApiErrorResponse {
  message?: string | string[];
  error?: string;
  statusCode?: number;
  code?: string;
  details?: string[];
}

export const AUTH_INVALIDATED_EVENT = 'flexikit-auth-invalidated';
export const AUTH_REFRESHED_EVENT = 'flexikit-auth-refreshed';

function dispatchAuthInvalidated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_INVALIDATED_EVENT));
  }
}

function dispatchAuthRefreshed(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_REFRESHED_EVENT));
  }
}

async function clearStoredAuthSession(): Promise<void> {
  await Promise.allSettled([
    clearStoredAccessToken(),
    clearStoredRefreshToken(),
  ]);
}

function isAuthLifecycleRequest(url: string | undefined): boolean {
  if (!url) return false;
  return ['/auth/login', '/auth/register', '/auth/refresh'].some(
    path => url.endsWith(path) || url.includes(`${path}?`),
  );
}

interface RefreshAttemptResult {
  token: string | null;
  invalidateSession: boolean;
}

let refreshPromise: Promise<RefreshAttemptResult> | null = null;

async function performRefreshUnlocked(): Promise<RefreshAttemptResult> {
  const refreshToken = await getStoredRefreshToken();
  const hasRefreshSession = await hasStoredRefreshSession();
  if (!refreshToken && !hasRefreshSession) return { token: null, invalidateSession: false };

  if (await isStoredRefreshTokenExpired()) {
    await clearStoredRefreshToken();
    return { token: null, invalidateSession: true };
  }

  try {
    const response = await axios.post(
      `${getApiBaseUrl()}/auth/refresh`,
      refreshToken ? { refresh_token: refreshToken } : {},
      {
        timeout: 10000,
        ...browserCookieAuthRequestOptions(),
      },
    );

    const payload: unknown = response.data;
    markApiReachable();
    if (!isApiSuccessResponse(payload) || !isAuthSessionLifecycle(payload.data)) {
      return { token: null, invalidateSession: false };
    }

    await Promise.all([
      persistAccessToken(payload.data),
      persistRefreshToken(payload.data),
    ]);
    dispatchAuthRefreshed();
    return { token: payload.data.access_token, invalidateSession: false };
  } catch (error: unknown) {
    if (isApiNetworkError(error)) {
      markApiUnavailable();
      return { token: null, invalidateSession: false };
    }
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status >= 500) markApiUnavailable();
      else markApiReachable();
      return {
        token: null,
        invalidateSession: error.response.status === 401 || error.response.status === 403,
      };
    }
    return { token: null, invalidateSession: false };
  }
}

async function performRefresh(): Promise<RefreshAttemptResult> {
  return withBrowserRefreshLock(performRefreshUnlocked);
}

async function refreshAccessTokenSingleFlight(): Promise<RefreshAttemptResult> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

export function isApiUnauthorizedError(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 401;
}

export function isApiNetworkError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  return !error.response || error.code === 'ERR_NETWORK' || error.code === 'ECONNABORTED';
}

export function isApiServiceUnavailableError(error: unknown): boolean {
  return axios.isAxiosError(error) && Boolean(error.response && error.response.status >= 500);
}

export async function probeApiConnectivity(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    markApiUnavailable();
    return false;
  }

  try {
    await axios.get(`${getApiBaseUrl()}/tools`, {
      params: { limit: 1 },
      timeout: 3500,
      ...browserCookieAuthRequestOptions(),
    });
    markApiReachable();
    return true;
  } catch (error: unknown) {
    if (isApiNetworkError(error)) {
      markApiUnavailable();
      return false;
    }
    if (axios.isAxiosError(error) && error.response) {
      if (error.response.status >= 500) {
        markApiUnavailable();
        return false;
      }
      markApiReachable();
      return true;
    }
    return false;
  }
}

export function getApiErrorMessage(error: unknown, fallback = '操作失败'): string {
  if (isApiNetworkError(error) || isApiServiceUnavailableError(error)) {
    return '当前无法连接网络服务，请稍后重试';
  }
  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    const details = error.response?.data?.details;
    if (Array.isArray(details) && details.length) return details.join('、');
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join('、');
    if (typeof message === 'string' && message) return message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 10000,
  withCredentials: isBrowserCookieAuthRuntime(),
});

api.interceptors.request.use(
  async (config) => {
    if (isAuthLifecycleRequest(config.url)) {
      return config;
    }

    let token = await getStoredAccessToken();
    const hasRefreshSession = await hasStoredRefreshSession();
    const hadAuthMaterial = Boolean(token || hasRefreshSession);

    if (!token || await isStoredAccessTokenExpired()) {
      if (token) await clearStoredAccessToken();
      const refreshResult = await refreshAccessTokenSingleFlight();
      token = refreshResult.token;

      if (!token && hadAuthMaterial && refreshResult.invalidateSession) {
        await clearStoredAuthSession();
        dispatchAuthInvalidated();
        return config;
      }
    }

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    markApiReachable();
    const payload: unknown = response.data;
    if (isApiSuccessResponse(payload)) {
      response.data = payload.data;
    }
    return response;
  },
  async (error: AxiosError<ApiErrorResponse>) => {
    const config = error.config as (typeof error.config & { _authRetry?: boolean }) | undefined;
    if (isApiNetworkError(error) || isApiServiceUnavailableError(error)) markApiUnavailable();
    else if (error.response) markApiReachable();
    const isProtectedRequest = !isAuthLifecycleRequest(config?.url);

    if (
      error.response?.status === 401
      && config
      && isProtectedRequest
      && !config._authRetry
      && await hasStoredRefreshSession()
    ) {
      config._authRetry = true;
      const refreshResult = await refreshAccessTokenSingleFlight();

      if (refreshResult.token) {
        config.headers.Authorization = `Bearer ${refreshResult.token}`;
        return api.request(config);
      }
      if (!refreshResult.invalidateSession) return Promise.reject(error);
    }

    if (error.response?.status === 401 && isProtectedRequest) {
      await clearStoredAuthSession();
      dispatchAuthInvalidated();
    }

    return Promise.reject(error);
  }
);

export default api;
