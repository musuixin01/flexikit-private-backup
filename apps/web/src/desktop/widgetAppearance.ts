import type { WidgetAppearance, WidgetAppearancePreset } from '@/types/desktopWidget'

export interface WidgetAppearancePresetDefinition {
  id: Exclude<WidgetAppearancePreset, 'custom'>
  title: string
  description: string
  appearance: WidgetAppearance
}

export const DEFAULT_WIDGET_APPEARANCE: WidgetAppearance = {
  preset: 'glass',
  tone: 'adaptive',
  opacity: 1,
  borderRadius: 22,
  blur: 30,
  surfaceOpacity: 0.66,
  borderStrength: 0.2,
  shadowStrength: 0.12,
}

export const WIDGET_APPEARANCE_PRESETS: readonly WidgetAppearancePresetDefinition[] = [
  {
    id: 'glass',
    title: '液态·标准',
    description: '通透悬浮 · 内容清晰',
    appearance: { ...DEFAULT_WIDGET_APPEARANCE },
  },
  {
    id: 'space',
    title: '深空',
    description: '更沉稳的深色表面',
    appearance: {
      preset: 'space',
      tone: 'dark',
      opacity: 0.97,
      borderRadius: 22,
      blur: 34,
      surfaceOpacity: 0.88,
      borderStrength: 0.12,
      shadowStrength: 0.2,
    },
  },
  {
    id: 'clear',
    title: '液态·轻透',
    description: '更通透 · 背景优先',
    appearance: {
      preset: 'clear',
      tone: 'adaptive',
      opacity: 1,
      borderRadius: 22,
      blur: 22,
      surfaceOpacity: 0.34,
      borderStrength: 0.22,
      shadowStrength: 0.1,
    },
  },
  {
    id: 'dense',
    title: '液态·浓厚',
    description: '柔和透光 · 阅读优先',
    appearance: {
      preset: 'dense',
      tone: 'adaptive',
      opacity: 1,
      borderRadius: 22,
      blur: 34,
      surfaceOpacity: 0.82,
      borderStrength: 0.18,
      shadowStrength: 0.16,
    },
  },
  {
    id: 'solid',
    title: '实色',
    description: '清晰稳定、弱化玻璃',
    appearance: {
      preset: 'solid',
      tone: 'adaptive',
      opacity: 1,
      borderRadius: 18,
      blur: 0,
      surfaceOpacity: 0.98,
      borderStrength: 0.1,
      shadowStrength: 0.1,
    },
  },
]

export function isWidgetAppearancePreset(value: unknown): value is WidgetAppearancePreset {
  return value === 'glass'
    || value === 'dense'
    || value === 'space'
    || value === 'clear'
    || value === 'solid'
    || value === 'custom'
}

export function isWidgetSurfaceTone(value: unknown): value is WidgetAppearance['tone'] {
  return value === 'adaptive' || value === 'dark' || value === 'light'
}
