<template>
  <div class="app-layout workspace-page">
    <Sidebar
      v-if="!ui.isMobile"
      @open-add-modal="openAddModal"
      @batch-delete="onBatchDelete"
      @export-data="onExport"
      @import-data="onImport"
    />
    <main class="main-content">
      <Navbar />

      <section v-if="ui.isMobile" class="mobile-workspace-header" aria-labelledby="mobile-workspace-title">
        <div class="mobile-workspace-title-row">
          <div class="mobile-workspace-heading">
            <h2 id="mobile-workspace-title">{{ ui.activeCategory === '全部' ? '全部工具' : ui.activeCategory }}</h2>
          </div>
          <span class="mobile-workspace-count">{{ tools.getVisibleTools().length }}</span>
        </div>
        <nav class="mobile-category-strip" aria-label="工具分类">
          <button
            v-for="(cat, idx) in collapsedCategories"
            :key="cat"
            type="button"
            :class="['mobile-category-chip', { active: cat === ui.activeCategory }]"
            @click="ui.activeCategory = cat"
          >
            <span
              class="mobile-category-dot"
              :style="{ background: cat === ui.activeCategory ? 'var(--accent)' : categoryColors[idx % categoryColors.length] }"
              aria-hidden="true"
            ></span>
            <span :title="cat">{{ mobileCategoryLabel(cat) }}</span>
          </button>
        </nav>

        <div class="mobile-workspace-controls">
          <div class="mobile-type-filter" role="group" aria-label="工具类型">
            <button :class="{ active: ui.toolTypeFilter === 'all' }" type="button" @click="ui.toolTypeFilter = 'all'">全部</button>
            <button :class="{ active: ui.toolTypeFilter === 'web' }" type="button" @click="ui.toolTypeFilter = 'web'">网页</button>
            <button :class="{ active: ui.toolTypeFilter === 'local' }" type="button" @click="ui.toolTypeFilter = 'local'">本地</button>
          </div>

          <div class="mobile-quick-actions" role="group" aria-label="工具操作">
            <button v-if="!ui.selectMode" class="mobile-action primary" type="button" @click="openAddModal">＋ 添加</button>
            <button class="mobile-action" :class="{ active: ui.selectMode }" type="button" @click="toggleMobileSelectMode">
              {{ ui.selectMode ? '完成' : '整理' }}
            </button>
            <button v-if="ui.selectMode" class="mobile-action danger" type="button" @click="onBatchDelete">
              删除 {{ ui.selectedSet.size }}
            </button>
            <button v-else class="mobile-action" :class="{ active: ui.showOnlyFav }" type="button" @click="toggleMobileFavorite">
              ★ 收藏
            </button>
          </div>
        </div>
      </section>

      <section class="workspace-content" :aria-labelledby="ui.isMobile ? 'mobile-workspace-title' : 'workspace-title'">
        <div v-if="!ui.isMobile" class="content-header workspace-header">
          <div class="workspace-header-primary">
            <div class="workspace-heading">
              <div class="workspace-title-row">
                <h2 id="workspace-title">{{ ui.activeCategory === '全部' ? '全部工具' : ui.activeCategory }}</h2>
                <span class="workspace-eyebrow">WORKSPACE · 我的工具空间</span>
              </div>
              <p>集中管理常用网站与本地应用，拖拽即可调整顺序。</p>
            </div>

            <div class="workspace-header-actions">
              <BrowserExtensionEntry />
              <span class="result-count">{{ tools.getVisibleTools().length }} 个工具</span>
            </div>
          </div>

          <nav
            v-if="ui.sidebarCollapsed && !ui.isMobile"
            class="collapsed-category-nav"
            aria-label="工具分类"
          >
            <button
              v-for="(cat, idx) in collapsedCategories"
              :key="cat"
              type="button"
              :class="['collapsed-category-chip', { active: cat === ui.activeCategory }]"
              @click="ui.activeCategory = cat"
            >
              <span
                class="collapsed-category-dot"
                :style="{ background: cat === ui.activeCategory ? 'var(--accent)' : categoryColors[idx % categoryColors.length] }"
                aria-hidden="true"
              ></span>
              <span class="collapsed-category-label">{{ cat }}</span>
              <span class="collapsed-category-count">{{ tools.categoryCounts[cat] || 0 }}</span>
            </button>
          </nav>
        </div>
        <div class="workspace-grid">
          <ToolGrid
            @check-click="onCheckClick"
            @edit="onEdit"
            @delete="onDelete"
            @toggle-fav="onToggleFav"
          />
        </div>
      </section>
    </main>
  </div>

  <!-- 模态框 -->
  <ToolModal ref="toolModalRef" @saved="onToolSaved" />
  <ConfirmModal />
  <RenameModal />
  <ToastMessage />
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import type { Tool } from '@/types/tool'
import Sidebar from '@/components/layout/Sidebar.vue'
import Navbar from '@/components/layout/Navbar.vue'
import ToolGrid from '@/components/tools/ToolGrid.vue'
import ToolModal from '@/components/tools/ToolModal.vue'
import ConfirmModal from '@/components/common/ConfirmModal.vue'
import RenameModal from '@/components/common/RenameModal.vue'
import ToastMessage from '@/components/common/ToastMessage.vue'
import BrowserExtensionEntry from '@/components/browser/BrowserExtensionEntry.vue'

