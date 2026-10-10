import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const folder = join(root, 'docs', 'incidents');
const index = readFileSync(join(root, 'docs', 'ERROR_KNOWLEDGE_BASE.md'), 'utf8');
const kinds = new Set(['BUG', 'ENV', 'TEST', 'TOOL']);
const statuses = new Set(['OPEN', 'IN_PROGRESS', 'FIXED_PENDING_VERIFICATION', 'VERIFIED', 'BLOCKED', 'PAUSED', 'REOPENED']);
const severities = new Set(['P0', 'P1', 'P2', 'P3']);
const filenames = readdirSync(folder).filter(n => /^FKI-\d{8}-\d{3}\.md$/.test(n));
assert.ok(filenames.length, 'No cases found');
const seen = new Set();
const required = ['现象', '复现', '根因及证据', '修复与变更', '验证与边界', '防复发', '关联资料'];
for (const filename of filenames) {
  const raw = readFileSync(join(folder, filename), 'utf8');
  const meta = Object.fromEntries([...raw.matchAll(/^(id|kind|severity|status|first_seen|last_reviewed|module):\s*(.*)$/gm)].map(m => [m[1], m[2].trim()]));
  assert.equal(meta.id, filename.slice(0, -3), `${filename}: invalid ID`);
  assert.ok(!seen.has(meta.id), `${filename}: duplicate ID`); seen.add(meta.id);
  assert.ok(kinds.has(meta.kind), `${filename}: bad kind`);
  assert.ok(severities.has(meta.severity), `${filename}: bad severity`);
  assert.ok(statuses.has(meta.status), `${filename}: bad status`);
  for (const k of ['first_seen', 'last_reviewed']) {
    assert.match(meta[k] ?? '', /^\d{4}-\d{2}-\d{2}$/, `${filename}: ${k} invalid`);
    assert.ok(Number.isFinite(Date.parse(meta[k])), `${filename}: ${k} not a date`);
  }
  assert.ok(meta.module?.length > 2, `${filename}: no module`);
  for (const h of required) assert.ok(raw.includes(`## ${h}`), `${filename}: missing ${h}`);
  const rows = index.split(/\r?\n/).filter(s => s.includes(`[${meta.id}](incidents/${filename})`));
  assert.equal(rows.length, 1, `${filename}: missing/duplicate index entry`);
  const cols = rows[0].split('|').map(s => s.trim());
  assert.equal(cols[3], meta.kind, `${filename}: kind mismatch`);
  assert.equal(cols[4], meta.severity, `${filename}: severity mismatch`);
  assert.equal(cols[5], meta.status, `${filename}: status mismatch`);
  for (const [, rel] of raw.matchAll(/\]\((\.\.?\/[^)#]+\.md)\)/g))
    assert.ok(existsSync(resolve(folder, rel)), `${filename}: broken link ${rel}`);
}
for (const [, filename] of index.matchAll(/\[FKI-\d{8}-\d{3}\]\(incidents\/(FKI-\d{8}-\d{3}\.md)\)/g))
  assert.ok(seen.has(filename.slice(0, -3)), `orphan index: ${filename}`);
console.log(`Incident knowledge PASS: ${filenames.length} cases, metadata, links`);
