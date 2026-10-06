<template>
  <div class="pet-page" @mousedown.self="handleBackdropPointerDown" @mouseenter="setHovered(true)" @mouseleave="handlePointerLeave" @contextmenu.prevent="openPetMenu">
    <div class="pet-stage" :class="[{ 'is-hovered': hovered, 'is-searching': searchOpen, 'is-menu-open': menuOpen }, `placement-${placement}`]" :style="swimStyle" @mousedown.self="handleBackdropPointerDown">
      <div class="pet-aquarium" aria-hidden="true">
        <span class="aquarium-highlight"></span>
        <span class="aquarium-waterline"></span>
        <span v-for="bubble in bubbles" :key="bubble.id" class="aquarium-bubble" :style="bubble.style"></span>
      </div>

      <div class="pet-swim-viewport">
        <button class="pet-creature" type="button" title="单击搜索 · 双击打开 FlexiKit" aria-label="FlexiKit 桌面宠物，单击搜索，双击打开应用" @click.stop="handlePetClick" @dblclick.stop="handlePetDoubleClick">
          <span class="pet-aura" aria-hidden="true"></span>
          <span class="pet-tail" aria-hidden="true"></span>
          <span class="pet-fin" aria-hidden="true"></span>
          <span class="pet-avatar"><img src="/icon/icon_256x256.ico" alt=""></span>
          <span class="pet-eye" aria-hidden="true"></span>
        </button>
      </div>

      <span class="pet-drag-handle" title="拖动水缸" aria-label="拖动桌面宠物"><i></i><i></i><i></i></span>

      <transition name="liquid-panel">
        <section v-if="searchOpen && !menuOpen" class="pet-search-bar" aria-label="搜索工具" @click.stop>
          <svg class="search-glyph" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
          <input ref="searchInputRef" v-model="query" type="search" placeholder="搜索名称、描述、分类或标签" autocomplete="off" @focus="inputFocused = true" @blur="inputFocused = false" @keydown.esc.prevent="closePanel" @keydown.enter.prevent="openFirstResult">
          <kbd>↵</kbd>
        </section>
      </transition>

      <transition name="dock-popover">
        <section v-if="searchOpen && !menuOpen" class="dock-results" aria-live="polite" @click.stop>
          <div v-if="searchResults.length" class="pet-result-list">
            <button v-for="tool in searchResults" :key="`${tool.name}-${tool.url}`" class="pet-result-item" type="button" @mousedown.prevent @click="openToolResult(tool)">
              <span class="result-icon"><ToolIcon :tool="tool" /></span>
              <span class="result-copy"><strong>{{ tool.name }}</strong><small>{{ tool.desc || tool.cat }}</small></span>
              <span class="result-category">{{ tool.cat }}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <div v-else class="pet-result-empty"><span>⌁</span><strong>{{ query.trim() ? '没有找到相关工具' : '暂无推荐记录' }}</strong><small>{{ query.trim() ? '换一个关键词试试' : '使用工具后会逐渐变得更懂你' }}</small></div>
        </section>
      </transition>

      <transition name="liquid-panel">
        <div v-if="menuOpen" class="pet-menu" @click.stop>
          <button type="button" @click="openSearch">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            <span><strong>搜索工具</strong><small>查找常用与热门工具</small></span>
            <i>↗</i>
          </button>
          <button type="button" @click="openMain">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="4"/><path d="M8 9h8M8 13h5"/></svg>
            <span><strong>打开完整 App</strong><small>进入 FlexiKit 工作区</small></span>
            <i>↗</i>
          </button>
          <button type="button" @click="openCanvas">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="12" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="19" width="7" height="2" rx="1"/></svg>
            <span><strong>桌面画布</strong><small>打开自由小组件工作台</small></span>
            <i>↗</i>
          </button>
          <button type="button" @click="openWidgetPicker">
            <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><path d="M16.5 13v7M13 16.5h7"/></svg>
            <span><strong>添加桌面组件</strong><small>直接打开 Widget 组件库</small></span>
            <i>＋</i>
          </button>
          <button class="pet-exit" type="button" @click="quitApp">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4M9 12h9"/></svg>
            <span><strong>退出 FlexiKit</strong><small>关闭桌面宠物与应用</small></span>
            <i>×</i>
          </button>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import ToolIcon from '@/components/tools/ToolIcon.vue'
import { invokeDesktop } from '@/api/runtime'
import { toolsApi } from '@/api/tools'
import { statsApi } from '@/api/stats'
import { openDesktopTool } from '@/desktop/openTool'
import { useToolsStore } from '@/stores/tools'
import type { Tool } from '@/types/tool'
import { getPersonalToolScore, readToolUsage, recordToolUsage } from '@/utils/toolUsage'

const tools = useToolsStore()
const petPlacements = ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
const trendingCacheKey = 'flexikit-trending-tools-v1'
const fallbackTrendingNames = ['Cursor', 'Kimi', 'Notion', 'Obsidian', 'IT-Tools', 'DeepL', 'Excalidraw', 'Regex101']
type PetPlacement = typeof petPlacements[number]
const query = ref('')
const hovered = ref(false)
const searchOpen = ref(false)
const menuOpen = ref(false)
const inputFocused = ref(false)
const dragging = ref(false)
const placement = ref<PetPlacement>('bottom-right')
const trendingToolNames = ref<string[]>(readTrendingCache())
const usageRevision = ref(0)
const searchInputRef = ref<HTMLInputElement | null>(null)
const swimX = ref(46)
const swimY = ref(38)
const facing = ref(1)
const swimDuration = ref(3.8)

