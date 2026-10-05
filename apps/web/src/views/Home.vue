<template>
  <div class="app-layout workspace-page" :style="{ '--grid-columns': ui.effectiveGridColumns }">
    <Sidebar
      @open-add-modal="openAddModal"
      @batch-delete="onBatchDelete"
      @export-data="onExport"
      @import-data="onImport"
    />
    <main class="main-content">
      <Navbar />
      <section class="workspace-content" aria-labelledby="workspace-title">
        <div class="content-header workspace-header">
          <div class="workspace-heading">
            <span class="workspace-eyebrow">WORKSPACE · 我的工具空间</span>
            <h2 id="workspace-title">{{ ui.activeCategory === '全部' ? '全部工具' : ui.activeCategory }}</h2>
            <p>集中管理常用网站与本地应用，拖拽即可调整顺序。</p>
          </div>
          <span class="result-count">{{ tools.getVisibleTools().length }} 个工具</span>
        </div>
        <BrowserExtensionEntry />
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
import { ref, onMounted, onUnmounted } from 'vue'
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
  max-width: none;
  margin: 0;
  padding: clamp(12px, 1vw, 18px);
  gap: clamp(16px, 1.2vw, 20px);
}

.workspace-page :deep(.sidebar-toggle:not(.fixed-mode)) {
  top: 24px;
  right: 16px;
  width: 32px;
  height: 32px;
}

.workspace-content {
  padding: 0 2px 40px;
}

.workspace-header {
  align-items: center;
  margin: 0 2px 10px;
  padding: 2px 2px 10px;
  border-bottom: 1px solid color-mix(in srgb, var(--divider) 72%, transparent);
}

.workspace-heading {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.workspace-eyebrow {
  display: inline-flex;
  align-items: center;
  margin: 0;
  padding: 5px 8px;
  border: 1px solid color-mix(in srgb, var(--primary) 18%, var(--glass-border));
  border-radius: 999px;
  background: linear-gradient(145deg, rgb(255 255 255 / 20%), transparent 54%), var(--primary-light);
  box-shadow: 0 5px 16px color-mix(in srgb, var(--primary) 6%, transparent), inset 0 1px 0 rgb(255 255 255 / 24%);
  backdrop-filter: blur(14px) saturate(145%);
  -webkit-backdrop-filter: blur(14px) saturate(145%);
  color: var(--primary);
  font-size: .61rem;
  font-weight: 750;
  letter-spacing: .08em;
  white-space: nowrap;
  order: 2;
}

.workspace-header h2 {
  margin: 0;
  font-size: clamp(1.35rem, 1.7vw, 1.65rem);
  letter-spacing: -.035em;
  order: 1;
}

.workspace-header p {
  margin: 0;
  padding-left: 12px;
  border-left: 1px solid var(--divider);
  color: var(--text-secondary);
  font-size: .76rem;
  line-height: 1.4;
  white-space: nowrap;
  order: 3;
}

.workspace-header .result-count {
  flex: 0 0 auto;
  padding: 6px 10px;
  border: 1px solid color-mix(in srgb, white 16%, var(--glass-border));
  border-radius: 999px;
  background: linear-gradient(145deg, rgb(255 255 255 / 18%), transparent 52%), color-mix(in srgb, var(--glass-bg) 78%, transparent);
  backdrop-filter: blur(16px) saturate(150%);
  -webkit-backdrop-filter: blur(16px) saturate(150%);
  box-shadow: 0 6px 18px rgb(15 23 42 / 5%), inset 0 1px 0 rgb(255 255 255 / 22%);
}

:global([data-theme="dark"]) .workspace-eyebrow {
  background: linear-gradient(145deg, rgb(255 255 255 / 4.5%), transparent 54%), color-mix(in srgb, var(--primary) 7%, transparent);
  border-color: color-mix(in srgb, var(--primary) 19%, rgb(255 255 255 / 4%));
  box-shadow: 0 5px 16px rgb(0 0 0 / 8%), inset 0 1px 0 rgb(255 255 255 / 6%);
}

:global([data-theme="dark"]) .workspace-header .result-count {
  background: linear-gradient(145deg, rgb(255 255 255 / 4%), transparent 52%), rgb(255 255 255 / 2%);
  border-color: rgb(255 255 255 / 6.5%);
  box-shadow: 0 6px 18px rgb(0 0 0 / 10%), inset 0 1px 0 rgb(255 255 255 / 5%);
}

.workspace-grid :deep(.cards-grid) {
  gap: clamp(14px, 1.25vw, 18px);
  padding-bottom: 48px;
}

@media (max-width: 860px) {
  .workspace-page {
    padding: 12px;
    gap: 12px;
  }

  .workspace-content {
    padding: 6px 0 32px;
  }

  .workspace-header {
    align-items: flex-start;
    margin-inline: 2px;
  }

  .workspace-heading {
    flex-wrap: wrap;
    gap: 8px 10px;
  }

  .workspace-header p {
    width: 100%;
    padding-left: 0;
    border-left: 0;
    white-space: normal;
  }
}

@media (max-width: 560px) {
  .workspace-header p {
    max-width: 27rem;
  }

  .workspace-header .result-count {
    padding: 6px 10px;
  }
}
</style>
