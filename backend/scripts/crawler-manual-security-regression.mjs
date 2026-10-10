import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const ts = (() => { try { return require('typescript'); } catch { return require('../../apps/web/node_modules/typescript'); } })();
const read = relative => readFile(new URL(relative, import.meta.url), 'utf8');
function compile(source, file) {
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021,
      experimentalDecorators: true, emitDecoratorMetadata: false },
  });
  assert.deepEqual((result.diagnostics || []).filter(x => x.category === ts.DiagnosticCategory.Error), []);
  return result.outputText;
}
let currentTime = 1_800_000;
class FakeDate extends Date {
  static now() { return currentTime; }
}
class FakeHttpException extends Error {
  constructor(message, status) { super(message); this.status = status; }
}
const HttpStatus = { TOO_MANY_REQUESTS: 429 };
const decorators = {
  Injectable: () => target => target,
  Controller: () => target => target,
  Post: () => (_target, _name, descriptor) => descriptor,
  UseGuards: (...guards) => target => { target.routeGuards = guards; return target; },
  HttpException: FakeHttpException,
  HttpStatus,
};
class JwtGuard {}
class AdminGuard {}
function load(source, file, deps = {}) {
  const module = { exports: {} };
  runInNewContext(compile(source, file), {
    exports: module.exports, module, Date: FakeDate, Promise,
    require(name) {
      if (name === '@nestjs/common') return decorators;
      if (name === '../common/guards/jwt-auth.guard') return { JwtAuthGuard: JwtGuard };
      if (name === '../admin/admin-access.guard') return { AdminAccessGuard: AdminGuard };
      if (Object.hasOwn(deps, name)) return deps[name];
      // Crawler service classes are only constructor type annotations.
      if (/\.crawler\.service$/.test(name)) return {};
      throw new Error('Unexpected runtime dependency: ' + name);
    },
  }, { filename: file, timeout: 2000 });
  return module.exports;
}

const gateSource = await read('../src/crawler/crawler-manual-trigger.gate.ts');
const { CrawlerManualTriggerGate } = load(gateSource, 'crawler-manual-trigger.gate.ts');
const gate = new CrawlerManualTriggerGate();
let resolveFirst;
let invoked = 0;
const first = gate.run('v2ex', () => { invoked++; return new Promise(resolve => { resolveFirst = resolve; }); });
await assert.rejects(gate.run('appinn', async () => 2), error => error.status === 429);
assert.equal(invoked, 1);
resolveFirst(7);
assert.equal(await first, 7);
await assert.rejects(gate.run('v2ex', async () => 1), error => error.status === 429);
assert.equal(await gate.run('appinn', async () => 4), 4);
currentTime += 60_000;
await assert.rejects(gate.run('v2ex', async () => { throw new Error('upstream unavailable'); }), /upstream unavailable/);
assert.equal(await gate.run('oschina', async () => 3), 3, 'gate must release after crawler failure');

const controllerSource = await read('../src/crawler/crawler.controller.ts');
const { CrawlerController } = load(controllerSource, 'crawler.controller.ts', {
  './crawler-manual-trigger.gate': { CrawlerManualTriggerGate },
});
assert.deepEqual(CrawlerController.routeGuards, [JwtGuard, AdminGuard],
  'every manual crawler endpoint must require JWT and AdminAccessGuard at controller level');

const routes = [
  ['triggerV2exCrawler', 'v2ex'], ['triggerAppinnCrawler', 'appinn'],
  ['triggerIplaysoftCrawler', 'iplaysoft'], ['triggerProducthuntCrawler', 'producthunt'],
  ['triggerJuejinCrawler', 'juejin'], ['triggerSspaiCrawler', 'sspai'],
  ['triggerApprcnCrawler', 'apprcn'], ['triggerIfanrCrawler', 'ifanr'],
  ['trigger36krCrawler', '36kr'], ['triggerOschinaCrawler', 'oschina'],
];
const calls = new Map();
const fakeServices = routes.map(([, source]) => ({
  async crawl() { calls.set(source, (calls.get(source) || 0) + 1); return 2; }
}));
const controller = new CrawlerController(new CrawlerManualTriggerGate(), ...fakeServices);
for (const [method, source] of routes) {
  const result = await controller[method]();
  assert.equal(result.newTools, 2);
  assert.equal(result.success, true);
  assert.equal(calls.get(source), 1);
}
await assert.rejects(controller.triggerV2exCrawler(), error => error.status === 429);
assert.equal(calls.get('v2ex'), 1, 'cooldown must block duplicate upstream work');
assert.equal((controllerSource.match(/@Post\('/g) || []).length, 10, 'all 10 POST routes remain intact');
assert.equal((controllerSource.match(/manualGate\.run\('/g) || []).length, 10);

const crawlerModule = await read('../src/crawler/crawler.module.ts');
const adminModule = await read('../src/admin/admin.module.ts');
for (const [name, source] of [['crawler.module.ts', crawlerModule], ['admin.module.ts', adminModule]]) {
  compile(source, name);
}
assert.match(crawlerModule, /AdminModule,/);
assert.match(crawlerModule, /CrawlerManualTriggerGate,/);
assert.match(adminModule, /exports:\s*\[AdminAccessGuard\]/);
console.log('Crawler manual P1 security: 10 JWT+admin routes, no anonymous trigger, single-flight, per-source cooldown, failure release: PASS');
