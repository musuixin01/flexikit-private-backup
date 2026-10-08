import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Theme } from '@/types/tool'
import { invokeDesktop, isDesktopRuntime } from '@/api/runtime'

// 预设主题�?
export const PRESET_PRIMARY_COLORS = [
  { name: '蓝色', value: '#0071e3' }, // 苹果蓝（默认�?
  { name: '靛蓝', value: '#6366f1' },
  { name: '紫色', value: '#af52de' },
  { name: '粉色', value: '#ff375f' },
  { name: '橙色', value: '#ff9500' },
  { name: '绿色', value: '#34c759' },
  { name: '青色', value: '#30b0c7' },
  { name: '红色', value: '#ff3b30' },
]

export type CardSize = 'small' | 'medium' | 'large'
export type SidebarPosition = 'left' | 'right'

export interface LayoutSettings {
  gridColumns: number // 3-6�?
  cardSize: CardSize
  sidebarPosition: SidebarPosition
  sidebarCollapsed: boolean
  glassIntensity: number // 0-1 毛玻璃强�?
  borderRadius: number // 圆角大小 8-20px
}

export interface ThemeSettings {
  primaryColor: string
  backgroundColor: string
  customPrimary: boolean
  customBackground: boolean
  buttonBgColor: string
  tagBgColor: string
  iconBgColor: string
  customButtonBg: boolean
  customTagBg: boolean
  customIconBg: boolean
}

const DEFAULT_LAYOUT: LayoutSettings = {
  gridColumns: 4,
  cardSize: 'medium',
  sidebarPosition: 'left',
  sidebarCollapsed: false,
  glassIntensity: 0.7,
  borderRadius: 18,
}

const DEFAULT_THEME: ThemeSettings = {
  primaryColor: '#0071e3',
  backgroundColor: '#f0f0f5',
  customPrimary: false,
  customBackground: false,
  buttonBgColor: '',
  tagBgColor: '',
  iconBgColor: '',
  customButtonBg: false,
  customTagBg: false,
  customIconBg: false,
}

