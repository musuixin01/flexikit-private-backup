import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import ts from 'typescript'

const read = name => readFileSync(path.resolve(process.cwd(), name), 'utf8')
const source = read('src/desktop/autoHideScrollbars.ts')
const css = read('src/styles/auto-hide-scrollbars.css')
const main = read('src/main.ts')
const dashboard = read('src/components/workspace/WorkspaceDashboard.vue')

assert.match(main, /if \(isDesktopRuntime\(\)\) \{\s*initAutoHideScrollbars\(\)/)
assert.match(main, /import '\.\/styles\/auto-hide-scrollbars\.css'/)
assert.match(css, /::-webkit-scrollbar-thumb/)
assert.match(css, /background: transparent !important/)
assert.match(css, /scrollbar-visible/)
assert.doesNotMatch(css, /scrollbar-width:\s*none|::-webkit-scrollbar\s*\{\s*display:\s*none/)
assert.match(dashboard, /scrollbar-width:none/)
assert.match(dashboard, /category-row::-webkit-scrollbar\{display:none\}/)

class Classes {
  values = new Set()
  add(name) { this.values.add(name) }
  remove(name) { this.values.delete(name) }
  contains(name) { return this.values.has(name) }
}
class ElementMock {
  classList = new Classes()
  parentElement = null
  scrollHeight = 0
  clientHeight = 0
  scrollWidth = 0
  clientWidth = 0
  rect = { left: 0, right: 200, top: 0, bottom: 300 }
  overflowX = 'hidden'
  overflowY = 'hidden'
  getBoundingClientRect() { return this.rect }
}
const root = new ElementMock()
const pane = new ElementMock()
const inner = new ElementMock()
pane.parentElement = root
inner.parentElement = pane
pane.scrollHeight = 800
pane.clientHeight = 300
pane.overflowY = 'auto'
const handlers = new Map()
const documentMock = {
  documentElement: root,
  scrollingElement: root,
  addEventListener(event, handler) { handlers.set(event, handler) },
  removeEventListener(event, handler) { assert.equal(handlers.get(event), handler); handlers.delete(event) },
}
const pending = new Map()
let nextId = 1
const sandbox = {
  exports: {},
  Element: ElementMock,
  document: documentMock,
  getComputedStyle: node => ({ overflowY: node.overflowY, overflowX: node.overflowX }),
  setTimeout: (callback, delay) => {
    assert.equal(delay, 1100)
    const id = nextId++
    pending.set(id, callback)
    return id
  },
  clearTimeout: id => pending.delete(id),
}
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText
vm.runInNewContext(js, sandbox)
const dispose = sandbox.exports.initAutoHideScrollbars()
assert.equal(root.classList.contains('auto-hide-scrollbars'), true)
assert.equal(pane.classList.contains('scrollbar-visible'), false)

handlers.get('scroll')({ target: pane })
assert.equal(pane.classList.contains('scrollbar-visible'), true)
assert.equal(pending.size, 1)
handlers.get('scroll')({ target: pane })
assert.equal(pending.size, 1, 'rapid scrolling refreshes timer without a leak')

for (const callback of pending.values()) callback()
pending.clear()
assert.equal(pane.classList.contains('scrollbar-visible'), false, 'thumb hides after idle')

handlers.get('pointermove')({ target: inner, pointerType: 'mouse', clientX: 191, clientY: 100 })
assert.equal(pane.classList.contains('scrollbar-visible'), true, 'edge hover reveals nested scroll thumb')
handlers.get('pointermove')({ target: inner, pointerType: 'touch', clientX: 191, clientY: 100 })
assert.equal(pending.size, 1, 'touch pointer does not cause extra hover timers')

for (const callback of pending.values()) callback()
pending.clear()
handlers.get('pointermove')({ target: inner, pointerType: 'mouse', clientX: 80, clientY: 100 })
assert.equal(pane.classList.contains('scrollbar-visible'), false, 'content-area idle stays hidden')

handlers.get('scroll')({ target: documentMock })
assert.equal(root.classList.contains('scrollbar-visible'), true, 'window/document scrolling reveals root thumb')
dispose()
assert.equal(handlers.size, 0)
assert.equal(pending.size, 0)
assert.equal(root.classList.contains('auto-hide-scrollbars'), false)
assert.equal(root.classList.contains('scrollbar-visible'), false)
console.log('Native scrollbar width/drag preserved, visual thumb auto-hidden: PASS')
console.log('Nested scroll, mouse edge hover, idle timeout, document scroll: PASS')
console.log('Desktop-only initialization and listener cleanup: PASS')
