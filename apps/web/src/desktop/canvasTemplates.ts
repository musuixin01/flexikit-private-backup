import { getWidgetConfigDefaults, getWidgetDefinition } from '@/desktop/widgetRegistry'
import type { CanvasMonitorInfo, WidgetCreateOptions } from '@/types/desktopWidget'

export type CanvasTemplateId = 'command' | 'creator' | 'focus' | 'custom'
export type CanvasConsoleOrientation = 'horizontal' | 'vertical'
export type CanvasConsolePosition =
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right'

export interface CanvasConsoleRequest {
  id: CanvasTemplateId
  orientation: CanvasConsoleOrientation
  position: CanvasConsolePosition
  offsetX: number
  offsetY: number
  items?: string[]
}
export interface CanvasConsoleTemplate {
  id: Exclude<CanvasTemplateId, 'custom'>
  title: string
  tagline: string
  description: string
  accent: string
  items: readonly { type: string }[]
}
export interface CanvasConsolePreviewItem {
  type: string
  x: number
  y: number
  width: number
  height: number
}
export interface SavedCustomConsole {
  version: 1
  name: string
  orientation: CanvasConsoleOrientation
  position: CanvasConsolePosition
  offsetX: number
  offsetY: number
  items: string[]
}

export const CUSTOM_CONSOLE_STORAGE_KEY = 'flexikit-canvas-console-custom-v1'
export const CONSOLE_WIDGET_TYPES = ['clock', 'search', 'tool-dock', 'desktop-organizer', 'disk', 'notes', 'ai', 'todo', 'system-monitor', 'calendar', 'weather', 'music', 'folder', 'launcher'] as const
export const MAX_CONSOLE_WIDGETS = 6

export const CANVAS_CONSOLE_TEMPLATES: readonly CanvasConsoleTemplate[] = [
  {
    id: 'command', title: '效率控制台', tagline: 'EVERYDAY WORKSPACE',
    description: '搜索、时间、系统状态与常用工具，开箱即用。',
    accent: '#818CF8',
    items: [
      { type: 'clock' }, { type: 'search' }, { type: 'disk' },
      { type: 'tool-dock' }, { type: 'desktop-organizer' },
    ],
  },
  {
    id: 'creator', title: '创作工作室', tagline: 'CREATOR STUDIO',
    description: '便签、AI 灵感和应用快捷入口，一张桌面完成创作。',
    accent: '#A78BFA',
    items: [
      { type: 'clock' }, { type: 'notes' }, { type: 'ai' },
      { type: 'tool-dock' }, { type: 'desktop-organizer' },
    ],
  },
  {
    id: 'focus', title: '极简专注', tagline: 'FOCUS MODE',
    description: '大面积留白和少量必要组件，降低桌面干扰。',
    accent: '#94A3B8',
    items: [
      { type: 'clock' }, { type: 'search' },
      { type: 'tool-dock' }, { type: 'desktop-organizer' },
    ],
  },
]

