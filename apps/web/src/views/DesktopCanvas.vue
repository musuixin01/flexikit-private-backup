<template>
  <main class="desktop-canvas" :class="{ 'is-editing': canvas.editMode, 'is-wallpaper-refracting': refractionReady }">
    <div class="canvas-backdrop" aria-hidden="true"></div>

    <div class="canvas-controls liquid-panel" :style="controlsStyle">
      <div class="canvas-brand">
        <img src="/icon/icon_256x256.ico" alt="">
        <span><strong>FlexiKit Canvas</strong><small>{{ canvas.widgets.length }} 个组件 · 20px 栅格 · {{ monitorSummary }} · {{ desktopAttached ? '桌面层' : '窗口模式' }}</small></span>
      </div>
      <div class="canvas-actions">
        <button type="button" class="canvas-action-primary" @click="openToolPicker()">＋ 添加工具</button>
        <button type="button" @click="openWidgetPalette">＋ 组件</button>
        <button type="button" :class="{ active: canvas.editMode }" @click="toggleEditMode">
          {{ canvas.editMode ? '完成' : '编辑' }}
        </button>
        <button type="button" :class="{ active: moreActionsOpen }" :aria-expanded="moreActionsOpen"
          aria-controls="canvas-more-actions" @click="toggleMoreActions">更多 ···</button>
        <button type="button" class="close-action" aria-label="关闭画布" @click="hideCanvas">×</button>
      </div>
      <div v-if="moreActionsOpen" id="canvas-more-actions" class="canvas-more-menu liquid-panel" @keydown.esc.stop="moreActionsOpen = false; scheduleInteractiveRegionSync()">
        <button type="button" @click="runMoreAction(openTemplates)">控制台模板</button>
        <button v-if="isDesktopRuntime()" type="button" class="refraction-toggle" :class="{ active: refractionReady }"
          :disabled="refractionLoading" :aria-pressed="refractionReady" :title="refractionTooltip"
          @click="runMoreAction(toggleWallpaperRefraction)">{{ refractionLoading ? '读取壁纸…' : refractionReady ? '关闭折射' : '试用折射' }}</button>
        <button v-if="canvas.templateBackupAvailable" type="button" title="恢复应用模板之前的完整画布布局"
          @click="runMoreAction(restorePreviousLayout)">恢复布局</button>
        <button type="button" @click="runMoreAction(arrangeCanvas)">自动整理</button>
        <div class="canvas-more-divider"></div>
        <button type="button" class="canvas-more-danger" @click="confirmResetCanvas">重置画布…</button>
      </div>
    </div>

    <transition name="palette-pop">
      <section v-if="paletteOpen" class="widget-palette liquid-panel" :style="paletteStyle">
        <header><strong>添加组件</strong><span>可以重复添加，位置和尺寸完全自由</span></header>
        <div class="palette-grid">
          <button v-for="definition in definitions" :key="definition.type" type="button" @click="addDefinition(definition)">
            <span class="palette-icon">{{ definition.icon }}</span>
            <span><strong>{{ definition.title }}</strong><small>{{ definition.description }}</small></span>
            <i>＋</i>
          </button>
        </div>
      </section>
    </transition>

    <transition name="palette-pop">
      <aside v-if="canvas.editMode && canvas.activeWidget && inspectorWidgetId === canvas.activeWidget.id" class="widget-inspector liquid-panel" :style="inspectorStyle">
        <header class="inspector-head">
          <span>
            <strong>{{ canvas.selectedWidgets.length > 1 ? `${canvas.selectedWidgets.length} 个组件` : canvas.activeWidget.title }}</strong>
            <small>{{ canvas.selectedWidgets.length > 1 ? '批量编辑外观 · Shift 多选' : '组件属性' }}</small>
          </span>
          <button type="button" aria-label="关闭属性面板" @click="inspectorWidgetId = null">×</button>
        </header>

        <label v-if="canvas.selectedWidgets.length === 1" class="inspector-field">
          <span>名称</span>
          <input :value="canvas.activeWidget.title" type="text" maxlength="40" @input="updateSelectedTitle">
        </label>

        <label v-if="canvas.selectedWidgets.length === 1 && canvas.monitors.length > 1" class="inspector-field">
          <span>显示器</span>
          <select :value="canvas.activeWidget.monitorId || canvas.primaryMonitor?.id || ''" @change="updateSelectedMonitor">
            <option v-for="monitor in canvas.monitors" :key="monitor.id" :value="monitor.id">
              {{ monitor.name }}{{ monitor.isPrimary ? ' · 主屏' : '' }} · {{ Math.round(monitor.scaleFactor * 100) }}%
            </option>
          </select>
        </label>

        <div class="inspector-actions">
          <button v-if="canvas.canGroupSelection" type="button" @click="canvas.groupSelection">组合</button>
          <button v-if="canvas.canUngroupSelection" type="button" @click="canvas.ungroupSelection">拆分</button>
          <button type="button" @click="canvas.setSelectedLocked(!allSelectedLocked)">
            {{ allSelectedLocked ? '解锁' : '锁定' }}
          </button>
        </div>

        <section class="appearance-section">
          <div class="appearance-title">
            <strong>外观</strong>
            <small>{{ activeAppearanceLabel }} · {{ canvas.activeWidget.appearance.preset === 'custom' ? '高级中可微调' : '一键完成' }}</small>
          </div>

          <div class="appearance-presets appearance-quick-presets">
            <button
              v-for="preset in quickAppearancePresets"
              :key="preset.id"
              type="button"
              :class="{ active: canvas.activeWidget.appearance.preset === preset.id }"
              :aria-pressed="canvas.activeWidget.appearance.preset === preset.id"
              @click="applyAppearancePreset(preset.id)"
            >
              <i :class="`preset-${preset.id}`"></i>
              <span><strong>{{ quickPresetTitle(preset.id) }}</strong></span>
            </button>
          </div>

          <details class="inspector-advanced" :key="inspectorWidgetId" @toggle="scheduleInteractiveRegionSync">
            <summary>高级外观设置 <small>通常无需调整</small></summary>
            <div class="appearance-advanced-content">
              <div class="appearance-other-presets">
                <span>其他风格</span>
                <div class="appearance-presets">
                  <button
                    v-for="preset in extraAppearancePresets"
                    :key="preset.id"
                    type="button"
                    :class="{ active: canvas.activeWidget.appearance.preset === preset.id }"
                    @click="applyAppearancePreset(preset.id)"
                  >
                    <i :class="`preset-${preset.id}`"></i>
                    <span><strong>{{ preset.title }}</strong><small>{{ preset.description }}</small></span>
                  </button>
                </div>
              </div>
              <div class="tone-row">
            <span>表面色调</span>
            <div class="tone-picker">
              <button type="button" :class="{ active: canvas.activeWidget.appearance.tone === 'adaptive' }" @click="updateAppearanceTone('adaptive')">跟随</button>
              <button type="button" :class="{ active: canvas.activeWidget.appearance.tone === 'dark' }" @click="updateAppearanceTone('dark')">深色</button>
              <button type="button" :class="{ active: canvas.activeWidget.appearance.tone === 'light' }" @click="updateAppearanceTone('light')">浅色</button>
            </div>
          </div>

          <label class="range-row">
            <span>整体不透明度（含文字） <b>{{ Math.round(canvas.activeWidget.appearance.opacity * 100) }}%</b></span>
            <input
              type="range"
              min="20"
              max="100"
              step="1"
              :value="canvas.activeWidget.appearance.opacity * 100"
              :style="rangeProgress(canvas.activeWidget.appearance.opacity * 100, 20, 100)"
              @input="updateAppearance('opacity', $event, 0.01)"
            >
          </label>

          <label class="range-row">
            <span>圆角 <b>{{ Math.round(canvas.activeWidget.appearance.borderRadius) }} px</b></span>
            <input
              type="range"
              min="0"
              max="48"
              step="1"
              :value="canvas.activeWidget.appearance.borderRadius"
              :style="rangeProgress(canvas.activeWidget.appearance.borderRadius, 0, 48)"
              @input="updateAppearance('borderRadius', $event)"
            >
          </label>

          <label class="range-row">
            <span>玻璃模糊 <b>{{ Math.round(canvas.activeWidget.appearance.blur) }} px</b></span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              :value="canvas.activeWidget.appearance.blur"
              :style="rangeProgress(canvas.activeWidget.appearance.blur, 0, 60)"
              @input="updateAppearance('blur', $event)"
            >
          </label>

          <label class="range-row">
            <span>玻璃浓度（只改变背景） <b>{{ Math.round(canvas.activeWidget.appearance.surfaceOpacity * 100) }}%</b></span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              :value="canvas.activeWidget.appearance.surfaceOpacity * 100"
              :style="rangeProgress(canvas.activeWidget.appearance.surfaceOpacity * 100, 0, 100)"
              @input="updateAppearance('surfaceOpacity', $event, 0.01)"
            >
          </label>

          <label class="range-row">
            <span>边框强度 <b>{{ Math.round(canvas.activeWidget.appearance.borderStrength * 100) }}%</b></span>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              :value="canvas.activeWidget.appearance.borderStrength * 100"
              :style="rangeProgress(canvas.activeWidget.appearance.borderStrength * 100, 0, 50)"
              @input="updateAppearance('borderStrength', $event, 0.01)"
            >
          </label>

          <label class="range-row">
            <span>阴影强度 <b>{{ Math.round(canvas.activeWidget.appearance.shadowStrength * 100) }}%</b></span>
            <input
              type="range"
              min="0"
              max="35"
              step="1"
              :value="canvas.activeWidget.appearance.shadowStrength * 100"
              :style="rangeProgress(canvas.activeWidget.appearance.shadowStrength * 100, 0, 35)"
              @input="updateAppearance('shadowStrength', $event, 0.01)"
            >
          </label>
              <div v-if="canvas.selectedWidgets.length === 1" class="position-inspector">
                <span>精确位置 <small>平时直接拖动组件即可</small></span>
                <div>
                  <label>X <input type="number" step="20" :disabled="canvas.activeWidget.locked" :value="Math.round(canvas.activeWidget.frame.x)" @change="updateSelectedCoordinate('x', $event)"></label>
                  <label>Y <input type="number" step="20" :disabled="canvas.activeWidget.locked" :value="Math.round(canvas.activeWidget.frame.y)" @change="updateSelectedCoordinate('y', $event)"></label>
                </div>
              </div>
            </div>
          </details>
        </section>

        <details v-if="canvas.selectedWidgets.length === 1 && activeConfigFields.length" class="config-section config-details" @toggle="scheduleInteractiveRegionSync">
          <summary>组件功能设置 <small>需要时再调整</small></summary>
          <div class="config-title">
            <span><strong>组件设置</strong><small>由 Widget Registry 自动生成</small></span>
            <button type="button" @click="resetWidgetConfig">恢复默认</button>
          </div>

          <div class="config-list">
            <div
              v-for="field in activeConfigFields"
              :key="field.key"
              class="config-control"
              :class="{ 'config-control-section': field.type === 'section' }"
            >
              <div v-if="field.type === 'section'" class="config-schema-section">
                <strong>{{ field.label }}</strong>
                <small v-if="field.description">{{ field.description }}</small>
              </div>

              <button
                v-else-if="field.type === 'boolean'"
                type="button"
                class="config-switch-row"
                :aria-pressed="configBooleanValue(field)"
                @click="toggleWidgetConfig(field)"
              >
                <span><strong>{{ field.label }}</strong><small v-if="field.description">{{ field.description }}</small></span>
                <i :class="{ active: configBooleanValue(field) }"><b></b></i>
              </button>

              <label v-else-if="field.type === 'select'" class="config-field">
                <span><strong>{{ field.label }}</strong><small v-if="field.description">{{ field.description }}</small></span>
                <select :value="configStringValue(field)" @change="updateWidgetConfigSelect(field, $event)">
                  <option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option>
                </select>
              </label>

              <label v-else-if="field.type === 'range'" class="range-row config-range">
                <span>
                  <strong>{{ field.label }}</strong>
                  <b>{{ configNumberValue(field) }}{{ field.unit ? ' ' + field.unit : '' }}</b>
                </span>
                <input
                  type="range"
                  :min="field.min"
                  :max="field.max"
                  :step="field.step"
                  :value="configNumberValue(field)"
                  :style="rangeProgress(configNumberValue(field), field.min, field.max)"
                  @input="updateWidgetConfigRange(field, $event)"
                >
                <small v-if="field.description">{{ field.description }}</small>
              </label>

              <label v-else-if="field.type === 'number'" class="config-field">
                <span><strong>{{ field.label }}</strong><small v-if="field.description">{{ field.description }}</small></span>
                <div class="config-number-control">
                  <input
                    type="number"
                    :min="field.min"
                    :max="field.max"
                    :step="field.step"
                    :value="configNumberValue(field)"
                    :placeholder="field.placeholder"
                    @input="updateWidgetConfigNumber(field, $event)"
                  >
                  <b v-if="field.unit">{{ field.unit }}</b>
                </div>
              </label>

              <label v-else-if="field.type === 'color'" class="config-field">
                <span><strong>{{ field.label }}</strong><small v-if="field.description">{{ field.description }}</small></span>
                <div class="config-color-control">
                  <input
                    type="color"
                    :value="configStringValue(field)"
                    @input="updateWidgetConfigColor(field, $event)"
                  >
                  <code>{{ configStringValue(field).toUpperCase() }}</code>
                </div>
              </label>

              <label v-else-if="field.type === 'text'" class="config-field">
                <span><strong>{{ field.label }}</strong><small v-if="field.description">{{ field.description }}</small></span>
                <input
                  type="text"
                  :value="configStringValue(field)"
                  :placeholder="field.placeholder"
                  :maxlength="field.maxLength"
                  @input="updateWidgetConfigText(field, $event)"
                >
              </label>
            </div>
          </div>
        </details>

        <p class="inspector-tip">直接拖动调整位置和大小。更多设置仅在需要时展开。</p>
      </aside>
    </transition>

    <section class="canvas-stage" @pointerdown.self="onStagePointerDown">
      <CanvasRefractionLayer v-if="wallpaperSample" :wallpaper="wallpaperSample" :widgets="canvas.orderedWidgets"
        :editing="canvas.editMode" @ready="onWallpaperRefractionReady" @error="onWallpaperRefractionError" @stats="onRefractionFrameStats" />
      <template v-if="canvas.editMode && canvas.monitors.length > 1">
        <div
          v-for="monitor in canvas.monitors"
          :key="monitor.id"
          class="monitor-guide"
          :style="monitorGuideStyle(monitor)"
        >
          <span>{{ monitor.name }}{{ monitor.isPrimary ? ' · 主屏' : '' }} · {{ Math.round(monitor.scaleFactor * 100) }}%</span>
        </div>
      </template>
      <WidgetHost
        v-for="widget in canvas.orderedWidgets"
        :key="widget.id"
        :widget="widget"
        :editing="canvas.editMode"
        @open-settings="openWidgetInspector"
      />
    </section>
    <CanvasToolPicker :open="toolPickerOpen" :selected="pickerSelected" @close="closeToolPicker" @toggle="togglePinnedTool" @create-web="openWebToolImport" @create-local="openLocalToolImport" />
    <CanvasConsoleTemplates :open="templatesOpen" @close="templatesOpen = false" @apply="applyConsoleTemplate" />
    <WebToolImportModal ref="webImportRef" />
    <LocalToolImportModal ref="localImportRef" />
    <ToastMessage />
  </main>
