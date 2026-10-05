import {
  apiOriginPattern,
  isSupportedPageUrl,
  normalizeText,
  uniqueTags
} from './shared.js';

const elements = Object.fromEntries(
  [...document.querySelectorAll('[id]')].map(element => [element.id, element])
);

let state = null;
let prepared = null;
let selectedTags = [];

function showView(id) {
  for (const view of document.querySelectorAll('.view')) {
    view.hidden = view.id !== id;
  }
}

function setStatus(message = '', kind = 'error') {
  elements.globalStatus.textContent = message;
  elements.globalStatus.className = `global-status ${kind === 'success' ? 'success' : ''}`;
}

function setBusy(button, busy, busyText) {
  if (!button) return;
  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
  } else if (button.dataset.originalText) {
    button.textContent = button.dataset.originalText;
  }
  button.disabled = busy;
}

async function message(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response?.ok) {
    const error = new Error(response?.error || '操作失败');
    error.status = response?.status || 0;
    throw error;
  }
  return response.data;
}

async function hasApiPermission(apiBaseUrl) {
  return chrome.permissions.contains({
    origins: [apiOriginPattern(apiBaseUrl)]
  });
}

async function requestApiPermission(apiBaseUrl) {
  return chrome.permissions.request({
    origins: [apiOriginPattern(apiBaseUrl)]
  });
}