function isOrientation(value: unknown): value is CanvasConsoleOrientation {
  return value === 'horizontal' || value === 'vertical'
}
function isPosition(value: unknown): value is CanvasConsolePosition {
  return typeof value === 'string' && (
    value === 'center'
    || /^(top|center|bottom)-(left|center|right)$/.test(value)
  )
}
function clampOffset(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(-300, Math.min(300, Math.round(value))) : 0
}
function normalizeItems(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return Array.from(new Set(input.filter((type): type is string => (
    typeof type === 'string' && CONSOLE_WIDGET_TYPES.some(known => known === type)
  )))).slice(0, MAX_CONSOLE_WIDGETS)
}
export function normalizeCanvasConsoleRequest(value: CanvasConsoleRequest): CanvasConsoleRequest {
  const items = value.id === 'custom' ? normalizeItems(value.items) : undefined
  return {
    id: value.id, orientation: isOrientation(value.orientation) ? value.orientation : 'horizontal',
    position: isPosition(value.position) ? value.position : 'top-center',
    offsetX: clampOffset(value.offsetX), offsetY: clampOffset(value.offsetY), ...(items ? { items } : {}),
  }
}
export function loadCustomCanvasConsole(): SavedCustomConsole | null {
  try {
    const raw = localStorage.getItem(CUSTOM_CONSOLE_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    const input = parsed as Partial<SavedCustomConsole>
    const items = normalizeItems(input.items)
    if (input.version !== 1 || !items.length || !isOrientation(input.orientation) || !isPosition(input.position)) return null
    return {
      version: 1, name: typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 32) : '我的控制台',
      orientation: input.orientation, position: input.position,
      offsetX: clampOffset(input.offsetX), offsetY: clampOffset(input.offsetY), items,
    }
  } catch { return null }
}
export function saveCustomCanvasConsole(custom: Omit<SavedCustomConsole, 'version'>): void {
  const items = normalizeItems(custom.items)
  if (!items.length) throw new Error('Please select at least one widget')
  const payload: SavedCustomConsole = {
    version: 1, name: custom.name.trim().slice(0, 32) || '我的控制台',
    orientation: isOrientation(custom.orientation) ? custom.orientation : 'horizontal',
    position: isPosition(custom.position) ? custom.position : 'top-center',
    offsetX: clampOffset(custom.offsetX), offsetY: clampOffset(custom.offsetY), items,
  }
  localStorage.setItem(CUSTOM_CONSOLE_STORAGE_KEY, JSON.stringify(payload))
}

// Pure geometry. Horizontal = one wide strip (at six widgets two wide rows);
// vertical = a stack (at six widgets two tall columns). No storage or UI writes.
export function layoutConsoleItems(types: readonly string[], orientation: CanvasConsoleOrientation): CanvasConsolePreviewItem[] {
  const gap = 20
  const baseWidths: Record<string, number> = { clock: 190, search: 310, disk: 200, 'tool-dock': 330, 'desktop-organizer': 320, notes: 275, ai: 240 }
  const baseHeights: Record<string, number> = { clock: 155, search: 190, disk: 155, 'tool-dock': 260, 'desktop-organizer': 265, notes: 255, ai: 215 }
  const compact = types.length === 6
  if (orientation === 'horizontal') {
    const columns = compact ? 3 : types.length
    const rows = compact ? 2 : 1
    const result: CanvasConsolePreviewItem[] = []
    let y = 0
    for (let row = 0; row < rows; row += 1) {
      let x = 0
      const rowTypes = types.slice(row * columns, (row + 1) * columns)
      const height = Math.max(...rowTypes.map(type => baseHeights[type] ?? 230))
      for (const type of rowTypes) {
        const width = baseWidths[type] ?? 245
        result.push({ type, x, y, width, height })
        x += width + gap
      }
      y += height + gap
    }
    return result
  }
  const columns = compact ? 2 : 1
  const rows = Math.ceil(types.length / columns)
  const result: CanvasConsolePreviewItem[] = []
  let x = 0
  for (let col = 0; col < columns; col += 1) {
    const colTypes = types.slice(col * rows, (col + 1) * rows)
    const width = 370
    let y = 0
    for (const type of colTypes) {
      const height = baseHeights[type] ?? 205
      result.push({ type, x, y, width, height })
      y += height + gap
    }
    x += width + gap
  }
  return result
}
export function resolveConsoleItems(value: CanvasConsoleRequest): string[] {
  if (value.id === 'custom') return normalizeItems(value.items)
  const template = CANVAS_CONSOLE_TEMPLATES.find(item => item.id === value.id)
  return template?.items.map(item => item.type) ?? []
}

