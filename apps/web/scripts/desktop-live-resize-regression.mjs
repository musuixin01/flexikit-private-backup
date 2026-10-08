import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const read = filename => readFileSync(path.join(process.cwd(), filename), 'utf8')
const app = read('src/App.vue')
const main = read('src/main.ts')
const ui = read('src/stores/ui.ts')
const css = read('src/styles/desktop-resize.css')
const native = read('../desktop/src-tauri/src/main.rs')
const config = JSON.parse(read('../desktop/src-tauri/tauri.conf.json'))

const mainWindow = config.app.windows.find(window => window.label === 'main')
const petWindow = config.app.windows.find(window => window.label === 'pet')
const canvasWindow = config.app.windows.find(window => window.label === 'canvas')
assert.equal(mainWindow.transparent, false)
assert.equal(mainWindow.shadow, false)
// Native shadow is disabled to avoid the Windows frameless border/compositor mismatch.
assert.equal(petWindow.transparent, true)
assert.equal(canvasWindow.transparent, true)

assert.match(main, /import '\.\/styles\/desktop-resize\.css'/)
assert.match(app, /handleDesktopLiveResize/)
assert.match(app, /window\.addEventListener\('resize', handleDesktopLiveResize/)
assert.match(app, /window\.removeEventListener\('resize', handleDesktopLiveResize/)
assert.match(app, /desktop-main-window/)
assert.match(app, /!isPetWindow\.value && !isCanvasWindow\.value/)
assert.match(app, /window\.clearTimeout\(resizeIdleTimer\)/)
assert.match(app, /}, 160\)/)

assert.match(css, /html\.desktop-main-window body/)
assert.match(css, /html\.desktop-main-window #app/)
assert.match(css, /var\(--bg-primary, #f4f7fb\)/)
assert.match(css, /html\.desktop-live-resize \.bg-layer::after/)
assert.match(css, /html\.desktop-live-resize \.dashboard-hero/)
assert.match(css, /backdrop-filter: none !important/)
assert.doesNotMatch(css, /^html,\s*body,\s*#app/m)

assert.match(ui, /set_main_window_background_color/)
assert.match(ui, /color: canvas/)
assert.match(ui, /!location\.hash\.startsWith\('#\/pet'\)/)
assert.match(native, /fn set_main_window_background_color/)
assert.match(native, /value\.len\(\) == 6/)
assert.match(native, /set_background_color\(Some\(background\)\)/)
assert.match(native, /Color\(244, 247, 251, 255\)/)

console.log('Main-window-only resize paint guard: PASS')
console.log('Resize idle restoration and compositor fallback: PASS')
console.log('Native WebView2 background synchronization: PASS')
console.log('Transparent Pet/Canvas window protection: PASS')
console.log('Desktop live-resize regression: PASS')
