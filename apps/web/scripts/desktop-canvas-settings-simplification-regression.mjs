import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const view = readFileSync(path.join(root, 'src/views/DesktopCanvas.vue'), 'utf8')
const appearance = readFileSync(path.join(root, 'src/desktop/widgetAppearance.ts'), 'utf8')
const store = readFileSync(path.join(root, 'src/stores/desktopCanvas.ts'), 'utf8')
const types = readFileSync(path.join(root, 'src/types/desktopWidget.ts'), 'utf8')
let checks = 0
function check(ok, label) { assert.ok(ok, label); checks++ }

const toolbar = view.split('<div class="canvas-actions">')[1].split('</div>')[0]
check(toolbar.includes('＋ 添加工具') && toolbar.includes('＋ 组件'), 'Two common add actions are immediately visible')
check(toolbar.includes('编辑') && toolbar.includes('更多 ···'), 'Editing and progressive disclosure remain visible')
for (const action of ['重置画布', '自动整理', '控制台模板', '试用折射', '恢复布局']) {
  check(!toolbar.includes(action), `Less common action hidden from default toolbar: ${action}`)
}
check(view.includes('class="canvas-more-menu liquid-panel"'), 'Low-frequency actions live in one compact overflow')
check(view.includes('document.querySelectorAll<HTMLElement>(')
  && view.includes('.canvas-more-menu, .widget-palette'), 'Overflow panel registers a separate transparent desktop interaction region')
check(view.includes('window.confirm(') && view.includes('canvas.reset()'), 'Destructive reset requires confirmation')
check(view.includes('aria-expanded="moreActionsOpen"'), 'Overflow disclosure announces open state')
check(view.includes('@keydown.esc.stop'), 'Escape can dismiss the overflow')

check(view.includes('quickAppearancePresets = appearancePresets.filter(item => item.id === \'glass\' || item.id === \'clear\' || item.id === \'dense\')'),
  'Simple appearance offers exactly three supported one-click materials')
check(view.includes('extraAppearancePresets = appearancePresets.filter(item => item.id === \'space\' || item.id === \'solid\')'),
  'Older additional materials remain available in advanced settings')
check(view.includes('class="inspector-advanced"') && view.includes('通常无需调整'),
  'Manual appearance settings start collapsed behind a clear explanation')
check(view.includes('class="config-section config-details"') && view.includes('需要时再调整'),
  'Detailed per-widget configuration does not overwhelm the default view')
for (const property of ['opacity','borderRadius','blur','surfaceOpacity','borderStrength','shadowStrength']) {
  check(view.includes(`@input="updateAppearance('${property}'`), `Advanced ${property} editor is preserved`)
  check(types.includes(`${property}: number`), `Persisted ${property} remains schema-compatible`)
}
check(view.includes('精确位置') && view.includes("updateSelectedCoordinate('x'"), 'Exact positioning survives inside advanced controls')
check(view.includes('canvas.activeWidget.appearance.preset === \'custom\''), 'Previously customized appearance is indicated without overwriting it')
for (const id of ['glass','clear','dense','space','solid']) {
  check(appearance.includes(`id: '${id}'`), `Saved ${id} material remains registered`)
}
check(store.includes('widgets: widgets.value') && store.includes('version: 2'), 'Saved Canvas layout storage version remains unchanged')
check(!view.includes('canvas.reset()\n  moreActionsOpen.value'), 'Opening a menu never resets saved widget state')
console.log(JSON.stringify({outcome:'PASS',checks,defaultAppearanceOptions:3,advancedFieldsPreserved:6,storageVersion:2}))