</template>

<script setup lang="ts">
import '@/styles/canvas-liquid-glass.css'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { CSSProperties } from 'vue'
import WidgetHost from '@/components/desktop/WidgetHost.vue'
import CanvasRefractionLayer from '@/components/desktop/CanvasRefractionLayer.vue'
import { validateWallpaperSnapshot, type WallpaperSnapshot } from '@/desktop/wallpaperLayout'
import { hasCanvasMonitorTopologyChanged } from '@/desktop/canvasRefractionLifecycle'
import type { CanvasFrameSummary } from '@/desktop/canvasRefractionLifecycle'
import CanvasToolPicker from '@/components/desktop/CanvasToolPicker.vue'
import CanvasConsoleTemplates from '@/components/desktop/CanvasConsoleTemplates.vue'
import WebToolImportModal from '@/components/tools/WebToolImportModal.vue'
import LocalToolImportModal from '@/components/tools/LocalToolImportModal.vue'
import ToastMessage from '@/components/common/ToastMessage.vue'
import { createCanvasTemplateWidgets, type CanvasConsoleRequest } from '@/desktop/canvasTemplates'
import { getWidgetConfigDefaults, getWidgetDefinition, isWidgetConfigField, isWidgetConfigSchemaItemVisible, listWidgetDefinitions, resolveWidgetConfigValue, type WidgetConfigPrimitive, type WidgetConfigSchemaItem, type WidgetDefinition } from '@/desktop/widgetRegistry'
import { useDesktopCanvasStore } from '@/stores/desktopCanvas'
import { useToolsStore } from '@/stores/tools'
import { invokeDesktop, isDesktopRuntime } from '@/api/runtime'
import { WIDGET_APPEARANCE_PRESETS } from '@/desktop/widgetAppearance'
import type { CanvasMonitorInfo, WidgetAppearance, WidgetAppearancePreset, WidgetSurfaceTone } from '@/types/desktopWidget'

