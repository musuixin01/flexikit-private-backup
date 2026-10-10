<template>
  <Transition name="preset-sheet">
    <div v-if="open" class="preset-overlay" @pointerdown.self="emit('close')">
      <section class="preset-panel liquid-panel" role="dialog" aria-modal="true" aria-label="控制台设计中心" @keydown.esc="emit('close')">
        <header class="preset-head">
          <div><small>FLEXIKIT / CONSOLE STUDIO</small><h2>设计你的桌面控制台</h2><p>横向或纵向，自由定位，自定义组件。你的桌面由你决定。</p></div>
          <button type="button" aria-label="关闭" @click="emit('close')">×</button>
        </header>

        <div class="preset-content">
          <section class="preset-chooser" aria-label="控制台样式">
            <div class="section-title"><strong>01 / 选择风格</strong><small>三种预设 · 一个专属控制台</small></div>
            <div class="preset-grid">
              <button v-for="template in CANVAS_CONSOLE_TEMPLATES" :key="template.id" type="button"
                class="preset-card" :class="{ selected: chosen === template.id }" @click="choose(template.id)">
                <span class="preset-symbol" :style="{ '--template-color': template.accent }"><span>▦</span></span>
                <span><small>{{ template.tagline }}</small><strong>{{ template.title }}</strong><em>{{ template.description }}</em></span>
                <span class="preset-check">{{ chosen === template.id ? '●' : '○' }}</span>
              </button>
              <button type="button" class="preset-card custom-card" :class="{ selected: chosen === 'custom' }" @click="choose('custom')">
                <span class="preset-symbol custom-symbol"><span>＋</span></span>
                <span><small>PERSONAL WORKSPACE</small><strong>{{ saved ? saved.name : '自定义控制台' }}</strong><em>自由挑选组件、排序并保存自己的样式。</em></span>
                <span class="preset-check">{{ chosen === 'custom' ? '●' : '○' }}</span>
              </button>
            </div>

            <template v-if="chosen === 'custom'">
              <div class="section-title custom-title"><strong>02 / 自定义内容</strong><small>最多 {{ MAX_CONSOLE_WIDGETS }} 个组件 · 可调整顺序</small></div>
              <label class="console-name">控制台名称<input v-model="customName" type="text" maxlength="32" placeholder="例如：我的工作桌面"></label>
              <div class="widget-options">
                <button v-for="type in availableWidgetTypes" :key="type" type="button"
                  :class="{ active: customItems.includes(type), disabled: customItems.length >= MAX_CONSOLE_WIDGETS && !customItems.includes(type) }"
                  :disabled="customItems.length >= MAX_CONSOLE_WIDGETS && !customItems.includes(type)"
                  @click="toggleCustomItem(type)">
                  <span>{{ getWidgetDefinition(type)?.icon ?? '▦' }}</span>{{ getWidgetDefinition(type)?.title ?? type }}
                  <b>{{ customItems.includes(type) ? '✓' : '＋' }}</b>
                </button>
              </div>
              <div class="widget-order" v-if="customItems.length">
                <div v-for="(type, index) in customItems" :key="type" class="order-entry">
                  <span><b>{{ String(index + 1).padStart(2, '0') }}</b>{{ getWidgetDefinition(type)?.title ?? type }}</span>
                  <div><button type="button" :disabled="index === 0" :aria-label="'上移 '+type" @click="moveCustomItem(index,-1)">↑</button>
                    <button type="button" :disabled="index === customItems.length - 1" :aria-label="'下移 '+type" @click="moveCustomItem(index,1)">↓</button></div>
                </div>
              </div>
              <button type="button" class="save-custom" :disabled="!customItems.length" @click="saveCustom">保存为我的控制台</button>
              <small v-if="feedback" class="feedback">{{ feedback }}</small>
            </template>
          </section>

          <section class="preset-settings">
            <div class="section-title"><strong>{{ chosen === 'custom' ? '03' : '02' }} / 排列与位置</strong><small>实时预览 · 应用后仍可拖动</small></div>
            <label class="settings-label">布局方向</label>
            <div class="orientation-switch">
              <button type="button" :class="{ active: orientation === 'horizontal' }" @click="orientation = 'horizontal'; confirming = false"><span>▭</span><strong>横向控制台</strong><small>沿桌面宽度排列</small></button>
              <button type="button" :class="{ active: orientation === 'vertical' }" @click="orientation = 'vertical'; confirming = false"><span>▯</span><strong>纵向控制台</strong><small>沿桌面高度排列</small></button>
            </div>
            <label class="settings-label">放置位置</label>
            <div class="position-control">
              <div class="position-grid" role="group" aria-label="控制台停靠位置">
                <button v-for="location in positions" :key="location.id" type="button"
                  :class="{ active: position === location.id }" :aria-label="location.label" :title="location.label"
                  @click="position = location.id; confirming = false"><i></i></button>
              </div>
              <span class="position-hint"><strong>{{ positions.find(item => item.id === position)?.label }}</strong><small>也可以应用后拖动任意组件</small></span>
            </div>
            <div class="offset-row">
              <label>水平偏移（px）<input v-model.number="offsetX" type="number" min="-300" max="300" step="20"></label>
              <label>垂直偏移（px）<input v-model.number="offsetY" type="number" min="-300" max="300" step="20"></label>
            </div>
            <div class="section-title preview-title"><strong>布局预览</strong><small>{{ previewItems.length }} 个组件</small></div>
            <div class="layout-preview" :class="{ vertical: orientation === 'vertical' }">
              <div class="preview-topline"><i></i><i></i><i></i><b>FLEXIKIT CANVAS</b></div>
              <div class="preview-stage">
                <div v-for="(item,index) in previewItems" :key="index" class="preview-widget" :style="previewStyle(item)">
                  <span>{{ getWidgetDefinition(item.type)?.title ?? item.type }}</span>
                  <b v-if="item.type === 'tool-dock'">▦　▦　▦</b>
                </div>
              </div>
              <span class="preview-caption">{{ orientation === 'horizontal' ? 'HORIZONTAL' : 'VERTICAL' }} · {{ positions.find(item => item.id === position)?.label }}</span>
            </div>
          </section>
        </div>

        <footer class="preset-foot">
          <div class="preset-warning">
            <strong>{{ confirming ? '确定替换当前画布布局？' : '原有布局会保留' }}</strong>
            <small>{{ confirming ? '将先在本机备份所有组件和配置。可通过“恢复布局”还原。' : '选中模板不会直接改动桌面。应用后仍可单独拖动、缩放与编辑组件。' }}</small>
          </div>
          <div class="footer-actions"><button type="button" class="preset-secondary" @click="confirming ? confirming = false : emit('close')">{{ confirming ? '返回编辑' : '取消' }}</button>
            <button type="button" class="preset-primary" :disabled="chosen === 'custom' && !customItems.length" @click="confirming ? confirm() : confirming = true">{{ confirming ? '确认应用' : '应用到桌面' }}</button></div>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue'
