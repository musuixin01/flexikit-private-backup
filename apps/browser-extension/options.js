import {
  DEFAULT_API_BASE_URL,
  apiOriginPattern,
  normalizeApiBaseUrl
} from './shared.js';

const elements = Object.fromEntries(
  [...document.querySelectorAll('[id]')].map(element => [element.id, element])
);

let state = null;

async function message(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) throw new Error(response?.error || '操作失败');
  return response.data;
}

function setStatus(message = '', kind = '') {
  elements.settingsStatus.textContent = message;
  elements.settingsStatus.className = `status ${kind}`;
}

function setConnectionBadge(text, kind = '') {
  elements.connectionBadge.textContent = text;
  elements.connectionBadge.className = `badge ${kind}`;
}

async function requestPermission(apiBaseUrl) {
  const origin = apiOriginPattern(apiBaseUrl);
  const exists = await chrome.permissions.contains({ origins: [origin] });
  if (exists) return true;
  return chrome.permissions.request({ origins: [origin] });
}

function renderAccount() {
  const profile = state?.auth?.profile;
  const authenticated = Boolean(state?.auth?.authenticated);

  elements.accountBadge.textContent = authenticated ? '已登录' : '未登录';
  elements.accountBadge.className = `badge ${authenticated ? 'success' : 'neutral'}`;
  elements.logoutButton.hidden = !authenticated;

  if (!authenticated) {
    elements.accountDetails.textContent = '点击浏览器工具栏中的 FlexiKit 图标完成登录。';
    return;
  }

  const name = profile?.displayName || profile?.display_name || profile?.username || 'FlexiKit 用户';
  const email = profile?.email ? ` · ${profile.email}` : '';
  const connectionError = state.auth.connectionError ? `（当前连接异常：${state.auth.connectionError}）` : '';
  elements.accountDetails.textContent = `${name}${email} ${connectionError}`.trim();
}

async function loadState() {
  state = await message('FLEXIKIT_GET_STATE');
  elements.apiBaseUrl.value = state?.settings?.apiBaseUrl || DEFAULT_API_BASE_URL;
  renderAccount();

  try {
    const granted = await chrome.permissions.contains({
      origins: [apiOriginPattern(elements.apiBaseUrl.value)]
    });
    setConnectionBadge(granted ? '已授权' : '待授权', granted ? 'success' : '');
  } catch {
    setConnectionBadge('地址无效', 'error');
  }
}

elements.settingsForm.addEventListener('submit', async event => {
  event.preventDefault();
  setStatus('');

  const button = elements.saveButton;
  button.disabled = true;
  const oldText = button.textContent;
  button.textContent = '保存中…';

  try {
    const apiBaseUrl = normalizeApiBaseUrl(elements.apiBaseUrl.value);
    const previousApiBaseUrl = state?.settings?.apiBaseUrl || DEFAULT_API_BASE_URL;
    const granted = await requestPermission(apiBaseUrl);
    if (!granted) throw new Error('未授予该 API 主机访问权限');

    state = await message('FLEXIKIT_SAVE_SETTINGS', {
      settings: { apiBaseUrl }
    });

    const previousOrigin = apiOriginPattern(previousApiBaseUrl);
    const nextOrigin = apiOriginPattern(apiBaseUrl);
    if (previousOrigin !== nextOrigin) {
      await chrome.permissions.remove({ origins: [previousOrigin] }).catch(() => false);
    }

    elements.apiBaseUrl.value = state.settings.apiBaseUrl;
    renderAccount();
    setConnectionBadge('已授权', 'success');
    setStatus('设置已保存。修改 API 地址后需要重新登录。', 'success');
  } catch (error) {
    setConnectionBadge('连接异常', 'error');
    setStatus(error instanceof Error ? error.message : '保存失败', 'error');
  } finally {
    button.disabled = false;
    button.textContent = oldText;
  }
});

elements.testButton.addEventListener('click', async () => {
  setStatus('');
  elements.testButton.disabled = true;
  const oldText = elements.testButton.textContent;
  elements.testButton.textContent = '检测中…';

  try {
    const apiBaseUrl = normalizeApiBaseUrl(elements.apiBaseUrl.value);
    const granted = await requestPermission(apiBaseUrl);
    if (!granted) throw new Error('未授予该 API 主机访问权限');

    await message('FLEXIKIT_TEST_CONNECTION', { apiBaseUrl });
    setConnectionBadge('连接正常', 'success');
    setStatus('FlexiKit API 可访问。', 'success');
  } catch (error) {
    setConnectionBadge('连接失败', 'error');
    setStatus(error instanceof Error ? error.message : '连接失败', 'error');
  } finally {
    elements.testButton.disabled = false;
    elements.testButton.textContent = oldText;
  }
});

elements.logoutButton.addEventListener('click', async () => {
  elements.logoutButton.disabled = true;
  try {
    await message('FLEXIKIT_LOGOUT');
    await loadState();
    setStatus('已退出 Browser Companion 会话。', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '退出失败', 'error');
  } finally {
    elements.logoutButton.disabled = false;
  }
});

loadState().catch(error => {
  setConnectionBadge('初始化失败', 'error');
  setStatus(error instanceof Error ? error.message : '初始化失败', 'error');
});