const canvas = useDesktopCanvasStore()
const tools = useToolsStore()
const paletteOpen = ref(false)
const toolPickerOpen = ref(false)
const toolPickerTargetId = ref<string | null>(null)
const templatesOpen = ref(false)
const moreActionsOpen = ref(false)
const webImportRef = ref<InstanceType<typeof WebToolImportModal> | null>(null)
const localImportRef = ref<InstanceType<typeof LocalToolImportModal> | null>(null)
const pickerSelected = computed(() => {
  const target = canvas.widgets.find(item => item.id === toolPickerTargetId.value)
  const keys = target?.config.toolKeys
  if (Array.isArray(keys)) return keys.filter((value): value is string => typeof value === 'string')
  return target ? tools.allTools.slice(0, 8).map(tool => tools.getToolKey(tool)) : []
})
const inspectorWidgetId = ref<string | null>(null)
const desktopAttached = ref(false)
const wallpaperSample = ref<WallpaperSnapshot | null>(null)
const refractionReady = ref(false)
const refractionLoading = ref(false)
const refractionNotice = ref('')
const refractionFrameStats = ref<CanvasFrameSummary | null>(null)
const refractionTooltip = computed(() => {
  const base = refractionNotice.value || '实验性本机静态壁纸 GPU 折射；不采集窗口或桌面图标'
  return refractionFrameStats.value
    ? `${base} · CPU 绘图提交 P95 ${refractionFrameStats.value.p95_ms.toFixed(2)}ms（不含 GPU 执行时间）`
    : base
})
function onRefractionFrameStats(summary: CanvasFrameSummary): void {
  refractionFrameStats.value = summary
}
// Serialize native consent updates: rapid on→off interactions must not
// leave a late on() IPC overwriting the user's explicit cancellation.
let nativeRefractionConsentChain: Promise<unknown> = Promise.resolve()
function updateNativeRefractionConsent(enabled: boolean): void {
  nativeRefractionConsentChain = nativeRefractionConsentChain.catch(() => undefined)
    .then(() => invokeDesktop('set_canvas_refraction_session_opt_in', { enabled }))
    .catch(() => undefined)
}
let refractionRequestId = 0

// Explicit user opt-in. Wallpaper bytes exist only in the current Canvas view
// memory and never flow through Pinia, localStorage, logs or a remote service.
async function toggleWallpaperRefraction(): Promise<void> {
  if (refractionLoading.value) return
  if (wallpaperSample.value !== null || refractionReady.value) {
    disableWallpaperRefraction()
    return
  }
  refractionLoading.value = true
  refractionNotice.value = ''
  const requestId = ++refractionRequestId
  try {
    const sample = await invokeDesktop<WallpaperSnapshot | null>('get_canvas_wallpaper_preview')
    if (refractionRequestId !== requestId) return
    if (!sample || !validateWallpaperSnapshot(sample)) {
      refractionNotice.value = '当前壁纸或显示器排列暂不支持折射；已保留普通玻璃'
      return
    }
    wallpaperSample.value = sample
    // Keep loading until the renderer says its WebGL scene is usable.
    return
  } catch {
    refractionNotice.value = '折射暂时不可用；已保留普通玻璃'
  } finally {
    if (refractionRequestId === requestId && !wallpaperSample.value) refractionLoading.value = false
  }
}
function onWallpaperRefractionReady(): void {
  refractionReady.value = true
  refractionLoading.value = false
  refractionNotice.value = '本机静态壁纸折射预览 · 非真实桌面窗口采样'
  // Session consent is recorded only AFTER the first successful GPU frame.
  // A WorkerW recreation can resume it once, with no localStorage and no
  // wallpaper image or filepath cached by the native process.
  updateNativeRefractionConsent(true)
}
function onWallpaperRefractionError(message: string): void {
  disableWallpaperRefraction()
  refractionNotice.value = message
}
function disableWallpaperRefraction(clearSession = true): void {
  refractionRequestId += 1
  refractionReady.value = false
  refractionLoading.value = false
  wallpaperSample.value = null
  refractionFrameStats.value = null
  if (clearSession) {
    // Explicit user cancellation, failure or genuinely changed monitor
    // topology revokes the in-memory opt-in immediately.
    updateNativeRefractionConsent(false)
  }
}

let regionSyncFrame: number | null = null
let monitorRefreshTimer: number | null = null
type NativeCanvasMonitorTuple = [string, string, number, number, number, number, number, boolean]
const definitions = listWidgetDefinitions().filter(definition => definition.type !== 'desktop-organizer')
const appearancePresets = WIDGET_APPEARANCE_PRESETS
const quickAppearancePresets = appearancePresets.filter(item => item.id === 'glass' || item.id === 'clear' || item.id === 'dense')
const extraAppearancePresets = appearancePresets.filter(item => item.id === 'space' || item.id === 'solid')
const activeAppearanceLabel = computed(() => appearancePresets.find(item =>
  item.id === canvas.activeWidget?.appearance.preset)?.title ?? '已自定义')
function quickPresetTitle(id: WidgetAppearancePreset): string {
  return id === 'glass' ? '标准' : id === 'clear' ? '轻透' : '柔和'
}
function toggleMoreActions(): void {
  moreActionsOpen.value = !moreActionsOpen.value
  scheduleInteractiveRegionSync()
}
function runMoreAction(action: () => void | Promise<void>): void {
  moreActionsOpen.value = false
  void action()
  scheduleInteractiveRegionSync()
}
function confirmResetCanvas(): void {
  moreActionsOpen.value = false
  if (window.confirm('确定重置桌面画布吗？这会替换当前组件和布局。')) canvas.reset()
  scheduleInteractiveRegionSync()
}
const activeDefinition = computed(() => {
  const widget = canvas.activeWidget
  return widget ? getWidgetDefinition(widget.type) : undefined
})
const activeConfigFields = computed<WidgetConfigSchemaItem[]>(() => {
  if (canvas.selectedWidgets.length !== 1) return []
  const schema = activeDefinition.value?.configSchema ?? []
  const config = canvas.activeWidget?.config ?? {}
  return schema.filter(item => isWidgetConfigSchemaItemVisible(item, config, schema))
})
const allSelectedLocked = computed(() => (
  canvas.selectedWidgets.length > 0 && canvas.selectedWidgets.every(widget => widget.locked)
))
const monitorSummary = computed(() => {
  if (!canvas.monitors.length) return '显示器检测中'
  const primary = canvas.primaryMonitor
  if (canvas.monitors.length === 1) {
    return `1 屏 · ${Math.round((primary?.scaleFactor ?? 1) * 100)}%`
  }
  return `${canvas.monitors.length} 屏 · 主屏 ${Math.round((primary?.scaleFactor ?? 1) * 100)}%`
})
const controlsStyle = computed<CSSProperties>(() => {
  const monitor = canvas.primaryMonitor
  if (!monitor) return {}
  return {
    left: `${monitor.x + 18}px`,
    top: `${monitor.y + 16}px`,
    right: 'auto',
    width: `${Math.max(320, monitor.width - 36)}px`,
  }
})

const paletteStyle = computed<CSSProperties>(() => {
  const monitor = canvas.primaryMonitor
  if (!monitor) return {}
  const width = Math.min(390, Math.max(280, monitor.width - 36))
  return {
    left: `${monitor.x + monitor.width - width - 18}px`,
    top: `${monitor.y + 70}px`,
    right: 'auto',
    width: `${width}px`,
  }
})

const inspectorStyle = computed<CSSProperties>(() => {
  const monitor = canvas.primaryMonitor
  if (!monitor) return {}
  return {
    left: `${monitor.x + 18}px`,
    top: `${monitor.y + 72}px`,
  }
})

function monitorGuideStyle(monitor: CanvasMonitorInfo): CSSProperties {
  return {
    left: `${monitor.x}px`,
    top: `${monitor.y}px`,
    width: `${monitor.width}px`,
    height: `${monitor.height}px`,
  }
}

