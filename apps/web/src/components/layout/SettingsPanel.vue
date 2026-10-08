<template>
  <Teleport to="body">
    <Transition name="settings">
      <div
        v-if="uiStore.settingsPanelOpen"
        class="settings-overlay"
        role="presentation"
        @click="uiStore.closeSettingsPanel()"
      >
        <section
          class="settings-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="settings-title"
          @click.stop
        >
          <div class="settings-scroll">
            <header class="settings-header">
              <div class="header-copy">
                <span class="header-kicker">PERSONALIZE</span>
                <h2 id="settings-title">外观与布局</h2>
                <p>让工具箱更符合你的浏览习惯</p>
              </div>
              <button class="icon-button close-button" type="button" aria-label="关闭设置" @click="uiStore.closeSettingsPanel()">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div class="settings-content">
              <section class="preview-card" aria-label="效果预览">
              <div class="preview-sidebar" :class="{ right: uiStore.layout.sidebarPosition === 'right' }">
                <span /><span /><span />
              </div>
              <div class="preview-content">
                <div class="preview-toolbar">
                  <span class="preview-title">实时预览</span>
                  <span class="preview-status">已自动保存</span>
                </div>
                <div class="preview-grid" :style="previewGridStyle">
                  <div v-for="item in 6" :key="item" class="preview-tool-card">
                    <span class="preview-icon" />
                    <span class="preview-line" />
                    <span class="preview-line short" />
                  </div>
                </div>
              </div>
              </section>

              <div class="settings-columns">
              <div class="settings-column">
                <div class="column-heading">
                  <span class="heading-icon appearance-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M12 3a9 9 0 1 0 9 9c0-1.1-.9-2-2-2h-1.2a2.2 2.2 0 0 1-2.2-2.2V6A3 3 0 0 0 12 3Z" />
                      <circle cx="7.5" cy="11" r="1" /><circle cx="10" cy="7.5" r="1" /><circle cx="7.5" cy="15" r="1" />
                    </svg>
                  </span>
                  <div><h3>外观</h3><p>主题与界面色彩</p></div>
                </div>

                <section class="setting-card">
                  <div class="setting-label"><span>显示模式</span><small>跟随环境切换明暗</small></div>
                  <div class="segmented-control three-columns">
                    <button
                      v-for="mode in themeModes"
                      :key="mode.value"
                      type="button"
                      :class="{ active: uiStore.theme === mode.value }"
                      @click="uiStore.setTheme(mode.value)"
                    >
                      <component :is="mode.icon" />
                      <span>{{ mode.label }}</span>
                    </button>
                  </div>
                </section>

                <section class="setting-card">
                  <div class="setting-label"><span>主题色</span><small>用于强调按钮与选中状态</small></div>
                  <div class="color-row">
                    <button
                      v-for="color in PRESET_PRIMARY_COLORS"
                      :key="color.value"
                      type="button"
                      class="color-swatch"
                      :class="{ active: uiStore.themeSettings.primaryColor === color.value }"
                      :style="{ '--swatch-color': color.value }"
                      :aria-label="color.name"
                      :title="color.name"
                      @click="uiStore.setPrimaryColor(color.value)"
                    ><svg v-if="uiStore.themeSettings.primaryColor === color.value" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg></button>
                    <label class="color-swatch custom-swatch" :style="{ '--swatch-color': uiStore.themeSettings.primaryColor }" title="自定义颜色">
                      <input type="color" :value="uiStore.themeSettings.primaryColor" @input="setPrimaryFromInput">
                      <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
                    </label>
                  </div>
                </section>

                <section class="setting-card component-colors">
                  <div class="setting-label"><span>组件色彩</span><small>单独调整常用视觉元素</small></div>
                  <div class="color-setting-list">
                    <div v-for="item in componentColors" :key="item.key" class="color-setting-row">
                      <div class="color-name"><span :class="['color-symbol', item.key]" />{{ item.label }}</div>
                      <div class="color-actions">
                        <button v-if="item.custom" type="button" class="text-button" @click="item.reset">跟随主题</button>
                        <span v-else class="default-label">跟随主题</span>
                        <label class="mini-color" :style="{ background: item.color }">
                          <input type="color" :value="item.color" @input="(event) => item.set(readColor(event))">
                        </label>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <div class="settings-column">
                <div class="column-heading">
                  <span class="heading-icon layout-icon">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3" /><path d="M9 3v18M9 10h12" /></svg>
                  </span>
                  <div><h3>布局</h3><p>密度与空间比例</p></div>
                </div>

                <section class="setting-card">
                  <div class="setting-label"><span>卡片尺寸</span><small>改变信息密度</small></div>
                  <div class="segmented-control three-columns">
                    <button
                      v-for="size in cardSizes"
                      :key="size.value"
                      type="button"
                      :class="{ active: uiStore.layout.cardSize === size.value }"
                      @click="uiStore.setCardSize(size.value)"
                    >{{ size.label }}</button>
                  </div>
                </section>

                <section class="setting-card">
                  <div class="range-heading">
                    <div class="setting-label"><span>网格列数</span><small>控制每行显示数量</small></div>
                    <output>{{ uiStore.layout.gridColumns }} 列</output>
                  </div>
                  <input
                    class="slider"
                    type="range"
                    min="3"
                    max="6"
                    step="1"
                    :value="uiStore.layout.gridColumns"
                    :style="rangeProgress(uiStore.layout.gridColumns, 3, 6)"
                    @input="setGridColumnsFromInput"
                  >
                  <div class="range-labels"><span>宽松</span><span>紧凑</span></div>
                </section>

                <section class="setting-card">
                  <div class="setting-label"><span>侧边栏位置</span><small>选择主要导航方向</small></div>
                  <div class="position-control">
                    <button type="button" :class="{ active: uiStore.layout.sidebarPosition === 'left' }" @click="uiStore.setSidebarPosition('left')">
                      <span class="layout-thumbnail left"><i /></span><span>左侧</span>
                    </button>
                    <button type="button" :class="{ active: uiStore.layout.sidebarPosition === 'right' }" @click="uiStore.setSidebarPosition('right')">
                      <span class="layout-thumbnail right"><i /></span><span>右侧</span>
                    </button>
                  </div>
                </section>

                <section class="setting-card range-group">
                  <div class="range-heading">
                    <div class="setting-label"><span>毛玻璃强度</span><small>调整界面的通透感</small></div>
                    <output>{{ Math.round(uiStore.layout.glassIntensity * 100) }}%</output>
                  </div>
                  <input
                    class="slider"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    :value="uiStore.layout.glassIntensity"
                    :style="rangeProgress(uiStore.layout.glassIntensity, 0, 1)"
                    @input="setGlassFromInput"
                  >
                  <div class="range-divider" />
                  <div class="range-heading radius-heading">
                    <div class="setting-label"><span>圆角大小</span><small>改变卡片的柔和程度</small></div>
                    <output>{{ uiStore.layout.borderRadius }} px</output>
                  </div>
                  <input
                    class="slider"
                    type="range"
                    min="8"
                    max="24"
                    step="2"
                    :value="uiStore.layout.borderRadius"
                    :style="rangeProgress(uiStore.layout.borderRadius, 8, 24)"
                    @input="setRadiusFromInput"
                  >
                </section>
              </div>
              </div>
              <section v-if="isDesktop" class="diagnostic-access" aria-label="本地诊断">
                <div>
                  <strong>本地诊断</strong>
                  <p>复制的摘要只含错误类别及次数，不包含日志原文；不会自动上传。</p>
                </div>
                <button type="button" :disabled="copyingDiagnostics" @click="copyDiagnosticSummary">
                  {{ copyingDiagnostics ? '正在复制…' : '复制诊断摘要' }}
                </button>
              </section>
            </div>
          </div>

          <footer class="settings-footer">
            <button class="reset-button" type="button" @click="resetAll">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" /></svg>
              恢复默认
            </button>
            <button class="done-button" type="button" @click="uiStore.closeSettingsPanel()">完成</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, h, ref, type CSSProperties } from 'vue'