import {
  CANVAS_CONSOLE_TEMPLATES, CONSOLE_WIDGET_TYPES, MAX_CONSOLE_WIDGETS,
  layoutConsoleItems, loadCustomCanvasConsole, saveCustomCanvasConsole,
  type CanvasConsolePosition, type CanvasConsoleOrientation, type CanvasConsoleRequest,
  type CanvasTemplateId, type CanvasConsolePreviewItem, type SavedCustomConsole,
} from '@/desktop/canvasTemplates'
import { getWidgetDefinition } from '@/desktop/widgetRegistry'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; apply: [request: CanvasConsoleRequest] }>()
const chosen = ref<CanvasTemplateId>('command')
const orientation = ref<CanvasConsoleOrientation>('horizontal')
const position = ref<CanvasConsolePosition>('top-center')
const offsetX = ref(0)
const offsetY = ref(0)
const customItems = ref<string[]>(['clock', 'tool-dock', 'desktop-organizer'])
const customName = ref('我的控制台')
const saved = ref<SavedCustomConsole | null>(null)
const feedback = ref('')
const confirming = ref(false)
const availableWidgetTypes = CONSOLE_WIDGET_TYPES.filter(type => Boolean(getWidgetDefinition(type)))
const positions: Array<{ id: CanvasConsolePosition; label: string }> = [
  { id: 'top-left', label: '左上' }, { id: 'top-center', label: '正上' }, { id: 'top-right', label: '右上' },
  { id: 'center-left', label: '左侧' }, { id: 'center', label: '居中' }, { id: 'center-right', label: '右侧' },
  { id: 'bottom-left', label: '左下' }, { id: 'bottom-center', label: '正下' }, { id: 'bottom-right', label: '右下' },
]
const chosenTypes = computed(() => chosen.value === 'custom'
  ? customItems.value
  : CANVAS_CONSOLE_TEMPLATES.find(item => item.id === chosen.value)?.items.map(item => item.type) ?? [])
