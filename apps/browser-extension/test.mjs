import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  apiOriginPattern,
  canonicalizePageUrl,
  inferCategory,
  normalizeApiBaseUrl,
  uniqueTags
} from './shared.js';

assert.equal(
  canonicalizePageUrl('https://Example.com/path/?utm_source=test&b=2&a=1#section'),
  'https://example.com/path?a=1&b=2'
);
assert.equal(normalizeApiBaseUrl('http://127.0.0.1:3001/v1/'), 'http://127.0.0.1:3001/v1');
assert.equal(apiOriginPattern('http://127.0.0.1:3001/v1'), 'http://127.0.0.1/*');
assert.deepEqual(uniqueTags(['AI', ' ai ', '', '开发', 'AI']), ['AI', '开发']);
assert.equal(
  inferCategory(['效率工具', '开发工具'], ['Git', '开发'], {
    name: 'GitHub',
    description: '代码仓库',
    url: 'https://github.com'
  }),
  '开发工具'
);

const manifest = JSON.parse(await readFile(new URL('./manifest.json', import.meta.url), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '0.4.0');
assert.equal(manifest.action.default_popup, 'popup.html');
assert.ok(manifest.permissions.includes('activeTab'));
assert.ok(manifest.permissions.includes('scripting'));
assert.ok(manifest.permissions.includes('contextMenus'));
assert.equal(manifest.commands._execute_action.suggested_key.default, 'Alt+Shift+S');
assert.ok(!manifest.content_scripts);
assert.ok(!manifest.host_permissions?.includes('<all_urls>'));
assert.ok(manifest.optional_host_permissions.includes('https://*/*'));

for (const file of ['background.js', 'popup.js', 'options.js']) {
  const source = await readFile(new URL(`./${file}`, import.meta.url), 'utf8');
  assert.ok(!source.includes('chrome.storage.sync'), `${file} must not use sync storage for auth`);
}
const backgroundSource = await readFile(new URL('./background.js', import.meta.url), 'utf8');
const optionsSource = await readFile(new URL('./options.js', import.meta.url), 'utf8');
assert.ok(backgroundSource.includes("client_type: 'extension'"));
assert.ok(backgroundSource.includes("'/auth/refresh'"));
assert.ok(backgroundSource.includes('/tools/duplicate?url='));
assert.ok(optionsSource.includes('chrome.permissions.remove'));
const readme = await readFile(new URL('./README.md', import.meta.url), 'utf8');
assert.ok(!readme.includes('\uFFFD'));
assert.ok(readme.includes('CORS_EXTENSION_ORIGINS'));
const optionsHtml = await readFile(new URL('./options.html', import.meta.url), 'utf8');
assert.ok(optionsHtml.includes('不保存你的密码'));
assert.ok(optionsHtml.includes('activeTab'));

console.log('URL canonicalization and tracking cleanup: PASS');
console.log('category/tag helpers: PASS');
console.log('least-privilege Manifest V3 permissions: PASS');
console.log('local-only auth storage policy: PASS');
const popup = await readFile(new URL('./popup.js', import.meta.url), 'utf8');
const popupHtml = await readFile(new URL('./popup.html', import.meta.url), 'utf8');
assert.ok(popup.includes("'FLEXIKIT_QUICK_CAPTURE'"));
assert.ok(popup.includes("'FLEXIKIT_UNDO_CAPTURE'"));
assert.ok(popupHtml.includes('id="captureForm" class="form-stack capture-form" hidden'));
assert.ok(popupHtml.includes('id="advancedToggle"'));
assert.ok(popupHtml.includes('id="undoButton"'));
console.log('one-click capture and progressive disclosure contract: PASS');
console.log('Browser Companion regression: PASS');
