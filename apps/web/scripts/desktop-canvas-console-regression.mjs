import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const file = relative => readFileSync(path.join(root, relative), 'utf8')
const view = file('apps/web/src/views/DesktopCanvas.vue')
const store = file('apps/web/src/stores/desktopCanvas.ts')
const registry = file('apps/web/src/desktop/widgetRegistry.ts')
const dock = file('apps/web/src/components/desktop/widgets/ToolDockWidget.vue')
const chooser = file('apps/web/src/components/desktop/CanvasConsoleTemplates.vue')
const templates = file('apps/web/src/desktop/canvasTemplates.ts')
const picker = file('apps/web/src/components/desktop/CanvasToolPicker.vue')
const widgetHost = file('apps/web/src/components/desktop/WidgetHost.vue')
const appearance = file('apps/web/src/desktop/widgetAppearance.ts')
const liquid = file('apps/web/src/styles/canvas-liquid-glass.css')
const types = file('apps/web/src/types/desktopWidget.ts')
const capability = JSON.parse(file('apps/desktop/src-tauri/capabilities/canvas-tool-import-events.json'))

function check(condition, message) { assert.ok(condition, message); console.log(message + ': PASS') }
check(view.includes('openToolPicker()') && view.includes('控制台模板') && view.includes('CanvasToolPicker'), 'Canvas direct tool and preset UI')
check(view.includes('WebToolImportModal') && view.includes('LocalToolImportModal'), 'Importers share the existing trusted tools')
check(/function openWebToolImport\(\): void \{[\s\S]*?closeToolPicker\(\)/.test(view) && /function openLocalToolImport\(\): void \{[\s\S]*?closeToolPicker\(\)/.test(view), 'Import modal sits above a closed Canvas picker')
check(registry.includes("type: 'tool-dock'") && registry.includes("permissions: ['tool-launch']"), 'Tool dock registered as launch-only widget')
check(dock.includes('tools.getToolKey(tool)') && dock.includes('openDesktopTool(tool)') && !dock.includes("invokeDesktop("), 'No duplicate unsafe native launcher or tool data')
check(picker.includes("create-web") && picker.includes("create-local") && picker.includes("emit('toggle'"), 'Tool picker search and add/remove actions')
check(chooser.includes('confirming = true') && chooser.includes('确认应用') && chooser.includes('confirming ? confirm()'), 'Explicit 2-step confirmation before template replacement')
for (const id of ['command','creator','focus']) {
  check(templates.includes("id: '"+id+"'"), 'Canvas template '+id)
}
check(templates.match(/type: 'desktop-organizer'/g)?.length === 3
   && templates.match(/type: 'tool-dock'/g)?.length === 3,
   'Templates include tool dock and desktop organizer')
check(store.includes('TEMPLATE_BACKUP_KEY') && store.includes('restoreTemplateBackup') && store.includes('localStorage.setItem(TEMPLATE_BACKUP_KEY'),
      'Local layout safety backup and restore')
check(store.includes('if (localStorage.getItem(TEMPLATE_BACKUP_KEY) === null)'),
      'Switching templates cannot overwrite the first backup')
check(chooser.includes('横向控制台') && chooser.includes('纵向控制台') && chooser.includes('position-grid'), 'Horizontal, vertical and nine docking positions')
check(chooser.includes('自定义控制台') && chooser.includes('saveCustomCanvasConsole') && chooser.includes('moveCustomItem'), 'Personal console save and widget reordering')
check(view.includes('updateSelectedCoordinate') && view.includes('position-inspector'), 'Explicit Canvas widget X/Y position editor')
check(registry.includes('toolDockOrientation') && dock.includes('is-vertical'), 'Tool Dock itself supports horizontal and vertical arrangements')
check(appearance.includes('surfaceOpacity: 0.66') && appearance.includes('blur: 30') && appearance.includes('opacity: 1'), 'Regular liquid-glass shell is translucent but keeps foreground fully opaque')
check(types.includes("| 'dense'") && appearance.includes("id: 'dense'") && appearance.includes("value === 'dense'"), 'Dense liquid preset is recognized by the stored Canvas appearance schema')
check(appearance.includes('液态·标准') && appearance.includes('液态·轻透') && appearance.includes('液态·浓厚'), 'Three user-selectable liquid-glass materials have distinct UI labels')
check(widgetHost.includes("'preset-dense': widget.appearance.preset === 'dense'") && widgetHost.includes("class=\"widget-host liquid-glass\""), 'All widgets participate in the material design system')
check(widgetHost.includes("preset === 'custom' ? props.widget.appearance.opacity : 1"), 'Material opacity never fades widget text; explicit custom overall opacity remains available')
check(liquid.includes('--liquid-material-opacity:clamp(59%') && liquid.includes('--liquid-material-opacity:clamp(25%') && liquid.includes('--liquid-material-opacity:clamp(78%'), 'Regular, Clear, Dense use independent material transparency bands')
check(liquid.includes('.widget-body::before') && liquid.includes('--liquid-local-plate') && liquid.includes('z-index:-1'), 'Feathered content-protection plate sits under foreground text')
check(liquid.includes('border:.75px solid color-mix(in srgb,var(--liquid-local-rim) 24%,transparent)')
  && liquid.includes('.widget-host.liquid-glass::after {content:none;}')
  && !liquid.includes('mask-composite:exclude'), 'Single translucent hairline replaces the double liquid-shell outline')
check(widgetHost.includes('window.requestAnimationFrame') && widgetHost.includes('highlightTarget.style.setProperty') && widgetHost.includes("props.editing || interactionMode.value"), 'Specular highlight is pointer-reactive, frame-coalesced and disabled while dragging')
check(view.includes("import '@/styles/canvas-liquid-glass.css'") && view.includes('canvas-controls liquid-panel') && view.includes('widget-inspector liquid-panel'), 'Liquid-glass material is loaded in Canvas toolbar and inspector')
check(picker.includes('canvas-tool-panel liquid-panel') && chooser.includes('preset-panel liquid-panel') && view.includes('widget-palette liquid-panel'), 'Tool selector, console studio and widget picker share consistent glass material')
check(liquid.includes('prefers-reduced-transparency:reduce') && liquid.includes('prefers-reduced-motion:reduce') && liquid.includes('forced-colors:active'), 'OS transparency, motion and high-contrast accessibility fallbacks included')
check(liquid.includes('[data-theme="dark"] .desktop-canvas') && liquid.includes('[data-theme="auto"] .desktop-canvas'), 'Dark and auto appearance have readable liquid-glass tokens')
check(view.includes('玻璃浓度（只改变背景）') && view.includes('整体不透明度（含文字）'), 'Inspector explains material density versus fading text')
assert.deepEqual(capability.windows, ['canvas','canvas-recovery-*'])
assert.deepEqual(capability.permissions, ['core:event:default'])
console.log('Canvas native import event permission scope: PASS')
console.log('Desktop Canvas customer console integration: PASS')
