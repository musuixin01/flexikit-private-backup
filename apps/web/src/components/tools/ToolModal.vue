<template>
  <div :class="['modal-overlay', { open: ui.toolModalOpen }]" @click.self="close">
    <div class="modal" role="dialog" aria-modal="true">
      <h3>{{ ui.toolModalMode === 'add' ? '添加工具' : (ui.toolModalBuiltinEdit ? '编辑内置工具（将替换为自定义版本）' : '编辑工具') }}</h3>

      <label for="fieldName">工具名称 *</label>
      <input
        id="fieldName"
        ref="nameInput"
        v-model="form.name"
        type="text"
        placeholder="例如：MyTool"
        maxlength="60"
      >
      <div :class="['field-error', { visible: errName }]" id="errName">请输入工具名称</div>

      <label>工具类型</label>
      <div class="tool-type-tabs">
        <button
          type="button"
          :class="['type-tab', { active: toolType === 'url' }]"
          @click="toolType = 'url'"
        >
          网页链接
        </button>
        <button
          type="button"
          :class="['type-tab', { active: toolType === 'local' }]"
          @click="selectLocalToolType"
        >
          本地应用
        </button>
      </div>

      <template v-if="toolType === 'url'">
        <label for="fieldUrl">官方网站 URL</label>
        <input
          id="fieldUrl"
          v-model="form.url"
          type="url"
          placeholder="https://example.com"
          maxlength="300"
          @input="onUrlInput"
        >
        <div :class="['field-error', { visible: errUrl }]" id="errUrl">请输入有效的 URL（以 http:// 或 https:// 开头）</div>
      </template>

      <template v-if="toolType === 'local'">
        <label for="fieldLocalPath">本地路径</label>
        <div class="local-path-row">
          <input
            id="fieldLocalPath"
            v-model="localPath"
            type="text"
            placeholder="C:\Program Files\...\app.exe"
            @input="cleanLocalPath"
          >
          <button type="button" class="btn-small" @click="pickLocalPath">浏览</button>
        </div>
        <input ref="localFileInput" type="file" style="display:none" @change="onLocalPathPick">
        <div class="field-hint">浏览器无法直接获取完整路径，只能作为辅助提示。</div>
        <div :class="['field-error', { visible: errUrl }]" id="errLocalPath">请填写本地路径</div>
      </template>

      <label for="fieldDesc">描述</label>
      <textarea
        id="fieldDesc"
        v-model="form.desc"
        placeholder="这个工具是做什么的..."
        maxlength="200"
      ></textarea>

      <label for="fieldTags">标签（用逗号分隔）</label>
      <input
        id="fieldTags"
        v-model="tagsInput"
        type="text"
        placeholder="免费, 效率, 开发"
        maxlength="120"
      >
      <div class="field-hint">最多 5 个标签</div>

      <!-- 智能推荐标签 -->
      <div class="tag-recommendation">
        <button 
          type="button" 
          class="btn-smart-recommend"
          @click="fetchRecommendedTags"
          :disabled="isLoadingTags"
        >
          <span v-if="isLoadingTags">加载中...</span>
          <span v-else>✨ 智能推荐标签</span>
        </button>
        
        <div v-if="recommendedTags.length > 0" class="recommended-tags">
          <span class="recommend-hint">点击添加：</span>
          <button
            v-for="tag in recommendedTags"
            :key="tag.tag"
            type="button"
            :class="['recommended-tag', { added: isTagAdded(tag.tag) }]"
            @click="addTag(tag.tag)"
            :disabled="isTagAdded(tag.tag) || currentTagCount >= 5"
          >
            {{ tag.tag }}
          </button>
        </div>
      </div>

      <label>分类</label>
      <div class="category-select-wrapper">
        <div class="category-input-group">
          <input
            v-model="form.cat"
            type="text"
            placeholder="选择或输入分类"
            autocomplete="off"
            class="theme-input"
            @focus="showDropdown = true"
          >
          <button type="button" class="category-dropdown-btn" @click.stop="showDropdown = !showDropdown">选择</button>
        </div>
        <div ref="dropdownRef" :class="['custom-dropdown', { show: showDropdown }]">
          <div v-for="cat in tools.categories" :key="cat" class="dropdown-item" @click="selectCategory(cat)">{{ cat }}</div>
        </div>
      </div>

      <label>自定义图标</label>
      <div class="icon-custom-area">
        <div class="icon-preview" v-html="iconPreviewHtml"></div>
        <div class="icon-options">
          <button type="button" class="btn-small" @click="triggerFileInput">上传图片</button>
          <button type="button" class="btn-small" @click="resetIcon">重置为默认</button>
        </div>
        <input ref="fileInput" type="file" accept="image/png, image/jpeg, image/svg+xml, image/webp" style="display:none" @change="onFileChange">
        <div class="icon-hint">上传图片将作为固定图标；不设置则自动使用网站 favicon。</div>
      </div>

      <label>卡片背景色</label>
      <div class="card-color-row">
        <div class="color-presets">
          <button
            v-for="c in colorPresets"
            :key="c"
            type="button"
            :class="['color-preset-dot', { active: cardColor === c }]"
            :style="{ background: c }"
            @click="cardColor = c"
            :title="c"
          ></button>
          <button
            type="button"
            class="color-preset-dot color-none"
            :class="{ active: !cardColor }"
            @click="cardColor = ''"
            title="默认（无自定义颜色）"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <label class="custom-color-btn" :style="{ background: cardColor || '#cccccc' }">
          <input
            type="color"
            :value="cardColor || '#cccccc'"
            @input="(e) => cardColor = (e.target as HTMLInputElement).value"
            class="hidden-color-input"
          >
        </label>
      </div>
      <div class="field-hint">为卡片设置自定义背景色，留空则使用默认毛玻璃效果。</div>

      <div class="modal-actions">
        <button class="btn-secondary" type="button" @click="close">取消</button>
        <button class="btn-primary" type="button" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import type { Tool } from '@/types/tool'