const previewItems = computed(() => layoutConsoleItems(chosenTypes.value, orientation.value))
const bounds = computed(() => ({
  width: Math.max(1, ...previewItems.value.map(item => item.x + item.width)),
  height: Math.max(1, ...previewItems.value.map(item => item.y + item.height)),
}))
function previewStyle(item: CanvasConsolePreviewItem): CSSProperties {
  const ratio = Math.min(1, 93 / (bounds.value.width / 10), 90 / (bounds.value.height / 4))
  const contentWidth = bounds.value.width * ratio / 10
  const contentHeight = bounds.value.height * ratio / 4
  const anchorX = position.value.includes('left') ? 0 : position.value.includes('right') ? 1 : .5
  const anchorY = position.value.startsWith('top') ? 0 : position.value.startsWith('bottom') ? 1 : .5
  const originX = Math.max(0, Math.min(100 - contentWidth, (100 - contentWidth) * anchorX + Number(offsetX.value || 0) / 25))
  const originY = Math.max(0, Math.min(100 - contentHeight, (100 - contentHeight) * anchorY + Number(offsetY.value || 0) / 25))
  const x = originX + item.x * ratio / 10
  const y = originY + item.y * ratio / 4
  return {
    left: `${x}%`, top: `${y}%`,
    width: `${Math.max(2, item.width * ratio / 10)}%`,
    height: `${Math.max(3, item.height * ratio / 4)}%`,
  }
}
watch(() => props.open, value => {
  if (!value) return
  saved.value = loadCustomCanvasConsole()
  confirming.value = false
  feedback.value = ''
})
function choose(id: CanvasTemplateId): void {
  chosen.value = id
  confirming.value = false
  feedback.value = ''
  if (id !== 'custom' || !saved.value) return
  const entry = saved.value
  customName.value = entry.name
  customItems.value = [...entry.items]
  orientation.value = entry.orientation
  position.value = entry.position
  offsetX.value = entry.offsetX
  offsetY.value = entry.offsetY
}
function toggleCustomItem(type: string): void {
  if (customItems.value.includes(type)) customItems.value = customItems.value.filter(value => value !== type)
  else if (customItems.value.length < MAX_CONSOLE_WIDGETS) customItems.value = [...customItems.value, type]
  confirming.value = false
}
function moveCustomItem(index: number, direction: number): void {
  const target = index + direction
  if (target < 0 || target >= customItems.value.length) return
  const next = [...customItems.value]
  ;[next[index], next[target]] = [next[target], next[index]]
  customItems.value = next
  confirming.value = false
}
function saveCustom(): void {
  try {
    saveCustomCanvasConsole({
      name: customName.value, items: customItems.value,
      orientation: orientation.value, position: position.value,
      offsetX: offsetX.value, offsetY: offsetY.value,
    })
    saved.value = loadCustomCanvasConsole()
    feedback.value = '已在本机保存专属控制台。'
  } catch {
    feedback.value = '保存失败，原有控制台没有受到影响。'
  }
}
function confirm(): void {
  if (chosen.value === 'custom' && !customItems.value.length) return
  emit('apply', {
    id: chosen.value, orientation: orientation.value, position: position.value,
    offsetX: offsetX.value, offsetY: offsetY.value,
    ...(chosen.value === 'custom' ? { items: [...customItems.value] } : {}),
  })
  confirming.value = false
}
</script>

