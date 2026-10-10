import assert from 'node:assert/strict';

const authExpiry = '2999-01-01T00:00:00.000Z';
const records = new Map();
let sequence = 0;
let creates = 0;
let refreshes = 0;
let failEnrichment = false;
let injectRace = false;
let pairApproved = false;
let pairVerifier = '';
let pairClient = '';
const sessionStorage = {};
let runtimeListener = null;
let contextListener = null;
let registeredMenu = null;
const badges = [];
const storage = {
  flexikitSettings: { apiBaseUrl: 'http://127.0.0.1:3001/v1' },
  flexikitAuthSession: {
    access_token: 'test-access',
    refresh_token: 'test-refresh',
    expires_at: authExpiry,
    refresh_expires_at: authExpiry,
    profile: { username: 'browser-test' }
  }
};

globalThis.chrome = {
  storage: {
    session: {
      async get(defaults) { return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, sessionStorage[key] ?? fallback])); },
      async set(items) { Object.assign(sessionStorage, items); },
      async remove(keys) { for (const key of Array.isArray(keys) ? keys : [keys]) delete sessionStorage[key]; }
    },
    local: {
      async get(defaults) { return Object.fromEntries(
        Object.entries(defaults).map(([key, fallback]) => [key, storage[key] ?? fallback])
      ); },
      async set(items) { Object.assign(storage, items); },
      async remove(keys) {
        for (const key of Array.isArray(keys) ? keys : [keys]) delete storage[key];
      }
    }
  },
  runtime: {
    onInstalled: { addListener(callback) { callback(); } },
    onMessage: { addListener(callback) { runtimeListener = callback; } }
  },
  contextMenus: {
    create(data) { registeredMenu = data; },
    onClicked: { addListener(callback) { contextListener = callback; } }
  },
  scripting: {
    async executeScript() {
      return [{ result: { name: '示例开发工具', url: 'https://example.com/dev?utm_source=test',
        description: '开发与设计', icon: 'https://example.com/favicon.ico' } }];
    }
  },
  action: {
    setBadgeBackgroundColor(args) { badges.push(args); return Promise.resolve(); },
    setBadgeText(args) { badges.push(args); return Promise.resolve(); },
    setTitle(args) { badges.push(args); return Promise.resolve(); }
  }
};

function json(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return status >= 400 ? { message: status === 409 ? '重复' : '请求失败' }
        : { code: 0, message: 'success', data };
    }
  };
}

globalThis.fetch = async (url, options = {}) => {
  const target = new URL(url);
  const route = target.pathname;
  const method = options.method || 'GET';
  if (route === '/v1/auth/extension-pair/start' && method === 'POST') {
    const input = JSON.parse(options.body);
    assert.match(input.verifier, /^[A-Za-z0-9_-]{43}$/);
    pairVerifier = input.verifier;
    pairClient = input.client_instance_id;
    return json({ code: 'ABCDEFGH23', expires_at: new Date(Date.now() + 300000).toISOString() });
  }
  if (route === '/v1/auth/extension-pair/complete' && method === 'POST') {
    const input = JSON.parse(options.body);
    assert.equal(input.client_instance_id, pairClient);
    assert.equal(input.verifier, pairVerifier);
    return json(pairApproved
      ? { status: 'connected', auth: {
          access_token: 'renewed-access', refresh_token: 'renewed-refresh',
          expires_at: authExpiry, refresh_expires_at: authExpiry
        } }
      : { status: 'pending' });
  }
  if (route === '/v1/users/profile') return json({ username: 'browser-test' });
  if (route === '/v1/auth/refresh' && method === 'POST') {
    refreshes++;
    await new Promise(resolve => setTimeout(resolve, 15));
    return json({ access_token: 'renewed-access', refresh_token: 'renewed-refresh',
      expires_at: authExpiry, refresh_expires_at: authExpiry });
  }
  assert.ok(['Bearer test-access', 'Bearer renewed-access'].includes(options.headers.Authorization));
  if (route === '/v1/tools/duplicate') {
    const url = target.searchParams.get('url');
    return json([...records.values()].find(tool => tool.url === url) || null);
  }
  if (route === '/v1/categories') {
    if (failEnrichment) return json(null, 503);
    return json([{ name: '开发工具' }]);
  }
  if (route === '/v1/tools/recommend-tags') {
    if (failEnrichment) return json(null, 503);
    return json([{ tag: '开发' }]);
  }
  if (route === '/v1/tools' && method === 'POST') {
    creates++;
    const payload = JSON.parse(options.body);
    if (injectRace) {
      injectRace = false;
      records.set(++sequence, { ...payload, id: sequence });
      return json(null, 409);
    }
    if ([...records.values()].some(tool => tool.url === payload.url)) return json(null, 409);
    const tool = { ...payload, id: ++sequence };
    records.set(tool.id, tool);
    return json(tool);
  }
  const matched = /^\/v1\/tools\/(\d+)$/.exec(route);
  if (matched && method === 'PUT') {
    const id = Number(matched[1]);
    const current = records.get(id);
    if (!current) return json(null, 404);
    const updated = { ...current, ...JSON.parse(options.body) };
    records.set(id, updated);
    return json(updated);
  }
  if (matched && method === 'DELETE') {
    records.delete(Number(matched[1]));
    return json(null);
  }
  throw new Error(`Unexpected API request ${method} ${route}`);
};

await import('./background.js');
assert.equal(registeredMenu?.id, 'flexikit-quick-add');
assert.deepEqual(registeredMenu.contexts, ['page']);
assert.equal(typeof contextListener, 'function');
assert.equal(typeof runtimeListener, 'function');

