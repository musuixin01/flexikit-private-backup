<template>
  <component
    :is="isLocal || desktopRuntime ? 'div' : 'a'"
    :class="['tool-card', cardClasses]"
    :style="cardStyle"
    :href="isLocal || desktopRuntime ? undefined : tool.url"
    :target="isLocal || desktopRuntime || selectMode ? undefined : '_blank'"
    :rel="isLocal || desktopRuntime || selectMode ? undefined : 'noopener'"
    :data-tool-name="tool.name"
    :data-tool-cat="tool.cat"
    :data-tool-key="toolKey"
    draggable="false"
    ref="cardRef"
    @click="onCardClick"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @mouseenter="onPopupMouseEnter"
    @mouseleave="onPopupMouseLeave"
  >
    <!-- 多选勾选框 -->
    <div
      v-if="selectMode"
      :class="['card-check', { checked: isChecked }]"
      @click.stop.prevent="onCheckClick"
      role="checkbox"
      :aria-checked="isChecked"
    ></div>

    <!-- 操作按钮（hover 显示） -->
    <div v-if="!selectMode" class="card-actions">
      <template v-if="mode === 'discovery'">
        <!-- 发现页：添加按钮 -->
        <button class="card-action-btn add" @click.stop.prevent="onAdd" aria-label="添加到我的工具箱">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </template>
      <template v-else>
        <!-- 普通模式：编辑和删除按钮 -->
        <button class="card-action-btn" @click.stop.prevent="onEdit" aria-label="编辑">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="card-action-btn danger" @click.stop.prevent="onDelete" aria-label="删除">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </template>
    </div>

    <!-- 图标 -->
    <div class="card-icon" style="--card-icon-bg:var(--color-icon-bg)">
      <ToolIcon :tool="tool" />
    </div>

    <!-- 名称 + 描述 -->
    <div class="card-body">
      <div class="card-name">
        {{ tool.name }}
        <span v-if="isLocal" class="card-local-tag">本地</span>
        <span v-if="tool.isCustom" class="card-custom-badge">自定义</span>
      </div>
      <div class="card-desc">{{ tool.desc }}</div>
      <div
        v-if="mode === 'discovery' && recommendationReason"
        class="card-recommendation-reason"
        :title="recommendationReason"
      >
        <span class="card-recommendation-dot" aria-hidden="true"></span>
        <span>{{ recommendationReason }}</span>
      </div>
    </div>

    <!-- 标签 + 收藏（始终显示，未登录点击会提示登录） -->
    <div class="card-tags">
       <span v-for="tag in tool.tags" :key="tag" class="card-tag" style="--card-tag-bg:var(--color-tag-bg);--card-tag-text:var(--color-tag-text)">{{ tag }}</span>
      
      <!-- ✅ 移除 v-if，让按钮始终可见 -->
      <button
        :class="['card-fav-btn', { active: isFav }]"
        @click.stop.prevent="onToggleFav"
        :aria-label="isFav ? '取消收藏' : '收藏'"
        :title="isFav ? '取消收藏' : '收藏'"
        :aria-pressed="isFav"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
      </button>
    </div>

    <!-- 底部提示 -->
    <div class="card-url-hint">
      <template v-if="isLocal">
        <span class="local-icon-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
            <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
          </svg>
        </span>
        <span class="local-path-text">{{ shortLocalPath }}</span>
      </template>
      <template v-else>{{ hostname }}</template>
    </div>

    <!-- 详细信息面板占位 -->
    <div v-if="false" class="detail-panel-placeholder"></div>

    <!-- 官网首页预览（Teleport 到 body，避免被卡片网格裁切） -->
    <Teleport to="body">
      <Transition name="site-preview">
        <div
          v-if="showDetailPopup && previewUrl"
          class="detail-popup site-preview-popup"
          :style="popupStyle"
          @click.stop.prevent
          @mouseenter="onPopupMouseEnter"
          @mouseleave="onPopupMouseLeave"
        >
        <div class="preview-toolbar">
          <span class="preview-window-dots" aria-hidden="true">
            <i></i><i></i><i></i>
          </span>
          <span class="preview-address" :title="previewUrl">{{ hostname }}</span>
          <a :href="previewUrl" target="_blank" rel="noopener" class="preview-open-link" @click.stop>
            打开官网
          </a>
        </div>

        <div
          class="preview-viewport"
          :style="websitePreview?.themeColor ? { '--preview-theme': websitePreview.themeColor } : undefined"
        >
          <div v-if="previewLoading" class="preview-loading">
            <ToolIcon :tool="tool" />
            <span>正在加载官网首页…</span>
          </div>
          <img
            v-else-if="websitePreview?.imageUrl && !previewImageFailed"
            class="preview-cover"
            :src="websitePreview.imageUrl"
            :alt="`${websitePreview.title} 官网预览`"
            referrerpolicy="no-referrer"
            @error="previewImageFailed = true"
          />
          <div v-else class="preview-details">
            <div class="preview-details-header">
              <div class="preview-fallback-icon"><ToolIcon :tool="tool" /></div>
              <div class="preview-details-title">
                <strong>{{ websitePreview?.title || tool.name }}</strong>
                <span>{{ hostname }}</span>
              </div>
              <span v-if="previewFailed || previewImageFailed" class="preview-unavailable-badge">
                详情模式
              </span>
            </div>
            <p class="preview-details-description">
              {{ websitePreview?.description || tool.desc || '该网站暂未提供页面预览，可点击右上角打开官网查看完整内容。' }}
            </p>
            <div class="preview-details-meta">
              <span v-if="tool.cat" class="preview-category">{{ tool.cat }}</span>
              <span v-for="tag in tool.tags.slice(0, 4)" :key="tag" class="preview-detail-tag">
                #{{ tag }}
              </span>
            </div>
          </div>
        </div>

        <div class="preview-footer">
          <div class="preview-tool-icon"><ToolIcon :tool="tool" /></div>
          <div class="preview-tool-info">
            <strong>{{ websitePreview?.title || tool.name }}</strong>
            <span>{{ websitePreview?.description || tool.desc || '访问官网查看详细信息' }}</span>
          </div>
          <button v-if="mode === 'discovery'" class="preview-add-btn" @click.stop.prevent="onAdd">
            添加
          </button>
        </div>
        <p class="preview-hint">静态预览来自官网公开信息，点击“打开官网”访问完整页面。</p>
        </div>
      </Transition>
    </Teleport>

    <div 
      v-if="false"
      class="detail-panel"
      @click.stop.prevent
    >
        <div class="detail-header">
          <div class="detail-icon"><ToolIcon :tool="tool" /></div>
          <div class="detail-title">
            <h3>{{ tool.name }}</h3>
            <span class="detail-source">{{ sourceLabel }}</span>
          </div>
        </div>
        <div class="detail-body">
          <p class="detail-desc">{{ tool.desc }}</p>
          <div class="detail-meta">
            <div class="meta-item">
              <span class="meta-label">分类</span>
              <span class="meta-value">{{ tool.cat }}</span>
            </div>
            <div class="meta-item" v-if="tool.hotScore">
              <span class="meta-label">热度</span>
              <span class="meta-value hot">🔥 {{ tool.hotScore }}</span>
            </div>
            <div class="meta-item" v-if="tool.upvotes">
              <span class="meta-label">点赞</span>
              <span class="meta-value">{{ tool.upvotes }}</span>
            </div>
            <div class="meta-item" v-if="tool.comments">
              <span class="meta-label">评论</span>
              <span class="meta-value">{{ tool.comments }}</span>
            </div>
          </div>
          <div class="detail-tags" v-if="tool.tags && tool.tags.length > 0">
            <span class="detail-tag" v-for="tag in tool.tags" :key="tag">{{ tag }}</span>
          </div>
        </div>
        <div class="detail-footer">
          <button class="detail-add-btn" @click.stop.prevent="onAdd">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            添加到工具箱
          </button>
          <a :href="tool.url" target="_blank" rel="noopener" class="detail-link" @click.stop>
            访问官网 →
          </a>
        </div>
      </div>
  </component>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { toolsApi } from '@/api/tools'
