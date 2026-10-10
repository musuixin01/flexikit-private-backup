import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { randomBytes, randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
const ts = (() => { try { return require('typescript'); } catch { return require('../../apps/web/node_modules/typescript'); } })();
function transpile(source, file) {
  const transpiled = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      experimentalDecorators: true,
      emitDecoratorMetadata: false,
    }
  });
  assert.equal((transpiled.diagnostics || []).filter(v => v.category === ts.DiagnosticCategory.Error).length,
    0, `Syntax errors in ${file}`);
  return transpiled.outputText;
}
async function read(relative) {
  return readFile(new URL(relative, import.meta.url), 'utf8');
}
function loadCommonJs(source, file, stubs) {
  const module = { exports: {} };
  runInNewContext(transpile(source, file), {
    exports: module.exports,
    module,
    require(id) {
      if (Object.hasOwn(stubs, id)) return stubs[id];
      if (id.startsWith('node:')) return require(id);
      throw new Error(`Unmocked dependency ${id}`);
    },
    Buffer,
    Date,
  }, { filename: file, timeout: 2500 });
  return module.exports;
}

for (const path of [
  '../src/auth/extension-pairing.entity.ts',
  '../src/auth/dto/extension-pair.dto.ts',
  '../src/auth/extension-pairing.controller.ts',
  '../src/auth/auth.module.ts',
  '../src/auth/auth.service.ts',
  '../src/migration/1791600000000-AddExtensionPairings.ts'
]) {
  transpile(await read(path), path);
}

const lifecycleSource = await read('../src/auth/extension-pair-lifecycle.ts');
const lifecycle = loadCommonJs(lifecycleSource, 'extension-pair-lifecycle.ts', {});
assert.equal(lifecycle.EXTENSION_PAIR_TTL_MS, 300000);
for (let i = 0; i < 250; i++) {
  const code = lifecycle.generateExtensionPairCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{10}$/);
}
const verifier = randomBytes(32).toString('base64url');
assert.equal(verifier.length, 43);
const hashed = lifecycle.extensionPairVerifierHash(verifier);
assert.equal(lifecycle.matchesExtensionPairVerifier(verifier, hashed), true);
assert.equal(lifecycle.matchesExtensionPairVerifier(randomBytes(32).toString('base64url'), hashed), false);

class FakeHttpError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
const decorate = () => target => target;
class PairEntity {}
class UserEntity {}
const common = {
  Injectable: decorate,
  ConflictException: FakeHttpError,
  GoneException: FakeHttpError,
  UnauthorizedException: FakeHttpError,
  ServiceUnavailableException: FakeHttpError,
  HttpException: FakeHttpError,
  HttpStatus: { TOO_MANY_REQUESTS: 429 },
};
const typeorm = {
  IsNull: () => ({ isNull: true }),
  MoreThan: value => ({ greaterThan: value }),
};
const serviceSource = await read('../src/auth/extension-pairing.service.ts');
const { ExtensionPairingService } = loadCommonJs(serviceSource, 'extension-pairing.service.ts', {
  '@nestjs/common': common,
  '@nestjs/typeorm': { InjectRepository: decorate },
  typeorm,
  './extension-pairing.entity': { ExtensionPairing: PairEntity },
  '../users/user.entity': { User: UserEntity },
  './extension-pair-lifecycle': lifecycle,
});
const codeRows = new Map();
const fakeRepo = {
  create: record => ({ ...record }),
  async save(record) { codeRows.set(record.code, record); return record; },
  async exist({ where }) { return codeRows.has(where.code); },
  async findOne({ where }) { return codeRows.get(where.code) || null; },
  async count({ where }) {
    return [...codeRows.values()].filter(pair =>
      (!where?.clientInstanceId || pair.clientInstanceId === where.clientInstanceId)
      && (!where?.expiresAt || pair.expiresAt > where.expiresAt.greaterThan)
      && (!where?.consumedAt || pair.consumedAt === null)).length;
  },
  createQueryBuilder() {
    return {
      delete() { return this; },
      where() { return this; },
      async execute() {
        for (const [key, value] of codeRows) {
          if (value.expiresAt.getTime() <= Date.now()) codeRows.delete(key);
        }
      },
    };
  }
};
const user = { id: 3, username: 'testuser', status: 'active', password_hash: 'PRIVATE-USER-HASH' };
let sessionCount = 0;
const manager = {
  getRepository(klass) {
    if (klass === PairEntity) return fakeRepo;
    if (klass === UserEntity) return { async findOne({ where }) { return where.id === user.id ? user : null; } };
    throw Error('Unrecognized entity');
  }
};
const service = new ExtensionPairingService(fakeRepo, {
  async transaction(callback) { return callback(manager); }
}, { async findOne(id) { return id === user.id ? user : null; } }, {
  async login(principal, context, transactionManager) {
    assert.equal(principal.password_hash, undefined, 'pair must not expose password hash');
    assert.equal(principal.username, user.username);
    assert.equal(context.clientType, 'extension');
    assert.equal(context.clientInstanceId, device);
    assert.equal(transactionManager, manager, 'new device session must use same database transaction');
    sessionCount++;
    return { access_token: 'issued-extension-access', refresh_token: 'issued-extension-refresh',
      expires_at: '2999-01-01T00:00:00Z', refresh_expires_at: '2999-01-01T00:00:00Z' };
  }
});
const device = randomUUID();
const first = await service.start({ client_instance_id: device, verifier }, 'ip-1');
assert.match(first.code, /^[A-HJ-NP-Z2-9]{10}$/);
assert.equal((await service.complete({ code: first.code, verifier, client_instance_id: device })).status, 'pending');
await assert.rejects(service.complete({ code: first.code,
  verifier: randomBytes(32).toString('base64url'), client_instance_id: device }), /配对设备不匹配/);
assert.equal(codeRows.get(first.code).failedClaims, 1);
assert.equal((await service.approve(first.code, user.id)).paired, true);
await assert.rejects(service.approve(first.code, user.id), /配对码已确认/);
const connected = await service.complete({ code: first.code, verifier, client_instance_id: device });
assert.equal(connected.status, 'connected');
assert.equal(connected.auth.access_token, 'issued-extension-access');
assert.equal(sessionCount, 1);
await assert.rejects(service.complete({ code: first.code, verifier, client_instance_id: device }), /配对码已失效/);
const second = await service.start({ client_instance_id: device, verifier }, 'ip-2');
for (let i = 0; i < 5; i++) {
  await assert.rejects(service.complete({ code: second.code,
    verifier: randomBytes(32).toString('base64url'), client_instance_id: device }), /配对设备不匹配/);
}
await assert.rejects(service.approve(second.code, user.id), /配对码不存在或已失效/);
const expired = await service.start({ client_instance_id: randomUUID(), verifier }, 'ip-3');
codeRows.get(expired.code).expiresAt = new Date(0);
await assert.rejects(service.approve(expired.code, user.id), /配对码不存在或已失效/);
const limitedService = new ExtensionPairingService(fakeRepo, { async transaction(fn) { return fn(manager); } },
  { async findOne() { return user; } }, { async login() { throw Error('unexpected'); } });
for (let n = 0; n < 8; n++) {
  await limitedService.start({ client_instance_id: randomUUID(), verifier }, 'repeat-ip');
}
await assert.rejects(
  limitedService.start({ client_instance_id: randomUUID(), verifier }, 'repeat-ip'),
  error => error.status === 429
);
console.log('Pairing code entropy / SHA256 verifier / pending / approve / one-time claim / brute-force lockout / quota: PASS');