function send(message) {
  return new Promise(resolve => runtimeListener(message, {}, resolve));
}

const original = { name: '示例开发工具', url: 'https://example.com/dev?utm_source=ad#section',
  description: '开发与设计', icon: 'https://example.com/favicon.ico' };
const first = await send({ type: 'FLEXIKIT_QUICK_CAPTURE', metadata: original });
assert.equal(first.ok, true);
assert.equal(first.data.status, 'created');
assert.equal(first.data.tool.url, 'https://example.com/dev');
assert.deepEqual(first.data.tool.tags, ['开发']);
assert.equal(first.data.tool.category, '开发工具');
assert.equal(records.size, 1);
const second = await send({ type: 'FLEXIKIT_QUICK_CAPTURE', metadata: original });
assert.equal(second.data.status, 'duplicate');
assert.equal(second.data.tool.id, first.data.tool.id);
assert.equal(creates, 1, 'duplicate capture must not POST a second record');

const updated = await send({ type: 'FLEXIKIT_UPDATE_CAPTURE', id: first.data.tool.id,
  tool: { ...original, name: '改名', description: '自定义描述', tags: ['专业'],
    category: '开发工具' } });
assert.equal(updated.ok, true);
assert.equal(updated.data.name, '改名');
assert.deepEqual(updated.data.tags, ['专业']);
const undo = await send({ type: 'FLEXIKIT_UNDO_CAPTURE', id: first.data.tool.id });
assert.equal(undo.ok, true);
assert.equal(records.size, 0);
const invalid = await send({ type: 'FLEXIKIT_UNDO_CAPTURE', id: 0 });
assert.equal(invalid.ok, false);

failEnrichment = true;
const fallback = await send({ type: 'FLEXIKIT_QUICK_CAPTURE', metadata: original });
assert.equal(fallback.data.status, 'created');
assert.equal(records.size, 1, 'enrichment outage must not block core capture');
await send({ type: 'FLEXIKIT_UNDO_CAPTURE', id: fallback.data.tool.id });
failEnrichment = false;

injectRace = true;
const raced = await send({ type: 'FLEXIKIT_QUICK_CAPTURE', metadata: original });
assert.equal(raced.data.status, 'duplicate', '409 race should resolve to existing record');
assert.equal(records.size, 1);
await send({ type: 'FLEXIKIT_UNDO_CAPTURE', id: raced.data.tool.id });

const beforeParallel = creates;
const samePage = { ...original, url: 'https://example.com/concurrent' };
const [quickOne, quickTwo] = await Promise.all([
  send({ type: 'FLEXIKIT_QUICK_CAPTURE', metadata: samePage }),
  send({ type: 'FLEXIKIT_QUICK_CAPTURE', metadata: samePage })
]);
assert.equal(quickOne.data.status, 'created');
assert.equal(quickTwo.data.status, 'duplicate');
assert.equal(quickOne.data.tool.id, quickTwo.data.tool.id);
assert.equal(creates, beforeParallel + 1, 'same-tab simultaneous gestures must use one POST');
await send({ type: 'FLEXIKIT_UNDO_CAPTURE', id: quickOne.data.tool.id });

contextListener({ menuItemId: 'flexikit-quick-add' },
  { id: 42, url: 'https://example.com/dev', title: '示例' });
for (let i = 0; i < 100 && !badges.some(item => item.text === '✓'); i++) {
  await new Promise(resolve => setTimeout(resolve, 10));
}
assert.ok(badges.some(item => item.text === '✓'), 'context menu should show success on current tab');
assert.equal(records.size, 1);
storage.flexikitAuthSession.expires_at = '2000-01-01T00:00:00.000Z';
const [parallelOne, parallelTwo] = await Promise.all([
  send({ type: 'FLEXIKIT_QUICK_CAPTURE', metadata: { ...original, url: 'https://example.com/new-one' } }),
  send({ type: 'FLEXIKIT_QUICK_CAPTURE', metadata: { ...original, url: 'https://example.com/new-two' } })
]);
assert.equal(parallelOne.ok, true);
assert.equal(parallelTwo.ok, true);
assert.equal(refreshes, 1, 'parallel requests must share a single refresh');
const pairStart = await send({ type: 'FLEXIKIT_PAIR_START' });
assert.equal(pairStart.ok, true);
assert.equal(pairStart.data.code, 'ABCDEFGH23');
assert.ok(sessionStorage.flexikitPendingExtensionPair.verifier);
assert.ok(!storage.flexikitPendingExtensionPair, 'pairing secret must not be in local storage');
assert.equal((await send({ type: 'FLEXIKIT_PAIR_STATUS' })).data.status, 'pending');
assert.equal((await send({ type: 'FLEXIKIT_PAIR_CHECK' })).data.status, 'pending');
pairApproved = true;
assert.equal((await send({ type: 'FLEXIKIT_PAIR_CHECK' })).data.status, 'connected');
assert.equal((await send({ type: 'FLEXIKIT_GET_STATE' })).data.auth.authenticated, true);
assert.equal(sessionStorage.flexikitPendingExtensionPair, undefined);
const nextPair = await send({ type: 'FLEXIKIT_PAIR_START' });
assert.equal(nextPair.ok, true);
assert.equal((await send({ type: 'FLEXIKIT_PAIR_CANCEL' })).data.status, 'cancelled');
assert.equal(sessionStorage.flexikitPendingExtensionPair, undefined);
console.log('Extension passwordless pairing lifecycle and session-secret isolation: PASS');

console.log('Concurrent rotating token refresh: PASS');

console.log('Browser one-click create / duplicate / edit / undo / outage / 409 race / right-click: PASS');
