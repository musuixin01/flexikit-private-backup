import {
  apiOriginPattern,
  isSupportedPageUrl,
  readCurrentPageMetadata,
  normalizeText,
  uniqueTags
} from './shared.js';

const elements = Object.fromEntries(
  [...document.querySelectorAll('[id]')].map(element => [element.id, element])
);

let state = null;
let prepared = null;
let selectedTags = [];
let createdId = null;
let savedTool = null;

let pairPollTimer = null;
let checkingPair = false;

function stopPairPolling() {
  if (pairPollTimer) clearTimeout(pairPollTimer);
  pairPollTimer = null;
}

function showPairing(pair) {
  elements.pairArea.hidden = false;
  elements.pairStartButton.hidden = true;
  elements.pairCode.textContent = pair.code;
  elements.pairStatus.textContent = '等待你在 FlexiKit 中确认…';
  stopPairPolling();
  pairPollTimer = setTimeout(() => { void checkPairing(); }, 2500);
}

function resetPairing(text = '') {
  stopPairPolling();
  elements.pairArea.hidden = true;
  elements.pairStartButton.hidden = false;
  elements.pairCode.textContent = '';
  elements.pairStatus.textContent = text;
}

async function checkPairing() {
  if (checkingPair || elements.loginView.hidden) return;
  checkingPair = true;
  try {
    const result = await message('FLEXIKIT_PAIR_CHECK');
    if (result.status === 'connected') {
      stopPairPolling();
      elements.pairStatus.textContent = '';
      showView('connectedView');
      return;
    }
    if (result.status === 'expired') {
      resetPairing('配对码已过期，请重新连接。');
      return;
    }
    elements.pairStatus.textContent = '等待你在 FlexiKit 中确认…';
  } catch (error) {
    elements.pairStatus.textContent = error instanceof Error
      ? `暂时无法确认：${error.message}` : '连接失败，请检查网络';
  } finally {
    checkingPair = false;
    if (!elements.loginView.hidden && !elements.pairArea.hidden) {
      stopPairPolling();
      pairPollTimer = setTimeout(() => { void checkPairing(); }, 2500);
    }
  }
}

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
    target: { tabId: tab.id }, func: readCurrentPageMetadata
  });
  if (!execution?.result) throw new Error('无法读取当前网页');
  return execution.result;
}

function showResult(text, undoAvailable = false) {
  elements.resultNotice.hidden = false;
  elements.resultText.textContent = text;
  elements.resultHeading.textContent = undoAvailable ? '已添加' : '已撤销';
  elements.undoButton.hidden = !undoAvailable;
}

async function loadCapture() {
  setStatus('');
  showView('captureView');
  elements.resultNotice.hidden = true;
  elements.duplicateNotice.hidden = true;
  elements.captureForm.hidden = true;
  elements.advancedToggle.hidden = true;
  elements.advancedToggle.setAttribute('aria-expanded', 'false');
  elements.quickNotice.hidden = false;
  elements.quickNotice.textContent = '正在保存当前网页…';
  createdId = null;
  savedTool = null;
  prepared = null;
  const profile = state?.auth?.profile;
  elements.accountName.textContent =
    profile?.displayName || profile?.display_name || profile?.username || 'FlexiKit 用户';
  try {
    const metadata = await extractCurrentPage();
    elements.pageTitle.textContent = metadata.name || '当前网页';
    elements.pageHost.textContent = new URL(metadata.url).hostname;
    elements.pageIcon.src = metadata.icon || 'icons/icon-32.png';
    prepared = { metadata, duplicate: null };
    const result = await message('FLEXIKIT_QUICK_CAPTURE', { metadata });
    prepared.metadata = result.metadata;
    elements.quickNotice.hidden = true;
    if (result.status === 'duplicate') {
      prepared.duplicate = result.tool;
      elements.duplicateNotice.hidden = false;
      elements.duplicateText.textContent =
        `“${result.tool?.name || '这个网站'}” 已存在，无需重复添加。`;
      return;
    }
    if (!Number.isSafeInteger(result.tool?.id) || result.tool.id <= 0) {
      throw new Error('保存成功，但返回的工具编号无效。请在工具箱中查看。');
    }
    createdId = result.tool.id;
    savedTool = result.tool;
    showResult('已保存到「我的工具」，你可以继续浏览。', true);
    elements.advancedToggle.hidden = false;
    elements.advancedToggle.textContent = '编辑名称、分类与标签';
  } catch (error) {
    if (error?.code === 'UNSUPPORTED_PAGE' || error?.message === 'UNSUPPORTED_PAGE') {
      showView('unsupportedView');
      return;
    }
    elements.quickNotice.hidden = true;
    setStatus(error instanceof Error ? error.message : '保存失败，请重试');
    if (prepared && createdId === null) {
      elements.advancedToggle.hidden = false;
      elements.advancedToggle.textContent = '手动添加 / 重试';
    }
  }
}