import { isDesktopRuntime } from '@/api/runtime'
import { statsApi } from '@/api/stats'
import type { Tool, WebsitePreview } from '@/types/tool'
import { recordToolUsage } from '@/utils/toolUsage'
import { openDesktopTool } from '@/desktop/openTool'
import ToolIcon from './ToolIcon.vue'

const props = defineProps<{
  tool: Tool
  mode?: 'normal' | 'discovery'
  recommendationReason?: string
}>()

const emit = defineEmits<{
  'check-click': [key: string]
  'edit': [tool: Tool]
  'delete': [tool: Tool]
  'toggle-fav': [key: string]
  'add': [tool: Tool]
}>()

const tools = useToolsStore()
const ui = useUiStore()
const user = useUserStore()
const desktopRuntime = isDesktopRuntime()

const toolKey = computed(() => tools.getToolKey(props.tool))
const selectMode = computed(() => ui.selectMode)
const isChecked = computed(() => ui.selectedSet.has(toolKey.value))
const isFav = computed(() => tools.favoriteTools.has(toolKey.value))
const isLocal = computed(() => !!(props.tool.localPath || props.tool.local_path))
const shortLocalPath = computed(() => {
  const p = props.tool.localPath || props.tool.local_path || ''
  if (p.length > 45) return '...' + p.slice(-42)
  return p
})

