/**
 * Opt-in Stage 6 Canvas Store stress + operation-cost test.
 *
 * Loads the actual desktopCanvas.ts through esbuild into Node with real
 * Vue/Pinia. Its localStorage and window objects are memory-only stubs.
 * It NEVER opens a Tauri window, reads a browser profile, contacts a backend,
 * or touches the user's Canvas v2 state.
 *
 * Timings measure synchronous Pinia store mutations, NOT painted UI latency.
 */
import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { createRequire, Module } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const { createPinia, setActivePinia } = require('pinia')
const { nextTick } = require('vue')
const STORAGE_KEY = 'flexikit-desktop-canvas-v2'
const iterations = Number(process.argv.find(value => value.startsWith('--iterations='))?.split('=')[1] ?? '20')

if (!Number.isSafeInteger(iterations) || iterations < 20 || iterations > 100) {
  throw new Error('Require 20..100 isolated test cycles')
}

const writes = []
const storage = new Map()
let simulatePersistFailure = false
const listeners = new Map()
const sandboxStorage = {
  getItem(key) { return storage.get(key) ?? null },
  setItem(key, value) {
    if (simulatePersistFailure && key === STORAGE_KEY) throw new Error('Simulated localStorage quota failure')
    writes.push(key); storage.set(key, String(value))
  },
  removeItem(key) { storage.delete(key) },
}
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: sandboxStorage })
Object.defineProperty(globalThis, 'window', { configurable: true, value: {
  addEventListener(type, listener) {
    const entries = listeners.get(type) ?? new Set()
    entries.add(listener)
    listeners.set(type, entries)
  },
  removeEventListener(type, listener) {
    listeners.get(type)?.delete(listener)
  },
}})
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const recordings = new Map()
function measure(name, operation) {
  const start = performance.now()
  const output = operation()
  const value = performance.now() - start
  const observations = recordings.get(name) ?? []
  observations.push(value)
  recordings.set(name, observations)
  return output
}
function percentile(items, amount) {
  const ordered = [...items].sort((a, b) => a - b)
  const idx = (ordered.length - 1) * amount / 100
  const lower = Math.floor(idx)
  const upper = Math.min(ordered.length - 1, lower + 1)
  return ordered[lower] + (ordered[upper] - ordered[lower]) * (idx - lower)
}
function stableSnapshot() {
  const raw = storage.get(STORAGE_KEY)
  assert.ok(raw, 'Canvas persistence must write a v2 record')
  const data = JSON.parse(raw)
  assert.equal(data.version, 2)
  assert.ok(Array.isArray(data.widgets) && Array.isArray(data.monitors))
  return data
}

// This is a source-code test: actual store logic with no stubs inside the
// store, and only two external framework packages kept unbundled.
const compiled = await build({
  entryPoints: [path.join(root, 'src', 'stores', 'desktopCanvas.ts')],
  bundle: true, write: false, platform: 'node', format: 'cjs', target: 'node20',
  alias: { '@': path.join(root, 'src') },
  external: ['vue', 'pinia'],
  logLevel: 'silent',
})
const storeModule = new Module(path.join(root, 'src', 'stores', 'stage6-canvas-harness.cjs'))
storeModule.filename = path.join(root, 'src', 'stores', 'stage6-canvas-harness.cjs')
storeModule.paths = Module._nodeModulePaths(path.dirname(storeModule.filename))
storeModule._compile(compiled.outputFiles[0].text, storeModule.filename)
const { useDesktopCanvasStore } = storeModule.exports
assert.equal(typeof useDesktopCanvasStore, 'function')

const pinia = createPinia()
setActivePinia(pinia)
const store = useDesktopCanvasStore()
store.init()
assert.equal(store.widgets.length, 5)
const monitor = { id: 'test-stage6-monitor', name: 'Synthetic display',
  x: 0, y: 0, width: 1920, height: 1080, scaleFactor: 1, isPrimary: true }
store.setMonitorTopology([monitor])
await nextTick()
await sleep(155)
let baseline = stableSnapshot()
assert.equal(baseline.widgets.length, 5)
assert.equal(baseline.monitors.length, 1)