import { PRESET_PRIMARY_COLORS, useUiStore } from '@/stores/ui'
import { invokeDesktop, isDesktopRuntime } from '@/api/runtime'

const uiStore = useUiStore()
const isDesktop = isDesktopRuntime()
const copyingDiagnostics = ref(false)

async function copyDiagnosticSummary(): Promise<void> {
  if (!isDesktop || copyingDiagnostics.value) return
  copyingDiagnostics.value = true
  try {
    const summary = await invokeDesktop<string>('get_diagnostic_summary')
    await invokeDesktop('set_clipboard_text', { text: summary })
    uiStore.showToast('诊断摘要已复制到剪贴板，不会自动上传')
  } catch {
    uiStore.showToast('复制诊断摘要失败，请重试')
  } finally {
    copyingDiagnostics.value = false
  }
}


const SunIcon = () => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
  h('circle', { cx: 12, cy: 12, r: 4 }),
  h('path', { d: 'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' }),
])
const MoonIcon = () => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [h('path', { d: 'M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z' })])
const AutoIcon = () => h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, [
  h('rect', { x: 3, y: 4, width: 18, height: 14, rx: 2 }),
  h('path', { d: 'M8 22h8M12 18v4' }),
])

const themeModes = [
  { value: 'light' as const, label: '浅色', icon: SunIcon },
  { value: 'dark' as const, label: '深色', icon: MoonIcon },
  { value: 'auto' as const, label: '自动', icon: AutoIcon },
]