export function createCanvasTemplateWidgets(
  input: CanvasConsoleRequest,
  monitor: CanvasMonitorInfo | null,
): Array<{ type: string; options: WidgetCreateOptions }> {
  const request = normalizeCanvasConsoleRequest(input)
  const types = resolveConsoleItems(request)
  if (!types.length) return []
  const rectangles = layoutConsoleItems(types, request.orientation)
  const boundingWidth = Math.max(...rectangles.map(item => item.x + item.width))
  const boundingHeight = Math.max(...rectangles.map(item => item.y + item.height))
  const monitorWidth = monitor?.width ?? 1440
  const monitorHeight = monitor?.height ?? 900
  const usableWidth = Math.max(180, Math.floor((monitorWidth - 48) / 20) * 20)
  const usableHeight = Math.max(180, Math.floor((monitorHeight - 124) / 20) * 20)
  const scale = Math.min(1, usableWidth / boundingWidth, usableHeight / boundingHeight)
  const snap = (value: number) => Math.round(value / 20) * 20
  const sized = rectangles.map(item => ({
    ...item, x: 0, y: 0,
    width: Math.max(80, snap(item.width * scale)),
    height: Math.max(80, snap(item.height * scale)),
  }))
  // Shrink oversized rows/columns in 20px steps. Never overlap a minimum-size
  // Widget when the monitor is short or a customer selects six tools.
  function fit(sizes: number[], budget: number): number[] {
    const values = [...sizes]
    while (values.reduce((sum, value) => sum + value, 0) > budget) {
      const largest = values.reduce((best, value, index) => value > values[best] ? index : best, 0)
      if (values[largest] <= 80) break
      values[largest] -= 20
    }
    return values
  }
  const gap = 20
  if (request.orientation === 'horizontal') {
    const rowIds = [...new Set(rectangles.map(item => item.y))].sort((a, b) => a - b)
    const rowGroups = rowIds.map(y => rectangles.map((item, index) => item.y === y ? index : -1).filter(index => index >= 0))
    const rowHeights = fit(rowGroups.map(group => Math.max(...group.map(index => sized[index].height))),
      usableHeight - gap * (rowGroups.length - 1))
    let y = 0
    rowGroups.forEach((group, rowIndex) => {
      const widths = fit(group.map(index => sized[index].width), usableWidth - gap * (group.length - 1))
      let x = 0
      group.forEach((index, position) => {
        sized[index].x = x
        sized[index].y = y
        sized[index].width = widths[position]
        sized[index].height = rowHeights[rowIndex]
        x += widths[position] + gap
      })
      y += rowHeights[rowIndex] + gap
    })
  } else {
    const colIds = [...new Set(rectangles.map(item => item.x))].sort((a, b) => a - b)
    const colGroups = colIds.map(x => rectangles.map((item, index) => item.x === x ? index : -1).filter(index => index >= 0))
    const colWidths = fit(colGroups.map(group => Math.max(...group.map(index => sized[index].width))),
      usableWidth - gap * (colGroups.length - 1))
    let x = 0
    colGroups.forEach((group, colIndex) => {
      const heights = fit(group.map(index => sized[index].height), usableHeight - gap * (group.length - 1))
      let y = 0
      group.forEach((index, position) => {
        sized[index].x = x
        sized[index].y = y
        sized[index].width = colWidths[colIndex]
        sized[index].height = heights[position]
        y += heights[position] + gap
      })
      x += colWidths[colIndex] + gap
    })
  }
  const renderedWidth = Math.max(...sized.map(item => item.x + item.width))
  const renderedHeight = Math.max(...sized.map(item => item.y + item.height))
  const anchorX = request.position.includes('left') ? 0 : request.position.includes('right') ? 1 : .5
  const anchorY = request.position.startsWith('top') ? 0 : request.position.startsWith('bottom') ? 1 : .5
  const localX = Math.max(24, Math.min(monitorWidth - 24 - renderedWidth,
    24 + (usableWidth - renderedWidth) * anchorX + request.offsetX))
  const localY = Math.max(82, Math.min(monitorHeight - 24 - renderedHeight,
    82 + (usableHeight - renderedHeight) * anchorY + request.offsetY))
  return sized.flatMap(item => {
    const definition = getWidgetDefinition(item.type)
    if (!definition) return []
    return [{
      type: item.type,
      options: {
        title: definition.title,
        monitorId: monitor?.id ?? null,
        frame: {
          x: (monitor?.x ?? 0) + snap(localX + item.x),
          y: (monitor?.y ?? 0) + snap(localY + item.y),
          width: item.width,
          height: item.height,
        },
        config: {
          ...getWidgetConfigDefaults(definition),
          consoleTemplateId: request.id,
          ...(item.type === 'tool-dock' ? { toolDockOrientation: request.orientation } : {}),
        },
      },
    }]
  })
}
