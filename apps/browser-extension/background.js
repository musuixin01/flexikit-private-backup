import {
  DEFAULT_API_BASE_URL,
  STORAGE_KEYS,
  canonicalizePageUrl,
  inferCategory,
  normalizeApiBaseUrl,
  normalizePageMetadata,
  uniqueTags,
  unwrapApiPayload,
  isExpired
} from './shared.js';

const REQUEST_TIMEOUT_MS = 12_000;

class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

function errorMessage(payload, status) {
  if (Array.isArray(payload?.message)) return payload.message.join('、');
  if (typeof payload?.message === 'string' && payload.message) return payload.message;
  if (typeof payload?.error === 'string' && payload.error) return payload.error;
  if (status === 401) return '登录已失效，请重新登录';
  if (status === 409) return '这个网站已经在你的工具箱中';
  return status ? `FlexiKit API 请求失败（HTTP ${status}）` : '无法连接 FlexiKit API';
}

async function getSettings() {
  const stored = await chrome.storage.local.get({
    [STORAGE_KEYS.settings]: null,
    apiBaseUrl: '',
    accessToken: ''
  });

  if (stored[STORAGE_KEYS.settings]?.apiBaseUrl) {
    return {
      apiBaseUrl: normalizeApiBaseUrl(stored[STORAGE_KEYS.settings].apiBaseUrl)
    };
  }

  const apiBaseUrl = normalizeApiBaseUrl(stored.apiBaseUrl || DEFAULT_API_BASE_URL);
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: { apiBaseUrl }
  });

  if (stored.apiBaseUrl || stored.accessToken) {
    await chrome.storage.local.remove(['apiBaseUrl', 'accessToken']);
  }

  return { apiBaseUrl };
}

async function getAuth() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEYS.auth]: null });
  return stored[STORAGE_KEYS.auth];
}

async function saveAuth(auth) {
  await chrome.storage.local.set({ [STORAGE_KEYS.auth]: auth });
}

async function clearAuth() {
  await chrome.storage.local.remove(STORAGE_KEYS.auth);
}

async function getClientInstanceId() {
  const stored = await chrome.storage.local.get({ [STORAGE_KEYS.clientInstanceId]: '' });
  if (stored[STORAGE_KEYS.clientInstanceId]) return stored[STORAGE_KEYS.clientInstanceId];

  const value = crypto.randomUUID();
  await chrome.storage.local.set({ [STORAGE_KEYS.clientInstanceId]: value });
  return value;
}

async function fetchJsonAtBase(baseUrl, path, { method = 'GET', body, token } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${normalizeApiBaseUrl(baseUrl)}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // Empty/non-JSON bodies are valid for some endpoints; status still controls success.
    }

    if (!response.ok) {
      throw new ApiError(errorMessage(payload, response.status), response.status);
    }

    return unwrapApiPayload(payload);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error?.name === 'AbortError') throw new ApiError('连接 FlexiKit API 超时');
    throw new ApiError(error instanceof Error ? error.message : '无法连接 FlexiKit API');
  } finally {
    clearTimeout(timer);
  }
}

function validateAuthResult(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    typeof value.access_token !== 'string' ||
    typeof value.refresh_token !== 'string' ||
    typeof value.expires_at !== 'string' ||
    typeof value.refresh_expires_at !== 'string'
  ) {
    throw new ApiError('FlexiKit 登录响应格式无效');
  }
  return value;
}

async function refreshAuth() {
  const settings = await getSettings();
  const current = await getAuth();

  if (!current?.refresh_token || isExpired(current.refresh_expires_at, 0)) {
    await clearAuth();
    throw new ApiError('登录已过期，请重新登录', 401);
  }

  try {
    const refreshed = validateAuthResult(await fetchJsonAtBase(
      settings.apiBaseUrl,
      '/auth/refresh',
      {
        method: 'POST',
        body: { refresh_token: current.refresh_token }
      }
    ));

    const next = {
      ...refreshed,
      profile: current.profile || null
    };
    await saveAuth(next);
    return next;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearAuth();
    }
    throw error;
  }
}

async function accessToken() {
  const current = await getAuth();
  if (current?.access_token && !isExpired(current.expires_at)) {
    return current.access_token;
  }
  return (await refreshAuth()).access_token;
}

async function authorizedRequest(path, options = {}, retry = true) {
  const settings = await getSettings();
  const token = await accessToken();

  try {
    return await fetchJsonAtBase(settings.apiBaseUrl, path, {
      ...options,
      token
    });
  } catch (error) {
    if (retry && error instanceof ApiError && error.status === 401) {
      await refreshAuth();
      return authorizedRequest(path, options, false);
    }
    throw error;
  }
}

async function loadProfile() {
  const profile = await authorizedRequest('/users/profile');
  const current = await getAuth();
  if (current) {
    await saveAuth({ ...current, profile });
  }
  return profile;
}

