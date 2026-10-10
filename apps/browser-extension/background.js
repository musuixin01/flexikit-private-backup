import {
  DEFAULT_API_BASE_URL,
  STORAGE_KEYS,
  canonicalizePageUrl,
  inferCategory,
  normalizeApiBaseUrl,
  normalizePageMetadata,
  uniqueTags,
  unwrapApiPayload,
  isExpired,
  isSupportedPageUrl,
  readCurrentPageMetadata
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

async function performRefreshAuth() {
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

let refreshInFlight = null;

function refreshAuth() {
  if (!refreshInFlight) {
    refreshInFlight = performRefreshAuth().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
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
      const latest = await getAuth();
      if (latest?.access_token === token) await refreshAuth();
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

  await chrome.storage.session.remove(STORAGE_KEYS.pairing);
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
    await chrome.storage.session.remove(STORAGE_KEYS.pairing);
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

async function performQuickCapture(metadata) {
  const duplicatePath = `/tools/duplicate?url=${encodeURIComponent(metadata.url)}`;
  const [duplicate, recommendations] = await Promise.all([
    authorizedRequest(duplicatePath),
    // Metadata enrichment is optional; a failure must never block the capture.
    prepareCapture(metadata).catch(() => null)
  ]);
  if (duplicate) return { status: 'duplicate', tool: duplicate, metadata };
  try {
    const tool = await createTool({
      ...metadata,
      category: recommendations?.recommendedCategory || '',
      tags: recommendations?.recommendedTags || []
    });
    return { status: 'created', tool, metadata };
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const existing = await authorizedRequest(duplicatePath);
      if (existing) return { status: 'duplicate', tool: existing, metadata };
    }
    throw error;
  }
}

// Coalesce repeated user gestures within one extension service worker.
const capturesInFlight = new Map();

async function quickCapture(input) {
  const metadata = normalizePageMetadata(input);
  const pending = capturesInFlight.get(metadata.url);
  if (pending) {
    const prior = await pending;
    return { ...prior, status: 'duplicate' };
  }
  const task = performQuickCapture(metadata);
  capturesInFlight.set(metadata.url, task);
  try {
    return await task;
  } finally {
    if (capturesInFlight.get(metadata.url) === task) capturesInFlight.delete(metadata.url);
  }
}

async function updateCapturedTool({ id, tool }) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError('无效的工具编号');
  const metadata = normalizePageMetadata(tool);
  return authorizedRequest(`/tools/${id}`, {
    method: 'PUT',
    body: {
      name: metadata.name,
      description: metadata.description,
      category: String(tool.category || '').trim() || undefined,
      tags: uniqueTags(tool.tags, 8)
    }
  });
}

async function undoCapture({ id }) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new ApiError('无效的工具编号');
  // The backend enforces account ownership of the specific tool.
  await authorizedRequest(`/tools/${id}`, { method: 'DELETE' });
  return { undone: true };
}

async function captureFromContextMenu(tab) {
  if (!tab?.id || !isSupportedPageUrl(tab.url)) throw new ApiError('此网页不支持添加');
  const [execution] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: readCurrentPageMetadata
  });
  if (!execution?.result) throw new ApiError('无法读取网页信息');
  return quickCapture(execution.result);
}

function showCaptureBadge(tabId, label, title) {
  if (!Number.isSafeInteger(tabId)) return;
  chrome.action.setBadgeBackgroundColor({ tabId, color: label === '!' ? '#bf4545' : '#217a4a' });
  chrome.action.setBadgeText({ tabId, text: label });
  chrome.action.setTitle({ tabId, title });
  setTimeout(() => {
    chrome.action.setBadgeText({ tabId, text: '' }).catch(() => {});
    chrome.action.setTitle({ tabId, title: '添加到 FlexiKit' }).catch(() => {});
  }, 3500);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'flexikit-quick-add',
    title: '添加到 FlexiKit',
    contexts: ['page']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'flexikit-quick-add') return;
  captureFromContextMenu(tab)
    .then(result => showCaptureBadge(tab?.id, result.status === 'created' ? '✓' : '已存',
      result.status === 'created' ? '已添加到 FlexiKit 工具箱' : '网页已在 FlexiKit 工具箱中'))
    .catch(() => showCaptureBadge(tab?.id, '!', '添加失败，请点击 FlexiKit 图标查看并登录'));
});

