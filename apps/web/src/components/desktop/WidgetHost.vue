<template>
  <article
    class="widget-host liquid-glass"
    :class="{
      'is-editing': editing,
      'is-locked': widget.locked,
      'is-selected': selected,
      'is-grouped': Boolean(widget.groupId),
      'is-moving': interactionMode === 'move',
      'is-resizing': interactionMode === 'resize',
      'tone-dark': widget.appearance.tone === 'dark',
      'tone-light': widget.appearance.tone === 'light',
      'preset-glass': widget.appearance.preset === 'glass',
      'preset-dense': widget.appearance.preset === 'dense',
      'preset-space': widget.appearance.preset === 'space',
      'preset-clear': widget.appearance.preset === 'clear',
      'preset-solid': widget.appearance.preset === 'solid',
    }"
    :style="hostStyle"
    @pointerdown="activate"
    @pointermove="updateLiquidPointer"
    @pointerleave="resetLiquidPointer"
  >
    <header v-if="editing" class="widget-edit-bar" @pointerdown.stop="startMove">
      <span class="drag-dots" aria-hidden="true"><i></i><i></i><i></i></span>
      <span v-if="widget.groupId" class="group-badge">组</span>
      <strong>{{ widget.title }}</strong>
      <span class="edit-actions">
        <button type="button" title="组件设置" @pointerdown.stop @click.stop="emit('open-settings', widget.id)">⚙</button>
        <button type="button" :title="widget.locked ? '解锁' : '锁定'" @pointerdown.stop @click.stop="canvas.toggleLock(widget.id)">{{ widget.locked ? '◉' : '○' }}</button>
        <button v-if="widget.type !== 'desktop-organizer'" type="button" title="删除组件" @pointerdown.stop @click.stop="canvas.removeWidget(widget.id)">×</button>
      </span>
    </header>

    <div class="widget-body">
      <component :is="definition?.component" v-if="definition" :widget="widget" />
      <div v-else class="unknown-widget">
        <strong>{{ widget.title }}</strong>
        <span>未注册组件 · {{ widget.type }}</span>
      </div>
    </div>

    <template v-if="editing && !widget.locked">
      <span class="resize-zone resize-n" @pointerdown.stop="startResize($event, 'n')"></span>
      <span class="resize-zone resize-e" @pointerdown.stop="startResize($event, 'e')"></span>
      <span class="resize-zone resize-s" @pointerdown.stop="startResize($event, 's')"></span>
      <span class="resize-zone resize-w" @pointerdown.stop="startResize($event, 'w')"></span>
      <span class="resize-zone resize-ne" @pointerdown.stop="startResize($event, 'ne')"></span>
      <span class="resize-zone resize-se" @pointerdown.stop="startResize($event, 'se')"></span>
      <span class="resize-zone resize-sw" @pointerdown.stop="startResize($event, 'sw')"></span>
      <span class="resize-zone resize-nw" @pointerdown.stop="startResize($event, 'nw')"></span>
    </template>
  </article>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import type { CSSProperties } from 'vue'
import type { DesktopWidget } from '@/types/desktopWidget'
import { getWidgetDefinition } from '@/desktop/widgetRegistry'
import { CANVAS_GRID_SIZE, useDesktopCanvasStore } from '@/stores/desktopCanvas'

const props = defineProps<{
  widget: DesktopWidget
  editing: boolean
}>()

const emit = defineEmits<{
  'open-settings': [widgetId: string]
}>()

const canvas = useDesktopCanvasStore()
const definition = computed(() => getWidgetDefinition(props.widget.type))
const selected = computed(() => canvas.isSelected(props.widget.id))

const hostStyle = computed<CSSProperties>(() => ({
  left: `${props.widget.frame.x}px`,
  top: `${props.widget.frame.y}px`,
  width: `${props.widget.frame.width}px`,
  height: `${props.widget.frame.height}px`,
  zIndex: props.widget.frame.zIndex,
  // A material's transparency belongs to its shell, never its readable text.
  // The manually customized preset still honors the explicit global-opacity slider.
  opacity: props.widget.appearance.preset === 'custom' ? props.widget.appearance.opacity : 1,
  borderRadius: `${props.widget.appearance.borderRadius}px`,
  '--widget-blur': `${props.widget.appearance.blur}px`,
  '--widget-surface-opacity': `${Math.round(props.widget.appearance.surfaceOpacity * 100)}%`,
  '--widget-border-strength': `${Math.round(props.widget.appearance.borderStrength * 100)}%`,
  '--widget-shadow-alpha': props.widget.appearance.shadowStrength,
} as CSSProperties))