const cardSizes = [
  { value: 'small' as const, label: '紧凑' },
  { value: 'medium' as const, label: '标准' },
  { value: 'large' as const, label: '宽松' },
]

const componentColors = computed(() => [
  {
    key: 'button', label: '按钮', custom: uiStore.themeSettings.customButtonBg,
    color: uiStore.themeSettings.customButtonBg ? uiStore.themeSettings.buttonBgColor : uiStore.themeSettings.primaryColor,
    set: uiStore.setButtonBgColor, reset: uiStore.resetButtonBgColor,
  },
  {
    key: 'tag', label: '标签', custom: uiStore.themeSettings.customTagBg,
    color: uiStore.themeSettings.customTagBg ? uiStore.themeSettings.tagBgColor : uiStore.themeSettings.primaryColor,
    set: uiStore.setTagBgColor, reset: uiStore.resetTagBgColor,
  },
  {
    key: 'icon', label: '图标容器', custom: uiStore.themeSettings.customIconBg,
    color: uiStore.themeSettings.customIconBg ? uiStore.themeSettings.iconBgColor : uiStore.themeSettings.primaryColor,
    set: uiStore.setIconBgColor, reset: uiStore.resetIconBgColor,
  },
])

const previewGridStyle = computed<CSSProperties>(() => ({
  gridTemplateColumns: `repeat(${uiStore.layout.gridColumns}, minmax(0, 1fr))`,
}))

function readNumber(event: Event): number {
  return Number((event.target as HTMLInputElement).value)
}

function readColor(event: Event): string {
  return (event.target as HTMLInputElement).value
}

function setPrimaryFromInput(event: Event) { uiStore.setPrimaryColor(readColor(event)) }
function setGridColumnsFromInput(event: Event) { uiStore.setGridColumns(readNumber(event)) }
function setGlassFromInput(event: Event) { uiStore.setGlassIntensity(readNumber(event)) }
function setRadiusFromInput(event: Event) { uiStore.setBorderRadius(readNumber(event)) }

function rangeProgress(value: number, min: number, max: number): CSSProperties {
  return { '--range-progress': `${((value - min) / (max - min)) * 100}%` } as CSSProperties
}

