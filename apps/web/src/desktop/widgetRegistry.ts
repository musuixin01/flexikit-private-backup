import type { Component } from 'vue'
import {
  createBuiltinWidgetPlugin,
  validateWidgetPluginManifest,
  type WidgetPluginManifest,
  type WidgetPluginManifestOptions,
} from '@/desktop/widgetPlugin'
import ClockWidget from '@/components/desktop/widgets/ClockWidget.vue'
import CalendarWidget from '@/components/desktop/widgets/CalendarWidget.vue'
import FolderWidget from '@/components/desktop/widgets/FolderWidget.vue'
import SystemMonitorWidget from '@/components/desktop/widgets/SystemMonitorWidget.vue'
import NotesWidget from '@/components/desktop/widgets/NotesWidget.vue'
import WeatherWidget from '@/components/desktop/widgets/WeatherWidget.vue'
import DiskWidget from '@/components/desktop/widgets/DiskWidget.vue'
import LauncherWidget from '@/components/desktop/widgets/LauncherWidget.vue'
import SearchWidget from '@/components/desktop/widgets/SearchWidget.vue'
import ToolDockWidget from '@/components/desktop/widgets/ToolDockWidget.vue'
import TodoWidget from '@/components/desktop/widgets/TodoWidget.vue'
import ClipboardWidget from '@/components/desktop/widgets/ClipboardWidget.vue'
import MusicWidget from '@/components/desktop/widgets/MusicWidget.vue'
import AiWidget from '@/components/desktop/widgets/AiWidget.vue'
import DesktopOrganizerWidget from '@/components/desktop/widgets/DesktopOrganizerWidget.vue'

export type WidgetConfigPrimitive = string | number | boolean

export interface WidgetConfigCondition {
  key: string
  equals: WidgetConfigPrimitive
}

interface WidgetConfigItemBase {
  key: string
  label: string
  description?: string
  visibleWhen?: WidgetConfigCondition
}

export interface WidgetBooleanConfigField extends WidgetConfigItemBase {
  type: 'boolean'
  defaultValue: boolean
}

export interface WidgetSelectConfigField extends WidgetConfigItemBase {
  type: 'select'
  defaultValue: string
  options: readonly { label: string; value: string }[]
}

export interface WidgetRangeConfigField extends WidgetConfigItemBase {
  type: 'range'
  defaultValue: number
  min: number
  max: number
  step: number
  unit?: string
}

export interface WidgetNumberConfigField extends WidgetConfigItemBase {
  type: 'number'
  defaultValue: number
  min: number
  max: number
  step: number
  unit?: string
  placeholder?: string
}

export interface WidgetTextConfigField extends WidgetConfigItemBase {
  type: 'text'
  defaultValue: string
  placeholder?: string
  maxLength?: number
}

export interface WidgetColorConfigField extends WidgetConfigItemBase {
  type: 'color'
  defaultValue: string
}

export interface WidgetConfigSection extends WidgetConfigItemBase {
  type: 'section'
}

export type WidgetConfigField =
  | WidgetBooleanConfigField
  | WidgetSelectConfigField
  | WidgetRangeConfigField
  | WidgetNumberConfigField
  | WidgetTextConfigField
  | WidgetColorConfigField

export type WidgetConfigSchemaItem = WidgetConfigField | WidgetConfigSection

export interface WidgetDefinition {
  type: string
  title: string
  description: string
  icon: string
  component: Component
  defaultWidth: number
  defaultHeight: number
  configSchema?: readonly WidgetConfigSchemaItem[]
  plugin: WidgetPluginManifest
}

type BuiltinWidgetDefinition = Omit<WidgetDefinition, 'plugin'>

const registry = new Map<string, WidgetDefinition>()
const WIDGET_TYPE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const CONFIG_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9]*$/
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function isWidgetConfigField(item: WidgetConfigSchemaItem): item is WidgetConfigField {
  return item.type !== 'section'
}

