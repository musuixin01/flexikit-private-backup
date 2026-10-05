import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const {
  normalizeAuthClientContext,
} = require('../dist/auth/auth-client-context.js');
const { LoginDto } = require('../dist/auth/dto/login.dto.js');
const { RegisterDto } = require('../dist/auth/dto/register.dto.js');

const legacy = normalizeAuthClientContext({});
assert.deepEqual(legacy, {
  clientType: 'unknown',
  clientInstanceId: null,
  clientName: null,
});

const desktopId = randomUUID();
const desktop = normalizeAuthClientContext({
  client_type: 'desktop',
  client_instance_id: desktopId,
  client_name: '  FlexiKit Desktop  ',
});
assert.deepEqual(desktop, {
  clientType: 'desktop',
  clientInstanceId: desktopId,
  clientName: 'FlexiKit Desktop',
});

const extensionId = randomUUID();
const extension = normalizeAuthClientContext({
  client_type: 'extension',
  client_instance_id: extensionId,
  client_name: '  FlexiKit Browser Companion  ',
});
assert.deepEqual(extension, {
  clientType: 'extension',
  clientInstanceId: extensionId,
  clientName: 'FlexiKit Browser Companion',
});

const extensionLogin = plainToInstance(LoginDto, {
  username: 'browser_companion_user',
  password: 'secret1',
  client_type: 'extension',
  client_instance_id: extensionId,
  client_name: 'FlexiKit Browser Companion',
});
assert.equal((await validate(extensionLogin)).length, 0);

const validLogin = plainToInstance(LoginDto, {
  username: 'multi_client_user',
  password: 'secret1',
  client_type: 'web',
  client_instance_id: randomUUID(),
  client_name: 'FlexiKit Web',
});
assert.equal((await validate(validLogin)).length, 0);

const invalidLogin = plainToInstance(LoginDto, {
  username: 'multi_client_user',
  password: 'secret1',
  client_type: 'server',
  client_instance_id: 'not-a-uuid',
  client_name: 'x'.repeat(81),
});
const invalidLoginErrors = await validate(invalidLogin);
assert.ok(invalidLoginErrors.some(error => error.property === 'client_type'));
assert.ok(invalidLoginErrors.some(error => error.property === 'client_instance_id'));
assert.ok(invalidLoginErrors.some(error => error.property === 'client_name'));

const legacyRegister = plainToInstance(RegisterDto, {
  username: 'legacy_user',
  email: 'legacy@example.com',
  password: 'secret1',
});
assert.equal((await validate(legacyRegister)).length, 0);

console.log('legacy clients normalize to unknown metadata: PASS');
console.log('desktop/web/extension client context normalization: PASS');
console.log('client type/UUID/name DTO validation: PASS');
console.log('login/register client context remains optional: PASS');
console.log('S4.2 multi-client strategy regression: PASS');
