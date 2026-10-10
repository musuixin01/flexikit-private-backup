import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref, watch } from 'vue'
import type { CanvasMonitorInfo, DesktopWidget, WidgetCreateOptions } from '@/types/desktopWidget'
import { DEFAULT_WIDGET_APPEARANCE, isWidgetAppearancePreset, isWidgetSurfaceTone } from '@/desktop/widgetAppearance'

const STORAGE_KEY = 'flexikit-desktop-canvas-v2'
// Same-device, same-origin safety copy made only after an explicit template apply.
const TEMPLATE_BACKUP_KEY = 'flexikit-desktop-canvas-v2-before-template'

const DEFAULT_APPEARANCE = DEFAULT_WIDGET_APPEARANCE

export const CANVAS_GRID_SIZE = 20
const CANVAS_LAYOUT_MARGIN = 40
const CANVAS_LAYOUT_TOP = 80
const CANVAS_LAYOUT_GAP = 20

const DEFAULT_WIDGETS: Array<Omit<DesktopWidget, 'id' | 'monitorId'>> = [
  {
    type: 'clock',
    title: '时间',
    frame: { x: 40, y: 80, width: 220, height: 160, zIndex: 1 },
    appearance: { ...DEFAULT_APPEARANCE },
    locked: false,
    config: {},
  },
  {
    type: 'search',
    title: '搜索',
    frame: { x: 280, y: 80, width: 400, height: 180, zIndex: 2 },
    appearance: { ...DEFAULT_APPEARANCE },
    locked: false,
    config: {},
  },
  {
    type: 'disk',
    title: '系统磁盘',
    frame: { x: 700, y: 80, width: 220, height: 160, zIndex: 3 },
    appearance: { ...DEFAULT_APPEARANCE },
    locked: false,
    config: {},
  },
  {
    type: 'launcher',
    title: '快捷启动',
    frame: { x: 40, y: 280, width: 280, height: 280, zIndex: 4 },
    appearance: { ...DEFAULT_APPEARANCE },
    locked: false,
    config: {},
  },
  {
    type: 'desktop-organizer',
    title: '桌面收纳',
    frame: { x: 340, y: 280, width: 400, height: 280, zIndex: 5 },
    appearance: { ...DEFAULT_APPEARANCE },
    locked: false,
    config: {},
  },
]

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function cloneDefaultWidgets(monitor: CanvasMonitorInfo | null = null): DesktopWidget[] {
  return DEFAULT_WIDGETS.map(widget => ({
    ...widget,
    id: createId(),
    monitorId: monitor?.id ?? null,
    frame: {
      ...widget.frame,
      x: widget.frame.x + (monitor?.x ?? 0),
      y: widget.frame.y + (monitor?.y ?? 0),
    },
    appearance: { ...widget.appearance },
    config: { ...widget.config },
  }))
}

const LEGACY_STARTER_FRAMES: Record<string, Pick<DesktopWidget['frame'], 'x' | 'y' | 'width' | 'height'>> = {
  clock: { x: 40, y: 80, width: 280, height: 180 },
  search: { x: 340, y: 80, width: 440, height: 240 },
  launcher: { x: 40, y: 280, width: 280, height: 320 },
  disk: { x: 340, y: 340, width: 300, height: 200 },
}

function isLegacyDuplicateLauncherLayout(widgets: DesktopWidget[]): boolean {
  if (widgets.length !== 6) return false
  if (widgets.some(widget => widget.locked || widget.groupId)) return false

  const byType = new Map<string, DesktopWidget[]>()
  for (const widget of widgets) {
    const bucket = byType.get(widget.type) ?? []
    bucket.push(widget)
    byType.set(widget.type, bucket)
  }

  if ((byType.get('clock')?.length ?? 0) !== 1
    || (byType.get('search')?.length ?? 0) !== 1
    || (byType.get('disk')?.length ?? 0) !== 1
    || (byType.get('desktop-organizer')?.length ?? 0) !== 1
    || (byType.get('launcher')?.length ?? 0) !== 2
    || byType.size !== 5) {
    return false
  }

  return true
}