function validateNumericField(
  field: WidgetRangeConfigField | WidgetNumberConfigField,
  issues: string[],
): void {
  if (![field.defaultValue, field.min, field.max, field.step].every(Number.isFinite)) {
    issues.push(`${field.key} numeric values must be finite`)
    return
  }
  if (field.min >= field.max) issues.push(`${field.key} min must be smaller than max`)
  if (field.step <= 0) issues.push(`${field.key} step must be greater than zero`)
  if (field.defaultValue < field.min || field.defaultValue > field.max) {
    issues.push(`${field.key} defaultValue must be within min/max`)
  }
}

function validateWidgetDefinition(definition: WidgetDefinition): string[] {
  const issues = validateWidgetPluginManifest(definition.plugin)

  if (!WIDGET_TYPE_PATTERN.test(definition.type)) {
    issues.push('widget type must use lowercase kebab-case')
  }
  if (!definition.title.trim()) issues.push('widget title is required')
  if (!definition.description.trim()) issues.push('widget description is required')
  if (!definition.icon.trim()) issues.push('widget icon is required')
  if (!Number.isFinite(definition.defaultWidth) || definition.defaultWidth < 120) {
    issues.push('defaultWidth must be at least 120')
  }
  if (!Number.isFinite(definition.defaultHeight) || definition.defaultHeight < 100) {
    issues.push('defaultHeight must be at least 100')
  }

  const schemaKeys = new Set<string>()
  const valueFields = new Map<string, WidgetConfigField>()
  for (const item of definition.configSchema ?? []) {
    if (!CONFIG_KEY_PATTERN.test(item.key)) {
      issues.push(`invalid config key: ${item.key}`)
    }
    if (!item.label.trim()) issues.push(`${item.key || 'config item'} label is required`)
    if (schemaKeys.has(item.key)) issues.push(`duplicate config key: ${item.key}`)
    schemaKeys.add(item.key)

    if (item.visibleWhen) {
      const controller = valueFields.get(item.visibleWhen.key)
      if (!controller) {
        issues.push(`${item.key} visibleWhen must reference an earlier value field`)
      } else if (typeof item.visibleWhen.equals !== typeof controller.defaultValue) {
        issues.push(`${item.key} visibleWhen value type does not match ${controller.key}`)
      } else if (
        controller.type === 'select'
        && typeof item.visibleWhen.equals === 'string'
        && !controller.options.some(option => option.value === item.visibleWhen?.equals)
      ) {
        issues.push(`${item.key} visibleWhen value is not an option of ${controller.key}`)
      }
    }

    if (!isWidgetConfigField(item)) continue

    if (item.type === 'select') {
      if (!item.options.length) issues.push(`${item.key} select requires options`)
      const optionValues = new Set<string>()
      for (const option of item.options) {
        if (!option.label.trim()) issues.push(`${item.key} select option label is required`)
        if (!option.value) issues.push(`${item.key} select option value is required`)
        if (optionValues.has(option.value)) issues.push(`${item.key} has duplicate option: ${option.value}`)
        optionValues.add(option.value)
      }
      if (!item.options.some(option => option.value === item.defaultValue)) {
        issues.push(`${item.key} defaultValue must exist in select options`)
      }
    } else if (item.type === 'range' || item.type === 'number') {
      validateNumericField(item, issues)
    } else if (item.type === 'text') {
      if (item.maxLength !== undefined && (!Number.isInteger(item.maxLength) || item.maxLength < 1 || item.maxLength > 4096)) {
        issues.push(`${item.key} maxLength must be an integer between 1 and 4096`)
      }
    } else if (item.type === 'color' && !HEX_COLOR_PATTERN.test(item.defaultValue)) {
      issues.push(`${item.key} color defaultValue must be #RRGGBB`)
    }

    valueFields.set(item.key, item)
  }

  return issues
}

export function registerWidgetPlugin(definition: WidgetDefinition): void {
  if (registry.has(definition.type)) {
    throw new Error(`Widget type already registered: ${definition.type}`)
  }

  const issues = validateWidgetDefinition(definition)
  if (issues.length) {
    throw new Error(`Invalid widget plugin ${definition.type}: ${issues.join('; ')}`)
  }

  registry.set(definition.type, definition)
}

export const registerWidget = registerWidgetPlugin

export function getWidgetDefinition(type: string): WidgetDefinition | undefined {
  return registry.get(type)
}