function resetAll() {
  uiStore.resetLayout()
  uiStore.resetThemeColors()
  uiStore.setTheme('auto')
}
</script>

<style scoped>
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgb(15 23 42 / 32%);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
}

.settings-panel {
  width: min(820px, 100%);
  max-height: min(880px, calc(100vh - 48px));
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--text-primary);
  background: color-mix(in srgb, var(--glass-bg) 92%, white 8%);
  border: 1px solid rgb(255 255 255 / 38%);
  border-radius: 28px;
  box-shadow: 0 30px 90px rgb(15 23 42 / 22%), 0 1px 0 rgb(255 255 255 / 55%) inset;
  backdrop-filter: blur(32px) saturate(165%);
  -webkit-backdrop-filter: blur(32px) saturate(165%);
}

:global(.dark) .settings-panel {
  background: color-mix(in srgb, var(--glass-bg) 92%, #0f172a 8%);
  border-color: rgb(255 255 255 / 10%);
  box-shadow: 0 36px 100px rgb(0 0 0 / 52%), 0 1px 0 rgb(255 255 255 / 8%) inset;
}

.settings-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 27px 30px 22px;
  border-bottom: 1px solid var(--border);
}

.header-kicker { display: block; margin-bottom: 5px; color: var(--primary); font-size: 10px; font-weight: 750; letter-spacing: .18em; }
.header-copy h2 { margin: 0; font-size: 24px; font-weight: 720; letter-spacing: -.035em; }
.header-copy p { margin: 5px 0 0; color: var(--text-secondary); font-size: 13px; }

.icon-button { display: grid; place-items: center; width: 38px; height: 38px; padding: 0; color: var(--text-secondary); background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 50%; cursor: pointer; transition: all .3s cubic-bezier(.25,.1,.25,1); }
.icon-button svg { width: 17px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; }
.icon-button:hover { color: var(--text-primary); background: var(--bg-hover); transform: scale(1.04); }
.icon-button:active { transform: scale(.96); }

.settings-scroll { min-height: 0; overflow-y: auto; padding: 0; overscroll-behavior: contain; }
.settings-content { padding: 22px 30px 26px; }

.preview-card { position: sticky; top: 0; z-index: 12; isolation: isolate; display: flex; min-height: 128px; margin-bottom: 25px; overflow: hidden; background: radial-gradient(circle at 12% 15%, var(--r1), transparent 42%), radial-gradient(circle at 84% 12%, var(--r2), transparent 42%), radial-gradient(circle at 68% 88%, var(--r3), transparent 48%), var(--gradient-base); background-size: 120% 120%; border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--border)); border-radius: 20px; box-shadow: 0 14px 38px rgb(15 23 42 / 16%), 0 1px 0 rgb(255 255 255 / 28%) inset; backdrop-filter: blur(24px) saturate(150%); -webkit-backdrop-filter: blur(24px) saturate(150%); animation: previewAmbientFlow 18s cubic-bezier(.25,.1,.25,1) infinite alternate; }
.preview-sidebar { order: 0; width: 38px; display: flex; flex-direction: column; align-items: center; gap: 8px; padding-top: 18px; background: color-mix(in srgb, var(--primary) 10%, transparent); border-right: 1px solid color-mix(in srgb, var(--primary) 12%, transparent); }
.preview-sidebar.right { order: 2; border-right: 0; border-left: 1px solid color-mix(in srgb, var(--primary) 12%, transparent); }
.preview-sidebar span { width: 14px; height: 4px; border-radius: 99px; background: color-mix(in srgb, var(--primary) 32%, transparent); }
.preview-sidebar span:first-child { height: 14px; margin-bottom: 4px; background: var(--primary); border-radius: 5px; }
.preview-content { flex: 1; min-width: 0; padding: 14px 16px 16px; }
.preview-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 11px; }
.preview-title { font-size: 11px; font-weight: 700; }
.preview-status { color: var(--text-tertiary); font-size: 9px; }
.preview-grid { display: grid; gap: 7px; }
.preview-tool-card { min-width: 0; min-height: calc(var(--card-min-height) * .55); padding: 9px; background: color-mix(in srgb, var(--glass-bg) 86%, transparent); border: 1px solid rgb(255 255 255 / 28%); border-radius: calc(var(--radius-lg) * .55); box-shadow: 0 5px 14px rgb(15 23 42 / 6%); }
.preview-icon { display: block; width: 16px; height: 16px; margin-bottom: 10px; border-radius: 5px; background: var(--primary); opacity: .9; }
.preview-line { display: block; width: 76%; height: 4px; margin-top: 5px; border-radius: 99px; background: color-mix(in srgb, var(--text-primary) 16%, transparent); }
.preview-line.short { width: 48%; opacity: .65; }