import { DEF_ICON } from '@/data/data'
import { resolveApiUrl } from '@/api/runtime'
import { toolsApi } from '@/api/tools'
import type { TagRecommendation } from '@/api/tools'

const tools = useToolsStore()
const ui = useUiStore()

const emit = defineEmits<{
  saved: []
  'local-import-request': []
}>()

const nameInput = ref<HTMLInputElement | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const localFileInput = ref<HTMLInputElement | null>(null)
const dropdownRef = ref<HTMLElement | null>(null)
const showDropdown = ref(false)

const form = reactive({
  name: '',
  url: '',
  desc: '',
  cat: '',
})

const toolType = ref<'url' | 'local'>('url')
const localPath = ref('')
const tagsInput = ref('')
const customIcon = ref('')
const cardColor = ref('')
const errName = ref(false)
const errUrl = ref(false)
let editTool: Tool | null = null

// 预设卡片颜色
const colorPresets = [
  '#4A90D9', '#5B9BD5', '#6366f1', '#8B5CF6',
  '#EC4899', '#F43F5E', '#F97316', '#EAB308',
  '#22C55E', '#14B8A6', '#06B6D4', '#64748B',
]

// 智能标签推荐
const recommendedTags = ref<TagRecommendation[]>([])
const isLoadingTags = ref(false)

/**
 * 获取当前标签列表
 */
const currentTags = computed(() => {
  return tagsInput.value
    ? tagsInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean)
    : []
})

/**
 * 当前标签数量
 */
const currentTagCount = computed(() => currentTags.value.length)

/**
 * 判断标签是否已添加
 */
function isTagAdded(tag: string): boolean {
  return currentTags.value.includes(tag)
}

/**
 * 获取推荐标签
 */
async function fetchRecommendedTags() {
  if (!form.name.trim() && !form.desc.trim() && !form.url.trim()) {
    ui.showToast('请先输入工具名称、描述或网址')
    return
  }

  isLoadingTags.value = true
  recommendedTags.value = []

  try {
    const response = await toolsApi.recommendTags({
      name: form.name,
      description: form.desc,
      url: form.url || undefined,
      category: form.cat || undefined,
      limit: 10,
    })
    recommendedTags.value = response.data
  } catch (err) {
    console.error('获取推荐标签失败:', err)
    ui.showToast('获取推荐标签失败，请稍后重试')
  } finally {
    isLoadingTags.value = false
  }
}

/**
 * 添加标签到输入框
 */
function addTag(tag: string) {
  if (isTagAdded(tag)) return
  if (currentTagCount.value >= 5) {
    ui.showToast('最多只能添加 5 个标签')
    return
  }

  const tags = currentTags.value
  tags.push(tag)
  tagsInput.value = tags.join(', ')
}