const tools = useToolsStore()
const ui = useUiStore()
const toolModalRef = ref<InstanceType<typeof ToolModal> | null>(null)
const categoryColors = ['#0071e3', '#5e5ce6', '#ff375f', '#34c759', '#ff9f0a', '#30b0c7']

const collapsedCategories = computed(() => {
  const all = ['全部', ...tools.categoryList]
  try {
    const stored = localStorage.getItem('gtb-cat-order')
    if (stored) {
      const order: string[] = JSON.parse(stored)
      const ordered = ['全部', ...order.filter(cat => cat !== '全部' && all.includes(cat))]
      for (const cat of all) {
        if (!ordered.includes(cat)) ordered.push(cat)
      }
      return ordered
    }
  } catch {}
  return all
})

const mobileCategoryLabels: Record<string, string> = {
  '全部': '全部',
  '本地硬核与系统辅助': '系统',
  '开发与极客工具': '开发',
  '科研与网络测试': '科研',
  '文档与图片处理': '文档',
  '制图与可视化': '制图',
  'AI 生产力工具': 'AI',
}

function mobileCategoryLabel(cat: string) {
  return mobileCategoryLabels[cat] || cat
}


// ========== 工具列表操作 ==========
function openAddModal() {
  toolModalRef.value?.openForAdd()
}

function onEdit(tool: Tool) {
  toolModalRef.value?.openForEdit(tool)
}

function onDelete(tool: Tool) {
  const name = tool.name
  if (tool.isCustom) {
    const idx = tools.customTools.indexOf(tool)
    if (idx !== -1) {
      ui.openConfirmModal('确认删除', `确定要删除自定义工具「${name}」吗？`, () => {
        tools.deleteCustomTool(idx)
        ui.showToast(`已删除自定义工具「${name}」`, () => tools.undoDelete())
      })
    }
  } else {
    const idx = tools.builtinTools.indexOf(tool)
    if (idx !== -1) {
      ui.openConfirmModal('确认删除', `确定要删除内置工具「${name}」吗？`, () => {
        tools.deleteBuiltinTool(idx)
        ui.showToast(`已删除内置工具「${name}」`, () => tools.undoDelete())
      })
    }
  }
}

function onCheckClick(key: string) {
  ui.toggleSelect(key)
}

function onToggleFav(key: string) {
  const wasFav = tools.favoriteTools.has(key)
  if (wasFav) {
    tools.toggleFavorite(key)
    ui.showToast('已取消收藏')
  } else {
    tools.toggleFavorite(key)
    ui.showToast('已添加到收藏')
  }
}

function toggleMobileSelectMode() {
  if (ui.selectMode) {
    ui.exitSelectMode()
    ui.showToast('已退出整理模式')
    return
  }
  ui.enterSelectMode()
  ui.showToast('整理模式已开启，可选择工具批量删除')
}

function toggleMobileFavorite() {
  ui.showOnlyFav = !ui.showOnlyFav
  ui.showToast(ui.showOnlyFav ? '仅显示收藏的工具' : '已显示全部工具')
}

