<template>
  <div>
    <!-- 无结果 -->
    <div v-if="visibleTools.length === 0" class="no-results" style="display:block">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/><line x1="8" y1="8" x2="14" y2="14"/><line x1="14" y1="8" x2="8" y2="14"/></svg>
      <p>没有找到匹配的工具</p>
    </div>

    <div v-else class="cards-grid" ref="gridRef">
      <ToolCard
        v-for="tool in visibleTools"
        :key="getKey(tool)"
        :tool="tool"
        @check-click="onCheckClick"
        @edit="onEdit"
        @delete="onDelete"
        @toggle-fav="onToggleFav"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import Sortable from 'sortablejs'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import type { Tool } from '@/types/tool'
import ToolCard from './ToolCard.vue'

const tools = useToolsStore()
const ui = useUiStore()

const gridRef = ref<HTMLElement | null>(null)
let cardSortable: Sortable | null = null

const visibleTools = computed(() => tools.getVisibleTools())

function getKey(tool: Tool): string {
  return (tool.isCustom ? 'custom:' : 'builtin:') + tool.name
}

// ========== 事件转发 ==========
const emit = defineEmits<{
  'check-click': [key: string]
  'edit': [tool: Tool]
  'delete': [tool: Tool]
  'toggle-fav': [key: string]
}>()

function onCheckClick(key: string) { emit('check-click', key) }
function onEdit(tool: Tool) { emit('edit', tool) }
function onDelete(tool: Tool) { emit('delete', tool) }
function onToggleFav(key: string) { emit('toggle-fav', key) }

function disableNativeCardDrag() {
  if (!gridRef.value) return
  gridRef.value.querySelectorAll<HTMLElement>('.tool-card').forEach(card => {
    card.draggable = false
    card.setAttribute('draggable', 'false')
  })
}

function preventNativeToolDrag(event: DragEvent) {
  const target = event.target
  if (target instanceof Element && target.closest('.tool-card')) {
    event.preventDefault()
  }
}

function clearToolSortState() {
  if (!document.documentElement.classList.contains('tool-sort-active')) return
  document.documentElement.classList.remove('tool-sort-active')
  window.dispatchEvent(new Event('flexikit-tool-drag-end'))
}

// ========== SortableJS ==========
function initSortable() {
  if (!gridRef.value) return
  disableNativeCardDrag()
  gridRef.value.removeEventListener('dragstart', preventNativeToolDrag, true)
  gridRef.value.addEventListener('dragstart', preventNativeToolDrag, true)
  if (cardSortable) cardSortable.destroy()
  cardSortable = new Sortable(gridRef.value, {
    animation: 200,
    handle: '.tool-card',
    draggable: '.tool-card',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 6,
    swapThreshold: 0.65,
    ghostClass: 'tool-card-drag-ghost',
    chosenClass: 'tool-card-drag-chosen',
    dragClass: 'tool-card-dragging',
    onStart: () => {
      document.documentElement.classList.add('tool-sort-active')
      window.dispatchEvent(new Event('flexikit-tool-drag-start'))
    },
    onEnd: () => {
      clearToolSortState()
      const cards = gridRef.value!.querySelectorAll<HTMLElement>('.tool-card')
      const toolByKey = new Map(tools.allTools.map(tool => [tools.getToolKey(tool), tool]))
      const newOrder = Array.from(cards)
        .map(card => card.dataset.toolKey ? toolByKey.get(card.dataset.toolKey) : undefined)
        .filter((tool): tool is Tool => tool !== undefined)
      tools.reorderTools(newOrder)
    }
  })
}

watch(visibleTools, () => {
  nextTick(initSortable)
}, { deep: false })

onMounted(() => {
  nextTick(initSortable)
  window.addEventListener('pointerup', clearToolSortState, true)
  window.addEventListener('pointercancel', clearToolSortState, true)
  window.addEventListener('blur', clearToolSortState)
})

onUnmounted(() => {
  clearToolSortState()
  window.removeEventListener('pointerup', clearToolSortState, true)
  window.removeEventListener('pointercancel', clearToolSortState, true)
  window.removeEventListener('blur', clearToolSortState)
  gridRef.value?.removeEventListener('dragstart', preventNativeToolDrag, true)
  if (cardSortable) cardSortable.destroy()
})
</script>