// Low-cost, rAF-coalesced specular response. Avoid Pinia writes/re-rendering
// while the pointer moves; never activate this while dragging a Canvas widget.
let highlightFrame: number | null = null
let highlightTarget: HTMLElement | null = null
let highlightX = 50
let highlightY = 12
function updateLiquidPointer(event: PointerEvent): void {
  if (props.editing || interactionMode.value || event.pointerType === 'touch') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return
  const element = event.currentTarget as HTMLElement
  const bounds = element.getBoundingClientRect()
  if (!bounds.width || !bounds.height) return
  highlightTarget = element
  highlightX = Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100))
  highlightY = Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100))
  if (highlightFrame !== null) return
  highlightFrame = window.requestAnimationFrame(() => {
    highlightFrame = null
    if (!highlightTarget?.isConnected) return
    highlightTarget.style.setProperty('--liquid-pointer-x', `${highlightX}%`)
    highlightTarget.style.setProperty('--liquid-pointer-y', `${highlightY}%`)
  })
}
function resetLiquidPointer(event: PointerEvent): void {
  if (highlightFrame !== null) { window.cancelAnimationFrame(highlightFrame); highlightFrame = null }
  const element = event.currentTarget as HTMLElement
  element.style.removeProperty('--liquid-pointer-x')
  element.style.removeProperty('--liquid-pointer-y')
  highlightTarget = null
}

interface MoveTarget {
  id: string
  x: number
  y: number
}

type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

interface ResizeFrame {
  x: number
  y: number
  width: number
  height: number
}

interface InteractionState {
  mode: 'move' | 'resize'
  startX: number
  startY: number
  targets: MoveTarget[]
  frame: ResizeFrame
  direction: ResizeDirection | null
  pointerId: number
  captureElement: HTMLElement
  active: boolean
}

const POINTER_ACTIVATION_DISTANCE = 3

let interaction: InteractionState | null = null
let pointerFrame: number | null = null
let pendingPointerPosition: { x: number; y: number } | null = null
const interactionMode = ref<InteractionState['mode'] | null>(null)

function setPointerInteractionActive(active: boolean): void {
  document.documentElement.classList.toggle('canvas-pointer-active', active)
}

function activate(event: PointerEvent): void {
  if (!props.editing) {
    canvas.bringToFront(props.widget.id)
    return
  }
  if (props.widget.locked || event.button !== 0) {
    canvas.bringToFront(props.widget.id)
    canvas.selectWidget(props.widget.id, event.shiftKey)
    return
  }
  startMove(event)
}

function startMove(event: PointerEvent): void {
  if (!props.editing || props.widget.locked) return
  beginInteraction('move', event)
}

function startResize(event: PointerEvent, direction: ResizeDirection): void {
  if (!props.editing || props.widget.locked) return
  beginInteraction('resize', event, direction)
}

function beginInteraction(
  mode: InteractionState['mode'],
  event: PointerEvent,
  direction: ResizeDirection | null = null,
): void {
  if (event.button !== 0 || interaction) return
  canvas.bringToFront(props.widget.id)
  if (!canvas.isSelected(props.widget.id)) canvas.selectWidget(props.widget.id, event.shiftKey)

  const captureElement = event.currentTarget as HTMLElement
  captureElement.setPointerCapture?.(event.pointerId)

  const targetIds = mode === 'move' ? canvas.getMoveTargetIds(props.widget.id) : [props.widget.id]
  const targets: MoveTarget[] = targetIds.flatMap(id => {
    const target = canvas.widgets.find(widget => widget.id === id)
    return target ? [{ id: target.id, x: target.frame.x, y: target.frame.y }] : []
  })

  interaction = {
    mode,
    startX: event.clientX,
    startY: event.clientY,
    targets,
    frame: {
      x: props.widget.frame.x,
      y: props.widget.frame.y,
      width: props.widget.frame.width,
      height: props.widget.frame.height,
    },
    direction,
    pointerId: event.pointerId,
    captureElement,
    active: false,
  }
  event.preventDefault()
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endInteraction)
  window.addEventListener('pointercancel', endInteraction)
  window.addEventListener('blur', endInteraction)
  captureElement.addEventListener('lostpointercapture', onLostPointerCapture)
}

function activateInteraction(clientX: number, clientY: number): boolean {
  if (!interaction) return false
  if (interaction.active) return true

  const dx = clientX - interaction.startX
  const dy = clientY - interaction.startY
  if (Math.hypot(dx, dy) < POINTER_ACTIVATION_DISTANCE) return false

  interaction.active = true
  interactionMode.value = interaction.mode
  canvas.beginFrameInteraction()
  setPointerInteractionActive(true)
  return true
}

