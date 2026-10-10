/**
 * True NestJS loopback HTTP integration of the actual compiled crawler
 * controller, JwtAuthGuard, AdminAccessGuard, AdminAccessService and gate.
 *
 * Requires an isolated installed backend dependency tree and compiled dist.
 * Uses test-only JWTs, fake repository and fake crawler implementations.
 * No real PostgreSQL, Redis, crawling, production credentials or profile.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { Test } = require('@nestjs/testing');
const { ForbiddenException } = require('@nestjs/common');
const { ConfigService } = require('@nestjs/config');
const { PassportModule, PassportStrategy } = require('@nestjs/passport');
const { Strategy, ExtractJwt } = require('passport-jwt');
const { getRepositoryToken } = require('@nestjs/typeorm');
const { sign } = require('jsonwebtoken');
const { CrawlerController } = require('../dist/crawler/crawler.controller.js');
const { CrawlerManualTriggerGate } = require('../dist/crawler/crawler-manual-trigger.gate.js');
const { AdminAccessService } = require('../dist/admin/admin-access.service.js');
const { AdminAccessGuard } = require('../dist/admin/admin-access.guard.js');
const { User } = require('../dist/users/user.entity.js');

const sources = [
  ['v2ex', 'V2exCrawlerService', 'v2ex.crawler.service'],
  ['appinn', 'AppinnCrawlerService', 'appinn.crawler.service'],
  ['iplaysoft', 'IplaysoftCrawlerService', 'iplaysoft.crawler.service'],
  ['producthunt', 'ProducthuntCrawlerService', 'producthunt.crawler.service'],
  ['juejin', 'JuejinCrawlerService', 'juejin.crawler.service'],
  ['sspai', 'SspaiCrawlerService', 'sspai.crawler.service'],
  ['apprcn', 'ApprcnCrawlerService', 'apprcn.crawler.service'],
  ['ifanr', 'IfanrCrawlerService', 'ifanr.crawler.service'],
  ['36kr', 'Kr36CrawlerService', '36kr.crawler.service'],
  ['oschina', 'OschinaCrawlerService', 'oschina.crawler.service'],
];

const TEST_SECRET = 'stage6-temporary-loopback-only-key-for-jwt';
const users = new Map([
  [101, { id: 101, username: 'isolation-admin', role: 'admin', status: 'active' }],
  [102, { id: 102, username: 'isolation-user', role: 'user', status: 'active' }],
  [103, { id: 103, username: 'isolation-disabled', role: 'admin', status: 'suspended' }],
]);
const tokens = new Map([...users.keys()].map(id => [
  id, sign({ sub: id, username: users.get(id).username }, TEST_SECRET, { expiresIn: '5m' }),
]));
class IsolationJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: TEST_SECRET });
  }
  async validate(payload) {
    return { userId: payload.sub, username: payload.username };
  }
}
const counts = new Map();
let releaseHold = null;
let markStarted = null;
let holdAppinn = false;
const appinnStarted = () => new Promise(resolve => { markStarted = resolve; });

const providers = [
  IsolationJwtStrategy,
  CrawlerManualTriggerGate,
  AdminAccessService,
  AdminAccessGuard,
  { provide: ConfigService, useValue: { get(key) { return key === 'ADMIN_USER_IDS' ? '' : undefined; } } },
  { provide: getRepositoryToken(User), useValue: {
    async findOne({ where }) { return users.get(where.id) ?? null; }
  } },
  ...sources.map(([source, exported, filename]) => {
    const token = require(`../dist/crawler/${filename}.js`)[exported];
    return { provide: token, useValue: {
      async crawl() {
        counts.set(source, (counts.get(source) ?? 0) + 1);
        if (source === 'appinn' && holdAppinn) {
          markStarted?.();
          await new Promise(resolve => { releaseHold = resolve; });
          holdAppinn = false;
        }
        return 2;
      }
    } };
  })
];

const testModule = await Test.createTestingModule({
  imports: [PassportModule],
  controllers: [CrawlerController],
  providers,
}).compile();
const app = testModule.createNestApplication({ logger: false });
let origin = null;
try {
  await app.listen(0, '127.0.0.1');
  const port = app.getHttpServer().address().port;
  origin = `http://127.0.0.1:${port}`;
  const post = async (source, token) => {
    const response = await fetch(origin + '/crawler/' + source, {
      method: 'POST',
      headers: token ? { authorization: 'Bearer ' + token } : {},
      signal: AbortSignal.timeout(5000),
    });
    return { status: response.status, body: await response.json() };
  };

  let response = await post('v2ex');
  assert.equal(response.status, 401, 'anonymous cannot run crawler');
  response = await post('v2ex', 'invalid');
  assert.equal(response.status, 401, 'invalid signature/token cannot run crawler');
  response = await post('v2ex', tokens.get(102));
  assert.equal(response.status, 403, 'non-admin cannot run crawler');
  response = await post('v2ex', tokens.get(103));
  assert.equal(response.status, 403, 'disabled admin cannot run crawler');
  assert.equal(counts.size, 0, 'denied requests cannot invoke crawlers');

  response = await post('v2ex', tokens.get(101));
  assert.equal(response.status, 201, 'admin can run crawl');
  assert.equal(response.body.newTools, 2);
  response = await post('v2ex', tokens.get(101));
  assert.equal(response.status, 429, 'repeated same source is rate limited');
  assert.equal(counts.get('v2ex'), 1);

  holdAppinn = true;
  const started = appinnStarted();
  const activeRequest = post('appinn', tokens.get(101));
  await Promise.race([started, new Promise((_, reject) => setTimeout(() => reject(new Error('crawl did not start')), 3000))]);
  response = await post('iplaysoft', tokens.get(101));
  assert.equal(response.status, 429, 'different source cannot run during active manual crawl');
  assert.equal(counts.get('iplaysoft'), undefined);
  releaseHold();
  response = await activeRequest;
  assert.equal(response.status, 201);
  response = await post('iplaysoft', tokens.get(101));
  assert.equal(response.status, 201, 'lock released after completed crawl');

  for (const [source] of sources) {
    if (['v2ex', 'appinn', 'iplaysoft'].includes(source)) continue;
    response = await post(source, tokens.get(101));
    assert.equal(response.status, 201, `${source} route remains available to admin`);
    assert.equal(response.body.newTools, 2);
  }

  assert.equal(sources.length, 10);
  assert.equal([...counts.values()].reduce((a,b)=>a+b,0), 10);
  console.log('ISOLATED NEST HTTP PASS: 10 routes, 401 anon/invalid, 403 user/disabled admin, 201 admin, 429 duplicate and overlapping crawl');
} finally {
  if (releaseHold) releaseHold();
  await app.close();
}