function renderTags() {
  elements.tagList.replaceChildren();

  for (const tag of selectedTags) {
    const chip = document.createElement('span');
    chip.className = 'tag';

    const label = document.createElement('span');
    label.textContent = tag;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.setAttribute('aria-label', `移除标签 ${tag}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      selectedTags = selectedTags.filter(value => value !== tag);
      renderTags();
    });

    chip.append(label, remove);
    elements.tagList.append(chip);
  }
}

function addTagFromInput() {
  const value = normalizeText(elements.tagInput.value, 32);
  if (!value) return;

  selectedTags = uniqueTags([...selectedTags, value], 8);
  elements.tagInput.value = '';
  renderTags();
}

function fillCategories(categories, selected) {
  elements.toolCategory.replaceChildren();

  const empty = document.createElement('option');
  empty.value = '';
  empty.textContent = '未分类';
  elements.toolCategory.append(empty);

  for (const category of categories) {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.toolCategory.append(option);
  }

  elements.toolCategory.value = selected || '';
}

async function extractCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id || !isSupportedPageUrl(tab.url)) {
    throw Object.assign(new Error('UNSUPPORTED_PAGE'), { code: 'UNSUPPORTED_PAGE' });
  }

  const [execution] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const meta = name => document.querySelector(`meta[name="${name}"]`)?.content?.trim() || '';
      const property = name => document.querySelector(`meta[property="${name}"]`)?.content?.trim() || '';
      const icon = [...document.querySelectorAll('link[rel~="icon"]')]
        .map(node => node.href)
        .find(Boolean);

      return {
        name: property('og:title') || document.title || location.hostname,
        url: location.href,
        icon: icon || `${location.origin}/favicon.ico`,
        description: property('og:description') || meta('description') || ''
      };
    }
  });

  if (!execution?.result) throw new Error('无法读取当前网页');
  return execution.result;
}

async function loadCapture() {
  setStatus('');
  showView('captureView');

  const profile = state?.auth?.profile;
  elements.accountName.textContent =
    profile?.displayName || profile?.display_name || profile?.username || 'FlexiKit 用户';

  try {
    const metadata = await extractCurrentPage();

    elements.pageTitle.textContent = metadata.name || '当前网页';
    try {
      elements.pageHost.textContent = new URL(metadata.url).hostname;
    } catch {
      elements.pageHost.textContent = metadata.url || '—';
    }
    elements.pageIcon.src = metadata.icon || 'icons/icon-32.png';

    prepared = await message('FLEXIKIT_PREPARE_CAPTURE', { metadata });

    elements.toolName.value = prepared.metadata.name;
    elements.toolDescription.value = prepared.metadata.description;
    selectedTags = uniqueTags(prepared.recommendedTags, 6);
    renderTags();
    fillCategories(prepared.categories || [], prepared.recommendedCategory);

    if (prepared.duplicate) {
      elements.duplicateNotice.hidden = false;
      elements.duplicateText.textContent =
        `“${prepared.duplicate.name || '该网站'}” 已存在，无需重复添加。`;
      elements.addToolButton.disabled = true;
    } else {
      elements.duplicateNotice.hidden = true;
      elements.addToolButton.disabled = false;
    }
  } catch (error) {
    if (error?.code === 'UNSUPPORTED_PAGE' || error?.message === 'UNSUPPORTED_PAGE') {
      showView('unsupportedView');
      return;
    }
    setStatus(error instanceof Error ? error.message : '读取网页失败');
  }
}

async function render() {
  setStatus('');
  state = await message('FLEXIKIT_GET_STATE');

  const granted = await hasApiPermission(state.settings.apiBaseUrl);
  if (!granted) {
    elements.permissionOrigin.textContent = state.settings.apiBaseUrl;
    showView('permissionView');
    return;
  }

  if (!state.auth.authenticated) {
    try {
      elements.apiBadge.textContent = new URL(state.settings.apiBaseUrl).hostname;
    } catch {
      elements.apiBadge.textContent = 'API';
    }
    showView('loginView');
    return;
  }

  await loadCapture();
}

elements.settingsButton.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

elements.grantPermissionButton.addEventListener('click', async () => {
  setStatus('');
  setBusy(elements.grantPermissionButton, true, '正在授权…');
  try {
    const granted = await requestApiPermission(state.settings.apiBaseUrl);
    if (!granted) throw new Error('未授予 API 连接权限');
    await render();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '授权失败');
  } finally {
    setBusy(elements.grantPermissionButton, false);
  }
});

elements.loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  setStatus('');
  setBusy(elements.loginButton, true, '登录中…');

  try {
    await message('FLEXIKIT_LOGIN', {
      credentials: {
        username: elements.username.value,
        password: elements.password.value
      }
    });
    elements.password.value = '';
    await render();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '登录失败');
  } finally {
    setBusy(elements.loginButton, false);
  }
});

elements.logoutButton.addEventListener('click', async () => {
  setStatus('');
  try {
    await message('FLEXIKIT_LOGOUT');
    prepared = null;
    selectedTags = [];
    await render();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '退出失败');
  }
});

elements.addTagButton.addEventListener('click', addTagFromInput);
elements.tagInput.addEventListener('keydown', event => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  addTagFromInput();
});

elements.captureForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!prepared || prepared.duplicate) return;

  setStatus('');
  setBusy(elements.addToolButton, true, '正在添加…');

  try {
    const created = await message('FLEXIKIT_CREATE_TOOL', {
      tool: {
        ...prepared.metadata,
        name: elements.toolName.value,
        description: elements.toolDescription.value,
        category: elements.toolCategory.value,
        tags: selectedTags
      }
    });

    prepared.duplicate = created;
    elements.addToolButton.disabled = true;
    elements.duplicateNotice.hidden = true;
    elements.resultNotice.hidden = false;
    setStatus('已同步到 FlexiKit', 'success');
  } catch (error) {
    if (error?.status === 409) {
      elements.duplicateNotice.hidden = false;
      elements.duplicateText.textContent = '这个网站已经在工具箱中。';
      elements.addToolButton.disabled = true;
    }
    setStatus(error instanceof Error ? error.message : '添加失败');
  } finally {
    const shouldRemainDisabled = Boolean(prepared?.duplicate);
    setBusy(elements.addToolButton, false);
    elements.addToolButton.disabled = shouldRemainDisabled;
  }
});

elements.pageIcon.addEventListener('error', () => {
  elements.pageIcon.src = 'icons/icon-32.png';
}, { once: true });

render().catch(error => {
  setStatus(error instanceof Error ? error.message : '扩展初始化失败');
});
