/**
 * Opt-in, TEMP-CLUSTER-ONLY real PostgreSQL verification for Browser Companion.
 *
 * Does not read project .env or user data. Refuses any database connection
 * outside a fresh flexikit-stage6-pg-... PostgreSQL data directory.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { Client } = require('pg');
const { DataSource, EntitySchema } = require('typeorm');
const { JwtService } = require('@nestjs/jwt');

if (process.env.FLEXIKIT_STAGE6_TEMP_PG !== 'isolated-test-only') {
  throw new Error('Only explicitly authorized TEMP PostgreSQL test cluster is supported');
}
const dataDir = process.env.FLEXIKIT_STAGE6_PG_DATA || '';
const port = Number(process.env.FLEXIKIT_STAGE6_PG_PORT);
if (!/[\\/]flexikit-stage6-pg-[a-f0-9]{32}[\\/]data$/i.test(dataDir)
  || !Number.isInteger(port) || port < 1024 || port > 65535
  || !process.env.FLEXIKIT_STAGE6_PG_PASSWORD) {
  throw new Error('Missing or invalid isolated PostgreSQL test configuration');
}
const connection = {
  host: '127.0.0.1', port, database: 'postgres',
  user: 'stage6_test', password: process.env.FLEXIKIT_STAGE6_PG_PASSWORD,
  connectionTimeoutMillis: 3000,
};
const native = new Client(connection);
const normalize = value => value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

const { AddRefreshSessions1790298000000 } = require('../dist/migration/1790298000000-AddRefreshSessions.js');
const { AddRefreshSessionClientContext1790299800000 } = require('../dist/migration/1790299800000-AddRefreshSessionClientContext.js');
const { AddExtensionPairings1791600000000 } = require('../dist/migration/1791600000000-AddExtensionPairings.js');
const { ExtensionPairingService } = require('../dist/auth/extension-pairing.service.js');
const { AuthService } = require('../dist/auth/auth.service.js');
const { ExtensionPairing } = require('../dist/auth/extension-pairing.entity.js');
const { RefreshSession } = require('../dist/auth/refresh-session.entity.js');
const { User } = require('../dist/users/user.entity.js');

const userSchema = new EntitySchema({
  name: 'Stage6User', target: User, tableName: 'users',
  columns: {
    id: { type: 'integer', primary: true },
    username: { type: 'varchar', length: 50 },
    email: { type: 'varchar', length: 100 },
    password_hash: { type: 'text' },
    displayName: { type: 'varchar', length: 100, name: 'display_name', nullable: true },
    avatar: { type: 'text', nullable: true },
    avatarType: { type: 'varchar', length: 20, name: 'avatar_type', nullable: true },
    role: { type: 'varchar', length: 16 },
    status: { type: 'varchar', length: 16 },
    created_at: { type: 'timestamptz' },
  },
});
const refreshSchema = new EntitySchema({
  name: 'Stage6RefreshSession', target: RefreshSession, tableName: 'refresh_sessions',
  columns: {
    id: { type: 'uuid', primary: true }, user_id: { type: 'integer' },
    tokenHash: { type: 'varchar', length: 64, name: 'token_hash' },
    clientType: { type: 'varchar', length: 16, name: 'client_type' },
    clientInstanceId: { type: 'uuid', name: 'client_instance_id', nullable: true },
    clientName: { type: 'varchar', length: 80, name: 'client_name', nullable: true },
    expiresAt: { type: 'timestamptz', name: 'expires_at' },
    revokedAt: { type: 'timestamptz', name: 'revoked_at', nullable: true },
    lastUsedAt: { type: 'timestamptz', name: 'last_used_at', nullable: true },
    createdAt: { type: 'timestamptz', name: 'created_at' },
    updatedAt: { type: 'timestamptz', name: 'updated_at' },
  },
});
const pairSchema = new EntitySchema({
  name: 'Stage6ExtensionPairing', target: ExtensionPairing, tableName: 'extension_pairings',
  columns: {
    code: { type: 'varchar', length: 10, primary: true },
    clientInstanceId: { type: 'uuid', name: 'client_instance_id' },
    verifierHash: { type: 'varchar', length: 64, name: 'verifier_hash' },
    expiresAt: { type: 'timestamptz', name: 'expires_at' },
    approvedUserId: { type: 'integer', name: 'approved_user_id', nullable: true },
    consumedAt: { type: 'timestamptz', name: 'consumed_at', nullable: true },
    failedClaims: { type: 'integer', name: 'failed_claims' },
    createdAt: { type: 'timestamptz', name: 'created_at' },
  },
});
let ds;
await native.connect();
try {
  const { rows: [{ data_directory: actualDir }] } = await native.query('SHOW data_directory');
  if (normalize(actualDir) !== normalize(dataDir)) {
    throw new Error('REFUSED: data_directory mismatch; cannot access preexisting PostgreSQL cluster');
  }
  assert.match(normalize(actualDir), /flexikit-stage6-pg-[a-f0-9]{32}\/data$/);
  assert.equal((await native.query('SELECT current_user AS name')).rows[0].name, 'stage6_test');

  // Minimal fixture for FKs; all tables in this database are synthetic.
  await native.query(`CREATE TABLE "users"(
    id integer PRIMARY KEY,
    username varchar(50) NOT NULL,
    email varchar(100) NOT NULL,
    password_hash text NOT NULL,
    display_name varchar(100),
    avatar text,
    avatar_type varchar(20),
    role varchar(16) NOT NULL DEFAULT 'user',
    status varchar(16) NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now()
  )`);
  await native.query(`INSERT INTO users(id,username,email,password_hash,role,status)
   VALUES (1,'stage6-user','isolated@example.test','synthetic-only','user','active')`);

  const runner = { query: (sql, params) => native.query(sql, params) };
  const refreshMigration = new AddRefreshSessions1790298000000();
  const contextMigration = new AddRefreshSessionClientContext1790299800000();
  const pairMigration = new AddExtensionPairings1791600000000();
  await refreshMigration.up(runner);
  await contextMigration.up(runner);
  await pairMigration.up(runner);
  const schema = await native.query(`SELECT column_name FROM information_schema.columns WHERE table_name='extension_pairings'`);
  assert.equal(schema.rows.length, 8);
  const indexes = await native.query(`SELECT indexname FROM pg_indexes WHERE tablename='extension_pairings'`);
  assert.equal(indexes.rows.length, 3);
  await assert.rejects(native.query(`INSERT INTO extension_pairings(code,client_instance_id,verifier_hash,expires_at,approved_user_id)
    VALUES ('ABCDEFGHIJ',$1,$2,now()+interval '5 minutes',9999)`,
    [randomUUID(), '0'.repeat(64)]), error => error.code === '23503');
  const userRepo = () => ds.getRepository(User);
  ds = new DataSource({
    type: 'postgres', ...connection, username: connection.user,
    entities: [userSchema, refreshSchema, pairSchema],
    synchronize: false, migrationsRun: false, logging: false,
    extra: { max: 8 },
  });
  await ds.initialize();

  const users = { findOne: id => userRepo().findOne({ where: { id } }) };
  const auth = new AuthService(
    users,
    new JwtService({ secret: 'stage6-test-secret-only' }),
    { get: key => key === 'ACCESS_TOKEN_TTL' ? '15m' : key === 'REFRESH_TOKEN_TTL' ? '30d' : undefined },
    ds.getRepository(RefreshSession),
    ds,
  );
  const pairing = new ExtensionPairingService(ds.getRepository(ExtensionPairing), ds, users, auth);
  const verifier = randomBytes(32).toString('base64url');
  const device = randomUUID();
  const begin = await pairing.start({ client_instance_id: device, verifier }, '127.0.0.1');
  assert.match(begin.code, /^[A-HJ-NP-Z2-9]{10}$/);
  assert.equal((await pairing.complete({ code: begin.code, client_instance_id: device, verifier })).status, 'pending');
  const approvals = await Promise.allSettled(Array.from({ length: 2 }, () => pairing.approve(begin.code, 1)));
  assert.equal(approvals.filter(item => item.status === 'fulfilled').length, 1,
    'real PostgreSQL write lock must allow only one approve');
  assert.equal(approvals.filter(item => item.status === 'rejected').length, 1);

  // Real PostgreSQL pessimistic_write row locks serialize two independent transactions.
  const requests = await Promise.allSettled(Array.from({ length: 2 }, () =>
    pairing.complete({ code: begin.code, client_instance_id: device, verifier })
  ));
  assert.equal(requests.filter(item => item.status === 'fulfilled').length, 1);
  assert.equal(requests.filter(item => item.status === 'rejected').length, 1);
  const result = requests.find(item => item.status === 'fulfilled').value;
  assert.equal(result.status, 'connected');
  assert.equal(result.auth.client_type, 'extension');
  assert.equal(result.auth.client_instance_id, device);
  const sessions = await native.query('SELECT user_id, client_type, client_instance_id FROM refresh_sessions');
  assert.equal(sessions.rows.length, 1, 'only ONE refresh session may be issued');
  assert.equal(sessions.rows[0].client_type, 'extension');
  assert.equal(sessions.rows[0].client_instance_id, device);
  const claimed = await native.query('SELECT consumed_at FROM extension_pairings WHERE code=$1', [begin.code]);
  assert.ok(claimed.rows[0].consumed_at);

  // Malformed device secret never creates another session.
  const second = await pairing.start({ client_instance_id: device, verifier }, '127.0.0.2');
  for (let i = 0; i < 5; i++) {
    await assert.rejects(pairing.complete({ code: second.code, client_instance_id: device,
      verifier: randomBytes(32).toString('base64url') }));
  }
  const locked = await native.query('SELECT failed_claims,expires_at FROM extension_pairings WHERE code=$1',[second.code]);
  assert.equal(locked.rows[0].failed_claims, 5);
  assert.ok(locked.rows[0].expires_at.getTime() <= Date.now());

  // If session minting fails after the pairing row was marked consumed,
  // PostgreSQL must roll back both the claim and any session side effects.
  const retryVerifier = randomBytes(32).toString('base64url');
  const retryDevice = randomUUID();
  const rollbackPair = await pairing.start({ client_instance_id: retryDevice,
    verifier: retryVerifier }, '127.0.0.3');
  await pairing.approve(rollbackPair.code, 1);
  const failSigning = new ExtensionPairingService(ds.getRepository(ExtensionPairing), ds,
    users, { async login() { throw new Error('synthetic session-signing failure'); } });
  await assert.rejects(failSigning.complete({ code: rollbackPair.code,
    client_instance_id: retryDevice, verifier: retryVerifier }), /synthetic session-signing failure/);
  const failedClaim = await native.query('SELECT consumed_at FROM extension_pairings WHERE code=$1', [rollbackPair.code]);
  assert.equal(failedClaim.rows[0].consumed_at, null, 'claim flag must roll back with session error');
  assert.equal((await native.query('SELECT count(*)::int AS n FROM refresh_sessions')).rows[0].n, 1);
  const recovered = await pairing.complete({ code: rollbackPair.code,
    client_instance_id: retryDevice, verifier: retryVerifier });
  assert.equal(recovered.status, 'connected', 'failed atomic exchange must be retryable');
  assert.equal((await native.query('SELECT count(*)::int AS n FROM refresh_sessions')).rows[0].n, 2);

  await ds.destroy();
  ds = undefined;
  await pairMigration.down(runner);
  const remains = await native.query(`SELECT to_regclass('public.extension_pairings') AS pair_table`);
  assert.equal(remains.rows[0].pair_table, null);
  await contextMigration.down(runner);
  await refreshMigration.down(runner);
  await native.query('DROP TABLE users');
  console.log('REAL TEMP POSTGRES PASS: exact migrations up/down, FK/indexes, concurrent approve/claim locks, one-time session, verifier lockout, rollback and retry');
} finally {
  if (ds?.isInitialized) await ds.destroy();
  await native.end();
}