:global(html .bg-layer) { overflow: hidden; background: var(--gradient-base); }
:global(html .bg-layer::before) { inset: -10%; transform-origin: center; will-change: transform, opacity; animation: ambientGradientDrift 32s cubic-bezier(.25,.1,.25,1) infinite alternate; }
:global(html .bg-layer::after) { width: 320px; height: 320px; top: 4%; left: 2%; background: radial-gradient(circle, var(--r1) 0%, transparent 68%); box-shadow: 58vw 4vh 120px 18px var(--r2), 34vw 62vh 140px 24px var(--r3), 72vw 72vh 120px 10px var(--r4); filter: blur(58px); opacity: .48; will-change: transform, opacity; animation: ambientOrbFlow 28s cubic-bezier(.25,.1,.25,1) infinite alternate; }
:global(html .nav-search-wrapper .search-icon),
:global(html .search-wrap .search-icon),
:global(html .select-arrow),
:global(html .top-navbar button:not(.danger) svg),
:global(html .sidebar button:not(.danger) svg),
:global(html .tool-card button:not(.danger) svg),
:global(html .settings-panel button:not(.danger) svg) { color: var(--icon-color) !important; stroke: currentColor; transition: color .3s cubic-bezier(.25,.1,.25,1), opacity .3s cubic-bezier(.25,.1,.25,1); }
:global(html .nav-search-wrapper .search-icon), :global(html .search-wrap .search-icon) { opacity: .68; }
:global(.nav-icon:has(svg)),
:global(.toolbar-row button:has(svg)),
:global(.card-action-btn:not(.danger)) { background: var(--icon-surface); border-color: color-mix(in srgb, var(--icon-color) 14%, transparent); }
:global(.nav-icon:has(svg):hover),
:global(.toolbar-row button:has(svg):hover),
:global(.card-action-btn:not(.danger):hover) { background: color-mix(in srgb, var(--icon-color) 11%, transparent); }
@keyframes ambientGradientDrift {
  0% { transform: translate3d(-1.5%, -1%, 0) scale(1.015); opacity: .9; }
  48% { transform: translate3d(1.8%, -.4%, 0) scale(1.035); opacity: 1; }
  100% { transform: translate3d(.4%, 1.7%, 0) scale(1.02); opacity: .92; }
}

@keyframes ambientOrbFlow {
  0% { transform: translate3d(-2vw, 1vh, 0) scale(.97); opacity: .36; }
  52% { transform: translate3d(4vw, 3vh, 0) scale(1.06); opacity: .56; }
  100% { transform: translate3d(1vw, 7vh, 0) scale(1.01); opacity: .42; }
}

@keyframes previewAmbientFlow {
  0% { background-position: 0% 18%; }
  100% { background-position: 100% 82%; }
}