function legacyOrganizerFrame(monitor: CanvasMonitorInfo | null): Pick<DesktopWidget['frame'], 'x' | 'y' | 'width' | 'height'> {
  const width = 500
  const height = 420
  const originX = monitor?.x ?? 0
  const originY = monitor?.y ?? 0
  const occupied = Object.values(LEGACY_STARTER_FRAMES).map(frame => ({
    ...frame,
    x: frame.x + originX,
    y: frame.y + originY,
  }))
  const startX = snapToGrid(originX + CANVAS_LAYOUT_MARGIN, originX)
  const startY = snapToGrid(originY + CANVAS_LAYOUT_TOP, originY)
  const maxX = monitor
    ? monitor.x + Math.max(0, monitor.width - width - CANVAS_LAYOUT_MARGIN)
    : startX + 1600
  const maxY = monitor
    ? monitor.y + Math.max(0, monitor.height - height - CANVAS_LAYOUT_MARGIN)
    : startY + 1000

  for (let y = startY; y <= maxY; y += CANVAS_GRID_SIZE) {
    for (let x = startX; x <= maxX; x += CANVAS_GRID_SIZE) {
      const candidate = { x, y, width, height }
      if (!occupied.some(frame => framesOverlap(candidate, frame))) return candidate
    }
  }
  return { x: startX, y: startY, width, height }
}

function isLegacyStarterLayout(widgets: DesktopWidget[], monitor: CanvasMonitorInfo | null): boolean {
  if (isLegacyDuplicateLauncherLayout(widgets)) return true
  if (widgets.length !== 4 && widgets.length !== 5) return false
  const types = new Set(widgets.map(widget => widget.type))
  const coreTypes = Object.keys(LEGACY_STARTER_FRAMES)
  if (!coreTypes.every(type => types.has(type))) return false
  if (widgets.length === 5 && !types.has('desktop-organizer')) return false
  if (types.size !== widgets.length) return false

  const originX = monitor?.x ?? 0
  const originY = monitor?.y ?? 0
  const organizerFrame = legacyOrganizerFrame(monitor)

  return widgets.every(widget => {
    const baseFrame = widget.type === 'desktop-organizer' ? organizerFrame : LEGACY_STARTER_FRAMES[widget.type]
    if (!baseFrame || widget.locked || widget.groupId) return false
    const expectedX = widget.type === 'desktop-organizer' ? baseFrame.x : baseFrame.x + originX
    const expectedY = widget.type === 'desktop-organizer' ? baseFrame.y : baseFrame.y + originY
    return widget.frame.x === expectedX
      && widget.frame.y === expectedY
      && widget.frame.width === baseFrame.width
      && widget.frame.height === baseFrame.height
      && (!monitor || widget.monitorId === monitor.id)
  })
}

function normalizeStoredWidget(value: unknown, index: number): DesktopWidget | null {
  if (!value || typeof value !== 'object') return null
  const widget = value as Partial<DesktopWidget>
  const frame = widget.frame
  if (typeof widget.id !== 'string'
    || typeof widget.type !== 'string'
    || typeof widget.title !== 'string'
    || !frame
    || typeof frame.x !== 'number'
    || typeof frame.y !== 'number'
    || typeof frame.width !== 'number'
    || typeof frame.height !== 'number') {
    return null
  }

  const appearance = widget.appearance
  const config = widget.config && typeof widget.config === 'object' && !Array.isArray(widget.config)
    ? widget.config
    : {}

  return {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    monitorId: typeof widget.monitorId === 'string' ? widget.monitorId : null,
    frame: {
      x: frame.x,
      y: frame.y,
      width: frame.width,
      height: frame.height,
      zIndex: typeof frame.zIndex === 'number' ? frame.zIndex : index + 1,
    },
    appearance: {
      preset: isWidgetAppearancePreset(appearance?.preset) ? appearance.preset : DEFAULT_APPEARANCE.preset,
      tone: isWidgetSurfaceTone(appearance?.tone) ? appearance.tone : DEFAULT_APPEARANCE.tone,
      opacity: typeof appearance?.opacity === 'number' ? appearance.opacity : DEFAULT_APPEARANCE.opacity,
      borderRadius: typeof appearance?.borderRadius === 'number' ? appearance.borderRadius : DEFAULT_APPEARANCE.borderRadius,
      blur: typeof appearance?.blur === 'number' ? appearance.blur : DEFAULT_APPEARANCE.blur,
      surfaceOpacity: typeof appearance?.surfaceOpacity === 'number'
        ? appearance.surfaceOpacity
        : DEFAULT_APPEARANCE.surfaceOpacity,
      borderStrength: typeof appearance?.borderStrength === 'number'
        ? appearance.borderStrength
        : DEFAULT_APPEARANCE.borderStrength,
      shadowStrength: typeof appearance?.shadowStrength === 'number'
        ? appearance.shadowStrength
        : DEFAULT_APPEARANCE.shadowStrength,
    },
    locked: widget.locked === true,
    groupId: typeof widget.groupId === 'string' ? widget.groupId : null,
    config: { ...config },
  }
}