function rangeProgress(value: number, min: number, max: number): Record<string, string> {
  const progress = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return { '--range-progress': `${progress}%` }
}

function openToolPicker(widgetId?: string): void {
  moreActionsOpen.value = false
  toolPickerTargetId.value = widgetId ?? canvas.widgets.find(item => item.type === 'tool-dock')?.id ?? null
  canvas.editMode = true
  templatesOpen.value = false
  paletteOpen.value = false
  toolPickerOpen.value = true
  scheduleInteractiveRegionSync()
}

function handleOpenToolPicker(event: Event): void {
  const request = event as CustomEvent<{ widgetId?: string }>
  openToolPicker(request.detail?.widgetId)
}

function closeToolPicker(): void {
  toolPickerOpen.value = false
  scheduleInteractiveRegionSync()
}

function ensureDock(): string {
  const existing = canvas.widgets.find(item => item.id === toolPickerTargetId.value)
  if (existing?.type === 'tool-dock') return existing.id
  const definition = getWidgetDefinition('tool-dock')
  if (!definition) throw new Error('Tool Dock widget is not registered')
  const dock = canvas.addWidget('tool-dock', {
    title: definition.title,
    frame: { width: definition.defaultWidth, height: definition.defaultHeight },
    config: { toolKeys: [] },
  })
  toolPickerTargetId.value = dock.id
  return dock.id
}

function togglePinnedTool(key: string): void {
  // A key is a reference to the existing trusted Tools Store, not a saved path.
  if (!tools.allTools.some(tool => tools.getToolKey(tool) === key)) return
  const id = ensureDock()
  const keys = pickerSelected.value
  canvas.updateWidget(id, { config: { toolKeys: keys.includes(key) ? keys.filter(item => item !== key) : [...keys, key] } })
}

function openWebToolImport(): void {
  // Existing importer has its own modal overlay. Hide the Canvas picker first.
  closeToolPicker()
  webImportRef.value?.open()
}

function openLocalToolImport(): void {
  closeToolPicker()
  localImportRef.value?.open()
}

function openTemplates(): void {
  moreActionsOpen.value = false
  canvas.editMode = true
  paletteOpen.value = false
  toolPickerOpen.value = false
  templatesOpen.value = true
  scheduleInteractiveRegionSync()
}

function applyConsoleTemplate(request: CanvasConsoleRequest): void {
  const widgets = createCanvasTemplateWidgets(request, canvas.primaryMonitor)
  if (!widgets.length) return
  try {
    canvas.applyTemplateLayout(widgets)
    templatesOpen.value = false
    inspectorWidgetId.value = null
    paletteOpen.value = false
    scheduleInteractiveRegionSync()
  } catch {
    // Do not replace a layout if its on-device safety backup cannot be written.
    window.alert('本机备份失败，已保留原来的画布。请确认设备有可用存储空间。')
  }
}

function restorePreviousLayout(): void {
  if (canvas.restoreTemplateBackup()) {
    templatesOpen.value = false
    toolPickerOpen.value = false
    inspectorWidgetId.value = null
    scheduleInteractiveRegionSync()
  }
}

function openWidgetPalette(): void {
  moreActionsOpen.value = false
  canvas.editMode = true
  canvas.clearSelection()
  inspectorWidgetId.value = null
  paletteOpen.value = true
  scheduleInteractiveRegionSync()
}

function openWidgetInspector(widgetId: string): void {
  moreActionsOpen.value = false
  canvas.editMode = true
  paletteOpen.value = false
  canvas.selectWidget(widgetId)
  inspectorWidgetId.value = widgetId
  scheduleInteractiveRegionSync()
}

function addDefinition(definition: WidgetDefinition): void {
  if (definition.plugin.instancePolicy === 'single') {
    const existing = canvas.widgets.find(widget => widget.type === definition.type)
    if (existing) {
      canvas.editMode = true
      canvas.selectWidget(existing.id)
      inspectorWidgetId.value = null
      paletteOpen.value = false
      return
    }
  }

  const widget = canvas.addWidget(definition.type, {
    title: definition.title,
    frame: {
      width: definition.defaultWidth,
      height: definition.defaultHeight,
    },
    config: getWidgetConfigDefaults(definition),
  })
  canvas.editMode = true
  canvas.selectWidget(widget.id)
  inspectorWidgetId.value = null
  paletteOpen.value = false
}

function ensureDesktopOrganizer(): void {
  if (!isDesktopRuntime() || canvas.widgets.some(widget => widget.type === 'desktop-organizer') || canvas.widgets.some(widget => typeof widget.config.consoleTemplateId === 'string')) return
  const definition = getWidgetDefinition('desktop-organizer')
  if (!definition) return
  canvas.addWidget(definition.type, {
    title: definition.title,
    frame: {
      width: definition.defaultWidth,
      height: definition.defaultHeight,
    },
    config: getWidgetConfigDefaults(definition),
  })
}

function toggleEditMode(): void {
  moreActionsOpen.value = false
  scheduleInteractiveRegionSync()
  canvas.editMode = !canvas.editMode
  if (!canvas.editMode) {
    canvas.clearSelection()
    inspectorWidgetId.value = null
  }
}

function arrangeCanvas(): void {
  canvas.arrangeWidgets()
  canvas.editMode = true
  canvas.clearSelection()
  inspectorWidgetId.value = null
  scheduleInteractiveRegionSync()
}

function onStagePointerDown(): void {
  moreActionsOpen.value = false
  scheduleInteractiveRegionSync()
  paletteOpen.value = false
  inspectorWidgetId.value = null
  if (canvas.editMode) canvas.clearSelection()
}

function updateSelectedTitle(event: Event): void {
  const target = event.target as HTMLInputElement
  canvas.updateSelectedTitle(target.value)
}

function updateSelectedCoordinate(axis: 'x' | 'y', event: Event): void {
  const widget = canvas.activeWidget
  const target = event.target as HTMLInputElement
  const number = Number(target.value)
  if (!widget || widget.locked || !Number.isFinite(number)) return
  canvas.updateFrame(widget.id, { [axis]: number })
  canvas.snapWidgetFrame(widget.id)
  scheduleInteractiveRegionSync()
}

function updateSelectedMonitor(event: Event): void {
  const widget = canvas.activeWidget
  const target = event.target as HTMLSelectElement
  if (!widget || !target.value) return
  canvas.moveWidgetToMonitor(widget.id, target.value)
  scheduleInteractiveRegionSync()
}

type NumericAppearanceKey = 'opacity' | 'borderRadius' | 'blur' | 'surfaceOpacity' | 'borderStrength' | 'shadowStrength'

function applyAppearancePreset(id: Exclude<WidgetAppearancePreset, 'custom'>): void {
  const preset = appearancePresets.find(item => item.id === id)
  if (!preset) return
  canvas.updateSelectedAppearance({ ...preset.appearance })
}

function updateAppearanceTone(tone: WidgetSurfaceTone): void {
  canvas.updateSelectedAppearance({ preset: 'custom', tone })
}

function updateAppearance(key: NumericAppearanceKey, event: Event, scale = 1): void {
  const target = event.target as HTMLInputElement
  const value = Number(target.value)
  if (!Number.isFinite(value)) return
  const patch: Partial<WidgetAppearance> = {
    preset: 'custom',
    [key]: value * scale,
  }
  canvas.updateSelectedAppearance(patch)
}

function configValue(field: WidgetConfigSchemaItem): WidgetConfigPrimitive {
  if (!isWidgetConfigField(field)) return ''
  return resolveWidgetConfigValue(field, canvas.activeWidget?.config ?? {})
}

function configBooleanValue(field: WidgetConfigSchemaItem): boolean {
  const value = configValue(field)
  return typeof value === 'boolean' ? value : false
}

function configNumberValue(field: WidgetConfigSchemaItem): number {
  const value = configValue(field)
  return typeof value === 'number' ? value : 0
}

function configStringValue(field: WidgetConfigSchemaItem): string {
  const value = configValue(field)
  return typeof value === 'string' ? value : ''
}

function toggleWidgetConfig(field: WidgetConfigSchemaItem): void {
  if (field.type !== 'boolean') return
  canvas.updateSelectedConfig({ [field.key]: !configBooleanValue(field) })
}

function updateWidgetConfigSelect(field: WidgetConfigSchemaItem, event: Event): void {
  if (field.type !== 'select') return
  const target = event.target as HTMLSelectElement
  const value = resolveWidgetConfigValue(field, { [field.key]: target.value })
  canvas.updateSelectedConfig({ [field.key]: value })
}

