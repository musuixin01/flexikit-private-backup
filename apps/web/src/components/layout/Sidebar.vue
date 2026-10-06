<template>
  <!-- 移动端按钮：Teleport 到 body，仅移动端显示 -->
  <Teleport to="body" :disabled="!ui.isMobile">
    <button
      v-if="ui.isMobile"
      class="sidebar-toggle"
      @click="toggleSidebar"
      :aria-label="ui.sidebarCollapsed ? '展开侧边栏' : '收缩侧边栏'"
      style="position:fixed;top:15px;right:24px;left:auto;z-index:1000;width:28px;height:28px;background:transparent;backdrop-filter:none;box-shadow:none;border-radius:0;display:flex;align-items:center;justify-content:center;"
    >
      <img :src="`/icon/${toggleIconName}`" alt="toggle" style="width:100%;height:100%;object-fit:contain;"
        @error="onToggleIconError" />
    </button>
  </Teleport>

  <aside
    :class="['sidebar', { collapsed: ui.sidebarCollapsed, 'desktop-runtime': isDesktop, 'compact-mode': compactMode }]"
    id="sidebar"
    role="navigation"
  >
    <!-- 桌面端按钮：始终在侧边栏内，用 position:fixed 突破折叠裁剪 -->
    <button
      v-if="!ui.isMobile"
      :class="['sidebar-toggle', { 'fixed-mode': ui.sidebarCollapsed }]"
      :style="desktopToggleStyle"
      @click="toggleSidebar"
      :aria-label="ui.sidebarCollapsed ? '展开侧边栏' : '收缩侧边栏'"
    >
      <img :src="`/icon/${toggleIconName}`" alt="toggle" id="toggleIcon"
        @error="onToggleIconError" />
    </button>

    <div v-if="!isDesktop || !ui.sidebarCollapsed" class="sidebar-expanded-content">
      <!-- Logo -->
      <div class="sidebar-logo" @mousedown.left="startSidebarWindowDrag">
        <img draggable="false" src="/icon/icon_256x256.ico" alt="FlexiKit Logo" style="width:48px;height:48px;border-radius:10px;">
        <div class="logo-text">
          <h1>FlexiKit</h1>
          <div class="version">灵巧箱 v6.0</div>
        </div>
      </div>

      <nav v-if="isDesktop" class="desktop-primary-nav" aria-label="桌面端主导航">
        <button
          type="button"
          :class="['desktop-nav-item', 'desktop-nav-button', 'desktop-nav-core', { 'router-link-active': route.path === '/app' && route.query.view !== 'library' }]"
          @click="openWorkspaceHome"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-8.5Z"/></svg>
          <span>工作台</span>
        </button>
        <button
          type="button"
          :class="['desktop-nav-item', 'desktop-nav-button', 'desktop-nav-core', { 'router-link-active': route.path === '/app' && route.query.view === 'library' }]"
          @click="openToolLibrary('全部')"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
          <span>全部工具</span>
        </button>
        <RouterLink to="/discover" class="desktop-nav-item">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z"/></svg>
          <span>发现工具</span>
        </RouterLink>
        <RouterLink to="/assistant" class="desktop-nav-item">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8a4 4 0 0 1 4 4v5a4 4 0 0 1-4 4h-3l-4 3v-3H8a4 4 0 0 1-4-4V8a4 4 0 0 1 4-4Z"/><path d="M9 10h.01M12 10h.01M15 10h.01"/></svg>
          <span>AI 助手</span>
        </RouterLink>
        <button type="button" class="desktop-nav-item desktop-nav-button" @click="openDesktopCanvas">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="12" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><path d="M15 19h6"/></svg>
          <span>桌面画布</span>
        </button>
        <RouterLink v-if="isAdmin" to="/admin/overview" class="desktop-nav-item">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 9h8M8 13h5M8 17h3"/></svg>
          <span>管理端</span>
        </RouterLink>
      </nav>

      <template v-if="!compactMode">
        <!-- 搜索框 -->
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="search" :value="searchLocal" @input="onSearchInput" placeholder="搜索工具名称、描述或标签…" autocomplete="off" />
        </div>

        <!-- 工具栏 -->
        <div class="toolbar-row">
          <button @click="$emit('open-add-modal')" aria-label="添加工具">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>添加
          </button>
          <span class="sep"></span>
          <button v-show="!ui.selectMode" @click="enterSelect" aria-label="多选整理">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>整理
          </button>
          <button :class="{ active: ui.showOnlyFav }" @click="toggleFav">⭐ 收藏</button>
          <span class="batch-count" :style="{ display: ui.selectMode ? 'inline-flex' : 'none' }">
            已选 {{ ui.selectedSet.size }} 项
          </span>
          <button class="danger" v-show="ui.selectMode" @click="$emit('batch-delete')" aria-label="删除选中">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>删除选中
          </button>
          <button v-show="ui.selectMode" @click="exitSelect" aria-label="退出多选">退出多选</button>
        </div>

        <!-- 工具类型筛选 -->
        <div v-if="ui.showToolTypeFilter" class="tool-type-filter">
          <button :class="{ active: ui.toolTypeFilter === 'all' }" @click="ui.toolTypeFilter = 'all'"><span>全部</span></button>
          <span class="sep"></span>
          <button :class="{ active: ui.toolTypeFilter === 'web' }" @click="ui.toolTypeFilter = 'web'"><span>网页</span></button>
          <span class="sep"></span>
          <button :class="{ active: ui.toolTypeFilter === 'local' }" @click="ui.toolTypeFilter = 'local'"><span>本地</span></button>
        </div>

        <!-- 分类导航：桌面端显示列表 -->
        <div v-if="!ui.isMobile" class="cat-nav" ref="catNavRef">
          <button
            v-for="(cat, idx) in displayCategories"
            :key="cat"
            :data-cat="cat"
            :class="['cat-item', { active: cat === ui.activeCategory }]"
            @click="setCategory(cat)"
            @dblclick="cat !== '全部' && ui.openRenameModal(cat)"
          >
            <span class="cat-dot" :style="{ background: cat === ui.activeCategory ? 'var(--accent)' : catColors[idx % catColors.length] }"></span>
            <span>{{ cat }}</span>
            <span class="cat-count">{{ tools.categoryCounts[cat] || 0 }}</span>
          </button>
        </div>

        <!-- 分类选择：移动端显示自定义下拉框 -->
        <div v-else class="mobile-cat-select" ref="mobileCatSelectRef">
          <div class="custom-select-trigger" @click="toggleMobileCatDropdown" :class="{ active: mobileCatDropdownOpen }">
            <span class="select-label">{{ ui.activeCategory }}</span>
            <span class="select-count">{{ tools.categoryCounts[ui.activeCategory] || 0 }}</span>
            <svg class="select-arrow" :class="{ open: mobileCatDropdownOpen }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
          <Teleport to="body">
            <transition name="dropdown">
              <div v-show="mobileCatDropdownOpen" class="custom-select-dropdown" :style="dropdownStyle">
                <div
                  v-for="(cat, idx) in displayCategories"
                  :key="cat"
                  :class="['select-option', { active: cat === ui.activeCategory }]"
                  @click="selectMobileCat(cat)"
                >
                  <span class="option-dot" :style="{ background: cat === ui.activeCategory ? 'var(--accent)' : catColors[idx % catColors.length] }"></span>
                  <span class="option-name">{{ cat }}</span>
                  <span class="option-count">{{ tools.categoryCounts[cat] || 0 }}</span>
                </div>
              </div>
            </transition>
          </Teleport>
        </div>

        <!-- 导入导出 -->
        <div class="import-export-bar">
          <button class="theme-btn" @click="$emit('export-data')" aria-label="导出数据">📤 导出</button>
          <button class="theme-btn" @click="$emit('import-data')" aria-label="导入数据">📥 导入</button>
        </div>
      </template>

      <!-- 底部固定操作区 -->
      <div class="sidebar-footer">
        <RouterLink v-if="isAdmin && !isDesktop" to="/admin/overview" class="theme-btn">管理端</RouterLink>
        <div class="theme-toggle-wrap">
          <button :class="['theme-btn', { active: ui.theme === 'auto' }]" @click="ui.setTheme('auto')">跟随系统</button>
          <button :class="['theme-btn', { active: ui.theme === 'light' }]" @click="ui.setTheme('light')">亮色</button>
          <button :class="['theme-btn', { active: ui.theme === 'dark' }]" @click="ui.setTheme('dark')">暗黑</button>
        </div>
        <div v-if="!compactMode" class="sidebar-stats">
          <span>总计 {{ tools.allTools.length }} 项</span>
          <span>显示 {{ tools.getVisibleTools().length }} 项</span>
        </div>
      </div>
    </div>

  </aside>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { CSSProperties } from 'vue'