<style scoped>
.preset-overlay{position:fixed;inset:0;z-index:20020;display:grid;place-items:center;padding:22px;background:rgb(8 12 20 / 28%);backdrop-filter:blur(9px)}
.preset-panel{width:min(1050px,calc(100vw - 38px));max-height:calc(100vh - 40px);display:flex;flex-direction:column;min-height:0;overflow:hidden;border:1px solid var(--glass-border);border-radius:24px;background:color-mix(in srgb,var(--canvas-material-base,rgb(247 249 252)) 96%,transparent);backdrop-filter:blur(34px) saturate(130%);-webkit-backdrop-filter:blur(34px) saturate(130%);box-shadow:0 26px 90px rgb(0 0 0 / 19%),inset 0 1px 0 rgb(255 255 255 / 22%);padding:24px;color:var(--text-primary);gap:18px}
.preset-head{display:flex;justify-content:space-between;align-items:start;gap:18px}.preset-head small{font-size:10px;letter-spacing:.16em;font-weight:700;color:var(--text-tertiary)}.preset-head h2{font-size:23px;letter-spacing:-.045em;margin:5px 0}.preset-head p{font-size:12px;color:var(--text-secondary);margin:0}.preset-head>button{width:32px;height:32px;border:1px solid var(--glass-border);border-radius:50%;background:var(--btn-bg);color:var(--text-primary);font-size:21px;cursor:pointer}
.preset-content{min-height:0;overflow-y:auto;display:grid;grid-template-columns:minmax(0,1.15fr) minmax(310px,.85fr);align-items:start;gap:25px;padding-right:4px}.preset-chooser,.preset-settings{min-width:0;display:flex;flex-direction:column;gap:12px}
.section-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.section-title strong{font-size:12px;letter-spacing:.015em}.section-title small{font-size:10px;color:var(--text-tertiary)}
.preset-grid{display:grid;gap:9px}.preset-card{display:flex;align-items:center;gap:13px;width:100%;padding:12px;border:1px solid var(--glass-border);border-radius:15px;background:color-mix(in srgb,var(--btn-bg) 64%,transparent);color:var(--text-primary);text-align:left;cursor:pointer;transition:transform .3s cubic-bezier(.25,.1,.25,1),border-color .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1)}.preset-card:hover{transform:translateY(-2px);background:var(--btn-bg-hover)}.preset-card:active{transform:scale(.98)}.preset-card.selected{border-color:color-mix(in srgb,var(--text-primary) 35%,var(--glass-border));background:var(--btn-bg-hover)}
.preset-symbol{flex:0 0 auto;width:46px;height:46px;border-radius:13px;display:grid;place-items:center;background:color-mix(in srgb,var(--template-color) 15%,var(--icon-surface));box-shadow:inset 0 1px 0 rgb(255 255 255 / 13%)}.preset-symbol span{font-size:23px;color:var(--text-secondary)}.custom-symbol{background:var(--icon-surface)}.preset-card>span:nth-child(2){flex:1;min-width:0;display:grid;gap:3px}.preset-card small{font-size:9px;letter-spacing:.08em;color:var(--text-tertiary);font-weight:650}.preset-card strong{font-size:13px;letter-spacing:-.02em}.preset-card em{font-size:10px;color:var(--text-secondary);font-style:normal;line-height:1.5}.preset-check{font-size:16px;color:var(--text-tertiary)}.preset-card.selected .preset-check{color:var(--text-primary)}
.settings-label{font-size:11px;color:var(--text-secondary);font-weight:650;margin-top:6px}
.orientation-switch{display:grid;grid-template-columns:1fr 1fr;gap:9px}.orientation-switch button{display:grid;justify-items:start;gap:5px;padding:12px;border:1px solid var(--glass-border);border-radius:13px;background:var(--btn-bg);color:var(--text-primary);cursor:pointer;text-align:left;transition:all .3s cubic-bezier(.25,.1,.25,1)}.orientation-switch button.active{border-color:color-mix(in srgb,var(--text-primary) 45%,var(--glass-border));background:var(--btn-bg-hover)}.orientation-switch span{font-size:24px;line-height:1}.orientation-switch strong{font-size:12px}.orientation-switch small{font-size:10px;color:var(--text-tertiary)}
.position-control{display:flex;align-items:center;gap:17px}.position-grid{display:grid;grid-template-columns:repeat(3,26px);gap:5px;padding:8px;border:1px solid var(--glass-border);border-radius:13px;background:var(--btn-bg)}.position-grid button{height:26px;border:1px solid var(--glass-border);border-radius:7px;background:var(--icon-surface);display:grid;place-items:center;cursor:pointer}.position-grid button i{width:6px;height:6px;border-radius:2px;background:var(--text-tertiary)}.position-grid button.active{border-color:var(--text-primary);background:var(--btn-bg-hover)}.position-grid button.active i{width:10px;height:10px;background:var(--text-primary)}.position-hint{display:grid;gap:5px}.position-hint strong{font-size:12px}.position-hint small{font-size:10px;color:var(--text-tertiary)}
.offset-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.offset-row label,.console-name{display:grid;gap:6px;font-size:10px;color:var(--text-secondary)}.offset-row input,.console-name input{height:35px;min-width:0;border:1px solid var(--glass-border);border-radius:10px;padding:0 10px;background:var(--input-bg);color:var(--text-primary);font:inherit;font-size:12px}
.preview-title{margin-top:9px}.layout-preview{height:192px;border:1px solid rgb(255 255 255 / 9%);border-radius:14px;padding:12px;background:radial-gradient(ellipse at 60% 0%,rgb(148 163 184 / 14%),transparent 60%),#161922;color:#eaecf0;display:flex;flex-direction:column;gap:9px}.preview-topline{display:flex;align-items:center;gap:4px;height:6px}.preview-topline i{width:4px;height:4px;border-radius:50%;background:#566070}.preview-topline b{margin-left:auto;font-size:7px;letter-spacing:.13em;font-weight:550;color:#a1aaba}.preview-stage{position:relative;flex:1;min-height:0}.preview-widget{position:absolute;display:grid;align-content:start;gap:3px;padding:5px;overflow:hidden;border:1px solid rgb(255 255 255 / 17%);border-radius:6px;background:rgb(255 255 255 / 11%)}.preview-widget span{font-size:7px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.preview-widget b{font-size:11px;color:#bdc6da;font-weight:400}.preview-caption{text-align:right;font-size:7px;letter-spacing:.17em;color:#919aad}
.custom-title{margin-top:8px}.widget-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.widget-options button{display:flex;align-items:center;min-width:0;gap:6px;border:1px solid var(--glass-border);border-radius:10px;background:var(--btn-bg);padding:8px;color:var(--text-secondary);font-size:11px;cursor:pointer;text-align:left;transition:background .3s cubic-bezier(.25,.1,.25,1)}.widget-options button.active{color:var(--text-primary);background:var(--btn-bg-hover);border-color:color-mix(in srgb,var(--text-primary) 32%,var(--glass-border))}.widget-options button:disabled{opacity:.4;cursor:default}.widget-options button>span{min-width:17px;text-align:center;font-size:13px}.widget-options button b{margin-left:auto;font-size:11px}.widget-order{display:grid;gap:5px}.order-entry{display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--btn-bg);border:1px solid var(--glass-border);border-radius:9px}.order-entry>span{font-size:11px;display:flex;gap:9px;align-items:center}.order-entry b{color:var(--text-tertiary);font-size:9px}.order-entry>div{display:flex;gap:5px}.order-entry button{width:25px;height:25px;border:1px solid var(--glass-border);border-radius:7px;background:var(--btn-bg-hover);color:var(--text-primary);cursor:pointer}.order-entry button:disabled{opacity:.3;cursor:default}.save-custom{align-self:start;border:1px solid var(--glass-border);border-radius:10px;background:var(--text-primary);color:var(--bg-secondary);padding:9px 14px;cursor:pointer;font-size:11px;font-weight:650}.save-custom:disabled{opacity:.4}.feedback{color:var(--text-secondary);font-size:11px}
.preset-foot{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:15px;border-top:1px solid var(--glass-border);padding-top:16px}.preset-warning{display:grid;gap:4px}.preset-warning strong{font-size:12px}.preset-warning small{font-size:10px;color:var(--text-tertiary)}.footer-actions{display:flex;gap:9px;flex:0 0 auto}.footer-actions button{height:37px;padding:0 17px;border-radius:10px;font-size:11px;font-weight:650;cursor:pointer}.preset-secondary{border:1px solid var(--glass-border);color:var(--text-primary);background:var(--btn-bg)}.preset-primary{border:0;background:var(--text-primary);color:var(--bg-secondary)}.preset-primary:disabled{opacity:.35;cursor:not-allowed}
.preset-sheet-enter-active,.preset-sheet-leave-active{transition:opacity .3s cubic-bezier(.25,.1,.25,1)}.preset-sheet-enter-from,.preset-sheet-leave-to{opacity:0}
@media(max-width:720px){.preset-panel{padding:15px;gap:12px}.preset-content{grid-template-columns:1fr}.preset-head h2{font-size:19px}.preset-foot{align-items:start;flex-direction:column}.footer-actions{width:100%;justify-content:flex-end}}
</style>