function updateWidgetConfigRange(field: WidgetConfigSchemaItem, event: Event): void {
  if (field.type !== 'range') return
  const target = event.target as HTMLInputElement
  const value = Number(target.value)
  if (!Number.isFinite(value)) return
  canvas.updateSelectedConfig({
    [field.key]: resolveWidgetConfigValue(field, { [field.key]: value }),
  })
}

function updateWidgetConfigNumber(field: WidgetConfigSchemaItem, event: Event): void {
  if (field.type !== 'number') return
  const target = event.target as HTMLInputElement
  const value = Number(target.value)
  if (!Number.isFinite(value)) return
  canvas.updateSelectedConfig({
    [field.key]: resolveWidgetConfigValue(field, { [field.key]: value }),
  })
}

function updateWidgetConfigText(field: WidgetConfigSchemaItem, event: Event): void {
  if (field.type !== 'text') return
  const target = event.target as HTMLInputElement
  canvas.updateSelectedConfig({
    [field.key]: resolveWidgetConfigValue(field, { [field.key]: target.value }),
  })
}

function updateWidgetConfigColor(field: WidgetConfigSchemaItem, event: Event): void {
  if (field.type !== 'color') return
  const target = event.target as HTMLInputElement
  canvas.updateSelectedConfig({
    [field.key]: resolveWidgetConfigValue(field, { [field.key]: target.value }),
  })
}

function resetWidgetConfig(): void {
  const definition = activeDefinition.value
  if (!definition) return
  canvas.updateSelectedConfig(getWidgetConfigDefaults(definition))
}

async function hideCanvas(): Promise<void> {
  moreActionsOpen.value = false
  await invokeDesktop('hide_desktop_canvas')
}

async function refreshMonitorTopology(): Promise<void> {
  try {
    const rows = await invokeDesktop<NativeCanvasMonitorTuple[]>('get_canvas_monitor_layout')
    const monitorList: CanvasMonitorInfo[] = rows.map(([
      id,
      name,
      x,
      y,
      width,
      height,
      scaleFactor,
      isPrimary,
    ]) => ({
      id,
      name,
      x,
      y,
      width,
      height,
      scaleFactor,
      isPrimary,
    }))
    // Native resize and ordinary WorkerW reattach both fire this event.
    // Only an actual display topology/DPI change invalidates the atlas.
    if ((wallpaperSample.value !== null || refractionReady.value || refractionLoading.value)
      && hasCanvasMonitorTopologyChanged(canvas.monitors, monitorList)) {
      disableWallpaperRefraction()
    }
    canvas.setMonitorTopology(monitorList)
  } catch {
    // 浏览器模式或原生显示器接口尚未就绪时保留当前布局。
  }
}

function handleCanvasResize(): void {
  scheduleInteractiveRegionSync()
  if (monitorRefreshTimer !== null) window.clearTimeout(monitorRefreshTimer)
  monitorRefreshTimer = window.setTimeout(() => {
    monitorRefreshTimer = null
    void refreshMonitorTopology()
  }, 140)
}

function handleCanvasTopologyChanged(): void {
  // No unconditional disable: native "Resized" also fires on harmless desktop
  // layer reparenting. Compare the OS monitor snapshot before invalidating.
  void refreshMonitorTopology().finally(scheduleInteractiveRegionSync)
}

function scheduleInteractiveRegionSync(): void {
  if (regionSyncFrame !== null) window.cancelAnimationFrame(regionSyncFrame)
  regionSyncFrame = window.requestAnimationFrame(() => {
    regionSyncFrame = null
    void syncInteractiveRegions()
  })
}

async function syncInteractiveRegions(): Promise<void> {
  await nextTick()
  const regions = Array.from(
    document.querySelectorAll<HTMLElement>('.widget-host, .canvas-controls, .canvas-more-menu, .widget-palette, .widget-inspector, .launcher-overlay, .canvas-tool-panel, .preset-panel, .web-import-panel, .local-import-panel'),
  ).map(element => {
    const rect = element.getBoundingClientRect()
    const radius = Number.parseFloat(window.getComputedStyle(element).borderTopLeftRadius) || 0
    return [rect.left, rect.top, rect.width, rect.height, radius]
  }).filter(([, , width, height]) => width > 0 && height > 0)

  try {
    await invokeDesktop('set_canvas_interactive_regions', {
      regions,
      editMode: canvas.editMode,
    })
  } catch {
    // 非 Windows 或原生桥未就绪时继续使用普通窗口交互。
  }
}

watch(
  [() => canvas.editMode, () => paletteOpen.value, () => canvas.selectedWidgetIds],
  scheduleInteractiveRegionSync,
  { deep: true },
)

watch(
  () => canvas.activeWidget?.id ?? null,
  activeId => {
    if (inspectorWidgetId.value && inspectorWidgetId.value !== activeId) {
      inspectorWidgetId.value = null
    }
  },
)

watch(
  () => canvas.widgets,
  () => {
    if (!canvas.editMode) scheduleInteractiveRegionSync()
  },
  { deep: true },
)

onMounted(async () => {
  document.documentElement.classList.add('desktop-canvas-window')
  canvas.init()

  try {
    desktopAttached.value = await invokeDesktop<boolean>('attach_desktop_canvas')
  } catch {
    desktopAttached.value = false
  }

  await refreshMonitorTopology()
  canvas.upgradeLegacyStarterLayout()
  ensureDesktopOrganizer()
  scheduleInteractiveRegionSync()
  window.addEventListener('resize', handleCanvasResize)
  window.addEventListener('flexikit:canvas-regions-changed', scheduleInteractiveRegionSync)
  window.addEventListener('flexikit:canvas-topology-changed', handleCanvasTopologyChanged)
  window.addEventListener('flexikit:open-widget-palette', openWidgetPalette)
  window.addEventListener('flexikit:canvas-open-tool-picker', handleOpenToolPicker)
  if (!tools.isLoaded) await tools.initData()
  // Only a WindowW/Explorer genuinely recreated within this running native
  // process may consume this volatile flag. Cold starts never auto-read images.
  if (isDesktopRuntime()) {
    try {
      const resume = await invokeDesktop<boolean>('consume_canvas_refraction_recovery_opt_in')
      if (resume) void toggleWallpaperRefraction()
    } catch { /* recovery is optional; default ordinary liquid glass remains */ }
  }
})

onBeforeUnmount(() => {
  // This WebView is also destroyed during Explorer recovery. Keep native
  // session consent solely for that specific recovery generation; the JS
  // bitmap and GPU context are still released by component unmount.
  disableWallpaperRefraction(false)
  document.documentElement.classList.remove('desktop-canvas-window')
  window.removeEventListener('resize', handleCanvasResize)
  window.removeEventListener('flexikit:canvas-regions-changed', scheduleInteractiveRegionSync)
  window.removeEventListener('flexikit:canvas-topology-changed', handleCanvasTopologyChanged)
  window.removeEventListener('flexikit:open-widget-palette', openWidgetPalette)
  window.removeEventListener('flexikit:canvas-open-tool-picker', handleOpenToolPicker)
  if (regionSyncFrame !== null) window.cancelAnimationFrame(regionSyncFrame)
  if (monitorRefreshTimer !== null) window.clearTimeout(monitorRefreshTimer)
})
</script>

