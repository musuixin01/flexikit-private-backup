import api from './client';
import type { AccessTokenLifecycle } from '@/auth/accessToken';
import type { RefreshTokenLifecycle } from '@/auth/refreshToken';
import { browserCookieAuthRequestOptions } from '@/auth/browserCookieAuth';
import {
  getAuthClientContext,
  type AuthSessionMetadata,
} from '@/auth/clientContext';

export interface AuthTokenResponse
  extends AccessTokenLifecycle, RefreshTokenLifecycle, AuthSessionMetadata {}

export interface ManagedAuthSession extends AuthSessionMetadata {
  created_at: string;
  last_used_at: string | null;
  expires_at: string;
  is_current: boolean;
}

export interface RevokeManagedSessionResponse {
  session_id: string;
  revoked_at: string;
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthTokenResponse>('/auth/login', {
      username,
      password,
      ...getAuthClientContext(),
    }, browserCookieAuthRequestOptions()),
  register: (username: string, email: string, password: string) =>
    api.post<AuthTokenResponse>('/auth/register', {
      username,
      email,
      password,
      ...getAuthClientContext(),
    }, browserCookieAuthRequestOptions()),
  logout: (refreshToken?: string) =>
    api.post<RevokeManagedSessionResponse>(
      '/auth/logout',
      refreshToken ? { refresh_token: refreshToken } : {},
      browserCookieAuthRequestOptions(),
    ),
  approveExtensionPair: (code: string) =>
    api.post<{ paired: boolean }>('/auth/extension-pair/approve', { code }),
  listSessions: () =>
    api.get<ManagedAuthSession[]>('/auth/sessions'),
  revokeSession: (sessionId: string) =>
    api.delete<RevokeManagedSessionResponse>(`/auth/sessions/${sessionId}`),
  refresh: (refreshToken?: string) =>
    api.post<AuthTokenResponse>(
      '/auth/refresh',
      refreshToken ? { refresh_token: refreshToken } : {},
      browserCookieAuthRequestOptions(),
    ),
};