export function getWidgetPluginManifest(type: string): WidgetPluginManifest | undefined {
  return registry.get(type)?.plugin
}

export function listWidgetDefinitions(): WidgetDefinition[] {
  return Array.from(registry.values())
}

export function listWidgetPluginManifests(): WidgetPluginManifest[] {
  return listWidgetDefinitions().map(definition => definition.plugin)
}

export function getWidgetConfigDefaults(definition: WidgetDefinition): Record<string, WidgetConfigPrimitive> {
  const defaults: Record<string, WidgetConfigPrimitive> = {}
  for (const item of definition.configSchema ?? []) {
    if (isWidgetConfigField(item)) defaults[item.key] = item.defaultValue
  }
  return defaults
}

function normalizeNumericValue(
  field: WidgetRangeConfigField | WidgetNumberConfigField,
  value: unknown,
): number {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : field.defaultValue
  const clamped = Math.min(field.max, Math.max(field.min, numeric))
  const stepped = field.min + Math.round((clamped - field.min) / field.step) * field.step
  return Number(Math.min(field.max, Math.max(field.min, stepped)).toFixed(10))
}

export function resolveWidgetConfigValue(
  field: WidgetConfigField,
  config: Record<string, unknown>,
): WidgetConfigPrimitive {
  const value = config[field.key]

  if (field.type === 'boolean') return typeof value === 'boolean' ? value : field.defaultValue
  if (field.type === 'range' || field.type === 'number') return normalizeNumericValue(field, value)
  if (field.type === 'text') {
    if (typeof value !== 'string') return field.defaultValue
    return field.maxLength ? value.slice(0, field.maxLength) : value
  }
  if (field.type === 'color') {
    return typeof value === 'string' && HEX_COLOR_PATTERN.test(value) ? value : field.defaultValue
  }
  if (typeof value === 'string' && field.options.some(option => option.value === value)) return value
  return field.defaultValue
}

export function isWidgetConfigSchemaItemVisible(
  item: WidgetConfigSchemaItem,
  config: Record<string, unknown>,
  schema: readonly WidgetConfigSchemaItem[],
): boolean {
  if (!item.visibleWhen) return true
  const controller = schema.find(candidate => (
    candidate.key === item.visibleWhen?.key && isWidgetConfigField(candidate)
  ))
  if (!controller || !isWidgetConfigField(controller)) return false
  return resolveWidgetConfigValue(controller, config) === item.visibleWhen.equals
}

const BUILTIN_PLUGIN_OPTIONS: Record<string, WidgetPluginManifestOptions> = {
  'desktop-organizer': {
    instancePolicy: 'single',
    permissions: ['native-command', 'desktop-read', 'desktop-open'],
    nativeCommands: [
      'get_desktop_item_icon',
      'get_desktop_items',
      'search_desktop_items',
      'get_desktop_folder_preview',
      'open_desktop_item',
    ],
  },
  clock: {},
  calendar: {},
  folder: {
    permissions: ['native-command', 'desktop-read', 'desktop-open'],
    nativeCommands: [
      'get_desktop_item_icon',
      'get_desktop_items',
      'get_desktop_folder_preview',
      'open_desktop_item',
    ],
  },
  'system-monitor': {
    permissions: ['native-command', 'system-read'],
    nativeCommands: ['get_system_monitor_snapshot'],
  },
  notes: {},
  weather: {
    permissions: ['network'],
    networkOrigins: [
      'https://geocoding-api.open-meteo.com',
      'https://api.open-meteo.com',
    ],
  },
  launcher: {
    permissions: ['tool-launch'],
  },
  'tool-dock': {
    permissions: ['tool-launch'],
  },
  search: {
    permissions: ['tool-launch'],
  },
  disk: {
    permissions: ['native-command', 'system-read'],
    nativeCommands: ['get_system_disk_info'],
  },
  todo: {},
  clipboard: {
    permissions: ['native-command', 'clipboard-read', 'clipboard-write'],
    nativeCommands: ['get_clipboard_text', 'set_clipboard_text'],
  },
  music: {
    permissions: ['network', 'native-command', 'media-control'],
    networkOrigins: ['https://lrclib.net'],
    nativeCommands: [
      'get_system_media_thumbnail',
      'get_system_media_snapshot',
      'control_system_media',
    ],
  },
  ai: {
    permissions: ['native-command', 'clipboard-write', 'tool-launch'],
    nativeCommands: ['set_clipboard_text'],
  },
}