function applyPointerPosition(clientX: number, clientY: number): void {
  if (!interaction || !activateInteraction(clientX, clientY)) return
  const dx = clientX - interaction.startX
  const dy = clientY - interaction.startY

  if (interaction.mode === 'move') {
    for (const target of interaction.targets) {
      canvas.updateFrame(target.id, {
        x: Math.round(target.x + dx),
        y: Math.round(target.y + dy),
      })
    }
    return
  }

  const direction = interaction.direction
  if (!direction) return

  const minimum = CANVAS_GRID_SIZE * 4
  const original = interaction.frame
  const right = original.x + original.width
  const bottom = original.y + original.height
  let x = original.x
  let y = original.y
  let width = original.width
  let height = original.height

  if (direction.includes('e')) {
    width = Math.max(minimum, Math.round(original.width + dx))
  }
  if (direction.includes('s')) {
    height = Math.max(minimum, Math.round(original.height + dy))
  }
  if (direction.includes('w')) {
    const nextX = Math.round(original.x + dx)
    x = Math.min(nextX, right - minimum)
    width = right - x
  }
  if (direction.includes('n')) {
    const nextY = Math.round(original.y + dy)
    y = Math.min(nextY, bottom - minimum)
    height = bottom - y
  }

  canvas.updateFrame(props.widget.id, { x, y, width, height })
}

function flushPointerMove(): void {
  pointerFrame = null
  const pending = pendingPointerPosition
  pendingPointerPosition = null
  if (pending) applyPointerPosition(pending.x, pending.y)
}

function onPointerMove(event: PointerEvent): void {
  if (!interaction || event.pointerId !== interaction.pointerId) return
  pendingPointerPosition = { x: event.clientX, y: event.clientY }
  if (pointerFrame === null) pointerFrame = window.requestAnimationFrame(flushPointerMove)
}

function onLostPointerCapture(event: PointerEvent): void {
  if (!interaction || event.pointerId !== interaction.pointerId) return
  endInteraction()
}

function endInteraction(event?: Event): void {
  if (!interaction) return
  if (event instanceof PointerEvent && event.pointerId !== interaction.pointerId) return
  const current = interaction
  const allowActivation = event instanceof PointerEvent && event.type === 'pointerup'

  if (event instanceof PointerEvent && (allowActivation || current.active)) {
    pendingPointerPosition = { x: event.clientX, y: event.clientY }
  }
  if (pointerFrame !== null) {
    window.cancelAnimationFrame(pointerFrame)
    pointerFrame = null
  }
  const pending = pendingPointerPosition
  pendingPointerPosition = null
  if (pending && (current.active || allowActivation)) applyPointerPosition(pending.x, pending.y)

  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endInteraction)
  window.removeEventListener('pointercancel', endInteraction)
  window.removeEventListener('blur', endInteraction)
  current.captureElement.removeEventListener('lostpointercapture', onLostPointerCapture)

  if (current.active) {
    for (const target of current.targets) canvas.snapWidgetFrame(target.id)
    canvas.endFrameInteraction()
    setPointerInteractionActive(false)
  }

  interaction = null
  interactionMode.value = null
  if (current.captureElement.hasPointerCapture?.(current.pointerId)) {
    current.captureElement.releasePointerCapture(current.pointerId)
  }
}

onBeforeUnmount(() => {
  if (highlightFrame !== null) { window.cancelAnimationFrame(highlightFrame); highlightFrame = null }
  if (pointerFrame !== null) window.cancelAnimationFrame(pointerFrame)
  pointerFrame = null
  pendingPointerPosition = null
  if (interaction) {
    const current = interaction
    current.captureElement.removeEventListener('lostpointercapture', onLostPointerCapture)
    if (current.active) {
      canvas.endFrameInteraction()
      setPointerInteractionActive(false)
    }
    interaction = null
    interactionMode.value = null
  }
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endInteraction)
  window.removeEventListener('pointercancel', endInteraction)
  window.removeEventListener('blur', endInteraction)
})
</script>