export const useUiStore = defineStore('ui', () => {
  // ========== State ==========
  const theme = ref<Theme>('auto')
  const activeCategory = ref('全部')
  const searchQuery = ref('')
  const selectMode = ref(false)
  const selectedSet = ref<Set<string>>(new Set())
  const showOnlyFav = ref(false)
  const toolTypeFilter = ref<'all' | 'web' | 'local'>('all')
  const showToolTypeFilter = ref(true)

  // 布局设置
  const layout = ref<LayoutSettings>({ ...DEFAULT_LAYOUT })
  // 主题设置
  const themeSettings = ref<ThemeSettings>({ ...DEFAULT_THEME })
  // 设置面板是否打开
  const settingsPanelOpen = ref(false)
  let faviconImagePromise: Promise<HTMLImageElement> | null = null
  let faviconUpdateVersion = 0

  // Toast state
  const toastMessage = ref('')
  const toastVisible = ref(false)
  const toastUndoCallback = ref<(() => void) | null>(null)

  // Modal state
  const toolModalOpen = ref(false)
  const toolModalMode = ref<'add' | 'edit'>('add')
  const toolModalBuiltinEdit = ref(false)
  const toolModalBuiltinName = ref('')
  const toolModalBuiltinUrl = ref('')
  const toolModalEditIndex = ref(-1)

  const confirmModalOpen = ref(false)
  const confirmModalTitle = ref('确认删除')
  const confirmModalMessage = ref('')
  const confirmModalCallback = ref<(() => void) | null>(null)

  const renameModalOpen = ref(false)
  const renameModalOldName = ref('')

  // ========== Getters ==========
  const windowWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1024)
  const isMobile = computed(() => windowWidth.value <= 860)

  // 桌面窗口缩小时限制最大列数，避免高列数把卡片压成狭长条。
  const effectiveGridColumns = computed(() => {
    if (isMobile.value) return 2
    if (isDesktopRuntime()) {
      if (windowWidth.value <= 1100) return Math.min(layout.value.gridColumns, 4)
      if (windowWidth.value <= 1400) return Math.min(layout.value.gridColumns, 5)
    }
    return layout.value.gridColumns
  })

  // 向后兼容：sidebarCollapsed 直接访问
  const sidebarCollapsed = computed({
    get: () => layout.value.sidebarCollapsed,
    set: (val: boolean) => { layout.value.sidebarCollapsed = val }
  })

  function updateWindowWidth() {
    if (typeof window !== 'undefined') windowWidth.value = window.innerWidth
  }

  // ========== Theme ==========
  function setTheme(t: Theme) {
    theme.value = t
    document.documentElement.setAttribute('data-theme', t)
    localStorage.setItem('gtb-theme', t)
    // 切换主题后重新应用CSS变量（深�?浅色模式默认颜色不同�?
    setTimeout(() => applyCssVariables(), 0)
  }

  function initTheme() {
    const saved = (localStorage.getItem('gtb-theme') || 'auto') as Theme
    setTheme(saved)
  }

  function getEffectiveTheme(): 'light' | 'dark' {
    if (theme.value === 'auto') {
      if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
      return 'light'
    }
    return theme.value
  }

  function toggleTheme() {
    const current = getEffectiveTheme()
    setTheme(current === 'dark' ? 'light' : 'dark')
  }

  // ========== 自定义主�?==========
  /**
   * 应用CSS变量到根元素
   */
  function applyCssVariables() {
    const root = document.documentElement
    const effectiveTheme = getEffectiveTheme()
    const isDark = effectiveTheme === 'dark'
    const selectedColor = themeSettings.value.customPrimary
      ? themeSettings.value.primaryColor
      : isDark ? '#0a84ff' : '#0071e3'
    const primary = isDark ? mixHex(selectedColor, '#ffffff', 0.08) : selectedColor
    const canvasBase = themeSettings.value.customBackground
      ? themeSettings.value.backgroundColor
      : isDark ? '#070b12' : '#f4f7fb'
    const canvas = mixHex(canvasBase, selectedColor, isDark ? 0.018 : 0.025)
    const surface = mixHex(isDark ? '#101620' : '#ffffff', selectedColor, isDark ? 0.02 : 0.012)
    const surfaceSoft = mixHex(isDark ? '#18202c' : '#f5f7fb', selectedColor, isDark ? 0.025 : 0.025)
    const textPrimary = mixHex(isDark ? '#f2f5fa' : '#182033', selectedColor, isDark ? 0.01 : 0.018)
    const textSecondary = mixHex(isDark ? '#abb4c2' : '#667085', selectedColor, isDark ? 0.015 : 0.035)
    const textTertiary = mixHex(isDark ? '#747e8f' : '#98a1b2', selectedColor, isDark ? 0.012 : 0.03)
    const primaryRgb = hexToRgb(primary)
    const surfaceRgb = hexToRgb(surface)
    const brandLogoHueRotation = getHueDegrees(primary) - 38
    const brandLogoEdge = isDark ? 'rgba(255, 255, 255, .30)' : 'rgba(15, 23, 42, .22)'
    const brandLogoOpacity = 0.98
    const brandLogoColorFilter = `grayscale(1) sepia(.78) saturate(${isDark ? 3.2 : 3.5}) hue-rotate(${brandLogoHueRotation}deg) brightness(${isDark ? 1.14 : 1.05}) contrast(1.08) drop-shadow(0 0 .65px ${brandLogoEdge})`
    const brandLogoFilter = `${brandLogoColorFilter} drop-shadow(0 3px 8px ${rgba(primaryRgb, isDark ? 0.24 : 0.16)})`
    const borderAlpha = isDark ? 0.075 : 0.085
    const companionA = rotateHue(selectedColor, 24)
    const companionB = rotateHue(selectedColor, -22)
    const companionC = rotateHue(selectedColor, 48)
    const gradientA = mixHex(canvasBase, companionA, isDark ? 0.032 : 0.065)
    const gradientB = mixHex(canvasBase, companionB, isDark ? 0.024 : 0.055)
    const gradientC = mixHex(canvasBase, companionC, isDark ? 0.018 : 0.045)

    // 主题色驱动整套色阶：背景、玻璃层、按钮、边框、标签与文字同步变化。
    setCssVariables(root, {
      '--primary': primary,
      '--primary-hover': mixHex(primary, isDark ? '#ffffff' : '#000000', 0.10),
      '--primary-light': rgba(primaryRgb, isDark ? 0.095 : 0.085),
      '--icon-color': primary,
      '--icon-surface': rgba(primaryRgb, isDark ? 0.085 : 0.065),
      '--brand-logo-filter': brandLogoFilter,
      '--brand-logo-opacity': String(brandLogoOpacity),
      '--accent': primary,
      '--accent-soft': rgba(primaryRgb, isDark ? 0.09 : 0.08),
      '--bg-primary': canvas,
      '--bg-secondary': surface,
      '--bg-tertiary': surfaceSoft,
      '--body-bg': canvas,
      '--bg-hover': rgba(primaryRgb, isDark ? 0.045 : 0.045),
      '--text-primary': textPrimary,
      '--text-secondary': textSecondary,
      '--text-tertiary': textTertiary,
      '--border': rgba(primaryRgb, borderAlpha),
      '--divider': rgba(primaryRgb, borderAlpha),
      '--glass-border': isDark ? 'rgba(255, 255, 255, 0.075)' : 'rgba(255, 255, 255, 0.52)',
      '--input-bg': isDark ? 'rgba(255, 255, 255, 0.042)' : 'rgba(255, 255, 255, 0.46)',
      '--btn-bg': rgba(primaryRgb, isDark ? 0.055 : 0.055),
      '--btn-bg-hover': rgba(primaryRgb, isDark ? 0.095 : 0.095),
      '--btn-bg-active': rgba(primaryRgb, isDark ? 0.14 : 0.135),
      '--btn-ghost-bg': isDark ? 'rgba(255, 255, 255, 0.038)' : 'rgba(255, 255, 255, 0.38)',
      '--btn-ghost-hover': rgba(primaryRgb, isDark ? 0.075 : 0.075),
      '--btn-selected-border': rgba(primaryRgb, 0.34),
      '--tag-bg': rgba(primaryRgb, isDark ? 0.095 : 0.075),
      '--tag-color': primary,
      '--color-btn-bg': rgba(primaryRgb, isDark ? 0.095 : 0.08),
      '--color-btn-text': primary,
      '--color-tag-bg': rgba(primaryRgb, isDark ? 0.095 : 0.075),
      '--color-tag-text': primary,
      '--color-icon-bg': rgba(primaryRgb, isDark ? 0.085 : 0.065),
      '--card-hover-bg': isDark ? 'rgba(255, 255, 255, 0.052)' : 'rgba(255, 255, 255, 0.62)',
      '--card-check-bg': rgba(surfaceRgb, isDark ? 0.74 : 0.70),
      '--card-checked-border': primary,
      '--card-checked-bg': rgba(primaryRgb, isDark ? 0.095 : 0.07),
      '--modal-bg': rgba(surfaceRgb, isDark ? 0.90 : 0.86),
      '--scrollbar-thumb': rgba(primaryRgb, isDark ? 0.13 : 0.13),
      '--grid-color': isDark ? 'rgba(255, 255, 255, 0.008)' : 'rgba(15, 23, 42, 0.012)',
      '--orb-color': rgba(primaryRgb, isDark ? 0.055 : 0.12),
      '--r1': rgba(primaryRgb, isDark ? 0.06 : 0.13),
      '--r2': rgba(hexToRgb(companionA), isDark ? 0.035 : 0.10),
      '--r3': rgba(hexToRgb(companionB), isDark ? 0.025 : 0.08),
      '--r4': rgba(hexToRgb(companionC), isDark ? 0.018 : 0.06),
      '--gradient-base': `linear-gradient(135deg, ${canvas} 0%, ${gradientA} 30%, ${gradientB} 62%, ${gradientC} 82%, ${canvas} 100%)`,
      '--logo-gradient': `linear-gradient(135deg, ${primary}, ${companionA}, ${companionB})`,
    })
    updateThemeFavicon(brandLogoColorFilter, brandLogoOpacity)

    // Synchronize the opaque native host and WebView2 background with the active theme.
    // Without this, an unpainted strip can flash black/white during live resize.
    if (isDesktopRuntime() && !location.hash.startsWith('#/pet') && !location.hash.startsWith('#/canvas')) {
      void invokeDesktop('set_main_window_background_color', { color: canvas }).catch(() => {
        // Older shells still use the CSS color fallback.
      })
    }

    const glassAlpha = layout.value.glassIntensity * 0.34
    root.style.setProperty('--glass-bg', rgba(surfaceRgb, glassAlpha + (isDark ? 0.34 : 0.28)))
    root.style.setProperty('--sidebar-bg', rgba(surfaceRgb, glassAlpha + (isDark ? 0.42 : 0.36)))

    // 圆角
    root.style.setProperty('--radius-lg', `${layout.value.borderRadius}px`)
    root.style.setProperty('--radius-md', `${layout.value.borderRadius - 6}px`)
    root.style.setProperty('--radius-sm', `${layout.value.borderRadius - 10}px`)

    // 自定义组件背景色
    if (themeSettings.value.customButtonBg && themeSettings.value.buttonBgColor) {
      root.style.setProperty('--card-btn-bg', rgba(hexToRgb(themeSettings.value.buttonBgColor), isDark ? 0.16 : 0.09))
    } else {
      root.style.removeProperty('--card-btn-bg')
    }
    if (themeSettings.value.customTagBg && themeSettings.value.tagBgColor) {
      root.style.setProperty('--card-tag-bg', rgba(hexToRgb(themeSettings.value.tagBgColor), isDark ? 0.16 : 0.085))
    } else {
      root.style.removeProperty('--card-tag-bg')
    }
    if (themeSettings.value.customIconBg && themeSettings.value.iconBgColor) {
      root.style.setProperty('--card-icon-bg', rgba(hexToRgb(themeSettings.value.iconBgColor), isDark ? 0.14 : 0.075))
    } else {
      root.style.removeProperty('--card-icon-bg')
    }

    // 卡片大小对应的尺�?
    const cardSizeMap = {
      small: { minHeight: '100px', padding: '14px', fontSize: '13px' },
      medium: { minHeight: '120px', padding: '18px', fontSize: '14px' },
      large: { minHeight: '140px', padding: '22px', fontSize: '15px' },
    }
    const size = cardSizeMap[layout.value.cardSize]
    root.style.setProperty('--card-min-height', size.minHeight)
    root.style.setProperty('--card-padding', size.padding)
    root.style.setProperty('--card-font-size', size.fontSize)

    // 侧边栏位�?
    root.style.setProperty('--sidebar-order', layout.value.sidebarPosition === 'left' ? '0' : '2')
    root.style.setProperty('--content-order', layout.value.sidebarPosition === 'left' ? '1' : '0')
  }

  interface RgbColor { r: number; g: number; b: number }

  function hexToRgb(hex: string): RgbColor {
    const normalized = hex.replace('#', '')
    const value = parseInt(normalized.length === 3
      ? normalized.split('').map(char => char + char).join('')
      : normalized, 16)
    return { r: value >> 16, g: (value >> 8) & 255, b: value & 255 }
  }

  function rgbToHex(color: RgbColor): string {
    const value = (color.r << 16) | (color.g << 8) | color.b
    return `#${value.toString(16).padStart(6, '0')}`
  }

  function mixHex(base: string, tint: string, ratio: number): string {
    const from = hexToRgb(base)
    const to = hexToRgb(tint)
    return rgbToHex({
      r: Math.round(from.r + (to.r - from.r) * ratio),
      g: Math.round(from.g + (to.g - from.g) * ratio),
      b: Math.round(from.b + (to.b - from.b) * ratio),
    })
  }

  function getHueDegrees(hex: string): number {
    const { r, g, b } = hexToRgb(hex)
    const red = r / 255
    const green = g / 255
    const blue = b / 255
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    const delta = max - min

    if (delta === 0) return 0
    let hue = 0
    if (max === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (max === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
    return (hue + 360) % 360
  }

  function updateThemeFavicon(brandLogoColorFilter: string, brandLogoOpacity: number): void {
    const updateVersion = ++faviconUpdateVersion
    if (!faviconImagePromise) {
      faviconImagePromise = new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('FlexiKit favicon failed to load'))
        image.src = '/icon/icon_256x256.ico'
      })
    }

    void faviconImagePromise.then((image) => {
      if (updateVersion !== faviconUpdateVersion) return
      let favicons = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'))
      if (favicons.length === 0) {
        const favicon = document.createElement('link')
        favicon.rel = 'icon'
        favicon.sizes = '32x32'
        document.head.appendChild(favicon)
        favicons = [favicon]
      }

      // Chrome 会优先挑选与标签栏最接近的尺寸，因此每一个静态 ICO 都要同步替换。
      favicons.forEach((favicon) => {
        const declaredSize = Number.parseInt(favicon.getAttribute('sizes')?.split('x')[0] || '32', 10)
        const size = Number.isFinite(declaredSize) ? Math.min(256, Math.max(16, declaredSize)) : 32
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d')
        if (!context) return

        context.filter = brandLogoColorFilter
        context.globalAlpha = brandLogoOpacity
        context.drawImage(image, 0, 0, size, size)

        const themedFavicon = favicon.cloneNode(false) as HTMLLinkElement
        themedFavicon.type = 'image/png'
        themedFavicon.dataset.themeFavicon = 'true'
        themedFavicon.href = canvas.toDataURL('image/png')
        favicon.replaceWith(themedFavicon)
      })
    }).catch(() => {
      // 原始 ICO 仍保留在 index.html 中，生成失败时自动使用静态图标。
    })
  }

  function rotateHue(hex: string, degrees: number): string {
    const { r, g, b } = hexToRgb(hex)
    const red = r / 255
    const green = g / 255
    const blue = b / 255
    const max = Math.max(red, green, blue)
    const min = Math.min(red, green, blue)
    const delta = max - min
    const lightness = (max + min) / 2
    const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1))
    let hue = 0

    if (delta !== 0) {
      if (max === red) hue = 60 * (((green - blue) / delta) % 6)
      else if (max === green) hue = 60 * ((blue - red) / delta + 2)
      else hue = 60 * ((red - green) / delta + 4)
    }

    const rotatedHue = ((hue + degrees) % 360 + 360) % 360
    const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
    const section = rotatedHue / 60
    const intermediate = chroma * (1 - Math.abs((section % 2) - 1))
    const match = lightness - chroma / 2
    let color: [number, number, number]

    if (section < 1) color = [chroma, intermediate, 0]
    else if (section < 2) color = [intermediate, chroma, 0]
    else if (section < 3) color = [0, chroma, intermediate]
    else if (section < 4) color = [0, intermediate, chroma]
    else if (section < 5) color = [intermediate, 0, chroma]
    else color = [chroma, 0, intermediate]

    return rgbToHex({
      r: Math.round((color[0] + match) * 255),
      g: Math.round((color[1] + match) * 255),
      b: Math.round((color[2] + match) * 255),
    })
  }

  function rgba(color: RgbColor, alpha: number): string {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(1, Math.max(0, alpha))})`
  }

  function setCssVariables(root: HTMLElement, variables: Record<string, string>): void {
    Object.entries(variables).forEach(([name, value]) => root.style.setProperty(name, value))
  }

  function setPrimaryColor(color: string) {
    themeSettings.value.primaryColor = color
    themeSettings.value.customPrimary = true
    saveSettings()
    applyCssVariables()
  }

  function setBackgroundColor(color: string) {
    themeSettings.value.backgroundColor = color
    themeSettings.value.customBackground = true
    saveSettings()
    applyCssVariables()
  }

  function resetThemeColors() {
    themeSettings.value = { ...DEFAULT_THEME }
    saveSettings()
    applyCssVariables()
  }

    // ========== 自定义组件背景色 ==========
  function setButtonBgColor(color: string) {
    themeSettings.value.buttonBgColor = color
    themeSettings.value.customButtonBg = true
    saveSettings()
    applyCssVariables()
  }

  function setTagBgColor(color: string) {
    themeSettings.value.tagBgColor = color
    themeSettings.value.customTagBg = true
    saveSettings()
    applyCssVariables()
  }

  function setIconBgColor(color: string) {
    themeSettings.value.iconBgColor = color
    themeSettings.value.customIconBg = true
    saveSettings()
    applyCssVariables()
  }

  function resetButtonBgColor() {
    themeSettings.value.buttonBgColor = ''
    themeSettings.value.customButtonBg = false
    saveSettings()
    applyCssVariables()
  }

  function resetTagBgColor() {
    themeSettings.value.tagBgColor = ''
    themeSettings.value.customTagBg = false
    saveSettings()
    applyCssVariables()
  }

  function resetIconBgColor() {
    themeSettings.value.iconBgColor = ''
    themeSettings.value.customIconBg = false
    saveSettings()
    applyCssVariables()
  }

  function resetBgColors() {
    resetButtonBgColor()
    resetTagBgColor()
    resetIconBgColor()
  }

  // ========== 布局设置 ==========
  function setGridColumns(columns: number) {
    layout.value.gridColumns = Math.max(3, Math.min(6, columns))
    saveSettings()
    applyCssVariables()
  }

  function setCardSize(size: CardSize) {
    layout.value.cardSize = size
    saveSettings()
    applyCssVariables()
  }

  function setSidebarPosition(position: SidebarPosition) {
    layout.value.sidebarPosition = position
    saveSettings()
    applyCssVariables()
  }

  function toggleSidebar() {
    layout.value.sidebarCollapsed = !layout.value.sidebarCollapsed
    saveSettings()
  }

  function setGlassIntensity(intensity: number) {
    layout.value.glassIntensity = Math.max(0, Math.min(1, intensity))
    saveSettings()
    applyCssVariables()
  }

  function setBorderRadius(radius: number) {
    layout.value.borderRadius = Math.max(8, Math.min(24, radius))
    saveSettings()
    applyCssVariables()
  }

  function resetLayout() {
    layout.value = { ...DEFAULT_LAYOUT }
    saveSettings()
    applyCssVariables()
  }

  // ========== 设置面板 ==========
  function openSettingsPanel() {
    settingsPanelOpen.value = true
  }

  function closeSettingsPanel() {
    settingsPanelOpen.value = false
  }

  function toggleSettingsPanel() {
    settingsPanelOpen.value = !settingsPanelOpen.value
  }

  // ========== 持久�?==========
  function saveSettings() {
    localStorage.setItem('flexikit-layout', JSON.stringify(layout.value))
    localStorage.setItem('flexikit-theme-settings', JSON.stringify(themeSettings.value))
  }

  function loadSettings() {
    try {
      const savedLayout = localStorage.getItem('flexikit-layout')
      if (savedLayout) {
        layout.value = { ...DEFAULT_LAYOUT, ...JSON.parse(savedLayout) }
      }
      const savedTheme = localStorage.getItem('flexikit-theme-settings')
      if (savedTheme) {
        const parsedTheme = JSON.parse(savedTheme) as Partial<ThemeSettings>
        themeSettings.value = { ...DEFAULT_THEME, ...parsedTheme }
        if (themeSettings.value.customPrimary !== true && themeSettings.value.primaryColor === '#6366f1') {
          themeSettings.value.primaryColor = DEFAULT_THEME.primaryColor
        }
      }
    } catch (e) {
      // ignore parse error
    }
  }

  function initAll() {
    initTheme()
    loadSettings()
    applyCssVariables()

    // 监听系统主题变化
    if (typeof window !== 'undefined') {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (theme.value === 'auto') {
          applyCssVariables()
        }
      })
      window.addEventListener('resize', updateWindowWidth)
      updateWindowWidth()
    }
  }

  // ========== Select Mode ==========
  function toggleSelect(key: string) {
    if (selectedSet.value.has(key)) {
      selectedSet.value.delete(key)
    } else {
      selectedSet.value.add(key)
    }
    selectedSet.value = new Set(selectedSet.value)
  }

  function enterSelectMode() {
    selectMode.value = true
  }

  function exitSelectMode() {
    selectMode.value = false
    selectedSet.value = new Set()
  }

  // ========== Toast ==========
  function showToast(message: string, undoCb?: () => void) {
    toastMessage.value = message
    toastVisible.value = true
    toastUndoCallback.value = undoCb || null
  }

  function hideToast() {
    toastVisible.value = false
  }

  // ========== Modals ==========
  function openToolModal(mode: 'add' | 'edit') {
    toolModalMode.value = mode
    toolModalOpen.value = true
  }

  function closeToolModal() {
    toolModalOpen.value = false
    toolModalBuiltinEdit.value = false
  }

  function openConfirmModal(title: string, message: string, callback: () => void) {
    confirmModalTitle.value = title
    confirmModalMessage.value = message
    confirmModalCallback.value = callback
    confirmModalOpen.value = true
  }

  function closeConfirmModal() {
    confirmModalOpen.value = false
    confirmModalCallback.value = null
  }

  function openRenameModal(oldName: string) {
    renameModalOldName.value = oldName
    renameModalOpen.value = true
  }

  function closeRenameModal() {
    renameModalOpen.value = false
  }

  return {
    // state
    theme, activeCategory, searchQuery, selectMode, selectedSet,
    showOnlyFav, sidebarCollapsed, toolTypeFilter, showToolTypeFilter,
    layout, themeSettings, settingsPanelOpen,
    toastMessage, toastVisible, toastUndoCallback,
    toolModalOpen, toolModalMode, toolModalBuiltinEdit,
    toolModalBuiltinName, toolModalBuiltinUrl, toolModalEditIndex,
    confirmModalOpen, confirmModalTitle, confirmModalMessage, confirmModalCallback,
    renameModalOpen, renameModalOldName,
    // getters
    isMobile, effectiveGridColumns,
    // methods
    updateWindowWidth,
    setTheme, initTheme, initAll, getEffectiveTheme, toggleTheme,
    applyCssVariables, setPrimaryColor, setBackgroundColor, resetThemeColors,
    setButtonBgColor, setTagBgColor, setIconBgColor,
    resetButtonBgColor, resetTagBgColor, resetIconBgColor,
    resetBgColors,
    setGridColumns, setCardSize, setSidebarPosition, toggleSidebar,
    setGlassIntensity, setBorderRadius, resetLayout,
    openSettingsPanel, closeSettingsPanel, toggleSettingsPanel,
    toggleSelect, enterSelectMode, exitSelectMode,
    showToast, hideToast,
    openToolModal, closeToolModal,
    openConfirmModal, closeConfirmModal,
    openRenameModal, closeRenameModal,
  }
})