const BUILTIN_WIDGETS = [
  { type: 'desktop-organizer', title: '桌面收纳', description: '自动分类并集中管理桌面项目', icon: '▦', component: DesktopOrganizerWidget, defaultWidth: 400, defaultHeight: 280 },
  {
    type: 'clock',
    title: '时间',
    description: '时间、日期和星期',
    icon: '◷',
    component: ClockWidget,
    defaultWidth: 220,
    defaultHeight: 160,
    configSchema: [
      { type: 'boolean', key: 'clockShowSeconds', label: '显示秒', description: '在时间中显示秒数', defaultValue: false },
      {
        type: 'select',
        key: 'clockHourCycle',
        label: '时间制式',
        defaultValue: '24',
        options: [
          { label: '24 小时', value: '24' },
          { label: '12 小时', value: '12' },
        ],
      },
      { type: 'boolean', key: 'clockShowDate', label: '显示日期', defaultValue: true },
      { type: 'boolean', key: 'clockShowWeekday', label: '显示星期', defaultValue: true },
    ],
  },
  {
    type: 'calendar',
    title: '日历',
    description: '月历、日期选择与今天定位',
    icon: '日',
    component: CalendarWidget,
    defaultWidth: 320,
    defaultHeight: 340,
    configSchema: [
      {
        type: 'select',
        key: 'calendarWeekStartsOn',
        label: '每周开始',
        defaultValue: 'monday',
        options: [
          { label: '周一', value: 'monday' },
          { label: '周日', value: 'sunday' },
        ],
      },
      {
        type: 'boolean',
        key: 'calendarShowAdjacentDays',
        label: '显示相邻月份',
        description: '在月历空位显示上月和下月日期',
        defaultValue: true,
      },
    ],
  },
  {
    type: 'folder',
    title: '文件夹',
    description: '把常用桌面文件夹固定到 Canvas',
    icon: '▣',
    component: FolderWidget,
    defaultWidth: 340,
    defaultHeight: 320,
  },
  {
    type: 'system-monitor',
    title: '系统监控',
    description: 'CPU、内存、系统盘与开机时长',
    icon: '▥',
    component: SystemMonitorWidget,
    defaultWidth: 320,
    defaultHeight: 250,
    configSchema: [
      {
        type: 'select',
        key: 'systemMonitorRefreshRate',
        label: '刷新频率',
        description: '较慢刷新可进一步减少桌面常驻开销',
        defaultValue: '2',
        options: [
          { label: '2 秒', value: '2' },
          { label: '5 秒', value: '5' },
          { label: '10 秒', value: '10' },
        ],
      },
      {
        type: 'boolean',
        key: 'systemMonitorShowDisk',
        label: '显示系统盘',
        defaultValue: true,
      },
    ],
  },
  {
    type: 'notes',
    title: '便签',
    description: '桌面纯文本速记与自动保存',
    icon: '▤',
    component: NotesWidget,
    defaultWidth: 320,
    defaultHeight: 280,
    configSchema: [
      {
        type: 'section',
        key: 'notesAppearanceSection',
        label: '便签样式',
        description: '只影响当前便签实例',
      },
      {
        type: 'color',
        key: 'noteAccentColor',
        label: '强调色',
        defaultValue: '#8F98A3',
      },
    ],
  },
  {
    type: 'weather',
    title: '天气',
    description: '手动城市的当前天气与 4 日预报',
    icon: '☀︎',
    component: WeatherWidget,
    defaultWidth: 340,
    defaultHeight: 280,
    configSchema: [
      {
        type: 'section',
        key: 'weatherLocationSection',
        label: '位置',
        description: '天气不会读取系统定位，只有设置城市后才联网',
      },
      {
        type: 'text',
        key: 'weatherLocation',
        label: '城市',
        description: '支持“城市, 国家/省州”减少同名歧义',
        defaultValue: '',
        placeholder: '例如：南京 / Singapore',
        maxLength: 80,
      },
      {
        type: 'section',
        key: 'weatherDisplaySection',
        label: '显示',
      },
      {
        type: 'select',
        key: 'weatherTemperatureUnit',
        label: '温度单位',
        defaultValue: 'celsius',
        options: [
          { label: '摄氏 °C', value: 'celsius' },
          { label: '华氏 °F', value: 'fahrenheit' },
        ],
      },
      {
        type: 'boolean',
        key: 'weatherShowForecast',
        label: '显示天气预报',
        defaultValue: true,
      },
      {
        type: 'number',
        key: 'weatherForecastDays',
        label: '预报天数',
        description: '控制 Widget 中显示的预报天数',
        defaultValue: 4,
        min: 1,
        max: 4,
        step: 1,
        unit: '天',
        visibleWhen: { key: 'weatherShowForecast', equals: true },
      },
    ],
  },
  { type: 'launcher', title: '快捷启动', description: '自由组合常用工具', icon: '⌘', component: LauncherWidget, defaultWidth: 280, defaultHeight: 280 },
  {
    type: 'tool-dock', title: '我的工具', description: '将网页与本地工具固定到桌面控制台', icon: '▦',
    component: ToolDockWidget, defaultWidth: 440, defaultHeight: 280,
    configSchema: [{
      type: 'select', key: 'toolDockOrientation', label: '工具排列', defaultValue: 'auto',
      options: [
        { value: 'auto', label: '根据尺寸自动' },
        { value: 'horizontal', label: '横向图标' },
        { value: 'vertical', label: '纵向列表' },
      ],
    }],
  },
  {
    type: 'search',
    title: '搜索',
    description: '搜索应用、工具与网站',
    icon: '⌕',
    component: SearchWidget,
    defaultWidth: 400,
    defaultHeight: 180,
    configSchema: [
      { type: 'range', key: 'searchResultLimit', label: '结果数量', defaultValue: 6, min: 3, max: 12, step: 1, unit: '项' },
      {
        type: 'text',
        key: 'searchPlaceholder',
        label: '搜索提示',
        defaultValue: '搜索应用、工具和网站…',
        placeholder: '输入搜索框提示文字',
        maxLength: 48,
      },
    ],
  },
  { type: 'disk', title: '系统磁盘', description: '查看系统盘容量', icon: '◉', component: DiskWidget, defaultWidth: 220, defaultHeight: 160 },
  {
    type: 'todo',
    title: '待办',
    description: '轻量待办与完成状态',
    icon: '✓',
    component: TodoWidget,
    defaultWidth: 320,
    defaultHeight: 320,
    configSchema: [
      { type: 'boolean', key: 'todoShowCompleted', label: '显示已完成', description: '关闭后仅显示未完成项目', defaultValue: true },
    ],
  },
  { type: 'clipboard', title: '剪贴板', description: '按需读取与写入系统剪贴板', icon: '⌘', component: ClipboardWidget, defaultWidth: 360, defaultHeight: 250 },
  {
    type: 'music',
    title: '音乐与歌词',
    description: '当前媒体、进度、控制与可选同步歌词',
    icon: '♪',
    component: MusicWidget,
    defaultWidth: 420,
    defaultHeight: 340,
    configSchema: [
      {
        type: 'boolean',
        key: 'musicLyricsEnabled',
        label: '联网歌词',
        description: '开启后会将歌曲元数据发送到 LRCLIB 匹配歌词',
        defaultValue: false,
      },
    ],
  },
  { type: 'ai', title: 'AI 快捷台', description: '写 Prompt 并快速打开 AI 工具', icon: '✦', component: AiWidget, defaultWidth: 390, defaultHeight: 250 },
] satisfies BuiltinWidgetDefinition[]

BUILTIN_WIDGETS.forEach((definition) => {
  registerWidgetPlugin({
    ...definition,
    plugin: createBuiltinWidgetPlugin(
      definition.type,
      BUILTIN_PLUGIN_OPTIONS[definition.type],
    ),
  })
})
