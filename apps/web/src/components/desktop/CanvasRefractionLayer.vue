<template>
  <canvas ref="surface" class="wallpaper-refraction" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { createCanvasRefractionRenderer, type CanvasRefractionRenderer } from '@/desktop/wallpaperRefraction'
import type { DesktopWidget } from '@/types/desktopWidget'
import type { WallpaperSnapshot } from '@/desktop/wallpaperLayout'
import { createCanvasFrameProfiler, type CanvasFrameSummary } from '@/desktop/canvasRefractionLifecycle'
import { createCanvasGpuRecoveryGate } from '@/desktop/canvasGpuRecovery'

const props = defineProps<{ wallpaper: WallpaperSnapshot; widgets: DesktopWidget[]; editing: boolean }>()
const emit = defineEmits<{ ready: []; error: [message: string]; stats: [summary: CanvasFrameSummary] }>()
const surface = ref<HTMLCanvasElement | null>(null)
let renderer: CanvasRefractionRenderer | null = null
let mounted = false
let paintFrame: number | null = null
let lastPointer: { x: number; y: number } | undefined
let lastPointerFrame = 0
let resizeObserver: ResizeObserver | null = null
const frameProfiler = createCanvasFrameProfiler(120)
let lastStatsAt = 0
const recovery = createCanvasGpuRecoveryGate(2)
const CONTEXT_RESTORE_TIMEOUT_MS = 4000
let restoreTimer: number | null = null
let initGeneration = 0
let pendingGpuInitialization: AbortController | null = null
function clearRestoreTimer(): void {
  if (restoreTimer !== null) window.clearTimeout(restoreTimer)
  restoreTimer = null
}


function draw(): void {
  paintFrame = null
  if (!mounted || !renderer) return
  const start = performance.now()
  renderer.render(props.widgets, props.editing ? undefined : lastPointer)
  const now = performance.now()
  frameProfiler.record(now - start)
  // A bounded CPU submission-only diagnostic: GPU completion is async.
  // No wallpaper image, coordinates or user data enter the statistics.
  if (now - lastStatsAt >= 2500) {
    lastStatsAt = now
    if (frameProfiler.summary().samples >= 8) emit('stats', frameProfiler.summary())
  }
}
function schedule(): void {
  if (!mounted || paintFrame !== null) return
  paintFrame = window.requestAnimationFrame(draw)
}
function onPointerMove(event: PointerEvent): void {
  if (props.editing || event.pointerType === 'touch') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (window.matchMedia('(prefers-reduced-transparency: reduce)').matches) return
  // Only render extra frames while inside a refraction-enabled widget.
  if (!props.widgets.some(item => item.appearance.preset === 'glass'
    || item.appearance.preset === 'clear' || item.appearance.preset === 'dense'
    ? event.clientX >= item.frame.x && event.clientX <= item.frame.x + item.frame.width
      && event.clientY >= item.frame.y && event.clientY <= item.frame.y + item.frame.height
    : false)) return
  const now = performance.now()
  if (now - lastPointerFrame < 32) return // maximum ~30 GPU frames per second on movement
  lastPointerFrame = now
  lastPointer = { x: event.clientX, y: event.clientY }
  schedule()
}
function onContextLost(event: Event): void {
  event.preventDefault() // Permit WebGL context restoration on Chromium.
  if (!mounted || recovery.isLost()) return
  initGeneration += 1
  recovery.lost()
  pendingGpuInitialization?.abort()
  pendingGpuInitialization = null
  if (paintFrame !== null) window.cancelAnimationFrame(paintFrame)
  paintFrame = null
  // The GPU driver has already invalidated these resources. The renderer
  // disposes its JS handles without issuing GL calls to a lost context.
  renderer?.dispose()
  renderer = null
  frameProfiler.clear()
  clearRestoreTimer()
  restoreTimer = window.setTimeout(() => {
    if (mounted && recovery.isLost()) emit('error', '显卡上下文未恢复，已切换普通玻璃')
  }, CONTEXT_RESTORE_TIMEOUT_MS)
}
function onContextRestored(): void {
  if (!mounted || !recovery.restored()) return
  clearRestoreTimer()
  void initializeGpuRenderer()
}
async function initializeGpuRenderer(): Promise<void> {
  const element = surface.value
  if (!mounted || !element || recovery.isLost()) return
  pendingGpuInitialization?.abort()
  const controller = new AbortController()
  pendingGpuInitialization = controller
  const generation = ++initGeneration
  try {
    const current = await createCanvasRefractionRenderer(element, props.wallpaper, controller.signal)
    if (!mounted || recovery.isLost() || generation !== initGeneration) {
      current.dispose()
      return
    }
    renderer?.dispose()
    renderer = current
    draw()
    emit('ready')
  } catch {
    if (mounted && generation === initGeneration && !recovery.isLost() && !controller.signal.aborted) {
      emit('error', 'GPU 折射重建失败，已切换普通玻璃')
    }
  } finally {
    if (pendingGpuInitialization === controller) pendingGpuInitialization = null
  }
}

watch(() => props.widgets, schedule, { deep: true, flush: 'post' })
watch(() => props.editing, schedule)

onMounted(async () => {
  mounted = true
  const element = surface.value
  if (!element) return
  element.addEventListener('webglcontextlost', onContextLost)
  element.addEventListener('webglcontextrestored', onContextRestored)
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  resizeObserver = new ResizeObserver(schedule)
  resizeObserver.observe(element)
  await initializeGpuRenderer()
})

onBeforeUnmount(() => {
  mounted = false
  initGeneration += 1
  clearRestoreTimer()
  pendingGpuInitialization?.abort()
  pendingGpuInitialization = null
  recovery.reset()
  surface.value?.removeEventListener('webglcontextlost', onContextLost)
  surface.value?.removeEventListener('webglcontextrestored', onContextRestored)
  window.removeEventListener('pointermove', onPointerMove)
  resizeObserver?.disconnect()
  resizeObserver = null
  if (paintFrame !== null) window.cancelAnimationFrame(paintFrame)
  frameProfiler.clear()
  renderer?.dispose()
  renderer = null
})
</script>

<style scoped>
.wallpaper-refraction {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  display: block;
  pointer-events: none;
  background: transparent;
  contain: strict;
}
</style>