async function toggleAdvanced() {
  if (!elements.captureForm.hidden) {
    elements.captureForm.hidden = true;
    elements.advancedToggle.setAttribute('aria-expanded', 'false');
    return;
  }
  if (!prepared || prepared.duplicate) return;
  elements.advancedToggle.disabled = true;
  try {
    let enrichment = null;
    try {
      enrichment = await message('FLEXIKIT_PREPARE_CAPTURE', { metadata: prepared.metadata });
    } catch {
      // Editing remains usable when recommendations are unavailable.
    }
    const details = savedTool || prepared.metadata;
    elements.toolName.value = details.name || prepared.metadata.name;
    elements.toolDescription.value = details.description || prepared.metadata.description;
    selectedTags = uniqueTags(savedTool?.tags || enrichment?.recommendedTags || [], 6);
    renderTags();
    fillCategories(enrichment?.categories || [],
      details.category || enrichment?.recommendedCategory || '');
    elements.addToolButton.textContent = createdId ? '保存修改' : '添加到工具箱';
    elements.addToolButton.disabled = false;
    elements.captureForm.hidden = false;
    elements.advancedToggle.setAttribute('aria-expanded', 'true');
  } finally {
    elements.advancedToggle.disabled = false;
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
    elements.apiBadge.textContent = '安全连接';
    try {
      const pairing = await message('FLEXIKIT_PAIR_STATUS');
      if (pairing.status === 'pending') showPairing(pairing);
      else resetPairing();
    } catch { resetPairing(); }
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

elements.pairStartButton.addEventListener('click', async () => {
  setStatus('');
  setBusy(elements.pairStartButton, true, '创建配对码…');
  try {
    const pairing = await message('FLEXIKIT_PAIR_START');
    showPairing(pairing);
  } catch (error) {
    elements.pairStatus.textContent = error instanceof Error ? error.message : '无法开始配对';
  } finally {
    setBusy(elements.pairStartButton, false);
  }
});

elements.pairCheckButton.addEventListener('click', () => { void checkPairing(); });
elements.pairCancelButton.addEventListener('click', async () => {
  try {
    await message('FLEXIKIT_PAIR_CANCEL');
    resetPairing('已取消连接。');
  } catch (error) {
    elements.pairStatus.textContent = error instanceof Error ? error.message : '取消失败';
  }
});

window.addEventListener('pagehide', stopPairPolling);

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
    stopPairPolling();
    showView('connectedView');
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

elements.advancedToggle.addEventListener('click', () => {
  toggleAdvanced().catch(error => {
    setStatus(error instanceof Error ? error.message : '无法展开编辑选项');
  });
});

elements.undoButton.addEventListener('click', async () => {
  if (!createdId) return;
  elements.undoButton.disabled = true;
  try {
    await message('FLEXIKIT_UNDO_CAPTURE', { id: createdId });
    createdId = null;
    savedTool = null;
    elements.captureForm.hidden = true;
    elements.advancedToggle.hidden = true;
    showResult('已撤销，网页已从工具箱移除。');
    setStatus('已撤销', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '撤销失败，请在 FlexiKit 工具箱中删除');
    elements.undoButton.disabled = false;
  }
});

elements.captureForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!prepared || prepared.duplicate) return;
  setStatus('');
  setBusy(elements.addToolButton, true, createdId ? '正在保存…' : '正在添加…');
  const tool = {
    ...prepared.metadata,
    name: elements.toolName.value,
    description: elements.toolDescription.value,
    category: elements.toolCategory.value,
    tags: selectedTags
  };
  try {
    const result = createdId
      ? await message('FLEXIKIT_UPDATE_CAPTURE', { id: createdId, tool })
      : await message('FLEXIKIT_CREATE_TOOL', { tool });
    if (!Number.isSafeInteger(result?.id) || result.id <= 0) {
      throw new Error('未能确认工具编号');
    }
    createdId = result.id;
    savedTool = result;
    elements.captureForm.hidden = true;
    elements.advancedToggle.setAttribute('aria-expanded', 'false');
    elements.advancedToggle.textContent = '编辑名称、分类与标签';
    showResult('已保存到「我的工具」，你可以继续浏览。', true);
    setStatus('已保存', 'success');
  } catch (error) {
    if (error?.status === 409) {
      elements.duplicateNotice.hidden = false;
      elements.duplicateText.textContent = '这个网站已经在工具箱中。';
      elements.captureForm.hidden = true;
      elements.advancedToggle.hidden = true;
    }
    setStatus(error instanceof Error ? error.message : '保存失败');
  } finally {
    setBusy(elements.addToolButton, false);
  }
});


elements.pageIcon.addEventListener('error', () => {
  elements.pageIcon.src = 'icons/icon-32.png';
}, { once: true });

render().catch(error => {
  setStatus(error instanceof Error ? error.message : '扩展初始化失败');
});
