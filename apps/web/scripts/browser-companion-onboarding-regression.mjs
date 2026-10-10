import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const source = await readFile(new URL('../src/components/browser/browserExtensionStores.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2021, module: ts.ModuleKind.ES2022 }
});
const moduleUrl = 'data:text/javascript;base64,' + Buffer.from(compiled.outputText).toString('base64');
const { detectCompanionBrowser, validatedStoreListing, cleanPairingCode } = await import(moduleUrl);

assert.equal(detectCompanionBrowser('Mozilla Chrome/156.0 Safari/537.36'), 'chrome');
assert.equal(detectCompanionBrowser('Mozilla Chrome/156.0 Safari/537.36 Edg/156.0'), 'edge');
assert.equal(detectCompanionBrowser('Mozilla Firefox/150.0'), 'other');
assert.equal(detectCompanionBrowser('Mozilla OPR/100.0 Chrome/156.0'), 'other');

const fakeId = 'a'.repeat(32);
const chromeUrl = `https://chromewebstore.google.com/detail/flexikit/${fakeId}`;
const edgeUrl = `https://microsoftedge.microsoft.com/addons/detail/flexikit/${fakeId}`;
assert.equal(validatedStoreListing(chromeUrl, 'chrome'), chromeUrl);
assert.equal(validatedStoreListing(edgeUrl, 'edge'), edgeUrl);
for (const badUrl of [
  'https://chromewebstore.google.com/',
  'https://chromewebstore.google.com/detail/unknown',
  'https://chromewebstore.google.com.evil.net/detail/flexikit/' + fakeId,
  'https://microsoftedge.microsoft.com/addons/detail/flexikit/' + fakeId + '?utm_fake=1',
  'http://chromewebstore.google.com/detail/flexikit/' + fakeId,
  'javascript:alert(1)',
  'https://microsoftedge.microsoft.com/addons/detail/flexikit/' + fakeId + '#x'
]) {
  assert.equal(validatedStoreListing(badUrl, 'chrome'), null);
  assert.equal(validatedStoreListing(badUrl, 'edge'), null);
}
assert.equal(validatedStoreListing(chromeUrl, 'edge'), null);
assert.equal(validatedStoreListing(edgeUrl, 'chrome'), null);
assert.equal(validatedStoreListing('', 'chrome'), null);
assert.equal(cleanPairingCode(' abcd-efgh23  '), 'ABCDEFGH23');
assert.notEqual(cleanPairingCode('<script>ABCDEFGH23</script>'), 'ABCDEFGH23');

const component = await readFile(new URL('../src/components/browser/BrowserQuickStart.vue', import.meta.url), 'utf8');
const dashboard = await readFile(new URL('../src/components/workspace/WorkspaceDashboard.vue', import.meta.url), 'utf8');
const home = await readFile(new URL('../src/views/Home.vue', import.meta.url), 'utf8');
assert.ok(component.includes('v-if="storeChoices.length"'), 'unpublished listing cannot show the install link');
assert.ok(component.includes('浏览器扩展尚未正式上架'));
assert.ok(component.includes('isDesktopRuntime()'));
assert.ok(component.includes('choice.label'));
assert.ok(component.includes('emit(\'open-web-import\')'));
assert.ok(component.includes('user.isLoggedIn'));
assert.ok(dashboard.includes('<BrowserQuickStart @open-web-import="emit(\'add-tool\')" />'));
assert.ok(home.includes('<WebToolImportModal ref="webToolImportRef" />'));
assert.ok(home.includes('BrowserQuickStart @open-web-import="openAddModal"'));
console.log('Store allowlist / browser detection / no listing fallback / native web import reuse / pairing approval contract: PASS');