<style scoped>
.widget-host{--widget-base:rgb(247 249 252);--widget-edge:var(--text-primary);--widget-material-opacity:var(--widget-surface-opacity);--text-secondary:rgb(61 66 75);--text-tertiary:rgb(94 99 110);--btn-bg:rgb(255 255 255 / 48%);--btn-bg-hover:rgb(255 255 255 / 72%);--input-bg:rgb(255 255 255 / 72%);--icon-surface:rgb(255 255 255 / 48%);position:absolute;overflow:hidden;isolation:isolate;background:linear-gradient(151deg,rgb(255 255 255 / 24%) 0%,rgb(255 255 255 / 8%) 24%,transparent 55%),color-mix(in srgb,var(--widget-base) var(--widget-material-opacity),transparent);backdrop-filter:blur(var(--widget-blur)) saturate(135%);-webkit-backdrop-filter:blur(var(--widget-blur)) saturate(135%);border:1px solid color-mix(in srgb,var(--widget-edge) var(--widget-border-strength),transparent);box-shadow:0 14px 42px rgb(0 0 0 / var(--widget-shadow-alpha)),inset 0 1px 0 rgb(255 255 255 / 45%),inset 0 -1px 0 rgb(255 255 255 / 10%);transition:left .3s cubic-bezier(.25,.1,.25,1),top .3s cubic-bezier(.25,.1,.25,1),width .3s cubic-bezier(.25,.1,.25,1),height .3s cubic-bezier(.25,.1,.25,1),border-color .3s cubic-bezier(.25,.1,.25,1),box-shadow .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1),backdrop-filter .3s cubic-bezier(.25,.1,.25,1),transform .3s cubic-bezier(.25,.1,.25,1)}
/* Regular glass uses an opaque *color source*, not an already translucent --glass-bg.
   Preserve legacy stored 72% presets while raising the readable visual floor;
   manually customized widgets and the intentionally Clear preset keep their values. */