function onBatchDelete() {
  if (ui.selectedSet.size === 0) {
    ui.showToast('未选中任何工具')
    return
  }

  const selectedItems: { tool: Tool; type: 'builtin' | 'custom' }[] = []
  for (const key of ui.selectedSet) {
    if (key.startsWith('builtin:')) {
      const name = key.slice(8)
      const t = tools.builtinTools.find(t => t.name === name)
      if (t) selectedItems.push({ tool: t, type: 'builtin' })
    } else if (key.startsWith('custom:')) {
      const name = key.slice(7)
      const t = tools.customTools.find(t => t.name === name)
      if (t) selectedItems.push({ tool: t, type: 'custom' })
    }
  }

  if (selectedItems.length === 0) {
    ui.showToast('未找到有效工具')
    return
  }

  let itemsHtml = ''
  selectedItems.forEach(item => {
    const smallIcon = tools.getSmallIconHtml(item.tool)
    itemsHtml += `<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:6px;">${smallIcon}<span>${tools.escapeHtml(item.tool.name)}</span></div>`
  })

  ui.openConfirmModal('确认删除', `确定要删除以下 ${selectedItems.length} 个工具吗？<br><br>${itemsHtml}<br>此操作不可撤销。`, () => {
    tools.batchDelete(ui.selectedSet)
    ui.exitSelectMode()
    ui.showToast(`已删除 ${selectedItems.length} 个工具`, () => tools.undoDelete())
  })
}

function onToolSaved() {
  // 工具保存后的处理
}