// Pending pairing secrets use extension-session storage (never sync, never exposed to web pages).
const PENDING_PAIR_KEY = STORAGE_KEYS.pairing;

function createPairVerifier() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getPendingPair() {
  const stored = await chrome.storage.session.get({ [PENDING_PAIR_KEY]: null });
  const pending = stored[PENDING_PAIR_KEY];
  if (!pending) return null;
  if (Date.parse(pending.expires_at) <= Date.now()) {
    await chrome.storage.session.remove(PENDING_PAIR_KEY);
    return null;
  }
  return pending;
}

async function startExtensionPair() {
  const existing = await getPendingPair();
  if (existing) return { code: existing.code, expires_at: existing.expires_at };
  const settings = await getSettings();
  const client_instance_id = await getClientInstanceId();
  const verifier = createPairVerifier();
  const pair = await fetchJsonAtBase(settings.apiBaseUrl, '/auth/extension-pair/start', {
    method: 'POST', body: { client_instance_id, verifier }
  });
  if (!/^[A-HJ-NP-Z2-9]{10}$/.test(pair?.code)
    || !Number.isFinite(Date.parse(pair.expires_at))) {
    throw new ApiError('服务器返回的配对信息无效');
  }
  await chrome.storage.session.set({
    [PENDING_PAIR_KEY]: { ...pair, client_instance_id, verifier }
  });
  return { code: pair.code, expires_at: pair.expires_at };
}

async function checkExtensionPair() {
  const pending = await getPendingPair();
  if (!pending) return { status: 'expired' };
  const settings = await getSettings();
  let result;
  try {
    result = await fetchJsonAtBase(settings.apiBaseUrl, '/auth/extension-pair/complete', {
      method: 'POST',
      body: {
        code: pending.code,
        verifier: pending.verifier,
        client_instance_id: pending.client_instance_id
      }
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 410) {
      await chrome.storage.session.remove(PENDING_PAIR_KEY);
      return { status: 'expired' };
    }
    throw error;
  }
  if (result?.status === 'pending') return { status: 'pending' };
  if (result?.status !== 'connected') throw new ApiError('连接响应无效');
  const auth = validateAuthResult(result.auth);
  await saveAuth({ ...auth, profile: null });
  await chrome.storage.session.remove(PENDING_PAIR_KEY);
  const profile = await loadProfile().catch(() => null);
  return { status: 'connected', profile };
}

async function cancelExtensionPair() {
  await chrome.storage.session.remove(PENDING_PAIR_KEY);
  return { status: 'cancelled' };
}

async function getExtensionPairStatus() {
  const pending = await getPendingPair();
  return pending
    ? { status: 'pending', code: pending.code, expires_at: pending.expires_at }
    : { status: 'none' };
}

async function handleMessage(message) {
  switch (message?.type) {
    case 'FLEXIKIT_PAIR_START':
      return startExtensionPair();
    case 'FLEXIKIT_PAIR_STATUS':
      return getExtensionPairStatus();
    case 'FLEXIKIT_PAIR_CHECK':
      return checkExtensionPair();
    case 'FLEXIKIT_PAIR_CANCEL':
      return cancelExtensionPair();
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
    case 'FLEXIKIT_QUICK_CAPTURE':
      return quickCapture(message.metadata);
    case 'FLEXIKIT_UPDATE_CAPTURE':
      return updateCapturedTool(message);
    case 'FLEXIKIT_UNDO_CAPTURE':
      return undoCapture(message);
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