const hostname = computed(() => {
  if (isLocal.value) return ''
  try { return new URL(props.tool.url).hostname }
  catch { return props.tool.url || '' }
})

const previewUrl = computed(() => {
  if (isLocal.value) return ''
  try {
    const url = new URL(props.tool.url)
    return ['http:', 'https:'].includes(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
})

const cardClasses = computed(() => ({
  'show-checks': selectMode.value,
  'selected': selectMode.value && isChecked.value,
  'is-local': isLocal.value,
  'discovery-mode': props.mode === 'discovery',
  'has-card-color': !!cardColor.value,
}))

const cardColor = computed(() => props.tool.cardColor || props.tool.card_color || null)

const cardStyle = computed(() => {
  const color = cardColor.value
  if (!color) return {}
  // 自定义颜色渐变：主色 → 稍暗，保留视觉层次
  return {
    background: `linear-gradient(135deg, ${color}ee 0%, ${color}99 100%)`,
    '--card-custom-bg': color,
  } as Record<string, string>
})

// 来源平台中文名称
const sourceLabel = computed(() => {
  const sourceMap: Record<string, string> = {
    'producthunt': 'Product Hunt',
    'appinn': '小众软件',
    'v2ex': 'V2EX',
    'juejin': '掘金',
    'sspai': '少数派',
    'apprcn': '反斗软件',
    'iplaysoft': '异次元软件',
    'ifanr': '爱范儿',
    '36kr': '36氪',
    'oschina': '开源中国',
  }
  const source = props.tool.source || ''
  return sourceMap[source] || source
})

// ===== 详细信息面板（新版） =====
const cardRef = ref<HTMLElement | null>(null)

function disableNativeCardDrag() {
  if (!cardRef.value) return
  cardRef.value.draggable = false
  cardRef.value.setAttribute('draggable', 'false')
}

const showDetailPopup = ref(false)
const isDragging = ref(false)
const popupStyle = ref<Record<string, string>>({})
const websitePreview = ref<WebsitePreview | null>(null)
const previewLoading = ref(false)
const previewFailed = ref(false)
const previewImageFailed = ref(false)
let loadedPreviewUrl = ''
let detailShowTimer: ReturnType<typeof setTimeout> | null = null
let detailHideTimer: ReturnType<typeof setTimeout> | null = null

function updatePopupPosition() {
  if (!cardRef.value) return
  const rect = cardRef.value.getBoundingClientRect()
  const popupWidth = 400
  const popupHeight = 336
  const viewportGap = 14
  let left = rect.right + viewportGap

  if (left + popupWidth > window.innerWidth - viewportGap) {
    left = rect.left - popupWidth - viewportGap
  }

  left = Math.max(viewportGap, Math.min(left, window.innerWidth - popupWidth - viewportGap))
  const top = Math.max(
    viewportGap,
    Math.min(rect.top, window.innerHeight - popupHeight - viewportGap),
  )

  popupStyle.value = {
    position: 'fixed',
    top: `${top}px`,
    left: `${left}px`,
    zIndex: '99999',
  }
}

function onPopupMouseEnter() {
  if (
    !previewUrl.value
    || selectMode.value
    || isDragging.value
    || document.documentElement.classList.contains('tool-sort-active')
    || window.matchMedia('(hover: none)').matches
  ) return
  // 清除隐藏定时器
  if (detailHideTimer) {
    clearTimeout(detailHideTimer)
    detailHideTimer = null
  }
  // 如果已经显示，直接返回
  if (showDetailPopup.value) return
  // 鼠标稳定停留后再加载官网，避免划过卡片时产生大量网络请求。
  if (detailShowTimer) clearTimeout(detailShowTimer)
  detailShowTimer = setTimeout(() => {
    updatePopupPosition()
    showDetailPopup.value = true
    void loadWebsitePreview()
    nextTick(() => {
      updatePopupPosition()
    })
  }, 1500)
}

function onPopupMouseLeave() {
  // 清除显示定时器
  if (detailShowTimer) {
    clearTimeout(detailShowTimer)
    detailShowTimer = null
  }
  // 隐藏延迟：给鼠标时间移到面板上
  if (detailHideTimer) clearTimeout(detailHideTimer)
  detailHideTimer = setTimeout(() => {
    showDetailPopup.value = false
    detailHideTimer = null
  }, 150)
}

async function loadWebsitePreview() {
  const url = previewUrl.value
  if (!url || (loadedPreviewUrl === url && (websitePreview.value || previewFailed.value))) return

  loadedPreviewUrl = url
  previewLoading.value = true
  previewFailed.value = false
  previewImageFailed.value = false

  try {
    const response = await toolsApi.getWebsitePreview(url)
    if (previewUrl.value !== url) return
    websitePreview.value = response.data
  } catch {
    if (previewUrl.value === url) {
      websitePreview.value = null
      previewFailed.value = true
    }
  } finally {
    if (previewUrl.value === url) previewLoading.value = false
  }
}

watch(previewUrl, () => {
  loadedPreviewUrl = ''
  websitePreview.value = null
  previewFailed.value = false
  previewImageFailed.value = false
})

// 窗口滚动或大小变化时更新面板位置
function handleScrollOrResize() {
  if (showDetailPopup.value) {
    updatePopupPosition()
  }
}

onMounted(() => {
  disableNativeCardDrag()
  window.addEventListener('scroll', handleScrollOrResize, true)
  window.addEventListener('resize', handleScrollOrResize)
  window.addEventListener('flexikit-tool-drag-start', handleToolDragStart)
  window.addEventListener('flexikit-tool-drag-end', handleToolDragEnd)
})

onUnmounted(() => {
  window.removeEventListener('scroll', handleScrollOrResize, true)
  window.removeEventListener('resize', handleScrollOrResize)
  window.removeEventListener('flexikit-tool-drag-start', handleToolDragStart)
  window.removeEventListener('flexikit-tool-drag-end', handleToolDragEnd)
  if (detailShowTimer) clearTimeout(detailShowTimer)
  if (detailHideTimer) clearTimeout(detailHideTimer)
})

// 监听显示状态，显示时更新位置
watch(showDetailPopup, (val) => {
  if (val) {
    nextTick(() => updatePopupPosition())
  }
})

function onCheckClick() {
  emit('check-click', toolKey.value)
}

async function onCardClick(e: MouseEvent) {
  if (selectMode.value) {
    e.preventDefault()
    emit('check-click', toolKey.value)
    return
  }
  if (props.tool.id) void statsApi.recordClick(props.tool.id).catch(() => {})
  if (isLocal.value) {
    e.preventDefault()
    if (!desktopRuntime) {
      ui.showToast('本地工具仅支持 FlexiKit 桌面端')
      return
    }
    try {
      const opened = await openDesktopTool(props.tool)
      ui.showToast(opened ? `已打开: ${props.tool.name}` : '这个工具没有可打开的有效地址')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      ui.showToast(`打开失败: ${message}`)
    }
    return
  }
  if (desktopRuntime) {
    e.preventDefault()
    try {
      const opened = await openDesktopTool(props.tool)
      if (opened) {
        ui.showToast('已打开: ' + props.tool.name)
      } else {
        ui.showToast('这个工具没有可打开的有效地址')
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      ui.showToast('打开失败: ' + message)
    }
    return
  }
  recordToolUsage(props.tool)
}

function onEdit() {
  emit('edit', props.tool)
}

function onDelete() {
  emit('delete', props.tool)
}

function onToggleFav() {
  emit('toggle-fav', toolKey.value)
}

function onAdd() {
  emit('add', props.tool)
}

function onDragStart(e: DragEvent) {
  // Native link/image dragging must never own the interaction. SortableJS is the
  // only code allowed to enter the global tool-sort state.
  e.preventDefault()
  disableNativeCardDrag()
}

function onDragEnd() {
  handleToolDragEnd()
}

function handleToolDragStart() {
  isDragging.value = true
  if (detailShowTimer) {
    clearTimeout(detailShowTimer)
    detailShowTimer = null
  }
  if (detailHideTimer) {
    clearTimeout(detailHideTimer)
    detailHideTimer = null
  }
  showDetailPopup.value = false
}

function handleToolDragEnd() {
  window.setTimeout(() => {
    isDragging.value = false
  }, 120)
}
</script>

<style scoped>
.tool-card {
  -webkit-user-drag: none;
  user-select: none;
  cursor: grab;
}

.tool-card:active {
  cursor: grabbing;
}

.tool-card :deep(img),
.tool-card :deep(svg) {
  -webkit-user-drag: none;
  user-select: none;
}

/* Sortable fallback follows the pointer through inline transform updates.
   Never animate transform on the dragged clone, otherwise it visibly trails
   behind the cursor by the card's normal 280–300ms hover transition. */
:global(.tool-card-dragging),
:global(.tool-card-drag-chosen),
:global(.tool-card-drag-ghost),
:global(.sortable-fallback.tool-card) {
  transition: none !important;
  animation: none !important;
}

:global(.sortable-fallback.tool-card) {
  pointer-events: none !important;
  will-change: transform;
  backface-visibility: hidden;
}

:global(html.tool-sort-active .tool-card:hover),
:global(html.tool-sort-active .tool-card:active) {
  filter: none !important;
}


/* ===== 自定义卡片背景色 ===== */
.tool-card.has-card-color {
  /* 覆盖默认玻璃背景，用自定义颜色 */
  border-color: transparent;
}

.tool-card.has-card-color:hover {
  /* hover 时不替换背景，仅加亮 */
  filter: brightness(1.08);
  border-color: rgba(255, 255, 255, 0.4) !important;
}

.tool-card.has-card-color .card-tag {
  /* 标签使用半透明白色背景 */
  background: rgba(255, 255, 255, 0.25);
  color: rgba(255, 255, 255, 0.9);
}

.tool-card.has-card-color .card-desc,
.tool-card.has-card-color .card-url-hint {
  color: rgba(255, 255, 255, 0.8);
}

.tool-card.has-card-color .card-name {
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.tool-card.has-card-color .card-fav-btn {
  color: rgba(255, 255, 255, 0.7);
}

.tool-card.has-card-color .card-fav-btn:hover {
  color: var(--primary);
}

.card-fav-btn.active,
.tool-card.has-card-color .card-fav-btn.active {
  color: var(--primary) !important;
  background: transparent !important;
  box-shadow: none !important;
  animation: favorite-pop .3s cubic-bezier(.25,.1,.25,1);
}

.card-fav-btn.active svg,
.tool-card.has-card-color .card-fav-btn.active svg {
  opacity: 0;
}

.card-fav-btn.active::before,
.card-fav-btn.active::after {
  content: '';
  position: absolute;
  inset: 4px;
  pointer-events: none;
  -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/%3E%3C/svg%3E") center / contain no-repeat;
  mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'/%3E%3C/svg%3E") center / contain no-repeat;
}

.card-fav-btn.active::before {
  background: linear-gradient(
    138deg,
    color-mix(in srgb, var(--primary) 58%, #ffffff) 0%,
    var(--primary) 44%,
    color-mix(in srgb, var(--primary) 76%, #5e5ce6) 100%
  );
  filter: drop-shadow(0 2px 5px color-mix(in srgb, var(--primary) 28%, transparent));
}

.card-fav-btn.active::after {
  background: linear-gradient(118deg, transparent 18%, rgba(255,255,255,.82) 43%, rgba(255,255,255,.18) 57%, transparent 78%);
  opacity: .58;
  transform: translateX(-18%);
  animation: favorite-glint .7s cubic-bezier(.25,.1,.25,1) both;
}

@keyframes favorite-pop {
  0% { transform: scale(.82); }
  65% { transform: scale(1.08); }
  100% { transform: scale(1); }
}

@keyframes favorite-glint {
  from { opacity: 0; transform: translateX(-42%); }
  45% { opacity: .68; }
  to { opacity: .42; transform: translateX(18%); }
}

:global(html.tool-sort-active .site-preview-popup) {
  display: none !important;
}

/* 深色模式下微调 */
:global([data-theme="dark"]) .tool-card.has-card-color .card-tag {
  background: color-mix(in srgb, var(--card-custom-bg) 12%, rgba(255, 255, 255, 0.035));
  border-color: color-mix(in srgb, var(--card-custom-bg) 16%, rgba(255, 255, 255, 0.06));
  color: color-mix(in srgb, var(--card-custom-bg) 46%, #dbe7f5);
}

:global([data-theme="dark"]) .tool-card.has-card-color {
  background:
    radial-gradient(circle at 8% 0%, color-mix(in srgb, var(--card-custom-bg) 9%, transparent), transparent 42%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.045), transparent 44%),
    color-mix(in srgb, var(--glass-bg) 94%, #0a1019) !important;
  border-color: rgba(255, 255, 255, 0.075) !important;
  box-shadow:
    0 12px 34px rgba(0, 0, 0, 0.18),
    inset 0 1px 0 rgba(255, 255, 255, 0.075) !important;
}

:global([data-theme="dark"]) .tool-card.has-card-color:hover {
  background:
    radial-gradient(circle at 10% 0%, color-mix(in srgb, var(--card-custom-bg) 13%, transparent), transparent 44%),
    linear-gradient(145deg, rgba(255, 255, 255, 0.065), transparent 46%),
    color-mix(in srgb, var(--card-hover-bg) 82%, #101722) !important;
  border-color: color-mix(in srgb, var(--primary) 14%, rgba(255, 255, 255, 0.10)) !important;
  box-shadow:
    0 16px 42px rgba(0, 0, 0, 0.24),
    0 7px 22px color-mix(in srgb, var(--card-custom-bg) 6%, transparent),
    inset 0 1px 0 rgba(255, 255, 255, 0.10) !important;
  filter: brightness(1.015);
}

:global([data-theme="dark"]) .tool-card.has-card-color .card-name {
  color: var(--text-primary);
  text-shadow: none;
}

:global([data-theme="dark"]) .tool-card.has-card-color .card-desc,
:global([data-theme="dark"]) .tool-card.has-card-color .card-url-hint {
  color: var(--text-secondary);
}

.card-recommendation-reason {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-top: 6px;
  color: var(--text-tertiary);
  font-size: 11px;
  line-height: 1.35;
}

.card-recommendation-reason > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-recommendation-dot {
  width: 5px;
  height: 5px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: color-mix(in srgb, var(--primary) 58%, transparent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 8%, transparent);
}

/* 发现模式下详细信息面板 */
.discovery-mode {
  position: relative;
  overflow: visible !important;
}

/* 透明桥梁：连接卡片和面板，鼠标移过去不会断开 */
.discovery-mode::after {
  content: '';
  position: absolute;
  top: 0;
  left: 100%;
  width: 16px;
  height: 100%;
  background: transparent;
  pointer-events: auto;
  z-index: 1;
}

/* hover 时提高 z-index，防止面板被其他卡片遮住 */
.discovery-mode:hover {
  z-index: 50;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--glass-border);
}

.detail-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.detail-icon :deep(img),
.detail-icon :deep(svg) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.detail-title h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 4px 0;
  line-height: 1.3;
}

.detail-source {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--btn-bg);
  padding: 2px 8px;
  border-radius: 4px;
}

.detail-body {
  margin-bottom: 12px;
}

.detail-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0 0 12px 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.meta-value {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 500;
}

.meta-value.hot {
  color: #ff6b35;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-tag {
  font-size: 11px;
  color: var(--text-secondary);
  background: var(--card-hover-bg);
  padding: 3px 8px;
  border-radius: 4px;
  line-height: 1.4;
}

.detail-footer {
  display: flex;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--glass-border);
}

.detail-add-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.detail-add-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.detail-link {
  padding: 8px 12px;
  color: var(--text-secondary);
  background: var(--card-hover-bg);
  border-radius: 8px;
  font-size: 13px;
  text-decoration: none;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.detail-link:hover {
  color: var(--accent);
  background: var(--bg-tertiary);
}

/* 添加按钮样式 */
.card-action-btn.add {
  color: var(--accent);
}

.card-action-btn.add:hover {
  background: rgba(var(--accent-rgb), 0.1);
}
</style>

<style scoped>
/* 添加按钮样式 */
.card-action-btn.add {
  color: var(--accent);
}

.card-action-btn.add:hover {
  background: var(--card-btn-bg, var(--accent-soft));
  color: var(--accent);
}

/* 详细信息面板 */
.detail-panel {
  position: absolute;
  top: 0;
  left: calc(100% + 12px);
  width: 320px;
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  z-index: 99999;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transform: translateX(8px);
  transition: all 0.2s ease-out;
  transition-delay: 200ms;
}

.discovery-mode:hover .detail-panel {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
  transition-delay: 0ms;
}

/* 暗色主题 */
:global([data-theme="dark"]) .detail-panel {
  background: rgba(28, 28, 32, 0.95);
  border-color: rgba(255, 255, 255, 0.08);
}

/* ===== 新版详细信息面板 ===== */
.detail-popup {
  position: absolute;
  top: 0;
  left: calc(100% + 12px);
  width: 320px;
  background: var(--modal-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 16px;
  box-shadow: var(--card-hover-shadow);
  z-index: 99999;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
  transform: translateX(8px);
  transition: all 0.2s ease-out;
}

.detail-popup.show {
  opacity: 1;
  transform: translateX(0);
  pointer-events: auto;
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-bottom: 1px solid var(--glass-border);
}

.detail-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.detail-icon :deep(img),
.detail-icon :deep(svg) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.detail-title h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

.detail-source {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.detail-body {
  padding: 16px;
}

.detail-desc {
  margin: 0 0 14px 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.detail-meta {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 11px;
  color: var(--text-tertiary);
}

.meta-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.meta-value.hot {
  color: #ff6b35;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.detail-tag {
  font-size: 11px;
  padding: 3px 8px;
  background: var(--tag-bg);
  color: var(--tag-color);
  border-radius: 6px;
}

.detail-footer {
  display: flex;
  gap: 10px;
  padding: 12px 16px;
  border-top: 1px solid var(--glass-border);
  background: var(--card-hover-bg);
}

.detail-add-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.detail-add-btn:hover {
  background: var(--accent-hover);
  transform: translateY(-1px);
}

.detail-link {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 8px 12px;
  background: var(--glass-bg);
  color: var(--text-primary);
  border: 1px solid var(--glass-border);
  border-radius: 10px;
  font-size: 13px;
  text-decoration: none;
  transition: all 0.2s;
}

.detail-link:hover {
  border-color: var(--accent);
  color: var(--accent);
}

/* 滑入淡出动画 */
.slide-fade-enter-active {
  transition: all 0.25s ease-out;
}

.slide-fade-leave-active {
  transition: all 0.2s ease-in;
}

.slide-fade-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.slide-fade-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

/* 发现页模式下的卡片 */
.discovery-mode {
  cursor: pointer;
}

/* 官网首页预览 */
.site-preview-popup {
  width: 400px;
  opacity: 1;
  transform: translateX(0) scale(1);
  overflow: hidden;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.82);
  backdrop-filter: blur(24px) saturate(160%);
  -webkit-backdrop-filter: blur(24px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.55);
  box-shadow: 0 18px 55px rgba(15, 23, 42, 0.18),
              inset 0 0 0 1px rgba(255, 255, 255, 0.1);
  transition: opacity 300ms cubic-bezier(0.25, 0.1, 0.25, 1),
              transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.site-preview-enter-active,
.site-preview-leave-active {
  transition: opacity 280ms cubic-bezier(0.25, 0.1, 0.25, 1),
              transform 280ms cubic-bezier(0.25, 0.1, 0.25, 1);
  transform-origin: center left;
}

.site-preview-leave-active {
  transition-duration: 220ms;
  pointer-events: none;
}

.site-preview-enter-from,
.site-preview-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.96);
}

:global([data-theme='dark']) .site-preview-popup {
  background: rgba(15, 23, 42, 0.88);
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 18px 55px rgba(0, 0, 0, 0.42),
              inset 0 0 0 1px rgba(255, 255, 255, 0.06);
}

.preview-toolbar {
  height: 38px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  border-bottom: 1px solid var(--glass-border);
  background: var(--card-hover-bg);
}

.preview-window-dots {
  display: flex;
  gap: 5px;
}

.preview-window-dots i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ff5f57;
}

.preview-window-dots i:nth-child(2) { background: #febc2e; }
.preview-window-dots i:nth-child(3) { background: #28c840; }

.preview-address {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 4px 10px;
  border-radius: 8px;
  color: var(--text-secondary);
  background: var(--glass-bg);
  font-size: 11px;
}

.preview-open-link {
  color: var(--accent);
  font-size: 11px;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition: opacity 300ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.preview-open-link:hover { opacity: 0.72; }

.preview-viewport {
  position: relative;
  height: 210px;
  overflow: hidden;
  background: linear-gradient(135deg, var(--accent-soft), var(--bg-secondary));
}

.preview-cover {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
  animation: preview-cover-in 300ms cubic-bezier(0.25, 0.1, 0.25, 1) both;
}

@keyframes preview-cover-in {
  from { opacity: 0; transform: scale(1.025); }
  to { opacity: 1; transform: scale(1); }
}

.preview-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.preview-loading :deep(.tool-icon) {
  width: 38px;
  height: 38px;
}

.preview-details {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 18px;
  overflow: auto;
  background: linear-gradient(135deg, color-mix(in srgb, var(--preview-theme, var(--accent)) 12%, transparent), transparent 72%);
}

.preview-details-header {
  display: flex;
  align-items: center;
  gap: 11px;
}

.preview-fallback-icon {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

.preview-details-title {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.preview-details-title strong {
  max-width: 100%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 15px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-details-title span {
  color: var(--text-tertiary);
  font-size: 11px;
}

.preview-unavailable-badge {
  flex-shrink: 0;
  padding: 4px 8px;
  border: 1px solid var(--glass-border);
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--glass-bg);
  font-size: 10px;
}

.preview-details-description {
  margin: 0;
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.65;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

.preview-details-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: auto;
}

.preview-category,
.preview-detail-tag {
  padding: 4px 8px;
  border-radius: 999px;
  color: var(--text-secondary);
  background: var(--card-hover-bg);
  font-size: 10px;
  line-height: 1;
}

.preview-category {
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}

.preview-footer {
  min-height: 60px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-top: 1px solid var(--glass-border);
}

.preview-tool-icon {
  width: 34px;
  height: 34px;
  flex-shrink: 0;
}

.preview-tool-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-tool-info strong {
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-tool-info span {
  overflow: hidden;
  color: var(--text-secondary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-add-btn {
  padding: 7px 12px;
  border: 0;
  border-radius: 10px;
  color: #fff;
  background: var(--accent);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1),
              filter 300ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.preview-add-btn:hover { transform: translateY(-1px); filter: brightness(1.05); }
.preview-add-btn:active { transform: scale(0.98); }

.preview-hint {
  margin: 0;
  padding: 0 12px 9px;
  color: var(--text-tertiary);
  font-size: 10px;
  line-height: 1.4;
}
</style>