const iconPreviewHtml = computed(() => {
  if (customIcon.value && customIcon.value.trim() !== '') {
    if (customIcon.value.startsWith('data:image') || customIcon.value.startsWith('http')) {
      return `<div class="card-icon preview-icon"><img src="${customIcon.value}" style="width:100%;height:100%;object-fit:contain;" alt=""></div>`
    }
    if (customIcon.value.startsWith('<svg')) {
      return `<div class="card-icon preview-icon">${customIcon.value}</div>`
    }
  }

  if (form.url && form.url !== '#' && /^https?:\/\//i.test(form.url)) {
    try {
      const domain = new URL(form.url).hostname
      const encodedUrl = encodeURIComponent(form.url)
      // 使用多个 favicon 源，后端解析优先，提高成功率
      const faviconSources = [
        // 优先使用后端解析接口（最稳定）
        resolveApiUrl(`/api/tools/favicon?url=${encodedUrl}`),
        // 国内 favicon 服务
        `https://api.iowen.cn/favicon/${domain}.png`,
        // 网站自己的 favicon
        `${new URL(form.url).origin}/favicon.ico`,
        `${new URL(form.url).origin}/apple-touch-icon.png`,
        // 国际源 fallback
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
      ]
      // 第一个源失败时自动 fallback 到下一个
      let onerrorStr = ''
      for (let i = 1; i < faviconSources.length; i++) {
        onerrorStr += `this.onerror=null;this.src='${faviconSources[i]}';`
      }
      onerrorStr += `this.onerror=null;this.style.opacity='0.3';`
      return `<div class="card-icon preview-icon"><img src="${faviconSources[0]}" style="width:100%;height:100%;object-fit:contain;" onerror="${onerrorStr}" alt=""></div>`
    } catch {}
  }

  return `<div class="card-icon preview-icon">${DEF_ICON}</div>`
})

function onUrlInput() {}

function selectLocalToolType(): void {
  if (ui.toolModalMode === 'add') {
    close()
    emit('local-import-request')
    return
  }
  toolType.value = 'local'
}

function selectCategory(cat: string) {
  form.cat = cat
  showDropdown.value = false
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = evt => {
    customIcon.value = (evt.target?.result as string) || ''
  }
  reader.readAsDataURL(file)
}

function resetIcon() {
  customIcon.value = ''
}

function triggerFileInput() {
  fileInput.value?.click()
}

function openForAdd() {
  resetForm()
  ui.toolModalMode = 'add'
  ui.toolModalBuiltinEdit = false
  ui.toolModalOpen = true
  nextTickFocus()
}

function openForAddWithData(tool: Partial<Tool> & Pick<Tool, 'name'>) {
  resetForm()
  form.name = tool.name || ''
  form.url = tool.url || ''
  form.desc = tool.desc || tool.description || ''
  form.cat = tool.cat || tool.category || '效率工具'
  tagsInput.value = (tool.tags || []).join(', ')
  customIcon.value = tool.icon || ''
  cardColor.value = tool.cardColor || tool.card_color || ''
  toolType.value = tool.localPath || tool.local_path ? 'local' : 'url'
  localPath.value = tool.localPath || tool.local_path || ''
  
  ui.toolModalMode = 'add'
  ui.toolModalBuiltinEdit = false
  ui.toolModalOpen = true
  nextTickFocus()
}

function openForEdit(tool: Tool) {
  editTool = tool
  form.name = tool.name
  form.url = tool.url === '#' ? '' : tool.url
  form.desc = tool.desc || tool.description || ''
  form.cat = tool.cat || tool.category || ''
  localPath.value = tool.localPath || tool.local_path || ''
  toolType.value = tool.localPath || tool.local_path ? 'local' : 'url'
  tagsInput.value = (tool.tags || []).join(', ')
  customIcon.value = tool.customIcon || ''
  cardColor.value = tool.cardColor || tool.card_color || ''

  const isBuiltin = !tool.isCustom
  ui.toolModalMode = 'edit'
  ui.toolModalBuiltinEdit = isBuiltin
  if (isBuiltin) {
    ui.toolModalBuiltinName = tool.name
    ui.toolModalBuiltinUrl = tool.url
  }
  ui.toolModalOpen = true
  nextTickFocus()
}