function normalizeStoredMonitor(value: unknown): CanvasMonitorInfo | null {
  if (!value || typeof value !== 'object') return null
  const monitor = value as Partial<CanvasMonitorInfo>
  if (typeof monitor.id !== 'string'
    || typeof monitor.name !== 'string'
    || typeof monitor.x !== 'number'
    || typeof monitor.y !== 'number'
    || typeof monitor.width !== 'number'
    || typeof monitor.height !== 'number'
    || monitor.width <= 0
    || monitor.height <= 0) {
    return null
  }

  return {
    id: monitor.id,
    name: monitor.name,
    x: monitor.x,
    y: monitor.y,
    width: monitor.width,
    height: monitor.height,
    scaleFactor: typeof monitor.scaleFactor === 'number' && monitor.scaleFactor > 0 ? monitor.scaleFactor : 1,
    isPrimary: monitor.isPrimary === true,
  }
}

function findMonitorForWidget(widget: DesktopWidget, monitorList: CanvasMonitorInfo[]): CanvasMonitorInfo | null {
  if (!monitorList.length) return null
  const centerX = widget.frame.x + widget.frame.width / 2
  const centerY = widget.frame.y + widget.frame.height / 2
  return monitorList.find(monitor => (
    centerX >= monitor.x
    && centerX < monitor.x + monitor.width
    && centerY >= monitor.y
    && centerY < monitor.y + monitor.height
  )) ?? monitorList.find(monitor => monitor.isPrimary) ?? monitorList[0]
}

function clampWidgetToMonitor(widget: DesktopWidget, monitor: CanvasMonitorInfo): void {
  const maxX = monitor.x + Math.max(0, monitor.width - widget.frame.width)
  const maxY = monitor.y + Math.max(0, monitor.height - widget.frame.height)
  widget.frame.x = Math.min(Math.max(widget.frame.x, monitor.x), maxX)
  widget.frame.y = Math.min(Math.max(widget.frame.y, monitor.y), maxY)
}

function snapToGrid(value: number, origin = 0): number {
  return origin + Math.round((value - origin) / CANVAS_GRID_SIZE) * CANVAS_GRID_SIZE
}

function snapWidgetToGrid(widget: DesktopWidget, monitor: CanvasMonitorInfo | null): void {
  const originX = monitor?.x ?? 0
  const originY = monitor?.y ?? 0
  widget.frame.x = snapToGrid(widget.frame.x, originX)
  widget.frame.y = snapToGrid(widget.frame.y, originY)
  widget.frame.width = Math.max(CANVAS_GRID_SIZE * 4, snapToGrid(widget.frame.width))
  widget.frame.height = Math.max(CANVAS_GRID_SIZE * 4, snapToGrid(widget.frame.height))
  if (monitor) clampWidgetToMonitor(widget, monitor)
}

function framesOverlap(
  left: Pick<DesktopWidget['frame'], 'x' | 'y' | 'width' | 'height'>,
  right: Pick<DesktopWidget['frame'], 'x' | 'y' | 'width' | 'height'>,
  gap = CANVAS_LAYOUT_GAP,
): boolean {
  return left.x < right.x + right.width + gap
    && left.x + left.width + gap > right.x
    && left.y < right.y + right.height + gap
    && left.y + left.height + gap > right.y
}

function remapAxis(position: number, size: number, fromStart: number, fromSize: number, toStart: number, toSize: number): number {
  const fromRange = Math.max(1, fromSize - size)
  const toRange = Math.max(0, toSize - size)
  const ratio = Math.min(1, Math.max(0, (position - fromStart) / fromRange))
  return toStart + ratio * toRange
}