let checks = 0
const cycleDurations = []
for (let cycle = 0; cycle < iterations; cycle++) {
  const began = performance.now()
  store.editMode = true
  const a = measure('addWidget', () => store.addWidget('clock',
    { title: 'Synthetic clock', frame: { width: 220, height: 160 } }))
  const b = measure('addWidget', () => store.addWidget('clock',
    { title: 'Synthetic secondary', frame: { width: 220, height: 160 } }))
  assert.notEqual(a.id, b.id)
  assert.equal(store.widgets.length, 7)

  measure('selectWidget', () => store.selectWidget(a.id))
  measure('selectWidget', () => store.selectWidget(b.id, true))
  measure('groupSelection', () => store.groupSelection())
  assert.ok(store.widgets.find(w => w.id === a.id).groupId)
  assert.equal(store.widgets.find(w => w.id === a.id).groupId,
    store.widgets.find(w => w.id === b.id).groupId)

  measure('ungroupSelection', () => store.ungroupSelection())
  assert.equal(store.widgets.find(w => w.id === a.id).groupId, null)
  measure('toggleLock', () => store.toggleLock(a.id))
  assert.equal(store.widgets.find(w => w.id === a.id).locked, true)
  const beforeBlocked = { ...store.widgets.find(w => w.id === a.id).frame }
  store.updateFrame(a.id, { x: beforeBlocked.x + 200 })
  assert.equal(store.widgets.find(w => w.id === a.id).frame.x, beforeBlocked.x)
  measure('toggleLock', () => store.toggleLock(a.id))
  assert.equal(store.widgets.find(w => w.id === a.id).locked, false)

  const initialStored = storage.get(STORAGE_KEY)
  store.beginFrameInteraction()
  const finalX = 60 + cycle * 20
  const finalY = 100 + cycle * 20
  for (let i = 0; i < 8; i++) {
    measure('updateFrame', () => store.updateFrame(a.id,
      { x: finalX + i, y: finalY + i, width: 240 + i, height: 160 + i }))
  }
  await nextTick()
  // The store explicitly suppresses persistence while the pointer is held.
  await sleep(145)
  assert.equal(storage.get(STORAGE_KEY), initialStored,
    'Pointer interaction must not repeatedly write layouts during movement')
  store.endFrameInteraction()
  await nextTick()
  await sleep(165)
  const persisted = stableSnapshot()
  const moved = persisted.widgets.find(widget => widget.id === a.id)
  assert.ok(moved, 'New synthetic widget not saved')
  assert.equal(moved.frame.x, finalX + 7)
  assert.equal(moved.frame.y, finalY + 7)
  checks += 2

  measure('removeWidget', () => store.removeWidget(a.id))
  measure('removeWidget', () => store.removeWidget(b.id))
  store.editMode = false
  await nextTick()
  await sleep(155)
  const final = stableSnapshot()
  assert.equal(final.widgets.length, baseline.widgets.length)
  assert.ok(!final.widgets.some(widget => widget.id === a.id || widget.id === b.id))
  checks += 3
  cycleDurations.push(performance.now() - began)
}
assert.equal(store.widgets.length, 5)
assert.ok(writes.length > 2)
assert.equal([...listeners.get('storage') ?? []].length, 1)


const beforeTemplate = stableSnapshot()
const firstTemplate = [
  { type: 'clock', options: { title: 'Template clock', frame: { x: 40, y: 80, width: 220, height: 160 } } },
  { type: 'tool-dock', options: { title: 'Template tools', frame: { x: 280, y: 80, width: 440, height: 280 }, config: { toolKeys: ['builtin:Example'] } } },
]
const backupKey = 'flexikit-desktop-canvas-v2-before-template'
store.applyTemplateLayout(firstTemplate)
assert.equal(store.widgets.length, 2)
assert.equal(store.templateBackupAvailable, true)
const copiedBackup = storage.get(backupKey)
assert.deepEqual(JSON.parse(copiedBackup), beforeTemplate)
store.applyTemplateLayout([{ type: 'tool-dock', options: { title: 'Alternative template', config: { toolKeys: [] } } }])
assert.equal(store.widgets.length, 1)
assert.equal(storage.get(backupKey), copiedBackup, 'Switching templates must retain the first complete backup')
assert.equal(store.restoreTemplateBackup(), true)
assert.equal(store.templateBackupAvailable, false)
assert.equal(storage.has(backupKey), false)
assert.deepEqual(stableSnapshot().monitors, beforeTemplate.monitors)
assert.deepEqual(stableSnapshot().widgets.map(item => ({ ...item, groupId: item.groupId ?? null })),
  beforeTemplate.widgets.map(item => ({ ...item, groupId: item.groupId ?? null })))
assert.equal(store.restoreTemplateBackup(), false)
checks += 9

// An explicit console layout application must roll back when persistence fails.
simulatePersistFailure = true
assert.throws(() => store.applyTemplateLayout(firstTemplate), /Simulated localStorage quota failure/)
simulatePersistFailure = false
assert.equal(store.widgets.length, beforeTemplate.widgets.length)
assert.equal(store.widgets.map(widget => widget.id).join(), beforeTemplate.widgets.map(widget => widget.id).join())
assert.deepEqual(stableSnapshot().monitors, beforeTemplate.monitors)
assert.deepEqual(stableSnapshot().widgets.map(item => ({ ...item, groupId: item.groupId ?? null })),
  beforeTemplate.widgets.map(item => ({ ...item, groupId: item.groupId ?? null })))
assert.equal(store.restoreTemplateBackup(), true)
checks += 4

// Reconstruct a fresh Pinia store using the same in-memory v2 layout.
// This tests the real initialization/migration read boundary, not just JSON.
pinia._e.stop()
const reload = createPinia()
setActivePinia(reload)
const reopened = useDesktopCanvasStore()
reopened.init()
assert.equal(reopened.widgets.length, 5)
assert.equal(reopened.monitors[0].id, monitor.id)
assert.equal(reopened.widgets.map(w => w.id).join(),
  stableSnapshot().widgets.map(w => w.id).join())
reload._e.stop()
assert.equal(listeners.get('storage')?.size ?? 0, 0)
checks += 4

const durations = Object.fromEntries([...recordings.entries()].map(([name, times]) => [
  name, { samples: times.length, p50_ms: Number(percentile(times, 50).toFixed(3)),
    p95_ms: Number(percentile(times, 95).toFixed(3)),
    max_ms: Number(Math.max(...times).toFixed(3)) },
]))
const result = {
  outcome: 'PASS', cycles: iterations, assertions: checks,
  persistence: 'memory-only localStorage stub; no browser/production profile touched',
  storeUnderTest: 'actual apps/web/src/stores/desktopCanvas.ts + Vue + Pinia',
  storageWrites: writes.length,
  noWritesDuringFrameInteraction: true,
  reloadRestoredWidgets: 5,
  operationCosts: durations,
  cycleDurationWithPersistenceTimers_ms: {
    p50: Number(percentile(cycleDurations, 50).toFixed(2)),
    p95: Number(percentile(cycleDurations, 95).toFixed(2)),
  },
  limitations: 'State mutations only; no DOM paint, pointer fidelity, WorkerW, native window/monitor, or real user data',
}
console.log(JSON.stringify(result))