// ========== 导入/导出 ==========
function onExport() {
  const jsonStr = tools.exportData()
  const blob = new Blob([jsonStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `flexikit_tools_export_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
  ui.showToast('已导出工具数据')
}

function onImport() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const addedCount = tools.importData(evt.target?.result as string)
        ui.showToast(`导入成功，新增 ${addedCount} 个自定义工具`)
      } catch (err) {
        ui.showToast('导入失败：文件格式错误')
        console.error(err)
      }
    }
    reader.onerror = () => ui.showToast('读取文件失败')
    reader.readAsText(file)
  }
  input.click()
}

// ========== 键盘快捷键 ==========
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (ui.toolModalOpen) ui.closeToolModal()
    if (ui.renameModalOpen) ui.closeRenameModal()
    if (ui.confirmModalOpen) ui.closeConfirmModal()
    if (ui.selectMode) ui.exitSelectMode()
  }
}

onMounted(() => {
  tools.initData()
  ui.initTheme()
  document.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.workspace-page {
  width: 100%;
  max-width: none !important;
  margin: 0 !important;
  padding: clamp(14px, 1.25vw, 22px) clamp(18px, 1.8vw, 30px) 34px;
  gap: clamp(16px, 1.15vw, 20px);
}

.workspace-page > .main-content {
  width: 100%;
  max-width: none;
  min-width: 0;
  flex: 1 1 auto;
}

.workspace-page :deep(.sidebar-toggle:not(.fixed-mode)) {
  top: 22px;
  right: 16px;
  width: 30px;
  height: 30px;
}

/* 顶部导航：降低视觉重量，保留清晰层级 */
.workspace-page :deep(.top-navbar) {
  top: 10px;
  height: 50px;
  margin-bottom: 14px;
  padding: 6px 12px;
  border-radius: 18px;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 22%), transparent 48%),
    color-mix(in srgb, var(--glass-bg) 72%, var(--bg-primary) 28%);
  border-color: color-mix(in srgb, var(--glass-border) 82%, white 18%);
  box-shadow:
    0 10px 30px rgb(15 23 42 / 5%),
    inset 0 1px 0 rgb(255 255 255 / 28%);
  backdrop-filter: blur(22px) saturate(145%);
  -webkit-backdrop-filter: blur(22px) saturate(145%);
}

.workspace-page :deep(.nav-left) {
  gap: 10px;
}

.workspace-page :deep(.nav-logo-wrapper) {
  gap: 6px;
}

.workspace-page :deep(.nav-logo-img) {
  width: 26px;
  height: 26px;
  border-radius: 7px;
}

.workspace-page :deep(.nav-logo-text) {
  font-size: 1.05rem;
  font-weight: 720;
  letter-spacing: -.035em;
}

.workspace-page :deep(.nav-links) {
  gap: 2px;
}

.workspace-page :deep(.nav-link) {
  padding: 6px 10px;
  border-radius: 9px;
  font-size: .78rem;
  font-weight: 560;
}

.workspace-page :deep(.nav-right) {
  gap: 8px;
}

.workspace-page :deep(.nav-search-wrapper) {
  width: clamp(210px, 22vw, 300px);
}

.workspace-page :deep(#navSearchInput) {
  height: 34px;
  border-radius: 11px;
  font-size: .78rem;
  background:
    linear-gradient(145deg, rgb(255 255 255 / 12%), transparent 52%),
    color-mix(in srgb, var(--input-bg) 82%, var(--bg-primary) 18%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 14%);
}

.workspace-page :deep(.nav-control-cluster) {
  height: 38px;
  padding: 2px;
  border-radius: 13px;
  box-shadow:
    0 5px 16px rgb(15 23 42 / 4%),
    inset 0 1px 0 rgb(255 255 255 / 22%);
}

.workspace-page :deep(.nav-control-cluster .nav-icon.nav-glass-action) {
  width: 32px;
  min-width: 32px;
  height: 32px;
  border-radius: 10px;
}

.workspace-page :deep(.nav-control-cluster .nav-icon.favorite-action) {
  width: auto;
  min-width: 49px;
}

.workspace-page :deep(.nav-account-action) {
  min-height: 36px;
  padding-inline: 11px;
  border-radius: 12px;
  font-size: .76rem;
}

.workspace-content {
  width: 100%;
  padding: 0 2px 42px;
}

/* 工作台标题：标题与辅助信息分层，而不是挤在一条线上 */
.workspace-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: stretch;
  margin: 0 2px 12px;
  padding: 4px 2px 10px;
  gap: 9px;
  border-bottom: 1px solid color-mix(in srgb, var(--divider) 62%, transparent);
}

.workspace-header-primary {
  min-width: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}

.workspace-heading {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.workspace-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.workspace-eyebrow {
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 4px 7px;
  border: 1px solid color-mix(in srgb, var(--primary) 13%, var(--glass-border));
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 5%, transparent);
  color: color-mix(in srgb, var(--primary) 84%, var(--text-secondary));
  font-size: .57rem;
  font-weight: 720;
  letter-spacing: .075em;
  white-space: nowrap;
}

.workspace-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: clamp(1.35rem, 1.55vw, 1.62rem);
  font-weight: 710;
  letter-spacing: -.045em;
  line-height: 1.08;
}

.workspace-header p {
  margin: 0;
  color: var(--text-tertiary);
  font-size: .72rem;
  line-height: 1.45;
  white-space: nowrap;
}

.collapsed-category-nav {
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  padding: 7px 1px 1px;
  overflow-x: auto;
  overflow-y: hidden;
  border-top: 1px solid color-mix(in srgb, var(--divider) 46%, transparent);
  scrollbar-width: none;
  mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 14px), transparent 100%);
  -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 14px), transparent 100%);
}

.collapsed-category-nav::-webkit-scrollbar {
  display: none;
}

.collapsed-category-chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 30px;
  padding: 0 9px;
  border: 1px solid transparent;
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: .64rem;
  font-weight: 590;
  white-space: nowrap;
  cursor: pointer;
  transition:
    transform 260ms cubic-bezier(.25, .1, .25, 1),
    color 260ms cubic-bezier(.25, .1, .25, 1),
    background 260ms cubic-bezier(.25, .1, .25, 1),
    border-color 260ms cubic-bezier(.25, .1, .25, 1),
    box-shadow 260ms cubic-bezier(.25, .1, .25, 1);
}

.collapsed-category-chip:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--primary) 5%, transparent);
}

.collapsed-category-chip:active {
  transform: scale(.98);
}

.collapsed-category-chip.active {
  border-color: color-mix(in srgb, var(--primary) 17%, var(--glass-border));
  background:
    linear-gradient(145deg, rgb(255 255 255 / 20%), transparent 58%),
    color-mix(in srgb, var(--primary) 7%, var(--glass-bg));
  color: var(--primary);
  box-shadow:
    0 4px 12px color-mix(in srgb, var(--primary) 7%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 20%);
}

.collapsed-category-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  box-shadow: 0 0 0 3px color-mix(in srgb, currentColor 4%, transparent);
}

.collapsed-category-label {
  max-width: 10rem;
  overflow: hidden;
  text-overflow: ellipsis;
}

.collapsed-category-count {
  color: var(--text-tertiary);
  font-size: .56rem;
  font-variant-numeric: tabular-nums;
}

.collapsed-category-chip.active .collapsed-category-count {
  color: color-mix(in srgb, var(--primary) 62%, var(--text-tertiary));
}

.workspace-header-actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 7px;
}

.workspace-header .result-count {
  flex: 0 0 auto;
  min-height: 34px;
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border: 1px solid color-mix(in srgb, var(--glass-border) 82%, white 18%);
  border-radius: 12px;
  background: color-mix(in srgb, var(--glass-bg) 74%, transparent);
  color: var(--text-tertiary);
  font-size: .67rem;
  font-weight: 590;
  font-variant-numeric: tabular-nums;
  backdrop-filter: blur(14px) saturate(135%);
  -webkit-backdrop-filter: blur(14px) saturate(135%);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 18%);
}

/* 工具网格：提高利用率和信息密度 */
.workspace-grid :deep(.cards-grid) {
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)) !important;
  gap: clamp(8px, .7vw, 11px);
  padding-bottom: 52px;
  align-items: stretch;
}

.workspace-grid :deep(.tool-card) {
  min-height: 108px;
  padding: 11px 12px 10px;
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  grid-template-rows: auto auto auto;
  column-gap: 9px;
  row-gap: 5px;
  border-radius: 14px;
  border-color: color-mix(in srgb, var(--glass-border) 82%, white 18%);
  background:
    linear-gradient(145deg, rgb(255 255 255 / 18%), transparent 44%),
    color-mix(in srgb, var(--glass-bg) 74%, var(--bg-primary) 26%) !important;
  box-shadow:
    0 7px 22px rgb(15 23 42 / 4.5%),
    inset 0 1px 0 rgb(255 255 255 / 22%);
  transition:
    transform 280ms cubic-bezier(.25, .1, .25, 1),
    border-color 280ms cubic-bezier(.25, .1, .25, 1),
    box-shadow 280ms cubic-bezier(.25, .1, .25, 1),
    background 280ms cubic-bezier(.25, .1, .25, 1);
}

.workspace-grid :deep(.tool-card.has-card-color) {
  background:
    radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--card-custom-bg) 10%, transparent), transparent 46%),
    linear-gradient(145deg, rgb(255 255 255 / 16%), transparent 46%),
    color-mix(in srgb, var(--glass-bg) 76%, var(--bg-primary) 24%) !important;
  border-color: color-mix(in srgb, var(--card-custom-bg) 9%, var(--glass-border)) !important;
}

.workspace-grid :deep(.tool-card::before) {
  border-radius: 14px;
  background: linear-gradient(135deg, rgb(255 255 255 / 14%) 0%, transparent 40%);
}

.workspace-grid :deep(.tool-card:hover) {
  transform: translateY(-1px) scale(1.003);
  border-color: color-mix(in srgb, var(--primary) 18%, var(--glass-border));
  background:
    linear-gradient(145deg, rgb(255 255 255 / 24%), transparent 46%),
    color-mix(in srgb, var(--card-hover-bg) 64%, var(--bg-primary) 36%) !important;
  box-shadow:
    0 13px 30px rgb(15 23 42 / 7%),
    0 4px 14px color-mix(in srgb, var(--primary) 4%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 28%);
}

.workspace-grid :deep(.tool-card.has-card-color:hover) {
  background:
    radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--card-custom-bg) 14%, transparent), transparent 48%),
    linear-gradient(145deg, rgb(255 255 255 / 22%), transparent 46%),
    color-mix(in srgb, var(--card-hover-bg) 68%, var(--bg-primary) 32%) !important;
  filter: none;
}

.workspace-grid :deep(.card-icon) {
  grid-column: 1;
  grid-row: 1;
  width: 32px;
  height: 32px;
  padding: 3px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--accent-soft) 68%, transparent);
}

.workspace-grid :deep(.card-body) {
  grid-column: 2;
  grid-row: 1;
  min-width: 0;
  align-self: center;
  padding-right: 38px;
}

.workspace-grid :deep(.card-name),
.workspace-grid :deep(.tool-card.has-card-color .card-name) {
  margin-bottom: 2px;
  color: var(--text-primary) !important;
  font-size: .80rem;
  font-weight: 670;
  letter-spacing: -.018em;
  line-height: 1.28;
  text-shadow: none !important;
}

.workspace-grid :deep(.card-desc),
.workspace-grid :deep(.tool-card.has-card-color .card-desc) {
  color: var(--text-secondary) !important;
  font-size: .64rem;
  line-height: 1.35;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.workspace-grid :deep(.card-tags) {
  grid-column: 1 / -1;
  grid-row: 2;
  min-width: 0;
  flex-wrap: nowrap;
  gap: 4px;
  margin-top: 1px;
  padding-right: 28px;
  overflow: hidden;
}

.workspace-grid :deep(.card-tag:nth-of-type(n + 4)) {
  display: none;
}

.workspace-grid :deep(.card-tag),
.workspace-grid :deep(.tool-card.has-card-color .card-tag) {
  flex: 0 0 auto;
  padding: 3px 7px;
  border: 1px solid color-mix(in srgb, var(--primary) 8%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 5.5%, transparent) !important;
  color: color-mix(in srgb, var(--primary) 68%, var(--text-secondary)) !important;
  font-size: .56rem;
  font-weight: 590;
  line-height: 1;
}

.workspace-grid :deep(.card-url-hint),
.workspace-grid :deep(.tool-card.has-card-color .card-url-hint) {
  grid-column: 1 / -1;
  grid-row: 3;
  padding-right: 26px;
  color: var(--text-tertiary) !important;
  font-size: .55rem;
  line-height: 1.15;
}

.workspace-grid :deep(.card-fav-btn) {
  right: 10px;
  bottom: 9px;
  width: 26px;
  height: 26px;
}

.workspace-grid :deep(.card-fav-btn svg) {
  width: 17px;
  height: 17px;
}

.workspace-grid :deep(.card-actions) {
  top: 10px;
  right: 10px;
  gap: 4px;
}

.workspace-grid :deep(.card-action-btn) {
  width: 27px;
  height: 27px;
  border-radius: 9px;
  background: color-mix(in srgb, var(--glass-bg) 76%, transparent);
  box-shadow: 0 4px 12px rgb(15 23 42 / 5%);
}

:global([data-theme="dark"]) .workspace-page :deep(.top-navbar),
:global([data-theme="dark"]) .workspace-page :deep(.tool-card) {
  border-color: rgb(255 255 255 / 6.5%);
  box-shadow:
    0 10px 30px rgb(0 0 0 / 14%),
    inset 0 1px 0 rgb(255 255 255 / 5%);
}

:global([data-theme="dark"]) .workspace-grid :deep(.tool-card) {
  background:
    linear-gradient(145deg, rgb(255 255 255 / 3.8%), transparent 46%),
    color-mix(in srgb, var(--glass-bg) 88%, #0b1018 12%) !important;
}

:global([data-theme="dark"]) .workspace-grid :deep(.tool-card.has-card-color) {
  background:
    radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--card-custom-bg) 9%, transparent), transparent 47%),
    linear-gradient(145deg, rgb(255 255 255 / 3.8%), transparent 46%),
    color-mix(in srgb, var(--glass-bg) 90%, #0a1018 10%) !important;
}

@media (min-width: 1600px) {
  .workspace-grid :deep(.cards-grid) {
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)) !important;
  }
}

@media (max-width: 1280px) {
  .collapsed-category-chip {
    padding-inline: 8px;
  }

  .collapsed-category-count {
    display: none;
  }
}

@media (max-width: 1120px) {
  .workspace-page :deep(.nav-search-wrapper) {
    width: 190px;
  }

  .workspace-page :deep(.nav-link) {
    padding-inline: 8px;
  }

  .workspace-grid :deep(.cards-grid) {
    grid-template-columns: repeat(auto-fit, minmax(195px, 1fr)) !important;
  }
}

.mobile-workspace-header {
  display: none;
}

@media (max-width: 860px) {
  .workspace-page {
    padding: 12px;
    gap: 12px;
  }

  .workspace-page :deep(.sidebar-toggle) {
    display: none !important;
  }

  .workspace-page :deep(.top-navbar.visible) {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
  }

  .workspace-page :deep(.top-navbar.visible .nav-left) {
    justify-content: flex-start;
  }

  .workspace-page :deep(.top-navbar.visible .nav-links) {
    display: none !important;
  }

  .workspace-page :deep(.top-navbar.visible .nav-right) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
  }

  .workspace-page :deep(.top-navbar.visible .theme-action),
  .workspace-page :deep(.top-navbar.visible .favorite-action) {
    display: none !important;
  }

  .workspace-page :deep(.top-navbar.visible .nav-control-cluster) {
    width: 36px;
    min-width: 36px;
    padding: 1px;
  }

  .workspace-page :deep(.top-navbar.visible .nav-control-cluster .settings-action) {
    width: 32px;
    min-width: 32px;
    height: 32px;
  }

  .mobile-workspace-header {
    display: grid;
    gap: 8px;
    margin: 0 1px 10px;
    padding: 0 1px 10px;
    border-bottom: 1px solid color-mix(in srgb, var(--divider) 58%, transparent);
  }

  .mobile-workspace-title-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 14px;
  }

  .mobile-workspace-heading {
    min-width: 0;
  }

  .mobile-workspace-heading h2 {
    margin: 0;
    color: var(--text-primary);
    font-size: 1.28rem;
    line-height: 1.05;
    letter-spacing: -.04em;
  }

  .mobile-workspace-count {
    flex: 0 0 auto;
    min-width: 32px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0 9px;
    border: 1px solid color-mix(in srgb, var(--glass-border) 84%, white 16%);
    border-radius: 10px;
    background: color-mix(in srgb, var(--glass-bg) 76%, transparent);
    color: var(--text-tertiary);
    font-size: .66rem;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }

  .mobile-category-strip {
    display: flex;
    gap: 5px;
    width: 100%;
    overflow-x: auto;
    padding: 0 16px 2px 0;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 18px), transparent 100%);
    -webkit-mask-image: linear-gradient(90deg, #000 0, #000 calc(100% - 18px), transparent 100%);
  }

  .mobile-category-strip::-webkit-scrollbar {
    display: none;
  }

  .mobile-category-chip {
    flex: 0 0 auto;
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 9px;
    border: 1px solid color-mix(in srgb, var(--glass-border) 84%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--glass-bg) 64%, transparent);
    color: var(--text-secondary);
    font-size: .63rem;
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transition: transform 240ms cubic-bezier(.25,.1,.25,1), background 240ms cubic-bezier(.25,.1,.25,1), border-color 240ms cubic-bezier(.25,.1,.25,1), color 240ms cubic-bezier(.25,.1,.25,1);
  }

  .mobile-category-chip.active {
    border-color: color-mix(in srgb, var(--primary) 22%, var(--glass-border));
    background: color-mix(in srgb, var(--primary) 8%, var(--glass-bg));
    color: var(--primary);
  }

  .mobile-category-chip:active {
    transform: scale(.97);
  }

  .mobile-category-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
  }

  .mobile-workspace-controls {
    display: grid;
    grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr);
    align-items: center;
    gap: 6px;
  }

  .mobile-type-filter {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
    padding: 2px;
    border: 1px solid color-mix(in srgb, var(--glass-border) 84%, transparent);
    border-radius: 11px;
    background: color-mix(in srgb, var(--glass-bg) 62%, transparent);
  }

  .mobile-type-filter button {
    min-width: 0;
    min-height: 28px;
    padding: 0 6px;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--text-tertiary);
    font: inherit;
    font-size: .62rem;
    font-weight: 620;
    cursor: pointer;
  }

  .mobile-type-filter button.active {
    background: color-mix(in srgb, var(--primary) 9%, white 22%);
    color: var(--primary);
    box-shadow: inset 0 1px 0 rgb(255 255 255 / 24%);
  }

  .mobile-quick-actions {
    min-width: 0;
    display: flex;
    justify-content: flex-end;
    gap: 5px;
  }

  .mobile-action {
    min-width: 0;
    min-height: 34px;
    padding: 0 7px;
    border: 1px solid color-mix(in srgb, var(--glass-border) 84%, transparent);
    border-radius: 11px;
    background: color-mix(in srgb, var(--glass-bg) 68%, transparent);
    color: var(--text-secondary);
    font: inherit;
    font-size: .61rem;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    cursor: pointer;
    transition: transform 240ms cubic-bezier(.25,.1,.25,1), background 240ms cubic-bezier(.25,.1,.25,1), border-color 240ms cubic-bezier(.25,.1,.25,1), color 240ms cubic-bezier(.25,.1,.25,1);
  }

  .mobile-action.primary,
  .mobile-action.active {
    border-color: color-mix(in srgb, var(--primary) 22%, var(--glass-border));
    background: color-mix(in srgb, var(--primary) 8%, var(--glass-bg));
    color: var(--primary);
  }

  .mobile-action.danger {
    color: var(--danger);
    border-color: color-mix(in srgb, var(--danger) 18%, var(--glass-border));
    background: color-mix(in srgb, var(--danger) 6%, var(--glass-bg));
  }

  .mobile-action:active {
    transform: scale(.97);
  }

  .workspace-page :deep(.top-navbar.visible) {
    height: auto;
    min-height: 50px;
    margin-bottom: 16px;
    padding: 8px 10px;
    align-items: stretch;
    gap: 8px;
    overflow: visible;
    background:
      linear-gradient(145deg, rgb(255 255 255 / 30%), transparent 48%),
      color-mix(in srgb, var(--glass-bg) 88%, var(--bg-primary) 12%);
    box-shadow:
      0 12px 32px rgb(15 23 42 / 8%),
      inset 0 1px 0 rgb(255 255 255 / 34%);
    backdrop-filter: blur(28px) saturate(155%);
    -webkit-backdrop-filter: blur(28px) saturate(155%);
  }

  .workspace-page :deep(.top-navbar.visible .nav-left) {
    width: 100%;
    min-width: 0;
    justify-content: space-between;
    gap: 8px;
  }

  .workspace-page :deep(.top-navbar.visible .nav-links) {
    min-width: 0;
    margin-left: auto;
  }

  .workspace-page :deep(.top-navbar.visible .nav-right) {
    width: 100%;
    min-width: 0;
    gap: 6px;
  }

  .workspace-page :deep(.top-navbar.visible .nav-search-wrapper) {
    width: auto;
    min-width: 120px;
    flex: 1 1 auto;
  }

  .workspace-page :deep(.top-navbar.visible .nav-control-cluster),
  .workspace-page :deep(.top-navbar.visible .nav-account-action) {
    flex: 0 0 auto;
  }

  .workspace-content {
    padding: 4px 0 32px;
  }

  .workspace-header {
    margin-inline: 1px;
    gap: 10px;
  }

  .workspace-header-primary {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: stretch;
    gap: 9px;
  }

  .workspace-heading {
    width: 100%;
    min-width: 0;
  }

  .workspace-header-actions {
    width: 100%;
    margin-left: 0;
    justify-content: flex-end;
  }

  .workspace-title-row {
    flex-wrap: wrap;
    gap: 7px 9px;
  }

  .workspace-header h2 {
    white-space: nowrap;
  }

  .workspace-header p {
    max-width: 100%;
    white-space: normal;
  }

  .workspace-grid :deep(.cards-grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
}

@media (max-width: 640px) {
  .workspace-page :deep(.top-navbar.visible) {
    margin-bottom: 12px;
    padding: 6px 8px;
    gap: 6px;
  }

  .workspace-page :deep(.top-navbar.visible .nav-right) {
    gap: 4px;
  }

  .workspace-page :deep(.top-navbar.visible .nav-logo-img) {
    width: 24px;
    height: 24px;
  }

  .workspace-page :deep(.top-navbar.visible .nav-logo-text) {
    font-size: .98rem;
  }

  .workspace-page :deep(.top-navbar.visible #navSearchInput) {
    height: 32px;
    padding-left: 32px;
    font-size: .76rem;
  }

  .workspace-page :deep(.top-navbar.visible .nav-search-wrapper .search-icon) {
    left: 10px;
    width: 14px;
    height: 14px;
  }

  .workspace-page :deep(.top-navbar.visible .nav-control-cluster) {
    height: 34px;
  }

  .workspace-page :deep(.top-navbar.visible .nav-account-action) {
    min-height: 32px;
    padding-inline: 8px;
    font-size: .72rem;
  }

  .workspace-header {
    padding-top: 2px;
  }

  .workspace-header-actions {
    justify-content: space-between;
  }

  .workspace-eyebrow {
    max-width: 100%;
  }

  .mobile-workspace-controls {
    grid-template-columns: minmax(0, .92fr) minmax(0, 1.08fr);
    gap: 6px;
  }

  .mobile-type-filter,
  .mobile-quick-actions {
    width: 100%;
    min-width: 0;
  }

  .mobile-type-filter button,
  .mobile-action {
    flex: 1 1 0;
  }

  .mobile-quick-actions {
    justify-content: stretch;
  }

  .workspace-content {
    padding-top: 0;
  }

  .workspace-grid :deep(.cards-grid) {
    grid-template-columns: 1fr !important;
    gap: 8px;
  }

  .workspace-grid :deep(.tool-card) {
    min-height: 96px;
    padding: 9px 11px 8px;
    grid-template-columns: 30px minmax(0, 1fr);
    column-gap: 8px;
    row-gap: 4px;
  }

  .workspace-grid :deep(.card-icon) {
    width: 30px;
    height: 30px;
    padding: 3px;
  }

  .workspace-grid :deep(.card-name),
  .workspace-grid :deep(.tool-card.has-card-color .card-name) {
    font-size: .78rem;
  }

  .workspace-grid :deep(.card-desc),
  .workspace-grid :deep(.tool-card.has-card-color .card-desc) {
    font-size: .61rem;
    line-height: 1.3;
  }
}

@media (max-width: 560px) {
  .workspace-header {
    display: grid;
    grid-template-columns: 1fr;
  }

  .workspace-header-actions {
    width: 100%;
    margin-left: 0;
    justify-content: space-between;
  }

  .workspace-grid :deep(.tool-card) {
    min-height: 96px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .mobile-category-chip,
  .mobile-action { transition-duration: 1ms !important; }
  .collapsed-category-chip {
    transition-duration: 1ms !important;
  }

  .workspace-grid :deep(.tool-card),
  .workspace-grid :deep(.tool-card:hover) {
    transform: none !important;
  }
}
</style>