import Sortable from 'sortablejs'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { adminApi } from '@/api/admin'
import { invokeDesktop, isDesktopRuntime } from '@/api/runtime'

const props = withDefaults(defineProps<{
  compactMode?: boolean
}>(), {
  compactMode: false,
})

const tools = useToolsStore()
const ui = useUiStore()
const user = useUserStore()
const isAdmin = ref(false)
const isDesktop = isDesktopRuntime()
const compactMode = computed(() => props.compactMode)
const route = useRoute()
const router = useRouter()

const catNavRef = ref<HTMLElement | null>(null)
const mobileCatSelectRef = ref<HTMLElement | null>(null)
let catSortable: Sortable | null = null

// 移动端分类下拉框状态
const mobileCatDropdownOpen = ref(false)
const dropdownStyle = ref<Record<string, string>>({})

function updateDropdownPosition() {
  if (!mobileCatSelectRef.value) return
  const rect = mobileCatSelectRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 8}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    zIndex: '9999',
  }
}

function toggleMobileCatDropdown() {
  mobileCatDropdownOpen.value = !mobileCatDropdownOpen.value
  if (mobileCatDropdownOpen.value) {
    nextTick(updateDropdownPosition)
  }
}

function selectMobileCat(cat: string) {
  openToolLibrary(cat)
  mobileCatDropdownOpen.value = false
}