.settings-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
.settings-column { min-width: 0; }
.column-heading { display: flex; align-items: center; gap: 11px; margin-bottom: 12px; }
.column-heading h3 { margin: 0 0 2px; font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
.column-heading p { margin: 0; color: var(--text-tertiary); font-size: 11px; }
.heading-icon { display: grid; place-items: center; width: 34px; height: 34px; color: var(--primary); background: color-mix(in srgb, var(--primary) 12%, transparent); border-radius: 10px; }
.heading-icon svg { width: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.layout-icon { color: var(--icon-color); background: var(--icon-surface); }

.setting-card { padding: 15px; margin-bottom: 10px; background: color-mix(in srgb, var(--bg-secondary) 72%, transparent); border: 1px solid var(--border); border-radius: 17px; box-shadow: 0 8px 30px rgb(0 0 0 / 3%); }
.setting-label { display: flex; flex-direction: column; gap: 3px; margin-bottom: 12px; }
.setting-label span { font-size: 13px; font-weight: 650; }
.setting-label small { color: var(--text-tertiary); font-size: 10px; line-height: 1.35; }

.segmented-control { display: grid; gap: 4px; padding: 4px; background: color-mix(in srgb, var(--bg-tertiary) 90%, transparent); border-radius: 12px; }
.three-columns { grid-template-columns: repeat(3, 1fr); }
.segmented-control button { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 7px 8px; color: var(--text-secondary); background: transparent; border: 0; border-radius: 9px; font: inherit; font-size: 11px; cursor: pointer; transition: all .3s cubic-bezier(.25,.1,.25,1); }
.segmented-control button svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.segmented-control button:hover { color: var(--text-primary); }
.segmented-control button.active { color: var(--primary); background: var(--glass-bg); box-shadow: 0 3px 12px rgb(15 23 42 / 8%), 0 0 0 1px rgb(255 255 255 / 36%) inset; }

.color-row { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; }
.color-swatch { --swatch-color: var(--primary); position: relative; display: grid; place-items: center; width: 28px; height: 28px; padding: 0; color: white; background: var(--swatch-color); border: 2px solid transparent; border-radius: 50%; box-shadow: 0 2px 8px rgb(15 23 42 / 12%); cursor: pointer; transition: all .3s cubic-bezier(.25,.1,.25,1); }
.color-swatch:hover { transform: scale(1.1); }
.color-swatch.active { box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--swatch-color); }
.color-swatch svg { width: 13px; fill: none; stroke: currentColor; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
.custom-swatch { overflow: hidden; border: 1px dashed rgb(255 255 255 / 65%); }
.custom-swatch::after { content: ''; position: absolute; inset: 0; background: rgb(15 23 42 / 24%); }
.custom-swatch input, .mini-color input { position: absolute; inset: 0; z-index: 2; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
.custom-swatch svg { z-index: 1; }

.color-setting-list { display: grid; gap: 11px; }
.color-setting-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.color-name, .color-actions { display: flex; align-items: center; gap: 8px; font-size: 11px; }
.color-symbol { width: 16px; height: 16px; background: color-mix(in srgb, var(--primary) 16%, transparent); border-radius: 5px; }
.color-symbol.tag { border-radius: 99px; }
.color-symbol.icon { border-radius: 50%; }
.default-label { color: var(--text-tertiary); font-size: 9px; }
.text-button { padding: 0; color: var(--primary); background: transparent; border: 0; font: inherit; font-size: 9px; cursor: pointer; }
.mini-color { position: relative; width: 22px; height: 22px; border: 2px solid var(--bg-primary); border-radius: 7px; box-shadow: 0 0 0 1px var(--border); cursor: pointer; }

.range-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
.range-heading output { flex: 0 0 auto; padding: 4px 8px; color: var(--primary); background: color-mix(in srgb, var(--primary) 10%, transparent); border-radius: 7px; font-size: 10px; font-weight: 700; }
.slider { width: 100%; height: 24px; margin: 0; appearance: none; -webkit-appearance: none; background: transparent; outline: 0; cursor: pointer; touch-action: none; }
.slider::-webkit-slider-runnable-track { height: 6px; border-radius: 999px; background: linear-gradient(to right, color-mix(in srgb, var(--text-primary) 72%, transparent) 0 var(--range-progress), color-mix(in srgb, var(--text-primary) 11%, transparent) var(--range-progress) 100%); box-shadow: inset 0 1px 2px rgb(15 23 42 / 10%), inset 0 0 0 1px color-mix(in srgb, var(--text-primary) 5%, transparent); }
.slider::-webkit-slider-thumb { width: 16px; height: 16px; margin-top: -5px; appearance: none; -webkit-appearance: none; border: 1px solid color-mix(in srgb, var(--text-primary) 20%, var(--border)); border-radius: 50%; background: color-mix(in srgb, var(--bg-primary) 94%, white 6%); box-shadow: 0 2px 7px rgb(15 23 42 / 18%), 0 0 0 3px color-mix(in srgb, var(--bg-primary) 72%, transparent), inset 0 1px 0 rgb(255 255 255 / 55%); transition: transform .18s cubic-bezier(.22,1,.36,1), box-shadow .18s ease, border-color .18s ease; }
.slider:hover::-webkit-slider-thumb { transform: scale(1.08); border-color: color-mix(in srgb, var(--text-primary) 34%, var(--border)); box-shadow: 0 4px 11px rgb(15 23 42 / 22%), 0 0 0 4px color-mix(in srgb, var(--text-primary) 7%, transparent), inset 0 1px 0 rgb(255 255 255 / 60%); }
.slider:active::-webkit-slider-thumb { transform: scale(.94); }
.slider:focus-visible::-webkit-slider-thumb { box-shadow: 0 4px 12px rgb(15 23 42 / 20%), 0 0 0 4px color-mix(in srgb, var(--text-primary) 12%, transparent), inset 0 1px 0 rgb(255 255 255 / 60%); }
.slider::-moz-range-track { height: 6px; border: 0; border-radius: 999px; background: color-mix(in srgb, var(--text-primary) 11%, transparent); box-shadow: inset 0 1px 2px rgb(15 23 42 / 10%); }
.slider::-moz-range-progress { height: 6px; border-radius: 999px; background: color-mix(in srgb, var(--text-primary) 72%, transparent); }
.slider::-moz-range-thumb { width: 16px; height: 16px; border: 1px solid color-mix(in srgb, var(--text-primary) 20%, var(--border)); border-radius: 50%; background: color-mix(in srgb, var(--bg-primary) 94%, white 6%); box-shadow: 0 2px 7px rgb(15 23 42 / 18%); }
.range-labels { display: flex; justify-content: space-between; margin-top: 7px; color: var(--text-tertiary); font-size: 9px; }
.range-divider { height: 1px; margin: 15px 0; background: var(--border); }
.radius-heading { margin-bottom: 12px; }

.position-control { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.position-control button { display: flex; align-items: center; gap: 9px; padding: 8px; color: var(--text-secondary); background: transparent; border: 1px solid var(--border); border-radius: 11px; font: inherit; font-size: 11px; cursor: pointer; transition: all .3s cubic-bezier(.25,.1,.25,1); }
.position-control button:hover { background: var(--bg-hover); }
.position-control button.active { color: var(--primary); background: color-mix(in srgb, var(--primary) 8%, transparent); border-color: color-mix(in srgb, var(--primary) 45%, transparent); box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 12%, transparent); }
.layout-thumbnail { position: relative; width: 28px; height: 21px; background: var(--bg-tertiary); border: 1px solid var(--border); border-radius: 5px; }
.layout-thumbnail i { position: absolute; inset: 3px auto 3px 3px; width: 6px; background: currentColor; border-radius: 2px; opacity: .7; }
.layout-thumbnail.right i { inset: 3px 3px 3px auto; }


.diagnostic-access { display: flex; align-items: center; justify-content: space-between; gap: 18px; margin-top: 18px; padding: 14px 16px; border: 1px solid var(--border); border-radius: 14px; background: color-mix(in srgb, var(--glass-bg) 46%, transparent); }
.diagnostic-access strong { display: block; font-size: 12px; font-weight: 650; color: var(--text-primary); }
.diagnostic-access p { margin-top: 5px; color: var(--text-tertiary); font-size: 11px; line-height: 1.55; }
.diagnostic-access button { flex: 0 0 auto; min-height: 34px; padding: 0 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--btn-bg); color: var(--text-secondary); font: inherit; font-size: 11px; font-weight: 600; cursor: pointer; transition: background .3s cubic-bezier(.25,.1,.25,1), color .3s cubic-bezier(.25,.1,.25,1); }
.diagnostic-access button:hover:not(:disabled) { background: var(--btn-bg-hover); color: var(--text-primary); }
.diagnostic-access button:disabled { opacity: .55; cursor: default; }
@media (max-width: 520px) { .diagnostic-access { align-items: flex-start; flex-direction: column; gap: 10px; } }
.settings-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 16px 30px 20px; background: color-mix(in srgb, var(--glass-bg) 82%, transparent); border-top: 1px solid var(--border); }
.settings-footer button { display: flex; align-items: center; justify-content: center; gap: 7px; height: 38px; padding: 0 17px; border-radius: 11px; font: inherit; font-size: 12px; font-weight: 650; cursor: pointer; transition: all .3s cubic-bezier(.25,.1,.25,1); }
.settings-footer button:active { transform: scale(.97); }
.reset-button { color: var(--text-secondary); background: transparent; border: 1px solid var(--border); }
.reset-button:hover { color: var(--text-primary); background: var(--bg-hover); }
.reset-button svg { width: 14px; fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
.done-button { min-width: 92px; color: white; background: var(--primary); border: 1px solid transparent; box-shadow: 0 7px 18px color-mix(in srgb, var(--primary) 28%, transparent); }
.done-button:hover { background: var(--primary-hover); transform: translateY(-1px); }

.settings-enter-active, .settings-leave-active { transition: opacity .3s cubic-bezier(.25,.1,.25,1); }
.settings-enter-active .settings-panel, .settings-leave-active .settings-panel { transition: transform .3s cubic-bezier(.25,.1,.25,1), opacity .3s cubic-bezier(.25,.1,.25,1); }
.settings-enter-from, .settings-leave-to { opacity: 0; }
.settings-enter-from .settings-panel, .settings-leave-to .settings-panel { opacity: 0; transform: translateY(18px) scale(.975); }

@media (max-width: 720px) {
  .settings-overlay { align-items: end; padding: 0; }
  .settings-panel { width: 100%; max-height: 94vh; border-radius: 26px 26px 0 0; }
  .settings-header { padding: 22px 20px 18px; }
  .settings-content { padding: 18px 20px 22px; }
  .settings-columns { grid-template-columns: 1fr; gap: 18px; }
  .preview-card { min-height: 110px; }
  .preview-content { padding-inline: 12px; }
  .preview-grid { gap: 5px; }
  .preview-tool-card { padding: 7px; }
  .settings-footer { padding: 14px 20px calc(14px + env(safe-area-inset-bottom)); }
}

@media (max-width: 420px) {
  .header-copy h2 { font-size: 21px; }
  .preview-card { min-height: 94px; margin-bottom: 18px; }
  .preview-sidebar { width: 30px; padding-top: 14px; }
  .preview-tool-card { min-height: 52px; }
  .preview-tool-card .preview-icon { width: 12px; height: 12px; margin-bottom: 7px; }
  .segmented-control button { gap: 4px; font-size: 10px; }
}

@media (prefers-reduced-motion: reduce) {
  :global(html .bg-layer::before), :global(html .bg-layer::after), .preview-card { animation: none; transform: none; }
  :global(html .bg-layer::after) { opacity: .42; }
  .settings-enter-active, .settings-leave-active, .settings-enter-active .settings-panel, .settings-leave-active .settings-panel, .icon-button, .segmented-control button, .color-swatch, .position-control button, .settings-footer button { transition-duration: .01ms; }
}
</style>