<style scoped>
:global(html.desktop-canvas-window),
:global(html.desktop-canvas-window body),
:global(html.desktop-canvas-window #app){background:transparent!important;overflow:hidden}
.desktop-canvas{--canvas-material-base:rgb(247 249 252);--canvas-panel-edge:rgb(255 255 255 / 68%);--text-tertiary:rgb(95 100 111);position:fixed;inset:0;overflow:hidden;color:var(--text-primary);font-family:inherit;user-select:none}
:global([data-theme="dark"]) .desktop-canvas{--canvas-material-base:rgb(22 26 34);--canvas-panel-edge:rgb(255 255 255 / 22%);--text-secondary:rgb(218 223 232);--text-tertiary:rgb(169 178 191)}
@media (prefers-color-scheme:dark){:global([data-theme="auto"]) .desktop-canvas{--canvas-material-base:rgb(22 26 34);--canvas-panel-edge:rgb(255 255 255 / 22%);--text-secondary:rgb(218 223 232);--text-tertiary:rgb(169 178 191)}}
.canvas-backdrop{position:absolute;inset:0;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;pointer-events:none;transition:background .3s cubic-bezier(.25,.1,.25,1),backdrop-filter .3s cubic-bezier(.25,.1,.25,1)}
.is-editing .canvas-backdrop{background:radial-gradient(circle at 18% 18%,color-mix(in srgb,var(--primary) 7%,transparent),transparent 30%),radial-gradient(circle at 82% 72%,color-mix(in srgb,var(--primary) 5%,transparent),transparent 34%),rgba(8,12,19,.08);backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
.canvas-stage{position:absolute;inset:0;min-width:100%;min-height:100%}
.canvas-stage::before{content:"";position:absolute;inset:0;pointer-events:none;opacity:0;background-image:linear-gradient(to right,color-mix(in srgb,var(--text-tertiary) 11%,transparent) 1px,transparent 1px),linear-gradient(to bottom,color-mix(in srgb,var(--text-tertiary) 11%,transparent) 1px,transparent 1px);background-size:20px 20px;background-position:0 0;transition:opacity .3s cubic-bezier(.25,.1,.25,1)}
.is-editing .canvas-stage::before{opacity:1}
.monitor-guide{position:absolute;z-index:1;pointer-events:none;border:1px dashed color-mix(in srgb,var(--text-tertiary) 26%,transparent);box-shadow:inset 0 0 0 1px rgb(255 255 255 / 3%)}
.monitor-guide span{position:absolute;left:16px;bottom:14px;padding:5px 8px;border-radius:9px;background:color-mix(in srgb,var(--glass-bg) 76%,transparent);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);color:var(--text-tertiary);font-size:.55rem;letter-spacing:.01em}
.is-editing .canvas-stage{background:transparent}
.canvas-controls{position:absolute;z-index:10000;top:16px;left:18px;right:18px;height:46px;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:0 8px 0 11px;border:1px solid var(--canvas-panel-edge);border-radius:16px;background:linear-gradient(155deg,rgb(255 255 255 / 19%),transparent 57%),color-mix(in srgb,var(--canvas-material-base) 89%,transparent);backdrop-filter:blur(34px) saturate(135%);-webkit-backdrop-filter:blur(34px) saturate(135%);box-shadow:0 10px 32px rgb(0 0 0 / 10%),inset 0 1px 0 rgb(255 255 255 / 30%);animation:canvas-controls-in .3s cubic-bezier(.25,.1,.25,1) both}
.canvas-brand{display:flex;align-items:center;gap:9px;min-width:0}
.canvas-brand img{width:28px;height:28px;border-radius:8px}
.canvas-brand>span{display:grid;gap:1px}
.canvas-brand strong{font-size:.72rem;font-weight:680}
.canvas-brand small{font-size:.57rem;color:var(--text-tertiary)}
.canvas-actions{display:flex;align-items:center;gap:5px}
.canvas-actions button{height:31px;padding:0 10px;border:1px solid var(--glass-border);border-radius:10px;background:var(--btn-bg);color:var(--text-secondary);font:inherit;font-size:.67rem;font-weight:580;cursor:pointer;box-shadow:inset 0 1px 0 rgb(255 255 255 / 5%);transition:all .3s cubic-bezier(.25,.1,.25,1)}
.canvas-actions button:hover,.canvas-actions button.active{background:var(--btn-bg-hover);border-color:color-mix(in srgb,var(--primary) 28%,var(--glass-border));color:var(--primary);transform:scale(1.02)}
.canvas-actions button:active{transform:scale(.98)}
.canvas-actions button:focus-visible{outline:none;border-color:color-mix(in srgb,var(--text-primary) 28%,var(--glass-border));box-shadow:0 0 0 3px color-mix(in srgb,var(--text-primary) 8%,transparent),inset 0 1px 0 rgb(255 255 255 / 10%)}
.canvas-actions .close-action{width:31px;padding:0;font-size:1rem}
.canvas-actions{overflow-x:auto;scrollbar-width:none;flex:0 1 auto;min-width:0}.canvas-actions::-webkit-scrollbar{display:none}.canvas-actions .canvas-action-primary{background:var(--text-primary);color:var(--bg-secondary);border-color:transparent}.canvas-actions .canvas-action-primary:hover{background:var(--text-primary);color:var(--bg-secondary);opacity:.9}.canvas-brand{flex:0 1 auto}.canvas-brand>span{min-width:0}.canvas-brand small{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}@media(max-width:1080px){.canvas-brand small{display:none}}
/* The top bar exposes only everyday actions. Less-used commands stay in one
   anchored menu; its region is registered separately for WorkerW hit testing. */
.canvas-more-menu{position:absolute;z-index:10005;right:45px;top:51px;width:185px;display:grid;gap:3px;padding:7px;border:1px solid var(--canvas-panel-edge);border-radius:15px;background:color-mix(in srgb,var(--canvas-material-base) 96%,transparent);backdrop-filter:blur(28px) saturate(135%);-webkit-backdrop-filter:blur(28px) saturate(135%);box-shadow:0 16px 42px rgb(0 0 0 / 14%);}
.canvas-more-menu button{min-height:34px;width:100%;display:flex;align-items:center;padding:0 11px;border:0;border-radius:9px;background:transparent;color:var(--text-primary);font:inherit;font-size:.68rem;text-align:left;cursor:pointer}
.canvas-more-menu button:hover,.canvas-more-menu button:focus-visible{background:var(--btn-bg-hover);outline:none}
.canvas-more-menu button.refraction-toggle.active{color:var(--primary)}
.canvas-more-menu button:disabled{opacity:.5;cursor:progress}
.canvas-more-divider{height:1px;margin:4px 5px;background:var(--glass-border)}
.canvas-more-menu button.canvas-more-danger{color:var(--text-secondary)}

.widget-palette{position:absolute;z-index:10001;top:70px;right:18px;width:min(390px,calc(100vw - 36px));padding:14px;border:1px solid var(--canvas-panel-edge);border-radius:20px;background:linear-gradient(155deg,rgb(255 255 255 / 16%),transparent 55%),color-mix(in srgb,var(--canvas-material-base) 94%,transparent);backdrop-filter:blur(34px) saturate(130%);-webkit-backdrop-filter:blur(34px) saturate(130%);box-shadow:0 18px 50px rgb(0 0 0 / 15%),inset 0 1px 0 rgb(255 255 255 / 25%)}
.widget-inspector{position:absolute;z-index:10002;top:72px;left:18px;width:min(304px,calc(100vw - 36px));max-height:calc(100vh - 90px);overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable;padding:14px;border:1px solid var(--canvas-panel-edge);border-radius:20px;background:linear-gradient(155deg,rgb(255 255 255 / 16%),transparent 55%),color-mix(in srgb,var(--canvas-material-base) 95%,transparent);backdrop-filter:blur(34px) saturate(130%);-webkit-backdrop-filter:blur(34px) saturate(130%);box-shadow:0 18px 50px rgb(0 0 0 / 15%),inset 0 1px 0 rgb(255 255 255 / 25%);scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--text-tertiary) 28%,transparent) transparent}
@media (prefers-reduced-transparency:reduce){.canvas-controls,.widget-palette,.widget-inspector{background:var(--canvas-material-base);backdrop-filter:none;-webkit-backdrop-filter:none;border-color:var(--canvas-panel-edge)}}
@media (forced-colors:active){.canvas-controls,.widget-palette,.widget-inspector{background:Canvas;border:1px solid CanvasText;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}}
.inspector-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1px 2px 12px}
.inspector-head>span{display:grid;gap:2px;min-width:0}
.inspector-head strong{font-size:.78rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.inspector-head small{font-size:.56rem;color:var(--text-tertiary)}
.inspector-head button{width:26px;height:26px;border:0;border-radius:50%;background:var(--btn-bg);color:var(--text-tertiary);font:inherit;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.inspector-head button:hover{background:var(--btn-bg-hover);color:var(--text-primary);transform:scale(1.02)}
.inspector-head button:active{transform:scale(.98)}
.inspector-field{display:grid;gap:6px;margin-bottom:10px}
.inspector-field>span,.range-row>span{display:flex;justify-content:space-between;gap:10px;font-size:.6rem;font-weight:620;color:var(--text-secondary)}
.inspector-field input,.inspector-field select{height:34px;padding:0 10px;border:1px solid var(--glass-border);border-radius:10px;outline:0;background:var(--input-bg);color:var(--text-primary);font:inherit;font-size:.67rem;transition:border-color .3s cubic-bezier(.25,.1,.25,1)}
.inspector-field select{cursor:pointer}
.inspector-field input:focus,.inspector-field select:focus{border-color:color-mix(in srgb,var(--primary) 50%,var(--glass-border))}
.inspector-actions{display:flex;gap:6px;margin-bottom:12px}
.position-inspector{display:grid;gap:8px;margin:3px 0 12px}.position-inspector>span{display:flex;justify-content:space-between;font-size:.63rem;font-weight:650;color:var(--text-primary)}.position-inspector>span small{font-size:.53rem;font-weight:400;color:var(--text-tertiary)}.position-inspector>div{display:grid;grid-template-columns:1fr 1fr;gap:8px}.position-inspector label{display:flex;align-items:center;gap:7px;font-size:.62rem;color:var(--text-secondary)}.position-inspector input{width:100%;min-width:0;height:33px;padding:0 9px;background:var(--input-bg);border:1px solid var(--glass-border);border-radius:9px;color:var(--text-primary);font:inherit}.position-inspector input:disabled{opacity:.45}

.inspector-actions button{flex:1;height:31px;border:1px solid var(--glass-border);border-radius:10px;background:var(--btn-bg);color:var(--text-secondary);font:inherit;font-size:.61rem;font-weight:620;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.inspector-actions button:hover{background:var(--btn-bg-hover);border-color:color-mix(in srgb,var(--primary) 24%,var(--glass-border));color:var(--primary);transform:scale(1.02)}
.inspector-actions button:active{transform:scale(.98)}
.appearance-section{display:grid;gap:12px;padding:12px;border:1px solid var(--glass-border);border-radius:15px;background:color-mix(in srgb,var(--btn-bg) 70%,transparent)}
.config-section{display:grid;gap:11px;margin-top:10px;padding:12px;border:1px solid var(--glass-border);border-radius:15px;background:color-mix(in srgb,var(--btn-bg) 62%,transparent)}
.config-title{display:flex;align-items:center;justify-content:space-between;gap:10px}
.config-title>span{display:grid;gap:2px}
.config-title strong{font-size:.68rem;color:var(--text-primary)}
.config-title small{font-size:.5rem;color:var(--text-tertiary)}
.config-title>button{height:25px;padding:0 8px;border:1px solid var(--glass-border);border-radius:8px;background:var(--btn-bg);color:var(--text-tertiary);font:inherit;font-size:.51rem;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.config-title>button:hover{background:var(--btn-bg-hover);color:var(--text-primary);transform:scale(1.02)}
.config-title>button:active{transform:scale(.98)}
.config-list{display:grid;gap:8px}
.config-control{min-width:0}
.config-control-section{padding-top:4px}
.config-schema-section{display:grid;gap:2px;padding:8px 2px 4px;border-bottom:1px solid color-mix(in srgb,var(--glass-border) 72%,transparent)}
.config-schema-section strong{font-size:.61rem;color:var(--text-primary)}
.config-schema-section small{font-size:.48rem;line-height:1.35;color:var(--text-tertiary)}
.config-switch-row{width:100%;min-height:42px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 8px;border:1px solid var(--glass-border);border-radius:11px;background:color-mix(in srgb,var(--btn-bg) 72%,transparent);color:var(--text-secondary);font:inherit;text-align:left;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.config-switch-row:hover{background:var(--btn-bg-hover)}
.config-switch-row>span{min-width:0;display:grid;gap:2px}
.config-switch-row strong,.config-field strong{font-size:.59rem;color:var(--text-primary)}
.config-switch-row small,.config-field small,.config-range>small{font-size:.49rem;line-height:1.35;color:var(--text-tertiary)}
.config-switch-row>i{position:relative;width:30px;height:18px;flex:0 0 30px;border:1px solid var(--glass-border);border-radius:999px;background:color-mix(in srgb,var(--text-tertiary) 13%,transparent);transition:all .3s cubic-bezier(.25,.1,.25,1)}
.config-switch-row>i b{position:absolute;top:2px;left:2px;width:12px;height:12px;border-radius:50%;background:color-mix(in srgb,var(--text-primary) 72%,var(--glass-bg));box-shadow:0 1px 4px rgb(0 0 0 / 20%);transition:transform .3s cubic-bezier(.25,.1,.25,1)}
.config-switch-row>i.active{background:color-mix(in srgb,var(--text-primary) 18%,var(--glass-bg));border-color:color-mix(in srgb,var(--text-primary) 25%,var(--glass-border))}
.config-switch-row>i.active b{transform:translateX(12px);background:var(--text-primary)}
.config-field{display:grid;gap:6px}
.config-field>span{display:grid;gap:2px}
.config-field input,.config-field select{width:100%;height:34px;padding:0 10px;border:1px solid var(--glass-border);border-radius:10px;outline:0;background:var(--input-bg);color:var(--text-primary);font:inherit;font-size:.62rem;transition:border-color .3s cubic-bezier(.25,.1,.25,1)}
.config-field input:focus,.config-field select:focus{border-color:color-mix(in srgb,var(--text-primary) 28%,var(--glass-border))}
.config-field select{cursor:pointer}
.config-number-control,.config-color-control{display:flex;align-items:center;gap:7px}
.config-number-control input{min-width:0;flex:1}
.config-number-control>b{flex:0 0 auto;min-width:26px;text-align:center;font-size:.52rem;font-weight:600;color:var(--text-tertiary)}
.config-color-control{height:36px;padding:3px 8px 3px 4px;border:1px solid var(--glass-border);border-radius:10px;background:var(--input-bg)}
.config-color-control input[type="color"]{width:34px;height:28px;flex:0 0 34px;padding:2px;border:0;border-radius:7px;background:transparent;cursor:pointer}
.config-color-control input[type="color"]::-webkit-color-swatch-wrapper{padding:0}
.config-color-control input[type="color"]::-webkit-color-swatch{border:1px solid var(--glass-border);border-radius:6px}
.config-color-control code{font:inherit;font-size:.54rem;color:var(--text-tertiary);letter-spacing:.04em}
.config-range{padding:4px 1px 1px}
.config-range>small{margin-top:-2px}
.appearance-title{display:flex;align-items:flex-end;justify-content:space-between;gap:8px}
.appearance-title strong{font-size:.68rem;color:var(--text-primary)}
.appearance-title small{font-size:.53rem;color:var(--text-tertiary)}
.appearance-presets{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.appearance-presets button{min-width:0;display:flex;align-items:center;gap:7px;padding:7px;border:1px solid var(--glass-border);border-radius:11px;background:color-mix(in srgb,var(--btn-bg) 72%,transparent);color:var(--text-secondary);font:inherit;text-align:left;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.appearance-presets button:hover{background:var(--btn-bg-hover);transform:scale(1.02)}
.appearance-presets button:active{transform:scale(.98)}
.appearance-presets button.active{border-color:color-mix(in srgb,var(--text-primary) 30%,var(--glass-border));background:color-mix(in srgb,var(--text-primary) 7%,var(--btn-bg))}
.appearance-presets i{width:26px;height:26px;flex:0 0 26px;border:1px solid rgb(255 255 255 / 10%);border-radius:8px;box-shadow:0 5px 12px rgb(0 0 0 / 12%),inset 0 1px 0 rgb(255 255 255 / 16%)}
.appearance-presets i.preset-glass{background:linear-gradient(145deg,rgb(255 255 255 / 24%),transparent),color-mix(in srgb,var(--glass-bg) 68%,transparent);backdrop-filter:blur(10px)}
.appearance-presets i.preset-dense{background:linear-gradient(145deg,rgb(255 255 255 / 60%),transparent 53%),color-mix(in srgb,var(--canvas-material-base) 83%,transparent);backdrop-filter:blur(15px)}
.appearance-presets i.preset-space{background:linear-gradient(145deg,rgb(255 255 255 / 8%),transparent),rgb(12 17 25 / 90%)}
.appearance-presets i.preset-clear{background:linear-gradient(145deg,rgb(255 255 255 / 15%),transparent),color-mix(in srgb,var(--glass-bg) 28%,transparent)}
.appearance-presets i.preset-solid{background:color-mix(in srgb,var(--glass-bg) 96%,var(--text-primary) 4%)}
.appearance-presets button>span{min-width:0;display:grid;gap:1px}
.appearance-presets button strong{font-size:.59rem;color:var(--text-primary)}
.appearance-presets button small{font-size:.48rem;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.appearance-quick-presets{grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.appearance-quick-presets button{min-height:48px;flex-direction:column;align-items:center;justify-content:center;gap:5px;padding:7px 4px;text-align:center}
.appearance-quick-presets i{width:23px;height:23px;flex-basis:23px;border-radius:7px}
.appearance-quick-presets button strong{font-size:.58rem}
.inspector-advanced{min-width:0}
.inspector-advanced>summary,.config-details>summary{display:flex;align-items:center;justify-content:space-between;gap:8px;list-style:none;min-height:33px;padding:0 9px;border:1px solid var(--glass-border);border-radius:10px;color:var(--text-secondary);font-size:.6rem;font-weight:650;cursor:pointer}
.inspector-advanced>summary::-webkit-details-marker,.config-details>summary::-webkit-details-marker{display:none}
.inspector-advanced>summary::after,.config-details>summary::after{content:"⌄";color:var(--text-tertiary);transition:transform .2s ease}
.inspector-advanced[open]>summary::after,.config-details[open]>summary::after{transform:rotate(180deg)}
.inspector-advanced>summary:hover,.config-details>summary:hover{background:var(--btn-bg-hover)}
.inspector-advanced>summary small,.config-details>summary small{margin-left:auto;color:var(--text-tertiary);font-size:.5rem;font-weight:400}
.appearance-advanced-content{display:grid;gap:12px;padding-top:12px}
.appearance-other-presets{display:grid;gap:8px}
.appearance-other-presets>span{font-size:.6rem;font-weight:620;color:var(--text-secondary)}
.config-details{display:block}
.config-details>summary{margin:-2px}
.config-details[open] .config-title{margin-top:12px;margin-bottom:11px}
.config-details[open] .config-list{margin-top:8px}

.tone-row{display:grid;gap:6px}
.tone-row>span{font-size:.6rem;font-weight:620;color:var(--text-secondary)}
.tone-picker{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;padding:3px;border:1px solid var(--glass-border);border-radius:11px;background:color-mix(in srgb,var(--btn-bg) 70%,transparent)}
.tone-picker button{height:26px;border:0;border-radius:8px;background:transparent;color:var(--text-tertiary);font:inherit;font-size:.55rem;font-weight:620;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.tone-picker button:hover{color:var(--text-primary)}
.tone-picker button.active{background:color-mix(in srgb,var(--text-primary) 9%,var(--glass-bg));color:var(--text-primary);box-shadow:0 2px 8px rgb(0 0 0 / 8%),inset 0 1px 0 rgb(255 255 255 / 12%)}
.range-row{display:grid;gap:7px}
.range-row b{font-size:.56rem;font-weight:560;color:var(--text-tertiary)}
.range-row input{width:100%;height:22px;margin:0;appearance:none;-webkit-appearance:none;background:transparent;outline:0;cursor:pointer;touch-action:none}
.range-row input::-webkit-slider-runnable-track{height:5px;border-radius:999px;background:linear-gradient(to right,color-mix(in srgb,var(--text-primary) 68%,transparent) 0 var(--range-progress),color-mix(in srgb,var(--text-primary) 12%,transparent) var(--range-progress) 100%);box-shadow:inset 0 1px 2px rgb(0 0 0 / 14%),inset 0 0 0 1px color-mix(in srgb,var(--text-primary) 5%,transparent)}
.range-row input::-webkit-slider-thumb{width:15px;height:15px;margin-top:-5px;appearance:none;-webkit-appearance:none;border:1px solid color-mix(in srgb,var(--text-primary) 22%,var(--glass-border));border-radius:50%;background:color-mix(in srgb,var(--glass-bg) 94%,white 6%);box-shadow:0 2px 7px rgb(0 0 0 / 22%),0 0 0 3px color-mix(in srgb,var(--glass-bg) 70%,transparent),inset 0 1px 0 rgb(255 255 255 / 48%);transition:transform .3s cubic-bezier(.25,.1,.25,1),box-shadow .3s cubic-bezier(.25,.1,.25,1)}
.range-row input:hover::-webkit-slider-thumb{transform:scale(1.08);box-shadow:0 4px 10px rgb(0 0 0 / 26%),0 0 0 4px color-mix(in srgb,var(--text-primary) 7%,transparent),inset 0 1px 0 rgb(255 255 255 / 52%)}
.range-row input:active::-webkit-slider-thumb{transform:scale(.94)}
.range-row input:focus-visible::-webkit-slider-thumb{box-shadow:0 4px 10px rgb(0 0 0 / 24%),0 0 0 4px color-mix(in srgb,var(--text-primary) 12%,transparent),inset 0 1px 0 rgb(255 255 255 / 55%)}
.range-row input::-moz-range-track{height:5px;border:0;border-radius:999px;background:color-mix(in srgb,var(--text-primary) 12%,transparent)}
.range-row input::-moz-range-progress{height:5px;border-radius:999px;background:color-mix(in srgb,var(--text-primary) 68%,transparent)}
.range-row input::-moz-range-thumb{width:15px;height:15px;border:1px solid color-mix(in srgb,var(--text-primary) 22%,var(--glass-border));border-radius:50%;background:color-mix(in srgb,var(--glass-bg) 94%,white 6%);box-shadow:0 2px 7px rgb(0 0 0 / 22%)}
.widget-inspector::-webkit-scrollbar{width:8px}
.widget-inspector::-webkit-scrollbar-track{background:transparent}
.widget-inspector::-webkit-scrollbar-thumb{min-height:40px;border:2px solid transparent;border-radius:999px;background:color-mix(in srgb,var(--text-tertiary) 30%,transparent);background-clip:padding-box}
.widget-inspector::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--text-tertiary) 44%,transparent);background-clip:padding-box}
.inspector-tip{margin:10px 2px 0;color:var(--text-tertiary);font-size:.54rem;line-height:1.5}
.widget-palette header{display:grid;gap:3px;padding:2px 4px 11px}
.widget-palette header strong{font-size:.82rem}
.widget-palette header span{font-size:.62rem;color:var(--text-tertiary)}
.palette-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.palette-grid button{display:flex;align-items:center;gap:9px;min-width:0;padding:10px;border:1px solid transparent;border-radius:14px;background:var(--btn-bg);color:var(--text-secondary);font:inherit;text-align:left;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.palette-grid button:hover{background:var(--btn-bg-hover);border-color:color-mix(in srgb,var(--primary) 20%,var(--glass-border));transform:scale(1.02)}
.palette-grid button:active{transform:scale(.98)}
.palette-icon{width:32px;height:32px;display:grid;place-items:center;border-radius:10px;background:var(--icon-surface);color:var(--primary);font-size:1rem}
.palette-grid button>span:nth-child(2){display:grid;min-width:0;gap:2px;flex:1}
.palette-grid strong{font-size:.68rem}
.palette-grid small{font-size:.56rem;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.palette-grid i{font-style:normal;color:var(--primary)}
.palette-pop-enter-active,.palette-pop-leave-active{transform-origin:top center;transition:opacity .3s cubic-bezier(.25,.1,.25,1),transform .3s cubic-bezier(.25,.1,.25,1),filter .3s cubic-bezier(.25,.1,.25,1)}
.palette-pop-enter-from,.palette-pop-leave-to{opacity:0;transform:translateY(-8px) scale(.98);filter:blur(5px)}
.widget-palette .palette-grid button{animation:palette-item-in .3s cubic-bezier(.25,.1,.25,1) both}
.widget-palette .palette-grid button:nth-child(2){animation-delay:.025s}.widget-palette .palette-grid button:nth-child(3){animation-delay:.05s}.widget-palette .palette-grid button:nth-child(4){animation-delay:.075s}.widget-palette .palette-grid button:nth-child(5){animation-delay:.1s}.widget-palette .palette-grid button:nth-child(6){animation-delay:.125s}.widget-palette .palette-grid button:nth-child(7){animation-delay:.15s}.widget-palette .palette-grid button:nth-child(8){animation-delay:.175s}
@keyframes canvas-controls-in{from{opacity:0;transform:translateY(-7px) scale(.995)}to{opacity:1;transform:translateY(0) scale(1)}}
@keyframes palette-item-in{from{opacity:0;transform:translateY(5px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
@media (prefers-reduced-motion:reduce){.canvas-backdrop,.canvas-stage::before,.canvas-controls,.palette-pop-enter-active,.palette-pop-leave-active,.widget-palette .palette-grid button,.canvas-actions button{animation:none!important;transition:none!important}.palette-pop-enter-from,.palette-pop-leave-to{filter:none;transform:none}}
[data-theme="dark"] .canvas-controls,[data-theme="dark"] .widget-palette,[data-theme="dark"] .widget-inspector{background:rgba(11,16,24,.86);border-color:rgba(255,255,255,.08)}
</style>