.widget-host.preset-glass{--widget-material-opacity:clamp(84%,var(--widget-surface-opacity),100%)}
.widget-host.preset-space{--widget-material-opacity:clamp(89%,var(--widget-surface-opacity),100%)}
.widget-host.preset-solid{--widget-material-opacity:clamp(96%,var(--widget-surface-opacity),100%)}
:global(html.canvas-pointer-active) .widget-host{transition:none!important}
.widget-host:not(.is-editing):hover{box-shadow:0 16px 44px rgb(0 0 0 / 10%),inset 0 1px 0 rgb(255 255 255 / 26%),inset 0 0 0 1px rgb(255 255 255 / 5%)}
.widget-host.is-editing{border-color:color-mix(in srgb,var(--primary) 25%,var(--glass-border));box-shadow:0 10px 34px rgb(0 0 0 / 8%),0 0 0 1px color-mix(in srgb,var(--primary) 9%,transparent),inset 0 1px 0 rgb(255 255 255 / 30%);touch-action:none}
.widget-host.is-editing:not(.is-locked){cursor:grab}
.widget-host.is-editing.is-locked{cursor:default}
.widget-host.is-selected{border-color:color-mix(in srgb,var(--primary) 72%,var(--glass-border));box-shadow:0 12px 36px rgb(0 0 0 / 10%),0 0 0 2px color-mix(in srgb,var(--primary) 34%,transparent),inset 0 1px 0 rgb(255 255 255 / 30%)}
.widget-host.is-moving,.widget-host.is-resizing{will-change:left,top,width,height;box-shadow:0 18px 46px rgb(0 0 0 / 14%),0 0 0 2px color-mix(in srgb,var(--primary) 30%,transparent),inset 0 1px 0 rgb(255 255 255 / 32%)}
.widget-host.is-moving{cursor:grabbing}
.widget-host.is-grouped.is-editing:not(.is-selected){box-shadow:0 10px 34px rgb(0 0 0 / 8%),0 0 0 1px color-mix(in srgb,var(--primary) 22%,transparent),inset 0 1px 0 rgb(255 255 255 / 30%)}
.widget-host.is-locked{border-style:dashed}
.widget-host.tone-dark{--widget-base:rgb(19 23 31);--widget-edge:white;--glass-bg:rgba(19,23,31,.88);--glass-border:rgba(255,255,255,.16);--text-primary:#f4f6f8;--text-secondary:rgba(239,243,248,.86);--text-tertiary:rgba(227,234,242,.66);--btn-bg:rgba(255,255,255,.12);--btn-bg-hover:rgba(255,255,255,.19);--input-bg:rgba(255,255,255,.13);--icon-surface:rgba(255,255,255,.12)}
.widget-host.tone-light{--widget-base:rgb(247 249 252);--widget-edge:black;--glass-bg:rgba(248,249,251,.9);--glass-border:rgba(0,0,0,.11);--text-primary:#171a1f;--text-secondary:rgb(61 66 75);--text-tertiary:rgb(94 99 110);--btn-bg:rgba(255,255,255,.55);--btn-bg-hover:rgba(255,255,255,.82);--input-bg:rgba(255,255,255,.78);--icon-surface:rgba(255,255,255,.55)}
.widget-edit-bar{position:absolute;z-index:5;top:0;left:0;right:0;height:32px;display:flex;align-items:center;gap:8px;padding:0 7px 0 10px;background:color-mix(in srgb,var(--glass-bg) 86%,transparent);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-bottom:1px solid var(--glass-border);cursor:grab;user-select:none;animation:widget-edit-bar-in .3s cubic-bezier(.25,.1,.25,1) both}
.widget-edit-bar:active{cursor:grabbing}
.widget-edit-bar strong{min-width:0;flex:1;font-size:.65rem;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.drag-dots{display:flex;gap:2px}
.drag-dots i{width:3px;height:3px;border-radius:50%;background:var(--text-tertiary)}
.group-badge{height:18px;display:grid;place-items:center;padding:0 5px;border-radius:6px;background:color-mix(in srgb,var(--primary) 10%,var(--btn-bg));color:var(--primary);font-size:.52rem;font-weight:700}
.edit-actions{display:flex;gap:3px}
.edit-actions button{width:23px;height:23px;border:0;border-radius:7px;background:transparent;color:var(--text-tertiary);cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.edit-actions button:hover{background:var(--btn-bg-hover);color:var(--text-primary);transform:scale(1.02)}
.edit-actions button:active{transform:scale(.98)}
.widget-body{width:100%;height:100%}
.is-editing .widget-body{padding-top:32px;pointer-events:none}
.resize-zone{position:absolute;z-index:7;display:block;background:transparent;touch-action:none;user-select:none}
.resize-n,.resize-s{left:10px;right:10px;height:8px}
.resize-n{top:0;cursor:ns-resize}
.resize-s{bottom:0;cursor:ns-resize}
.resize-e,.resize-w{top:10px;bottom:10px;width:8px}
.resize-e{right:0;cursor:ew-resize}
.resize-w{left:0;cursor:ew-resize}
.resize-ne,.resize-se,.resize-sw,.resize-nw{width:14px;height:14px}
.resize-ne{top:0;right:0;cursor:nesw-resize}
.resize-se{right:0;bottom:0;cursor:nwse-resize}
.resize-sw{left:0;bottom:0;cursor:nesw-resize}
.resize-nw{top:0;left:0;cursor:nwse-resize}
.widget-host.is-selected .resize-ne::after,.widget-host.is-selected .resize-se::after,.widget-host.is-selected .resize-sw::after,.widget-host.is-selected .resize-nw::after{content:"";position:absolute;inset:4px;border-radius:2px;background:color-mix(in srgb,var(--primary) 82%,white);box-shadow:0 0 0 2px color-mix(in srgb,var(--glass-bg) 82%,transparent);pointer-events:none;opacity:.9;transition:opacity .3s cubic-bezier(.25,.1,.25,1)}
.unknown-widget{height:100%;display:grid;place-content:center;gap:5px;text-align:center;color:var(--text-secondary)}
.unknown-widget span{font-size:.68rem;color:var(--text-tertiary)}
@keyframes widget-edit-bar-in{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:translateY(0)}}
@media (prefers-reduced-motion:reduce){.widget-host,.widget-edit-bar,.edit-actions button{animation:none!important;transition:none!important}.widget-host:not(.is-editing):hover,.widget-host.is-moving{transform:none}}
[data-theme="dark"] .widget-host:not(.tone-light):not(.tone-dark){--widget-base:rgb(19 23 31);--widget-edge:white;--text-secondary:rgb(218 224 232);--text-tertiary:rgb(168 178 191);--btn-bg:rgb(255 255 255 / 12%);--btn-bg-hover:rgb(255 255 255 / 19%);--input-bg:rgb(255 255 255 / 13%);--icon-surface:rgb(255 255 255 / 12%)}
@media (prefers-color-scheme:dark){[data-theme="auto"] .widget-host:not(.tone-light):not(.tone-dark){--widget-base:rgb(19 23 31);--widget-edge:white;--text-secondary:rgb(218 224 232);--text-tertiary:rgb(168 178 191);--btn-bg:rgb(255 255 255 / 12%);--btn-bg-hover:rgb(255 255 255 / 19%);--input-bg:rgb(255 255 255 / 13%);--icon-surface:rgb(255 255 255 / 12%)}}
@media (prefers-reduced-transparency:reduce){.widget-host:not(.preset-clear){--widget-material-opacity:96%!important;backdrop-filter:none;-webkit-backdrop-filter:none}.widget-host.preset-clear{--widget-material-opacity:88%!important;backdrop-filter:none;-webkit-backdrop-filter:none}}
@media (forced-colors:active){.widget-host{--widget-material-opacity:100%!important;forced-color-adjust:auto;border:1px solid CanvasText;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}}
</style>