// 点击外部关闭下拉框
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.mobile-cat-select') && !target.closest('.custom-select-dropdown')) {
    mobileCatDropdownOpen.value = false
  }
}

const catColors = ['#0071e3', '#5e5ce6', '#ff375f', '#34c759', '#ff9f0a', '#30b0c7']

// ========== Display categories ==========
const displayCategories = computed(() => {
  const all = ['全部', ...tools.categoryList]
  try {
    const stored = localStorage.getItem('gtb-cat-order')
    if (stored) {
      const order: string[] = JSON.parse(stored)
      const ordered = ['全部', ...order.filter(c => c !== '全部' && all.includes(c))]
      for (const c of all) { if (!ordered.includes(c)) ordered.push(c) }
      return ordered
    }
  } catch {}
  return all
})

// ========== Toggle icon ==========
const prefersDark = ref(typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false)
const toggleIconName = computed(() => {
  const effective = ui.theme === 'auto' ? (prefersDark.value ? 'dark' : 'light') : ui.theme
  return effective === 'light' ? 'sidebar_black.png' : 'sidebar_white.png'
})

function onToggleIconError(e: Event) {
  const img = e.target as HTMLImageElement
  img.style.display = 'none'
  const btn = img.parentElement
  if (btn) {
    btn.innerHTML = '◀'
    btn.style.fontSize = '18px'
    btn.style.color = 'var(--text-primary)'
  }
}

// ========== 桌面端按钮样式 ==========
const desktopToggleStyle = computed<CSSProperties>(() => {
  if (isDesktop && ui.sidebarCollapsed) {
    return {
      position: 'absolute', top: '10px', right: '10px', left: 'auto', zIndex: '20'
    } as CSSProperties
  }
  return {
    position: 'absolute', top: '24px', right: '16px', left: 'auto', zIndex: '20'
  } as CSSProperties
})

// ========== Sidebar toggle ==========
function toggleSidebar() {
  if (ui.isMobile) {
    handleMobileToggle()
  } else {
    ui.sidebarCollapsed = !ui.sidebarCollapsed
    localStorage.setItem('flexikit-sidebar-collapsed', String(ui.sidebarCollapsed))
  }
}

function handleMobileToggle() {
  const scrollY = window.scrollY || window.pageYOffset || 0
  if (scrollY > 150) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    if (ui.sidebarCollapsed) {
      ui.sidebarCollapsed = false
      localStorage.setItem('flexikit-sidebar-collapsed', 'false')
    }
  } else {
    ui.sidebarCollapsed = !ui.sidebarCollapsed
    localStorage.setItem('flexikit-sidebar-collapsed', String(ui.sidebarCollapsed))
  }
}

