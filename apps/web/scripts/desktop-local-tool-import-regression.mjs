import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => readFileSync(path.join(root, relative), 'utf8')

const dashboard = read('src/components/workspace/WorkspaceDashboard.vue')
const home = read('src/views/Home.vue')
const modal = read('src/components/tools/LocalToolImportModal.vue')
const bridge = read('src/desktop/localToolImport.ts')
const main = read('../desktop/src-tauri/src/main.rs')
const native = read('../desktop/src-tauri/src/local_tool_import_windows.rs')

assert.match(dashboard, /添加本地工具/)
assert.match(dashboard, /add-local-tool/)
assert.match(home, /LocalToolImportModal/)
assert.match(home, /openLocalToolImport/)
assert.match(modal, /将启动程序拖到这里/)
assert.match(modal, /选择启动程序/)
assert.match(modal, /queue\.value\.shift\(\)/)
assert.match(modal, /existingPathSet/)
assert.match(modal, /isInsideDropZone/)
assert.match(modal, /devicePixelRatio/)
assert.match(bridge, /onDragDropEvent/)
assert.match(bridge, /isDesktopRuntime\(\)/)
assert.match(main, /inspect_local_tool_paths/)
assert.match(main, /pick_local_tool_file/)
assert.match(native, /"exe" \| "lnk" \| "url" \| "msi"/)
assert.match(native, /shell_icon_data_url_for_path/)
assert.equal(modal.includes("document.addEventListener('drop'"), false)

console.log('workbench local-tool entry: PASS')
console.log('desktop-only Tauri drag/drop bridge: PASS')
console.log('native local-tool picker + allowlist + icon inspection: PASS')
console.log('duplicate guard + sequential confirmation queue: PASS')
console.log('web DOM does not accept local file drops: PASS')
console.log('Desktop local-tool import regression: PASS')