let swimTimer: ReturnType<typeof setTimeout> | null = null
let closeTimer: ReturnType<typeof setTimeout> | null = null
let singleClickTimer: ReturnType<typeof setTimeout> | null = null
let lastNativeEventAt = 0
let lastPetClickActionAt = 0
let suppressClickUntil = 0

const bubbles = Array.from({ length: 10 }, (_, index) => ({
  id: index,
  style: {
    '--bubble-left': `${8 + ((index * 19) % 84)}%`,
    '--bubble-size': `${3 + (index % 4) * 1.5}px`,
    '--bubble-duration': `${3.2 + (index % 5) * .65}s`,
    '--bubble-delay': `${-(index * .72)}s`,
  },
}))

const swimStyle = computed(() => ({
  '--pet-x': `${swimX.value}%`,
  '--pet-y': `${swimY.value}%`,
  '--pet-facing': String(facing.value),
  '--swim-duration': `${swimDuration.value}s`,
}))

const searchResults = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (keyword) {
    return tools.allTools
      .filter(tool => [tool.name, tool.desc, tool.cat, ...(tool.tags || [])].some(value => value?.toLowerCase().includes(keyword)))
      .slice(0, 6)
  }

  usageRevision.value
  const usage = readToolUsage()
  const personalized = tools.allTools
    .map(tool => ({ tool, score: getPersonalToolScore(tool, usage) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.tool)

  const trending = trendingToolNames.value
    .map(name => tools.allTools.find(tool => tool.name === name))
    .filter((tool): tool is Tool => Boolean(tool))

  const seen = new Set<string>()
  return [...personalized.slice(0, 3), ...trending, ...personalized.slice(3), ...tools.allTools]
    .filter(tool => {
      const key = `${tool.id || ''}:${tool.name}:${tool.url}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, 6)
})

function readTrendingCache(): string[] {
  try {
    const cached = JSON.parse(localStorage.getItem(trendingCacheKey) || '[]')
    return Array.isArray(cached) && cached.length ? cached : fallbackTrendingNames
  } catch {
    return fallbackTrendingNames
  }
}

async function refreshTrendingTools() {
  try {
    const response = await toolsApi.getRankings('week', 12)
    const names = (response.data || [])
      .map((tool: { name?: string }) => tool.name)
      .filter((name: string | undefined): name is string => Boolean(name))
    if (names.length) {
      trendingToolNames.value = names
      localStorage.setItem(trendingCacheKey, JSON.stringify(names))
    }
  } catch {
    // 保留上次成功排行或内置热门候选，离线时仍可推荐。
  }
}

async function initializePetData() {
  await tools.initData()
  await refreshTrendingTools()
}

function clearCloseTimer() {
  if (closeTimer) clearTimeout(closeTimer)
  closeTimer = null
}

function clearSingleClickTimer() {
  if (singleClickTimer) clearTimeout(singleClickTimer)
  singleClickTimer = null
}

function scheduleNextSwim() {
  if (swimTimer) clearTimeout(swimTimer)
  if (hovered.value || searchOpen.value || menuOpen.value) return
  const nextX = 28 + Math.random() * 44
  const nextY = 32 + Math.random() * 32
  facing.value = nextX >= swimX.value ? 1 : -1
  swimX.value = nextX
  swimY.value = nextY
  swimDuration.value = 2.8 + Math.random() * 2.5
  swimTimer = setTimeout(scheduleNextSwim, (swimDuration.value + .4) * 1000)
}

function setHovered(value: boolean) {
  clearCloseTimer()
  hovered.value = value
  if (value) {
    if (swimTimer) clearTimeout(swimTimer)
    swimTimer = null
  } else {
    scheduleNextSwim()
  }
}

function handlePointerLeave() {
  setHovered(false)
  if (!searchOpen.value || inputFocused.value || menuOpen.value) return
  closeTimer = setTimeout(() => void closePanel(), 900)
}

function handleBackdropPointerDown() {
  if (searchOpen.value || menuOpen.value) void closePanel()
}

async function setWindowExpanded(value: boolean, results = false) {
  const nextPlacement = await invokeDesktop<string>('resize_pet_window', { expanded: value, results })
  if (petPlacements.includes(nextPlacement as PetPlacement)) {
    placement.value = nextPlacement as PetPlacement
  }
}

async function openSearch() {
  clearSingleClickTimer()
  clearCloseTimer()
  menuOpen.value = false
  searchOpen.value = true
  hovered.value = true
  usageRevision.value += 1
  await setWindowExpanded(true, true)
  await nextTick()
  searchInputRef.value?.focus()
}

async function closePanel() {
  clearSingleClickTimer()
  clearCloseTimer()
  menuOpen.value = false
  searchOpen.value = false
  inputFocused.value = false
  query.value = ''
  await setWindowExpanded(false, false)
  hovered.value = false
  scheduleNextSwim()
}

function handlePetClick() {
  const now = Date.now()
  if (dragging.value || now < suppressClickUntil || now - lastPetClickActionAt < 160) return
  lastPetClickActionAt = now
  clearSingleClickTimer()
  if (searchOpen.value && !menuOpen.value) {
    void closePanel()
    return
  }
  singleClickTimer = setTimeout(() => {
    singleClickTimer = null
    void openSearch()
  }, 260)
}

function handlePetDoubleClick() {
  clearSingleClickTimer()
  void openMain()
}

async function openMain() {
  menuOpen.value = false
  await invokeDesktop('show_main_window')
}

async function openCanvas() {
  menuOpen.value = false
  await invokeDesktop('show_desktop_canvas')
}

async function openWidgetPicker() {
  menuOpen.value = false
  await invokeDesktop('show_canvas_widget_picker')
}

async function openToolResult(tool: Tool) {
  if (tool.id) void statsApi.recordClick(tool.id).catch(() => {})
  const localPath = tool.localPath || tool.local_path || undefined
  if (localPath) {
    try {
      const opened = await openDesktopTool(tool)
      if (opened) {
        usageRevision.value += 1
        return
      }
    } catch {
      // 本地打开失败时回到完整 App 的同名搜索结果。
    }
  }
  localStorage.setItem('flexikit-pet-search', tool.name)
  recordToolUsage(tool)
  usageRevision.value += 1
  await openMain()
}

function openFirstResult() {
  const first = searchResults.value[0]
  if (first) void openToolResult(first)
}

async function openPetMenu() {
  clearSingleClickTimer()
  clearCloseTimer()
  searchOpen.value = false
  menuOpen.value = true
  hovered.value = true
  await setWindowExpanded(true, true)
}

async function quitApp() {
  await invokeDesktop('quit_app')
}

function nativeEventIsDuplicate() {
  const now = Date.now()
  if (now - lastNativeEventAt < 120) return true
  lastNativeEventAt = now
  return false
}

function handleNativeClick() {
  if (!nativeEventIsDuplicate()) handlePetClick()
}

function handleNativeHoverEnter() {
  setHovered(true)
}

function handleNativeDoubleClick() {
  if (!nativeEventIsDuplicate()) handlePetDoubleClick()
}

function handleNativeCollapse() {
  void closePanel()
}

function handleNativeDragStart() {
  dragging.value = true
  suppressClickUntil = Date.now() + 500
  clearSingleClickTimer()
}

function handleNativeDragEnd() {
  dragging.value = false
  suppressClickUntil = Date.now() + 350
}

function handleNativeMenu() {
  void openPetMenu()
}

function handleNativePlacement(event: Event) {
  const nextPlacement = (event as CustomEvent<string>).detail
  if (petPlacements.includes(nextPlacement as PetPlacement)) {
    placement.value = nextPlacement as PetPlacement
  }
}

onMounted(() => {
  document.documentElement.classList.add('pet-window')
  window.addEventListener('flexikit-pet-hover-enter', handleNativeHoverEnter)
  window.addEventListener('flexikit-pet-hover-leave', handlePointerLeave)
  window.addEventListener('flexikit-pet-native-click', handleNativeClick)
  window.addEventListener('flexikit-pet-native-double-click', handleNativeDoubleClick)
  window.addEventListener('flexikit-pet-native-collapse', handleNativeCollapse)
  window.addEventListener('flexikit-pet-native-menu', handleNativeMenu)
  window.addEventListener('flexikit-pet-drag-start', handleNativeDragStart)
  window.addEventListener('flexikit-pet-drag-end', handleNativeDragEnd)
  window.addEventListener('flexikit-pet-placement', handleNativePlacement)
  void initializePetData()
  void invokeDesktop('mark_pet_ready')
  scheduleNextSwim()
})

onBeforeUnmount(() => {
  if (swimTimer) clearTimeout(swimTimer)
  clearCloseTimer()
  clearSingleClickTimer()
  window.removeEventListener('flexikit-pet-hover-enter', handleNativeHoverEnter)
  window.removeEventListener('flexikit-pet-hover-leave', handlePointerLeave)
  window.removeEventListener('flexikit-pet-native-click', handleNativeClick)
  window.removeEventListener('flexikit-pet-native-double-click', handleNativeDoubleClick)
  window.removeEventListener('flexikit-pet-native-collapse', handleNativeCollapse)
  window.removeEventListener('flexikit-pet-native-menu', handleNativeMenu)
  window.removeEventListener('flexikit-pet-drag-start', handleNativeDragStart)
  window.removeEventListener('flexikit-pet-drag-end', handleNativeDragEnd)
  window.removeEventListener('flexikit-pet-placement', handleNativePlacement)
  document.documentElement.classList.remove('pet-window')
})

</script>

<style scoped>
:global(html.pet-window), :global(html.pet-window body), :global(html.pet-window #app) { width: 100%; min-width: 0; min-height: 0; overflow: hidden; background: transparent !important; box-shadow: none !important; outline: 0 !important; }
.pet-page, .pet-stage { width: 100vw; height: 100vh; overflow: hidden; border: 0; outline: 0; background: transparent; box-shadow: none; }
.pet-stage { --pet-x: 46%; --pet-y: 28%; --pet-facing: 1; --swim-duration: 3.8s; --dock-item-width: min(calc(100vw - 156px), 356px); position: relative; }

.pet-aquarium { position: absolute; inset: 8px; overflow: hidden; border: 1px solid rgb(255 255 255 / 58%); border-bottom-color: color-mix(in srgb, var(--primary) 25%, rgb(255 255 255 / 32%)); border-radius: 38px 38px 30px 30px; background: radial-gradient(circle at 22% 12%, rgb(255 255 255 / 58%), transparent 28%), linear-gradient(180deg, rgb(255 255 255 / 24%) 0 30%, color-mix(in srgb, var(--primary) 14%, rgb(130 220 255 / 18%)) 31% 100%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 78%), inset 8px 0 18px rgb(255 255 255 / 14%), inset -6px -10px 22px color-mix(in srgb, var(--primary) 12%, transparent); transition: opacity .28s ease, transform .38s cubic-bezier(.22, 1, .36, 1), filter .3s ease; }
.aquarium-highlight { position: absolute; inset: 7px 14px auto; height: 14px; border-top: 2px solid rgb(255 255 255 / 52%); border-radius: 50%; }
.aquarium-waterline { position: absolute; top: 31%; left: 4%; width: 92%; height: 7px; border-top: 1px solid rgb(255 255 255 / 58%); border-radius: 50%; box-shadow: 0 3px 8px color-mix(in srgb, var(--primary) 10%, transparent); animation: waterBreath 4.6s ease-in-out infinite; }
.aquarium-bubble { position: absolute; left: var(--bubble-left); bottom: -10px; width: var(--bubble-size); height: var(--bubble-size); border: 1px solid rgb(255 255 255 / 74%); border-radius: 50%; background: rgb(255 255 255 / 14%); box-shadow: inset 1px 1px 2px rgb(255 255 255 / 55%); animation: bubbleRise var(--bubble-duration) linear var(--bubble-delay) infinite; }
.pet-stage.is-hovered .pet-aquarium, .pet-stage.is-searching .pet-aquarium, .pet-stage.is-menu-open .pet-aquarium { opacity: 0; transform: scale(.88); filter: blur(6px); pointer-events: none; }

.pet-swim-viewport { position: absolute; z-index: 5; inset: 8px; overflow: hidden; border-radius: 38px 38px 30px 30px; transition: inset .28s ease; }
.pet-stage.is-hovered .pet-swim-viewport, .pet-stage.is-searching .pet-swim-viewport, .pet-stage.is-menu-open .pet-swim-viewport { inset: 0; overflow: visible; }
.pet-creature { position: absolute; z-index: 5; left: var(--pet-x); top: var(--pet-y); width: 52px; height: 52px; padding: 0; border: 0; outline: 0; background: transparent; cursor: pointer; transform: translate(-50%, -50%) scaleX(var(--pet-facing)); transition: left var(--swim-duration) cubic-bezier(.42, 0, .35, 1), top var(--swim-duration) cubic-bezier(.42, 0, .35, 1), transform .34s cubic-bezier(.22, 1, .36, 1), filter .28s ease; filter: drop-shadow(0 8px 10px rgb(44 108 170 / 18%)); }
.pet-avatar { position: absolute; inset: 5px; display: grid; place-items: center; animation: petFloat 2.7s ease-in-out infinite; }
.pet-avatar img { width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
.pet-aura { position: absolute; inset: 7px; border-radius: 50%; background: color-mix(in srgb, var(--primary) 24%, rgb(104 214 255 / 18%)); filter: blur(10px); opacity: .72; animation: auraPulse 3.4s ease-in-out infinite; }
.pet-tail { position: absolute; z-index: -1; left: -7px; top: 17px; width: 18px; height: 20px; clip-path: polygon(100% 50%, 5% 0, 26% 50%, 5% 100%); background: linear-gradient(135deg, color-mix(in srgb, var(--primary) 58%, #9ee8ff), rgb(255 255 255 / 45%)); opacity: .75; transform-origin: right center; animation: tailWave .72s ease-in-out infinite alternate; }
.pet-fin { position: absolute; right: 3px; bottom: 3px; width: 17px; height: 11px; border-radius: 80% 10% 80% 20%; background: color-mix(in srgb, var(--primary) 45%, rgb(255 255 255 / 52%)); opacity: .62; transform: rotate(-24deg); }
.pet-eye { position: absolute; right: 7px; top: 17px; width: 4px; height: 4px; border: 1px solid rgb(255 255 255 / 80%); border-radius: 50%; background: #16324c; }
.pet-creature:hover, .pet-stage.is-hovered:not(.is-searching):not(.is-menu-open) .pet-creature { left: 50%; top: 50%; transform: translate(-50%, -50%) scale(1.18); filter: drop-shadow(0 12px 16px color-mix(in srgb, var(--primary) 28%, transparent)); }
.pet-stage.is-searching .pet-creature, .pet-stage.is-menu-open .pet-creature { left: 38px; top: 42px; transform: translate(-50%, -50%) scale(1.04); }
.pet-creature:active { filter: drop-shadow(0 5px 8px color-mix(in srgb, var(--primary) 20%, transparent)); }
.pet-creature:focus-visible { border-radius: 18px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 28%, transparent); }

.pet-drag-handle { position: absolute; z-index: 9; top: 12px; right: 18px; display: flex; gap: 3px; padding: 5px 6px; border-radius: 10px; cursor: grab; opacity: .52; transition: opacity .2s ease, background .2s ease; }
.pet-drag-handle:hover { opacity: .9; background: rgb(255 255 255 / 22%); }
.pet-drag-handle i { width: 2px; height: 2px; border-radius: 50%; background: color-mix(in srgb, var(--primary) 70%, #6b7280); pointer-events: none; }

.pet-search-panel { position: absolute; z-index: 4; inset: 10px 10px 10px 76px; overflow: hidden; border: 1px solid rgb(255 255 255 / 52%); border-radius: 26px; background: radial-gradient(circle at 12% 0%, rgb(255 255 255 / 52%), transparent 38%), color-mix(in srgb, var(--glass-bg) 68%, transparent); box-shadow: 0 20px 48px rgb(27 65 105 / 18%), inset 0 1px 0 rgb(255 255 255 / 68%); backdrop-filter: blur(28px) saturate(185%); -webkit-backdrop-filter: blur(28px) saturate(185%); }
.pet-search-panel { display: flex; flex-direction: column; padding: 16px; }
.search-panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.search-panel-header div { display: grid; gap: 2px; }
.search-panel-header span { color: var(--primary); font-size: .58rem; font-weight: 760; letter-spacing: .12em; }
.search-panel-header strong { color: var(--text-primary); font-size: 1rem; letter-spacing: -.02em; }
.search-panel-header > button { display: grid; place-items: center; width: 27px; height: 27px; border: 1px solid rgb(255 255 255 / 42%); border-radius: 50%; background: rgb(255 255 255 / 16%); color: var(--text-secondary); font-size: 1rem; cursor: pointer; }
.pet-search-field { display: flex; align-items: center; min-height: 42px; padding: 0 12px; border: 1px solid color-mix(in srgb, var(--primary) 20%, rgb(255 255 255 / 48%)); border-radius: 15px; background: rgb(255 255 255 / 21%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 42%); transition: border-color .2s ease, box-shadow .2s ease, background .2s ease; }
.pet-search-field:focus-within { border-color: color-mix(in srgb, var(--primary) 58%, transparent); background: rgb(255 255 255 / 28%); box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary) 12%, transparent), inset 0 1px 0 rgb(255 255 255 / 58%); }
.pet-search-field svg { width: 16px; height: 16px; flex: 0 0 auto; fill: none; stroke: var(--primary); stroke-width: 1.8; stroke-linecap: round; }
.pet-search-field input { width: 100%; min-width: 0; height: 40px; padding: 0 10px; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: .74rem; }
.pet-search-field input::placeholder { color: var(--text-tertiary); }
.pet-search-field kbd { padding: 3px 5px; border: 1px solid rgb(255 255 255 / 42%); border-radius: 6px; background: rgb(255 255 255 / 18%); color: var(--text-tertiary); font: 600 .48rem/1 system-ui; }
.search-result-heading { display: flex; justify-content: space-between; padding: 12px 3px 7px; color: var(--text-tertiary); font-size: .6rem; }
.search-result-heading small { font-size: inherit; }
.pet-result-list { display: grid; flex: 1; min-height: 0; gap: 5px; overflow: auto; padding-right: 2px; scrollbar-width: none; }
.pet-result-list::-webkit-scrollbar { display: none; }
.pet-result-item { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto 14px; align-items: center; gap: 9px; width: 100%; min-height: 43px; padding: 6px 9px; border: 1px solid transparent; border-radius: 13px; background: rgb(255 255 255 / 11%); color: var(--text-primary); text-align: left; cursor: pointer; transition: transform .2s cubic-bezier(.22, 1, .36, 1), background .2s ease, border-color .2s ease, box-shadow .2s ease; }
.pet-result-item:hover, .pet-result-item:focus-visible { border-color: color-mix(in srgb, var(--primary) 22%, rgb(255 255 255 / 46%)); outline: 0; background: color-mix(in srgb, var(--primary) 8%, rgb(255 255 255 / 25%)); box-shadow: 0 8px 18px color-mix(in srgb, var(--primary) 9%, transparent); transform: translateX(2px); }
.pet-result-item:active { transform: scale(.985); }
.result-icon { width: 27px; height: 27px; padding: 3px; border-radius: 9px; background: rgb(255 255 255 / 36%); box-shadow: inset 0 1px 0 rgb(255 255 255 / 52%); }
.result-copy { display: grid; min-width: 0; gap: 2px; }
.result-copy strong, .result-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.result-copy strong { color: var(--text-primary); font-size: .68rem; font-weight: 680; }
.result-copy small { color: var(--text-tertiary); font-size: .54rem; }
.result-category { max-width: 88px; overflow: hidden; padding: 4px 7px; border-radius: 999px; background: color-mix(in srgb, var(--primary) 8%, rgb(255 255 255 / 16%)); color: var(--text-secondary); font-size: .5rem; text-overflow: ellipsis; white-space: nowrap; }
.pet-result-item > svg { width: 13px; height: 13px; fill: none; stroke: var(--text-tertiary); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.pet-result-empty { display: grid; place-items: center; flex: 1; align-content: center; gap: 4px; color: var(--text-tertiary); }
.pet-result-empty span { font-size: 1.5rem; color: var(--primary); }
.pet-result-empty strong { color: var(--text-secondary); font-size: .72rem; }
.pet-result-empty small { font-size: .56rem; }
.pet-search-panel footer { padding-top: 8px; color: var(--text-tertiary); font-size: .5rem; text-align: center; }

.pet-stage.is-searching .pet-drag-handle, .pet-stage.is-menu-open .pet-drag-handle { display: none; }
.pet-stage:is(.is-searching, .is-menu-open).placement-bottom-left .pet-creature { left: 34px; top: auto; right: auto; bottom: 22px; transform: translate(-50%, 0) scale(1.04); }
.pet-stage:is(.is-searching, .is-menu-open).placement-bottom-right .pet-creature { left: auto; top: auto; right: 8px; bottom: 22px; transform: translate(0, 0) scale(1.04); }
.pet-stage:is(.is-searching, .is-menu-open).placement-top-left .pet-creature { left: 34px; top: 22px; right: auto; bottom: auto; transform: translate(-50%, 0) scale(1.04); }
.pet-stage:is(.is-searching, .is-menu-open).placement-top-right .pet-creature { left: auto; top: 22px; right: 8px; bottom: auto; transform: translate(0, 0) scale(1.04); }

.pet-search-bar { position: absolute; z-index: 6; box-sizing: border-box; display: grid; grid-template-columns: 18px minmax(0, 1fr) auto; align-items: center; gap: 9px; width: var(--dock-item-width); min-height: 50px; padding: 5px 12px 5px 13px; border: 1px solid rgb(255 255 255 / 58%); border-radius: 16px; background: radial-gradient(circle at 12% 0%, rgb(255 255 255 / 48%), transparent 38%), color-mix(in srgb, var(--glass-bg) 72%, transparent); box-shadow: 0 10px 25px rgb(25 60 98 / 18%), inset 0 1px 0 rgb(255 255 255 / 72%); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); }
.placement-bottom-left .pet-search-bar, .placement-top-left .pet-search-bar { left: 76px; }
.placement-bottom-right .pet-search-bar, .placement-top-right .pet-search-bar { right: 76px; }
.placement-bottom-left .pet-search-bar, .placement-bottom-right .pet-search-bar { bottom: 10px; }
.placement-top-left .pet-search-bar, .placement-top-right .pet-search-bar { top: 10px; }
.pet-search-bar .search-glyph { width: 17px; height: 17px; fill: none; stroke: var(--primary); stroke-width: 1.8; stroke-linecap: round; }
.pet-search-bar input { width: 100%; min-width: 0; height: 38px; padding: 0; border: 0; outline: 0; background: transparent; color: var(--text-primary); font: inherit; font-size: .72rem; }
.pet-search-bar input::placeholder { color: var(--text-tertiary); }
.pet-search-bar kbd { padding: 3px 5px; border: 1px solid rgb(255 255 255 / 42%); border-radius: 6px; background: rgb(255 255 255 / 18%); color: var(--text-tertiary); font: 600 .48rem/1 system-ui; }
.pet-search-bar:focus-within { border-color: color-mix(in srgb, var(--primary) 48%, rgb(255 255 255 / 52%)); box-shadow: 0 12px 30px rgb(25 60 98 / 20%), 0 0 0 4px color-mix(in srgb, var(--primary) 11%, transparent), inset 0 1px 0 rgb(255 255 255 / 78%); }
.dock-results { position: absolute; z-index: 7; display: flex; flex-direction: column; max-height: calc(100vh - 72px); overflow: visible; pointer-events: none; }
.placement-bottom-left .dock-results, .placement-top-left .dock-results { right: 10px; left: 76px; }
.placement-bottom-right .dock-results, .placement-top-right .dock-results { right: 76px; left: 10px; }
.placement-bottom-left .dock-results, .placement-bottom-right .dock-results { bottom: 68px; justify-content: flex-end; }
.placement-top-left .dock-results, .placement-top-right .dock-results { top: 68px; justify-content: flex-start; }
.dock-results .pet-result-list { display: flex; flex: none; flex-direction: column; gap: 6px; overflow: visible; padding: 5px 4px; }
.placement-bottom-left .pet-result-list, .placement-top-left .pet-result-list { align-items: flex-start; padding-right: 70px; }
.placement-bottom-right .pet-result-list, .placement-top-right .pet-result-list { align-items: flex-end; padding-left: 70px; }
.dock-results .pet-result-item { --fan-x: 0px; --origin-x: 18px; --origin-y: 16px; box-sizing: border-box; width: var(--dock-item-width); min-height: 50px; pointer-events: auto; border-color: rgb(255 255 255 / 58%); border-radius: 16px; background: radial-gradient(circle at 12% 0%, rgb(255 255 255 / 48%), transparent 38%), color-mix(in srgb, var(--glass-bg) 72%, transparent); box-shadow: 0 10px 25px rgb(25 60 98 / 18%), inset 0 1px 0 rgb(255 255 255 / 72%); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); transform: translateX(var(--fan-x)); transform-origin: right bottom; animation: dockItemRise .38s cubic-bezier(.22, 1, .36, 1) both; }
.placement-bottom-left .pet-result-item:nth-child(1), .placement-bottom-right .pet-result-item:nth-child(1) { --fan-distance: 62px; }
.placement-bottom-left .pet-result-item:nth-child(2), .placement-bottom-right .pet-result-item:nth-child(2) { --fan-distance: 43px; }
.placement-bottom-left .pet-result-item:nth-child(3), .placement-bottom-right .pet-result-item:nth-child(3) { --fan-distance: 27px; }
.placement-bottom-left .pet-result-item:nth-child(4), .placement-bottom-right .pet-result-item:nth-child(4) { --fan-distance: 14px; }
.placement-bottom-left .pet-result-item:nth-child(5), .placement-bottom-right .pet-result-item:nth-child(5) { --fan-distance: 5px; }
.placement-bottom-left .pet-result-item:nth-child(6), .placement-bottom-right .pet-result-item:nth-child(6) { --fan-distance: 0px; }
.placement-top-left .pet-result-item:nth-child(1), .placement-top-right .pet-result-item:nth-child(1) { --fan-distance: 0px; }
.placement-top-left .pet-result-item:nth-child(2), .placement-top-right .pet-result-item:nth-child(2) { --fan-distance: 5px; }
.placement-top-left .pet-result-item:nth-child(3), .placement-top-right .pet-result-item:nth-child(3) { --fan-distance: 14px; }
.placement-top-left .pet-result-item:nth-child(4), .placement-top-right .pet-result-item:nth-child(4) { --fan-distance: 27px; }
.placement-top-left .pet-result-item:nth-child(5), .placement-top-right .pet-result-item:nth-child(5) { --fan-distance: 43px; }
.placement-top-left .pet-result-item:nth-child(6), .placement-top-right .pet-result-item:nth-child(6) { --fan-distance: 62px; }
.placement-bottom-left .pet-result-item, .placement-top-left .pet-result-item { --fan-x: var(--fan-distance); --hover-x: 5px; --origin-x: -18px; transform-origin: left center; }
.placement-bottom-right .pet-result-item, .placement-top-right .pet-result-item { --fan-x: calc(0px - var(--fan-distance)); --hover-x: -5px; --origin-x: 18px; transform-origin: right center; }
.placement-top-left .pet-result-item, .placement-top-right .pet-result-item { --origin-y: -16px; }
.dock-results .pet-result-item:nth-child(1) { animation-delay: 0ms; }
.dock-results .pet-result-item:nth-child(2) { animation-delay: 34ms; }
.dock-results .pet-result-item:nth-child(3) { animation-delay: 68ms; }
.dock-results .pet-result-item:nth-child(4) { animation-delay: 102ms; }
.dock-results .pet-result-item:nth-child(5) { animation-delay: 136ms; }
.dock-results .pet-result-item:nth-child(6) { animation-delay: 170ms; }
.dock-results .pet-result-item:hover, .dock-results .pet-result-item:focus-visible { transform: translateX(calc(var(--fan-x) + var(--hover-x))) scale(1.025); }
.dock-results .pet-result-item:active { transform: translateX(var(--fan-x)) scale(.985); }
.dock-results .pet-result-empty { align-self: flex-end; width: 270px; min-height: 82px; padding: 12px; pointer-events: auto; border: 1px solid rgb(255 255 255 / 56%); border-radius: 22px; background: color-mix(in srgb, var(--glass-bg) 70%, transparent); box-shadow: 0 14px 32px rgb(25 60 98 / 18%), inset 0 1px 0 rgb(255 255 255 / 70%); backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); }
.placement-bottom-left .pet-result-empty, .placement-top-left .pet-result-empty { align-self: flex-start; }

.pet-menu { position: absolute; z-index: 7; display: flex; flex-direction: column; gap: 6px; width: calc(100% - 86px); overflow: visible; border: 0; background: transparent; box-shadow: none; pointer-events: none; }
.placement-bottom-left .pet-menu, .placement-top-left .pet-menu { right: 10px; left: 76px; align-items: flex-start; }
.placement-bottom-right .pet-menu, .placement-top-right .pet-menu { right: 76px; left: 10px; align-items: flex-end; }
.placement-bottom-left .pet-menu, .placement-bottom-right .pet-menu { bottom: 18px; }
.placement-top-left .pet-menu, .placement-top-right .pet-menu { top: 18px; }
.pet-menu button { --fan-x: 0px; --origin-x: 18px; --origin-y: 16px; box-sizing: border-box; display: grid; grid-template-columns: 22px minmax(0, 1fr) 14px; align-items: center; gap: 10px; width: var(--dock-item-width); min-height: 50px; padding: 6px 10px; pointer-events: auto; border: 1px solid rgb(255 255 255 / 58%); border-radius: 16px; background: radial-gradient(circle at 12% 0%, rgb(255 255 255 / 48%), transparent 38%), color-mix(in srgb, var(--glass-bg) 72%, transparent); box-shadow: 0 10px 25px rgb(25 60 98 / 18%), inset 0 1px 0 rgb(255 255 255 / 72%); color: var(--text-primary); font: inherit; text-align: left; cursor: pointer; backdrop-filter: blur(24px) saturate(180%); -webkit-backdrop-filter: blur(24px) saturate(180%); transform: translateX(var(--fan-x)); animation: dockItemRise .38s cubic-bezier(.22, 1, .36, 1) both; transition: border-color .2s ease, background .2s ease, box-shadow .2s ease, transform .2s cubic-bezier(.22, 1, .36, 1); }
.pet-menu button > svg { width: 19px; height: 19px; fill: none; stroke: var(--primary); stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.pet-menu button > span { display: grid; min-width: 0; gap: 2px; }
.pet-menu button strong, .pet-menu button small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pet-menu button strong { color: var(--text-primary); font-size: .68rem; font-weight: 680; }
.pet-menu button small { color: var(--text-tertiary); font-size: .52rem; }
.pet-menu button > i { color: var(--text-tertiary); font: 600 .65rem/1 system-ui; text-align: center; }
.placement-bottom-left .pet-menu button:nth-child(1), .placement-bottom-right .pet-menu button:nth-child(1) { --fan-distance: 38px; }
.placement-bottom-left .pet-menu button:nth-child(2), .placement-bottom-right .pet-menu button:nth-child(2) { --fan-distance: 16px; }
.placement-bottom-left .pet-menu button:nth-child(3), .placement-bottom-right .pet-menu button:nth-child(3) { --fan-distance: 0px; }
.placement-top-left .pet-menu button:nth-child(1), .placement-top-right .pet-menu button:nth-child(1) { --fan-distance: 0px; }
.placement-top-left .pet-menu button:nth-child(2), .placement-top-right .pet-menu button:nth-child(2) { --fan-distance: 16px; }
.placement-top-left .pet-menu button:nth-child(3), .placement-top-right .pet-menu button:nth-child(3) { --fan-distance: 38px; }
.placement-bottom-left .pet-menu button, .placement-top-left .pet-menu button { --fan-x: var(--fan-distance); --hover-x: 5px; --origin-x: -18px; transform-origin: left center; }
.placement-bottom-right .pet-menu button, .placement-top-right .pet-menu button { --fan-x: calc(0px - var(--fan-distance)); --hover-x: -5px; --origin-x: 18px; transform-origin: right center; }
.placement-top-left .pet-menu button, .placement-top-right .pet-menu button { --origin-y: -16px; }
.pet-menu button:nth-child(2) { animation-delay: 45ms; }
.pet-menu button:nth-child(3) { animation-delay: 90ms; }
.pet-menu button:hover, .pet-menu button:focus-visible { border-color: color-mix(in srgb, var(--primary) 28%, rgb(255 255 255 / 58%)); outline: 0; background: color-mix(in srgb, var(--primary) 8%, rgb(255 255 255 / 25%)); box-shadow: 0 12px 28px color-mix(in srgb, var(--primary) 13%, transparent), inset 0 1px 0 rgb(255 255 255 / 78%); transform: translateX(calc(var(--fan-x) + var(--hover-x))) scale(1.025); }
.pet-menu button:active { transform: translateX(var(--fan-x)) scale(.985); }
.pet-menu .pet-exit strong, .pet-menu .pet-exit > svg { color: var(--danger); stroke: var(--danger); }

.liquid-panel-enter-active, .liquid-panel-leave-active { transition: opacity .24s ease, transform .36s cubic-bezier(.22, 1, .36, 1), filter .24s ease; }
.liquid-panel-enter-from, .liquid-panel-leave-to { opacity: 0; transform: translateX(18px) scale(.94); filter: blur(8px); }
.dock-popover-enter-active, .dock-popover-leave-active { transition: opacity .22s ease, transform .34s cubic-bezier(.22, 1, .36, 1), filter .22s ease; }
.dock-popover-enter-from, .dock-popover-leave-to { opacity: 0; transform: translateY(16px) scale(.92); filter: blur(8px); }
.placement-top-left .dock-popover-enter-from, .placement-top-left .dock-popover-leave-to, .placement-top-right .dock-popover-enter-from, .placement-top-right .dock-popover-leave-to { transform: translateY(-16px) scale(.92); }
@keyframes dockItemRise { from { opacity: 0; transform: translateX(var(--origin-x)) translateY(var(--origin-y)) scale(.72); filter: blur(7px); } to { opacity: 1; transform: translateX(var(--fan-x)) translateY(0) scale(1); filter: blur(0); } }
@keyframes bubbleRise { 0% { transform: translateY(0) translateX(0) scale(.72); opacity: 0; } 14% { opacity: .78; } 55% { transform: translateY(-46px) translateX(5px) scale(1); opacity: .7; } 100% { transform: translateY(-92px) translateX(-3px) scale(1.08); opacity: 0; } }
@keyframes waterBreath { 0%, 100% { transform: scaleX(.98); opacity: .72; } 50% { transform: scaleX(1.03) translateY(1px); opacity: .94; } }
@keyframes petFloat { 0%, 100% { transform: translateY(-1px) rotate(-1.5deg); } 50% { transform: translateY(2px) rotate(1.5deg); } }
@keyframes tailWave { from { transform: rotate(-10deg) scaleX(.88); } to { transform: rotate(10deg) scaleX(1.08); } }
@keyframes auraPulse { 0%, 100% { opacity: .48; transform: scale(.88); } 50% { opacity: .82; transform: scale(1.16); } }
@media (prefers-reduced-motion: reduce) { .pet-aquarium, .pet-creature, .pet-result-item, .liquid-panel-enter-active, .liquid-panel-leave-active { transition-duration: .01ms; } .aquarium-waterline, .aquarium-bubble, .pet-avatar, .pet-tail, .pet-aura { animation: none; } }
</style>