// ========== Actions ==========
const searchLocal = ref(ui.searchQuery)
let searchTimer: ReturnType<typeof setTimeout> | null = null

function onSearchInput(e: Event) {
  const val = (e.target as HTMLInputElement).value
  searchLocal.value = val
  if (searchTimer) clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    ui.searchQuery = val
    if (val.trim() && route.path === '/app' && route.query.view !== 'library') {
      void router.push({ path: '/app', query: { view: 'library' } })
    }
  }, 300)
}

function openWorkspaceHome() {
  void router.push({ path: '/app' })
}

function openToolLibrary(cat: string) {
  ui.activeCategory = cat
  ui.showOnlyFav = false
  void router.push({ path: '/app', query: { view: 'library' } })
}

function setCategory(cat: string) { openToolLibrary(cat) }
function onMobileCatChange(e: Event) {
  const target = e.target as HTMLSelectElement
  openToolLibrary(target.value)
}
function enterSelect() { ui.enterSelectMode(); ui.showToast('整理模式已开启，可勾选工具进行批量删除') }
function exitSelect() { ui.exitSelectMode(); ui.showToast('已退出整理模式') }
function toggleFav() {
  ui.showOnlyFav = !ui.showOnlyFav
  if (ui.showOnlyFav) {
    ui.activeCategory = '全部'
    void router.push({ path: '/app', query: { view: 'library' } })
  }
  ui.showToast(ui.showOnlyFav ? '仅显示收藏的工具' : '已显示全部工具')
}

async function refreshAdminAccess(): Promise<void> {
  if (!user.isLoggedIn || !user.profile?.id) {
    isAdmin.value = false
    return
  }

  try {
    isAdmin.value = Boolean(await adminApi.checkAccess())
  } catch {
    isAdmin.value = false
  }
}

watch(
  () => [user.isLoggedIn, user.profile?.id] as const,
  () => {
    void refreshAdminAccess()
  },
  { immediate: true },
)

function openDesktopCanvas(): void {
  void invokeDesktop('show_desktop_canvas')
}

function startSidebarWindowDrag(event: MouseEvent): void {
  if (!isDesktop || event.button !== 0) return
  void invokeDesktop('start_main_window_drag').catch(error => {
    console.warn('Failed to start sidebar window drag', error)
  })
}

const emit = defineEmits<{
  'open-add-modal': []
  'batch-delete': []
  'export-data': []
  'import-data': []
}>()

// ========== SortableJS ==========
function initCatSortable() {
  if (!catNavRef.value) return
  if (catSortable) catSortable.destroy()
  catSortable = Sortable.create(catNavRef.value, {
    animation: 200,
    handle: '.cat-item',
    draggable: '.cat-item',
    filter: (evt) => {
      const el = (evt as any).target?.closest?.('.cat-item')
      return el?.getAttribute('data-cat') === undefined || el?.textContent?.trim().startsWith('全部')
    },
    onEnd: () => {
      const items = catNavRef.value!.querySelectorAll('.cat-item')
      const newOrder = Array.from(items)
        .map(item => item.getAttribute('data-cat'))
        .filter((c): c is string => c !== null && c !== '全部')
      localStorage.setItem('gtb-cat-order', JSON.stringify(newOrder))
  }
  })
}

// ========== Lifecycle ==========
let darkMq: MediaQueryList | null = null
function onDarkChange(e: MediaQueryListEvent) { prefersDark.value = e.matches }

onMounted(() => {
  const storedCollapsed = localStorage.getItem('flexikit-sidebar-collapsed')
  if (storedCollapsed !== null) {
    ui.sidebarCollapsed = storedCollapsed === 'true'
  }
  nextTick(initCatSortable)
  
  darkMq = window.matchMedia('(prefers-color-scheme: dark)')
  prefersDark.value = darkMq.matches
  darkMq.addEventListener('change', onDarkChange)

  // 点击外部关闭移动端分类下拉框
  document.addEventListener('click', handleClickOutside)
  // 窗口大小变化时更新下拉框位置
  window.addEventListener('resize', updateDropdownPosition)
})

onUnmounted(() => {
  if (catSortable) catSortable.destroy()
  if (darkMq) darkMq.removeEventListener('change', onDarkChange)
  document.removeEventListener('click', handleClickOutside)
  window.removeEventListener('resize', updateDropdownPosition)
})
</script>