function remapWidgetBetweenMonitors(widget: DesktopWidget, from: CanvasMonitorInfo, to: CanvasMonitorInfo): void {
  widget.frame.x = remapAxis(widget.frame.x, widget.frame.width, from.x, from.width, to.x, to.width)
  widget.frame.y = remapAxis(widget.frame.y, widget.frame.height, from.y, from.height, to.y, to.height)
  widget.monitorId = to.id
  clampWidgetToMonitor(widget, to)
}

export const useDesktopCanvasStore = defineStore('desktopCanvas', () => {
  const widgets = ref<DesktopWidget[]>([])
  const monitors = ref<CanvasMonitorInfo[]>([])
  const editMode = ref(false)
  const initialized = ref(false)
  const templateBackupAvailable = ref(false)
  const selectedWidgetIds = ref<string[]>([])
  let persistTimer: ReturnType<typeof setTimeout> | null = null
  let persistenceSuspended = false
  let frameInteractionDepth = 0
  let persistQueuedDuringFrameInteraction = false

  const selectedWidgets = computed(() => selectedWidgetIds.value
    .map(id => widgets.value.find(widget => widget.id === id))
    .filter((widget): widget is DesktopWidget => widget !== undefined))
  const activeWidget = computed(() => selectedWidgets.value[0] ?? null)
  const canGroupSelection = computed(() => selectedWidgets.value.length >= 2)
  const canUngroupSelection = computed(() => selectedWidgets.value.some(widget => Boolean(widget.groupId)))
  const primaryMonitor = computed(() => monitors.value.find(monitor => monitor.isPrimary) ?? monitors.value[0] ?? null)

  const orderedWidgets = computed(() => [...widgets.value].sort((a, b) => a.frame.zIndex - b.frame.zIndex))

  function persist(): void {
    if (!initialized.value || persistenceSuspended) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 2,
      widgets: widgets.value,
      monitors: monitors.value,
    }))
  }

  function schedulePersist(): void {
    if (!initialized.value || persistenceSuspended) return
    if (frameInteractionDepth > 0) {
      persistQueuedDuringFrameInteraction = true
      return
    }
    if (persistTimer !== null) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      persistTimer = null
      persist()
    }, 120)
  }

  function beginFrameInteraction(): void {
    frameInteractionDepth += 1
    if (frameInteractionDepth !== 1) return
    if (persistTimer !== null) {
      clearTimeout(persistTimer)
      persistTimer = null
      persistQueuedDuringFrameInteraction = true
    }
  }

  function endFrameInteraction(): void {
    if (frameInteractionDepth === 0) return
    frameInteractionDepth -= 1
    if (frameInteractionDepth > 0 || !persistQueuedDuringFrameInteraction) return
    persistQueuedDuringFrameInteraction = false
    schedulePersist()
  }

  function init(): void {
    if (initialized.value) return

    let restoredLayout = false
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      try {
        const parsed: unknown = JSON.parse(stored)
        if (parsed && typeof parsed === 'object') {
          const state = parsed as { version?: unknown; widgets?: unknown; monitors?: unknown }
          if (state.version !== 2) {
            throw new Error('Unsupported desktop Canvas storage version')
          }
          if (Array.isArray(state.widgets)) {
            widgets.value = state.widgets
              .map(normalizeStoredWidget)
              .filter((widget): widget is DesktopWidget => widget !== null)
            restoredLayout = true
          }
          if (Array.isArray(state.monitors)) {
            monitors.value = state.monitors
              .map(normalizeStoredMonitor)
              .filter((monitor): monitor is CanvasMonitorInfo => monitor !== null)
          }
        }
      } catch {
        widgets.value = []
        monitors.value = []
      }
    }

    if (!restoredLayout) widgets.value = cloneDefaultWidgets()
    initialized.value = true
    templateBackupAvailable.value = localStorage.getItem(TEMPLATE_BACKUP_KEY) !== null
  }

  // Explicit template application; save a local v2 restore point first.
  function applyTemplateLayout(items: Array<{ type: string; options: WidgetCreateOptions }>): void {
    if (!initialized.value || !items.length) return
    if (localStorage.getItem(TEMPLATE_BACKUP_KEY) === null) {
      localStorage.setItem(TEMPLATE_BACKUP_KEY, JSON.stringify({
        version: 2, widgets: widgets.value, monitors: monitors.value,
      }))
    }
    templateBackupAvailable.value = true
    const previousWidgets = [...widgets.value]
    const previousSelection = [...selectedWidgetIds.value]
    const previousEditMode = editMode.value
    if (persistTimer !== null) { clearTimeout(persistTimer); persistTimer = null }
    try {
      widgets.value = []
      selectedWidgetIds.value = []
      editMode.value = false
      for (const item of items) addWidget(item.type, item.options)
      persist()
    } catch (error) {
      // Failed storage writes must not leave an empty working Canvas.
      widgets.value = previousWidgets
      selectedWidgetIds.value = previousSelection
      editMode.value = previousEditMode
      throw error
    }
  }

  function restoreTemplateBackup(): boolean {
    const raw = localStorage.getItem(TEMPLATE_BACKUP_KEY)
    if (!raw) return false
    let parsed: { version?: unknown; widgets?: unknown; monitors?: unknown }
    try { parsed = JSON.parse(raw) as typeof parsed } catch { return false }
    if (parsed?.version !== 2 || !Array.isArray(parsed.widgets) || !Array.isArray(parsed.monitors)) return false
    const restoredWidgets = parsed.widgets.map(normalizeStoredWidget)
    const restoredMonitors = parsed.monitors.map(normalizeStoredMonitor)
    if (restoredWidgets.some(item => item === null) || restoredMonitors.some(item => item === null)) return false
    if (persistTimer !== null) { clearTimeout(persistTimer); persistTimer = null }
    widgets.value = restoredWidgets.filter((item): item is DesktopWidget => item !== null)
    monitors.value = restoredMonitors.filter((item): item is CanvasMonitorInfo => item !== null)
    selectedWidgetIds.value = []
    editMode.value = false
    persist()
    localStorage.removeItem(TEMPLATE_BACKUP_KEY)
    templateBackupAvailable.value = false
    return true
  }

  function setMonitorTopology(nextMonitors: CanvasMonitorInfo[]): void {
    const normalized = nextMonitors
      .map(normalizeStoredMonitor)
      .filter((monitor): monitor is CanvasMonitorInfo => monitor !== null)
    if (!normalized.length) return

    const previous = monitors.value
    const nextPrimary = normalized.find(monitor => monitor.isPrimary) ?? normalized[0]

    for (const widget of widgets.value) {
      const previousMonitor = (widget.monitorId
        ? previous.find(monitor => monitor.id === widget.monitorId)
        : null) ?? findMonitorForWidget(widget, previous)
      const matchingMonitor = widget.monitorId
        ? normalized.find(monitor => monitor.id === widget.monitorId)
        : null
      const targetMonitor = matchingMonitor ?? (
        previousMonitor
          ? normalized.find(monitor => monitor.name === previousMonitor.name)
          : null
      ) ?? nextPrimary

      if (!targetMonitor) continue

      if (!previousMonitor) {
        const inferred = findMonitorForWidget(widget, normalized) ?? targetMonitor
        widget.monitorId = inferred.id
        clampWidgetToMonitor(widget, inferred)
        continue
      }

      const geometryChanged = previousMonitor.x !== targetMonitor.x
        || previousMonitor.y !== targetMonitor.y
        || previousMonitor.width !== targetMonitor.width
        || previousMonitor.height !== targetMonitor.height
        || previousMonitor.scaleFactor !== targetMonitor.scaleFactor

      if (previousMonitor.id !== targetMonitor.id || geometryChanged) {
        remapWidgetBetweenMonitors(widget, previousMonitor, targetMonitor)
      } else {
        widget.monitorId = targetMonitor.id
        clampWidgetToMonitor(widget, targetMonitor)
      }
    }

    monitors.value = normalized
    persist()
  }

  function assignWidgetMonitor(widget: DesktopWidget): void {
    const monitor = findMonitorForWidget(widget, monitors.value)
    if (monitor) widget.monitorId = monitor.id
  }

  function moveWidgetToMonitor(id: string, monitorId: string): void {
    const widget = widgets.value.find(item => item.id === id)
    const target = monitors.value.find(monitor => monitor.id === monitorId)
    if (!widget || !target) return

    const source = (widget.monitorId
      ? monitors.value.find(monitor => monitor.id === widget.monitorId)
      : null) ?? findMonitorForWidget(widget, monitors.value)

    if (source) remapWidgetBetweenMonitors(widget, source, target)
    else {
      widget.monitorId = target.id
      clampWidgetToMonitor(widget, target)
    }
  }

  function nextZIndex(): number {
    return widgets.value.reduce((max, widget) => Math.max(max, widget.frame.zIndex), 0) + 1
  }

  function findNextGridSlot(
    width: number,
    height: number,
    monitor: CanvasMonitorInfo | null,
    excludedIds: ReadonlySet<string> = new Set(),
  ): { x: number; y: number } {
    const originX = monitor?.x ?? 0
    const originY = monitor?.y ?? 0
    const startX = snapToGrid(originX + CANVAS_LAYOUT_MARGIN, originX)
    const startY = snapToGrid(originY + CANVAS_LAYOUT_TOP, originY)
    const maxX = monitor
      ? monitor.x + Math.max(0, monitor.width - width - CANVAS_LAYOUT_MARGIN)
      : startX + 1600
    const maxY = monitor
      ? monitor.y + Math.max(0, monitor.height - height - CANVAS_LAYOUT_MARGIN)
      : startY + 1000

    const occupied = widgets.value.filter(widget => (
      !excludedIds.has(widget.id)
      && (!monitor || widget.monitorId === monitor.id || findMonitorForWidget(widget, monitors.value)?.id === monitor.id)
    ))

    for (let y = startY; y <= maxY; y += CANVAS_GRID_SIZE) {
      for (let x = startX; x <= maxX; x += CANVAS_GRID_SIZE) {
        const candidate = { x, y, width, height }
        if (!occupied.some(widget => framesOverlap(candidate, widget.frame))) return { x, y }
      }
    }

    return { x: startX, y: startY }
  }

  function arrangeWidgets(): void {
    const monitorList = monitors.value.length
      ? monitors.value
      : [{ id: 'fallback', name: 'Desktop', x: 0, y: 0, width: 1920, height: 1080, scaleFactor: 1, isPrimary: true }]

    for (const monitor of monitorList) {
      const monitorWidgets = widgets.value
        .filter(widget => (widget.monitorId ?? findMonitorForWidget(widget, monitorList)?.id) === monitor.id)
        .sort((left, right) => left.frame.zIndex - right.frame.zIndex)
      const placed = new Set<string>()

      for (const widget of monitorWidgets) {
        widget.frame.width = Math.max(CANVAS_GRID_SIZE * 4, snapToGrid(widget.frame.width))
        widget.frame.height = Math.max(CANVAS_GRID_SIZE * 4, snapToGrid(widget.frame.height))
        const excluded = new Set(widgets.value.map(item => item.id).filter(id => !placed.has(id)))
        const slot = findNextGridSlot(widget.frame.width, widget.frame.height, monitor, excluded)
        widget.frame.x = slot.x
        widget.frame.y = slot.y
        widget.monitorId = monitor.id
        clampWidgetToMonitor(widget, monitor)
        placed.add(widget.id)
      }
    }
  }

  function snapWidgetFrame(id: string): void {
    const widget = widgets.value.find(item => item.id === id)
    if (!widget || widget.locked) return
    const monitor = (widget.monitorId
      ? monitors.value.find(item => item.id === widget.monitorId)
      : null) ?? findMonitorForWidget(widget, monitors.value)
    snapWidgetToGrid(widget, monitor)
    assignWidgetMonitor(widget)
  }

  function addWidget(type: string, options: WidgetCreateOptions = {}): DesktopWidget {
    const targetMonitor = (options.monitorId
      ? monitors.value.find(monitor => monitor.id === options.monitorId)
      : null) ?? primaryMonitor.value
    const widget: DesktopWidget = {
      id: createId(),
      type,
      title: options.title || type,
      monitorId: targetMonitor?.id ?? options.monitorId ?? null,
      frame: {
        x: options.frame?.x ?? 0,
        y: options.frame?.y ?? 0,
        width: Math.max(CANVAS_GRID_SIZE * 4, snapToGrid(options.frame?.width ?? 300)),
        height: Math.max(CANVAS_GRID_SIZE * 4, snapToGrid(options.frame?.height ?? 220)),
        zIndex: nextZIndex(),
      },
      appearance: {
        ...DEFAULT_APPEARANCE,
        ...options.appearance,
      },
      locked: options.locked ?? false,
      groupId: options.groupId ?? null,
      config: { ...(options.config || {}) },
    }
    if (options.frame?.x === undefined || options.frame?.y === undefined) {
      const slot = findNextGridSlot(widget.frame.width, widget.frame.height, targetMonitor)
      if (options.frame?.x === undefined) widget.frame.x = slot.x
      if (options.frame?.y === undefined) widget.frame.y = slot.y
    }
    snapWidgetToGrid(widget, targetMonitor)
    widgets.value.push(widget)
    return widget
  }

  function updateWidget(id: string, patch: Partial<Omit<DesktopWidget, 'id'>>): void {
    const widget = widgets.value.find(item => item.id === id)
    if (!widget) return
    if (patch.title !== undefined) widget.title = patch.title
    if (patch.type !== undefined) widget.type = patch.type
    if (patch.monitorId !== undefined) widget.monitorId = patch.monitorId
    if (patch.locked !== undefined) widget.locked = patch.locked
    if (patch.groupId !== undefined) widget.groupId = patch.groupId
    if (patch.frame) widget.frame = { ...widget.frame, ...patch.frame }
    if (patch.appearance) widget.appearance = { ...widget.appearance, ...patch.appearance }
    if (patch.config) widget.config = { ...widget.config, ...patch.config }
  }

  function updateFrame(id: string, frame: Partial<DesktopWidget['frame']>): void {
    const widget = widgets.value.find(item => item.id === id)
    if (!widget || widget.locked) return
    widget.frame = { ...widget.frame, ...frame }
    assignWidgetMonitor(widget)
  }

  function removeWidget(id: string): void {
    const removed = widgets.value.find(widget => widget.id === id)
    widgets.value = widgets.value.filter(widget => widget.id !== id)
    selectedWidgetIds.value = selectedWidgetIds.value.filter(selectedId => selectedId !== id)

    if (removed?.groupId) {
      const remainingGroup = widgets.value.filter(widget => widget.groupId === removed.groupId)
      if (remainingGroup.length === 1) remainingGroup[0].groupId = null
    }
  }

  function isSelected(id: string): boolean {
    return selectedWidgetIds.value.includes(id)
  }

  function getSelectionTargetIds(id: string): string[] {
    const widget = widgets.value.find(item => item.id === id)
    if (!widget?.groupId) return [id]
    return widgets.value.filter(item => item.groupId === widget.groupId).map(item => item.id)
  }

  function selectWidget(id: string, additive = false): void {
    const targetIds = getSelectionTargetIds(id)
    if (!additive) {
      selectedWidgetIds.value = targetIds
      return
    }

    const allSelected = targetIds.every(targetId => selectedWidgetIds.value.includes(targetId))
    if (allSelected) {
      selectedWidgetIds.value = selectedWidgetIds.value.filter(selectedId => !targetIds.includes(selectedId))
      return
    }

    selectedWidgetIds.value = Array.from(new Set([...selectedWidgetIds.value, ...targetIds]))
  }

  function clearSelection(): void {
    selectedWidgetIds.value = []
  }

  function getMoveTargetIds(id: string): string[] {
    return getSelectionTargetIds(id)
  }

  function groupSelection(): void {
    if (selectedWidgets.value.length < 2) return
    const groupId = `group-${createId()}`
    for (const widget of selectedWidgets.value) {
      widget.groupId = groupId
    }
  }

  function ungroupSelection(): void {
    const groupIds = new Set(
      selectedWidgets.value.map(widget => widget.groupId).filter((groupId): groupId is string => Boolean(groupId)),
    )
    if (!groupIds.size) return
    for (const widget of widgets.value) {
      if (widget.groupId && groupIds.has(widget.groupId)) widget.groupId = null
    }
  }

  function updateSelectedAppearance(patch: Partial<DesktopWidget['appearance']>): void {
    for (const widget of selectedWidgets.value) {
      widget.appearance = { ...widget.appearance, ...patch }
    }
  }

  function updateSelectedTitle(title: string): void {
    if (selectedWidgets.value.length !== 1) return
    selectedWidgets.value[0].title = title
  }

  function updateSelectedConfig(patch: Record<string, unknown>): void {
    if (selectedWidgets.value.length !== 1) return
    const widget = selectedWidgets.value[0]
    widget.config = { ...widget.config, ...patch }
  }

  function setSelectedLocked(locked: boolean): void {
    for (const widget of selectedWidgets.value) {
      widget.locked = locked
    }
  }

  function bringToFront(id: string): void {
    const widget = widgets.value.find(item => item.id === id)
    if (!widget) return

    const targets = widget.groupId
      ? widgets.value.filter(item => item.groupId === widget.groupId)
      : [widget]
    let zIndex = nextZIndex()
    for (const target of targets) {
      target.frame.zIndex = zIndex
      zIndex += 1
    }
  }

  function toggleLock(id: string): void {
    const widget = widgets.value.find(item => item.id === id)
    if (!widget) return

    const locked = !widget.locked
    if (!widget.groupId) {
      widget.locked = locked
      return
    }

    for (const target of widgets.value) {
      if (target.groupId === widget.groupId) target.locked = locked
    }
  }

  function upgradeLegacyStarterLayout(): boolean {
    const monitor = primaryMonitor.value
    if (!isLegacyStarterLayout(widgets.value, monitor)) return false
    const defaults = cloneDefaultWidgets(monitor)
    widgets.value = defaults.map(defaultWidget => {
      const candidates = widgets.value
        .filter(widget => widget.type === defaultWidget.type)
        .sort((left, right) => {
          const configDifference = Object.keys(right.config).length - Object.keys(left.config).length
          return configDifference !== 0 ? configDifference : left.frame.zIndex - right.frame.zIndex
        })
      const current = candidates[0]
      return current
        ? {
            ...defaultWidget,
            id: current.id,
            title: current.title,
            appearance: { ...current.appearance },
            config: { ...current.config },
          }
        : defaultWidget
    })
    selectedWidgetIds.value = []
    editMode.value = false
    return true
  }

  function reset(): void {
    widgets.value = cloneDefaultWidgets(primaryMonitor.value)
    selectedWidgetIds.value = []
    editMode.value = false
  }

  function handleExternalStorageChange(event: StorageEvent): void {
    if (event.storageArea !== localStorage || event.key !== STORAGE_KEY || event.newValue !== null) return

    persistenceSuspended = true
    if (persistTimer !== null) {
      clearTimeout(persistTimer)
      persistTimer = null
    }
    monitors.value = []
    widgets.value = cloneDefaultWidgets()
    selectedWidgetIds.value = []
    editMode.value = false
  }

  watch(widgets, schedulePersist, { deep: true })
  window.addEventListener('storage', handleExternalStorageChange)

  onScopeDispose(() => {
    if (persistTimer !== null) clearTimeout(persistTimer)
    window.removeEventListener('storage', handleExternalStorageChange)
  })

  return {
    widgets,
    monitors,
    orderedWidgets,
    selectedWidgetIds,
    selectedWidgets,
    activeWidget,
    canGroupSelection,
    canUngroupSelection,
    primaryMonitor,
    editMode,
    templateBackupAvailable,
    applyTemplateLayout,
    restoreTemplateBackup,
    init,
    setMonitorTopology,
    moveWidgetToMonitor,
    arrangeWidgets,
    snapWidgetFrame,
    beginFrameInteraction,
    endFrameInteraction,
    addWidget,
    updateWidget,
    updateFrame,
    isSelected,
    selectWidget,
    clearSelection,
    getMoveTargetIds,
    groupSelection,
    ungroupSelection,
    updateSelectedAppearance,
    updateSelectedTitle,
    updateSelectedConfig,
    setSelectedLocked,
    removeWidget,
    bringToFront,
    toggleLock,
    upgradeLegacyStarterLayout,
    reset,
  }
})