async function login({ username, password }) {
  const settings = await getSettings();
  const clientInstanceId = await getClientInstanceId();

  const auth = validateAuthResult(await fetchJsonAtBase(
    settings.apiBaseUrl,
    '/auth/login',
    {
      method: 'POST',
      body: {
        username: String(username || '').trim(),
        password: String(password || ''),
        client_type: 'extension',
        client_instance_id: clientInstanceId,
        client_name: 'FlexiKit Browser Companion'
      }
    }
  ));

  await saveAuth({ ...auth, profile: null });

  try {
    const profile = await loadProfile();
    return { authenticated: true, profile };
  } catch (error) {
    await clearAuth();
    throw error;
  }
}

async function logout() {
  const current = await getAuth();

  if (current?.refresh_token) {
    try {
      await authorizedRequest('/auth/logout', {
        method: 'POST',
        body: { refresh_token: current.refresh_token }
      });
    } catch {
      // Local sign-out must still succeed if the API is offline.
    }
  }

  await clearAuth();
  return { authenticated: false };
}

async function getState() {
  const settings = await getSettings();
  const current = await getAuth();

  if (!current?.refresh_token || isExpired(current.refresh_expires_at, 0)) {
    if (current) await clearAuth();
    return {
      settings,
      auth: { authenticated: false, profile: null }
    };
  }

  try {
    const profile = current.profile || await loadProfile();
    return {
      settings,
      auth: { authenticated: true, profile }
    };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      await clearAuth();
      return {
        settings,
        auth: { authenticated: false, profile: null }
      };
    }

    return {
      settings,
      auth: {
        authenticated: true,
        profile: current.profile || null,
        connectionError: error instanceof Error ? error.message : '连接失败'
      }
    };
  }
}

async function testConnection(candidateBaseUrl) {
  const baseUrl = normalizeApiBaseUrl(candidateBaseUrl);
  await fetchJsonAtBase(baseUrl, '/categories');

  const currentSettings = await getSettings();
  const current = await getAuth();

  if (current?.refresh_token && currentSettings.apiBaseUrl === baseUrl) {
    const profile = await loadProfile();
    return { ok: true, profile };
  }

  return { ok: true, profile: null };
}

async function saveSettings({ apiBaseUrl }) {
  const nextBaseUrl = normalizeApiBaseUrl(apiBaseUrl);
  const currentSettings = await getSettings();

  if (currentSettings.apiBaseUrl !== nextBaseUrl) {
    await logout();
  }

  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: { apiBaseUrl: nextBaseUrl }
  });

  return getState();
}

async function prepareCapture(input) {
  const metadata = normalizePageMetadata(input);

  const params = new URLSearchParams({
    name: metadata.name,
    description: metadata.description,
    url: metadata.url,
    limit: '6'
  });

  const [categoriesRaw, recommendations, duplicate] = await Promise.all([
    authorizedRequest('/categories'),
    authorizedRequest(`/tools/recommend-tags?${params.toString()}`),
    authorizedRequest(`/tools/duplicate?url=${encodeURIComponent(metadata.url)}`)
  ]);

  const categories = Array.isArray(categoriesRaw)
    ? categoriesRaw.map(item => item?.name).filter(name => typeof name === 'string' && name.trim())
    : [];

  const recommendedTags = uniqueTags(
    Array.isArray(recommendations) ? recommendations.map(item => item?.tag) : [],
    6
  );

  return {
    metadata,
    categories,
    recommendedTags,
    recommendedCategory: inferCategory(categories, recommendedTags, metadata),
    duplicate: duplicate || null
  };
}

async function createTool(input) {
  const metadata = normalizePageMetadata(input);
  const payload = {
    name: metadata.name,
    url: canonicalizePageUrl(metadata.url),
    description: metadata.description,
    icon: metadata.icon,
    tags: uniqueTags(input.tags, 8),
    category: String(input.category || '').trim() || undefined
  };

  return authorizedRequest('/tools', {
    method: 'POST',
    body: payload
  });
}

async function handleMessage(message) {
  switch (message?.type) {
    case 'FLEXIKIT_GET_STATE':
      return getState();
    case 'FLEXIKIT_LOGIN':
      return login(message.credentials || {});
    case 'FLEXIKIT_LOGOUT':
      return logout();
    case 'FLEXIKIT_TEST_CONNECTION':
      return testConnection(message.apiBaseUrl);
    case 'FLEXIKIT_SAVE_SETTINGS':
      return saveSettings(message.settings || {});
    case 'FLEXIKIT_PREPARE_CAPTURE':
      return prepareCapture(message.metadata);
    case 'FLEXIKIT_CREATE_TOOL':
      return createTool(message.tool);
    default:
      throw new ApiError('未知的扩展请求');
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(data => sendResponse({ ok: true, data }))
    .catch(error => sendResponse({
      ok: false,
      error: error instanceof Error ? error.message : '操作失败',
      status: error instanceof ApiError ? error.status : 0
    }));
  return true;
});