function cleanLocalPath() {
  localPath.value = localPath.value.replace(/["']/g, '')
}

function cleanLocalPathValue(): string {
  return localPath.value.trim().replace(/["']/g, '')
}

function pickLocalPath() {
  localFileInput.value?.click()
}

function onLocalPathPick(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  localPath.value = localPath.value || file.name
  ui.showToast('请手动补充完整路径，浏览器无法自动获取完整路径。')
}

function resetForm() {
  editTool = null
  form.name = ''
  form.url = ''
  form.desc = ''
  form.cat = ''
  toolType.value = 'url'
  localPath.value = ''
  tagsInput.value = ''
  customIcon.value = ''
  cardColor.value = ''
  errName.value = false
  errUrl.value = false
  recommendedTags.value = []
  isLoadingTags.value = false
}

function nextTickFocus() {
  setTimeout(() => nameInput.value?.focus(), 100)
}

function close() {
  ui.closeToolModal()
  resetForm()
}

function save() {
  const name = form.name.trim()
  if (!name) {
    errName.value = true
    return
  }
  errName.value = false

  const url = form.url.trim()
  const lp = cleanLocalPathValue()
  errUrl.value = false

  if (toolType.value === 'url') {
    if (!url || !/^https?:\/\//i.test(url)) {
      errUrl.value = true
      ui.showToast('请输入有效的官方网站 URL')
      return
    }
  } else if (!lp) {
    errUrl.value = true
    ui.showToast('请填写本地路径')
    return
  }

  const desc = form.desc.trim() || name
  const tags = tagsInput.value
    ? tagsInput.value.split(/[,，]/).map(s => s.trim()).filter(Boolean).slice(0, 5)
    : []
  const cat = form.cat.trim() || '自定义工具'
  const finalCustomIcon = customIcon.value.trim() || null

  const newTool: Tool = {
    name,
    url: toolType.value === 'url' ? url : '#',
    desc,
    description: desc,
    tags,
    cat,
    category: cat,
    localPath: toolType.value === 'local' ? lp : null,
    local_path: toolType.value === 'local' ? lp : null,
    cardColor: cardColor.value.trim() || null,
    card_color: cardColor.value.trim() || null,
    icon: DEF_ICON,
    customIcon: finalCustomIcon,
    isCustom: true,
    is_custom: true,
  }

  if (ui.toolModalMode === 'add') {
    void tools.addCustomTool({ ...newTool, icon: finalCustomIcon || DEF_ICON })
    ui.showToast(`已添加：${name}`)
  } else if (ui.toolModalBuiltinEdit && editTool) {
    tools.replaceBuiltinWithCustom(editTool, newTool, finalCustomIcon)
    ui.showToast(`已用自定义版本替换：${name}`)
  } else if (editTool && editTool.isCustom) {
    const idx = tools.customTools.indexOf(editTool)
    if (idx !== -1) {
      void tools.updateCustomTool(idx, { ...editTool, ...newTool, icon: finalCustomIcon || editTool.icon })
      ui.showToast(`已更新：${name}`)
    }
  } else {
    void tools.addCustomTool({ ...newTool, icon: finalCustomIcon || DEF_ICON })
    ui.showToast(`已添加自定义版本：${name}`)
  }

  emit('saved')
  close()
}

defineExpose({ openForAdd, openForAddWithData, openForEdit })

function onDocumentClick(e: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(e.target as Node)) {
    showDropdown.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

watch(
  () => ui.toolModalOpen,
  open => {
    if (!open) resetForm()
  }
)
</script>

<style scoped>
/* ===== 卡片背景色选择 ===== */
.card-color-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 4px;
}
.color-presets {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex: 1;
}
.color-preset-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.color-preset-dot:hover {
  transform: scale(1.15);
}
.color-preset-dot.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 0 2px var(--accent);
}
.color-none {
  background: transparent !important;
  border: 2px dashed var(--text-tertiary);
  color: var(--text-tertiary);
}
.custom-color-btn {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  cursor: pointer;
  border: 2px solid var(--border);
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  transition: all 0.2s;
}
.custom-color-btn:hover {
  transform: scale(1.1);
}
.hidden-color-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
  width: 100%;
  height: 100%;
}

.tag-recommendation {
  margin-top: 8px;
  margin-bottom: 16px;
}

.btn-smart-recommend {
  background: var(--glass-bg, rgba(255, 255, 255, 0.7));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.3));
  border-radius: 8px;
  padding: 6px 14px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.btn-smart-recommend:hover:not(:disabled) {
  background: var(--accent, #6366f1);
  color: white;
  border-color: var(--accent, #6366f1);
}

.btn-smart-recommend:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.recommended-tags {
  margin-top: 10px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.recommend-hint {
  font-size: 12px;
  color: var(--text-secondary, #9ca3af);
  margin-right: 4px;
}

.recommended-tag {
  background: var(--glass-bg, rgba(255, 255, 255, 0.6));
  border: 1px solid var(--glass-border, rgba(255, 255, 255, 0.3));
  border-radius: 16px;
  padding: 4px 12px;
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(10px);
}

.recommended-tag:hover:not(:disabled) {
  background: var(--accent, #6366f1);
  color: white;
  border-color: var(--accent, #6366f1);
  transform: translateY(-1px);
}

.recommended-tag.added {
  background: var(--accent, #6366f1);
  color: white;
  border-color: var(--accent, #6366f1);
  opacity: 0.7;
  cursor: default;
}

.recommended-tag:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.recommended-tag:disabled:hover {
  transform: none;
}
</style>
