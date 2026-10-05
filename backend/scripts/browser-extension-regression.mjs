import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { plainToInstance } = require('class-transformer');
const { validate } = require('class-validator');
const {
  AUTH_CLIENT_TYPES,
  normalizeAuthClientContext,
} = require('../dist/auth/auth-client-context.js');
const { LoginDto } = require('../dist/auth/dto/login.dto.js');
const { normalizeToolUrl } = require('../dist/tools/tool-url.util.js');
const { ToolsService } = require('../dist/tools/tools.service.js');
const {
  isCorsOriginAllowed,
  parseCorsOriginList,
} = require('../dist/common/security/cors-origin-policy.js');

assert.ok(AUTH_CLIENT_TYPES.includes('extension'));

const instanceId = randomUUID();
assert.deepEqual(
  normalizeAuthClientContext({
    client_type: 'extension',
    client_instance_id: instanceId,
    client_name: '  FlexiKit Browser Companion  ',
  }),
  {
    clientType: 'extension',
    clientInstanceId: instanceId,
    clientName: 'FlexiKit Browser Companion',
  },
);

const login = plainToInstance(LoginDto, {
  username: 'extension_user',
  password: 'secret1',
  client_type: 'extension',
  client_instance_id: instanceId,
  client_name: 'FlexiKit Browser Companion',
});
assert.equal((await validate(login)).length, 0);

assert.equal(
  normalizeToolUrl('https://Example.com/path/?utm_source=test&b=2&a=1#section'),
  'https://example.com/path?a=1&b=2',
);
assert.equal(normalizeToolUrl('ftp://example.com/file'), null);
const allowedOrigins = new Set(parseCorsOriginList(
  ' https://flexikit.app , chrome-extension://abcdefghijklmnopabcdefghijklmnop ',
));
assert.equal(isCorsOriginAllowed(undefined, allowedOrigins, false), true);
assert.equal(isCorsOriginAllowed('https://flexikit.app', allowedOrigins, false), true);
assert.equal(
  isCorsOriginAllowed('chrome-extension://abcdefghijklmnopabcdefghijklmnop', allowedOrigins, false),
  true,
);
assert.equal(
  isCorsOriginAllowed('chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba', allowedOrigins, false),
  false,
);
assert.equal(
  isCorsOriginAllowed('chrome-extension://ponmlkjihgfedcbaponmlkjihgfedcba', allowedOrigins, true),
  true,
);
assert.equal(isCorsOriginAllowed('chrome-extension://invalid', allowedOrigins, true), false);
assert.equal(typeof ToolsService.prototype.findDuplicateByUrl, 'function');

class FakeQueryBuilder {
  constructor(items) {
    this.items = items;
  }
  where() { return this; }
  andWhere() { return this; }
  orderBy() { return this; }
  getMany() { return Promise.resolve(this.items); }
}

const repository = {
  candidates: [
    {
      id: 1,
      user_id: null,
      name: 'Public Example',
      url: 'https://example.com/path?a=1&b=2',
      local_path: null,
    },
    {
      id: 2,
      user_id: 42,
      name: 'My Example',
      url: 'https://example.com/path/?b=2&utm_source=legacy&a=1#old',
      local_path: null,
    },
  ],
  createQueryBuilder() {
    return new FakeQueryBuilder(this.candidates);
  },
  create(value) {
    return { ...value };
  },
  async save(value) {
    return { id: 99, ...value };
  },
};

const toolsService = new ToolsService(repository);
const duplicate = await toolsService.findDuplicateByUrl(
  'https://EXAMPLE.com/path?utm_medium=test&a=1&b=2#new',
  42,
);
assert.equal(duplicate?.id, 2);

await assert.rejects(
  () => toolsService.create({
    name: 'Duplicate',
    url: 'https://example.com/path?b=2&a=1&utm_campaign=x',
    description: '',
    tags: [],
    category: '效率工具',
  }, 42),
  error => typeof error?.message === 'string' && error.message.includes('已在工具箱中'),
);

repository.candidates = [];
const created = await toolsService.create({
  name: 'Fresh',
  url: 'https://example.com/fresh/?utm_source=x&b=2&a=1#section',
  description: '',
  tags: [],
  category: '效率工具',
}, 42);
assert.equal(created.url, 'https://example.com/fresh?a=1&b=2');

console.log('extension auth client type: PASS');
console.log('extension login DTO validation: PASS');
console.log('extension CORS origin policy: PASS');
console.log('tool URL canonicalization: PASS');
console.log('duplicate URL detection/create guard: PASS');
console.log('Browser Companion backend regression: PASS');
