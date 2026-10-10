export interface WidgetFrame {
  x: number
  y: number
  width: number
  height: number
  zIndex: number
}

export type WidgetAppearancePreset = 'glass' | 'clear' | 'dense' | 'space' | 'solid' | 'custom'
export type WidgetSurfaceTone = 'adaptive' | 'dark' | 'light'

export interface WidgetAppearance {
  preset: WidgetAppearancePreset
  tone: WidgetSurfaceTone
  opacity: number
  borderRadius: number
  blur: number
  surfaceOpacity: number
  borderStrength: number
  shadowStrength: number
}

export interface CanvasMonitorInfo {
  id: string
  name: string
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
  isPrimary: boolean
}

export interface DesktopWidget {
  id: string
  type: string
  title: string
  monitorId?: string | null
  frame: WidgetFrame
  appearance: WidgetAppearance
  locked: boolean
  groupId?: string | null
  config: Record<string, unknown>
}

export interface WidgetCreateOptions {
  title?: string
  monitorId?: string | null
  frame?: Partial<WidgetFrame>
  appearance?: Partial<WidgetAppearance>
  locked?: boolean
  groupId?: string | null
  config?: Record<string, unknown>
}
