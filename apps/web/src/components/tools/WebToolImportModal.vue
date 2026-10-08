<template>
  <Teleport to="body">
    <Transition name="web-import">
      <div v-if="openState" class="web-import-overlay" @pointerdown.self="close">
        <section
          class="web-import-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="web-import-title"
          @pointerdown.stop
        >
          <header class="web-import-header">
            <div class="web-import-brand">
              <span class="brand-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="8"/>
                  <path d="M4 12h16M12 4c2.2 2.1 3.4 4.8 3.4 8S14.2 17.9 12 20M12 4C9.8 6.1 8.6 8.8 8.6 12S9.8 17.9 12 20"/>
                </svg>
              </span>
              <div>
                <span class="eyebrow">WEB TOOL</span>
                <h2 id="web-import-title">添加网页工具</h2>
                <p>粘贴网址即可。FlexiKit 会自动识别名称、图标、描述、分类和标签。</p>
              </div>
            </div>
            <button class="close-button" type="button" aria-label="关闭" @click="close">×</button>
          </header>

          <div class="url-entry">
            <label for="web-tool-url">网站地址</label>
            <div class="url-input-shell" :class="{ invalid: urlInput && !normalizedUrl }">
              <span class="link-icon" aria-hidden="true">↗</span>
              <input
                id="web-tool-url"
                ref="urlInputRef"
                v-model="urlInput"
                type="text"
                inputmode="url"
                autocomplete="url"
                spellcheck="false"
                placeholder="粘贴网址，例如 github.com"
                maxlength="500"
                @input="onUrlInput"
                @blur="normalizeInputDisplay"
                @keydown.enter.prevent="handleEnter"
              >
              <span v-if="analysisState === 'loading'" class="analysis-spinner" aria-label="正在识别"></span>
              <button v-else-if="urlInput" class="clear-url" type="button" aria-label="清空网址" @click="clearUrl">×</button>
            </div>
            <div class="url-status">
              <span v-if="isDuplicate" class="status-error">这个网站已经在工具箱中</span>
              <span v-else-if="urlInput && !normalizedUrl" class="status-error">请输入有效的网址</span>
              <span v-else-if="analysisState === 'loading'">正在读取网站信息…</span>
              <span v-else-if="analysisState === 'ready'">已识别网站信息，可直接添加</span>
              <span v-else-if="analysisState === 'fallback'">已根据网址生成信息，可直接添加</span>
              <span v-else>支持直接粘贴不带 https:// 的网址</span>
            </div>
          </div>

          <div v-if="normalizedUrl" class="preview-card">
            <div class="preview-icon">
              <ToolIcon :tool="previewTool" />
            </div>
            <div class="preview-copy">
              <strong>{{ draftName || fallbackName }}</strong>
              <span>{{ displayHostname }}</span>
              <p>{{ draftDescription || fallbackDescription }}</p>
              <div class="preview-meta">
                <span class="category-pill">{{ draftCategory || '网页与效率工具' }}</span>
                <span v-for="tag in parsedTags.slice(0, 4)" :key="tag" class="tag-pill">{{ tag }}</span>
              </div>
            </div>
          </div>

          <button
            v-if="normalizedUrl"
            class="advanced-toggle"
            type="button"
            :aria-expanded="showAdvanced"
            @click="showAdvanced = !showAdvanced"
          >
            <span>{{ showAdvanced ? '收起自定义' : '自定义名称、描述、标签等' }}</span>
            <span aria-hidden="true">{{ showAdvanced ? '⌃' : '⌄' }}</span>
          </button>

          <Transition name="advanced">
            <div v-if="normalizedUrl && showAdvanced" class="advanced-panel">
              <div class="advanced-grid">
                <label>
                  <span>名称</span>
                  <input v-model.trim="draftName" maxlength="60" autocomplete="off" @input="manual.name = true">
                </label>
                <label>
                  <span>分类</span>
                  <input
                    v-model.trim="draftCategory"
                    list="web-tool-category-options"
                    maxlength="60"
                    autocomplete="off"
                    @input="manual.category = true"
                  >
                  <datalist id="web-tool-category-options">
                    <option v-for="category in categoryOptions" :key="category" :value="category"></option>
                  </datalist>
                </label>
                <label class="wide">
                  <span>描述</span>
                  <textarea
                    v-model.trim="draftDescription"
                    maxlength="200"
                    rows="2"
                    @input="manual.description = true"
                  ></textarea>
                </label>
                <label class="wide">
                  <span>标签</span>
                  <input
                    v-model="draftTags"
                    maxlength="140"
                    placeholder="用逗号分隔"
                    autocomplete="off"
                    @input="manual.tags = true"
                  >
                  <small>{{ tagLoading ? '正在优化标签…' : '最多保留 5 个标签' }}</small>
                </label>
              </div>

              <div class="advanced-row">
                <div class="icon-setting">
                  <span>自定义图标</span>
                  <div>
                    <button type="button" class="secondary-mini" @click="iconFileInput?.click()">上传图片</button>
                    <button v-if="customIcon" type="button" class="text-mini" @click="customIcon = ''">恢复网站图标</button>
                  </div>
                  <input
                    ref="iconFileInput"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    hidden
                    @change="onIconFile"
                  >
                </div>
                <label class="color-setting">
                  <span>卡片颜色</span>
                  <div>
                    <input v-model="cardColor" type="color" aria-label="卡片颜色">
                    <button v-if="cardColor" type="button" class="text-mini" @click="cardColor = ''">默认</button>
                  </div>
                </label>
              </div>
            </div>
          </Transition>

          <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

          <footer class="web-import-actions">
            <div class="privacy-hint">
              <span>默认只保存工具信息</span>
              <span>识别失败也可使用本地规则添加</span>
            </div>
            <div class="action-buttons">
              <button class="secondary" type="button" @click="close">取消</button>
              <button class="primary" type="button" :disabled="!canSave || saving" @click="save">
                {{ saving ? '添加中…' : '添加到工具箱' }}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, reactive, ref } from 'vue'
import ToolIcon from '@/components/tools/ToolIcon.vue'
import { toolsApi } from '@/api/tools'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import type { Tool, WebsitePreview } from '@/types/tool'

type AnalysisState = 'idle' | 'loading' | 'ready' | 'fallback'

const tools = useToolsStore()
const ui = useUiStore()

const openState = ref(false)
const urlInput = ref('')
const normalizedUrl = ref('')
const analysisState = ref<AnalysisState>('idle')
const saving = ref(false)
const tagLoading = ref(false)
const showAdvanced = ref(false)
const formError = ref('')
const draftName = ref('')
const draftDescription = ref('')
const draftCategory = ref('')
const draftTags = ref('')
const customIcon = ref('')
const cardColor = ref('')
const urlInputRef = ref<HTMLInputElement | null>(null)
const iconFileInput = ref<HTMLInputElement | null>(null)
const manual = reactive({
  name: false,
  description: false,
  category: false,
  tags: false,
})

let analyzeTimer: ReturnType<typeof setTimeout> | null = null
let analysisGeneration = 0

const categoryOptions = computed(() => [
  ...new Set([
    '网页与效率工具',
    'AI 生产力工具',
    '开发与极客工具',
    '文档与图片处理',
    '制图与可视化',
    '科研与网络测试',
    '本地硬核与系统辅助',
    ...tools.categoryList,
  ].filter(Boolean)),
])

const displayHostname = computed(() => {
  if (!normalizedUrl.value) return ''
  try {
    return new URL(normalizedUrl.value).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
})

const fallbackName = computed(() => nameFromUrl(normalizedUrl.value))
const fallbackDescription = computed(() => {
  const name = draftName.value || fallbackName.value || '网页工具'
  return displayHostname.value ? `${name} · ${displayHostname.value}` : name
})

const parsedTags = computed(() => parseTags(draftTags.value))
const isDuplicate = computed(() => {
  const key = comparableUrl(normalizedUrl.value)
  if (!key) return false
  return tools.allTools.some(tool => comparableUrl(tool.url) === key)
})

const previewTool = computed<Tool>(() => ({
  name: draftName.value || fallbackName.value || '网页工具',
  url: normalizedUrl.value || '#',
  desc: draftDescription.value || fallbackDescription.value,
  description: draftDescription.value || fallbackDescription.value,
  cat: draftCategory.value || '网页与效率工具',
  category: draftCategory.value || '网页与效率工具',
  tags: parsedTags.value,
  icon: customIcon.value,
  customIcon: customIcon.value || null,
  localPath: null,
  local_path: null,
  isCustom: true,
  is_custom: true,
}))

const canSave = computed(() => (
  Boolean(normalizedUrl.value)
  && Boolean((draftName.value || fallbackName.value).trim())
  && !isDuplicate.value
))

function tryNormalizeUrl(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''

  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) return ''
    url.hash = ''
    return url.href
  } catch {
    return ''
  }
}

function comparableUrl(value: string): string {
  const normalized = tryNormalizeUrl(value)
  if (!normalized) return ''

  try {
    const url = new URL(normalized)
    const hostname = url.hostname.toLocaleLowerCase().replace(/^www\./i, '')
    const host = `${hostname}${url.port ? `:${url.port}` : ''}`
    url.hash = ''
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '')
    return `${host}${url.pathname}${url.search}`
  } catch {
    return ''
  }
}

function nameFromUrl(value: string): string {
  if (!value) return ''
  try {
    const hostname = new URL(value).hostname.replace(/^www\./i, '')
    const first = hostname.split('.')[0] || hostname
    return first
      .split(/[-_]/)
      .filter(Boolean)
      .map(part => part.length <= 3 ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  } catch {
    return ''
  }
}

function cleanWebsiteTitle(title: string, fallback: string): string {
  const compact = title.trim().replace(/\s+/g, ' ')
  if (!compact) return fallback
  const candidates = compact.split(/\s(?:\||·|—|–)\s/).map(part => part.trim()).filter(Boolean)
  const preferred = candidates.find(part => part.length >= 2 && part.length <= 60)
  return (preferred || compact).slice(0, 60)
}

function inferCategory(text: string): string {
  const value = text.toLocaleLowerCase()
  const rules: Array<[RegExp, string]> = [
    [/\b(ai|gpt|llm|claude|gemini|deepseek|kimi|prompt|chatbot|copilot)\b|人工智能|大模型|智能助手/, 'AI 生产力工具'],
    [/github|gitlab|developer|\bapi\b|\bjson\b|regex|docker|\bnpm\b|vercel|cloudflare|coding|programming|代码|开发|编程/, '开发与极客工具'],
    [/\bpdf\b|image|photo|png|jpg|document|office|compress|convert|ebook|文档|图片|电子书|压缩|转换/, '文档与图片处理'],
    [/diagram|draw|whiteboard|mermaid|mind ?map|chart|visual|flowchart|流程图|白板|思维导图|可视化|制图/, '制图与可视化'],
    [/scholar|research|paper|latex|doi|journal|ping|dns|network|seo|论文|学术|文献|科研|网络/, '科研与网络测试'],
    [/download|proxy|vpn|system|windows|steam|下载|代理|系统/, '本地硬核与系统辅助'],
  ]
  return rules.find(([pattern]) => pattern.test(value))?.[1] || '网页与效率工具'
}

function defaultTags(category: string): string[] {
  const byCategory: Record<string, string[]> = {
    'AI 生产力工具': ['AI', '在线', '效率'],
    '开发与极客工具': ['开发', '在线', '工具'],
    '文档与图片处理': ['文档', '在线', '效率'],
    '制图与可视化': ['制图', '在线', '可视化'],
    '科研与网络测试': ['科研', '在线', '工具'],
    '本地硬核与系统辅助': ['系统', '在线', '工具'],
    '网页与效率工具': ['网页', '在线', '效率'],
  }
  return byCategory[category] || ['网页', '在线', '效率']
}

function parseTags(value: string): string[] {
  return [...new Set(
    value
      .split(/[，,]/)
      .map(tag => tag.trim())
      .filter(Boolean),
  )].slice(0, 5)
}

function applyFallback(url: string): void {
  const name = nameFromUrl(url) || '网页工具'
  const hostname = (() => {
    try { return new URL(url).hostname.replace(/^www\./i, '') } catch { return '' }
  })()
  const category = inferCategory(`${name} ${hostname}`)

  if (!manual.name) draftName.value = name
  if (!manual.description) draftDescription.value = hostname ? `${name} · ${hostname}` : name
  if (!manual.category) draftCategory.value = category
  if (!manual.tags) draftTags.value = defaultTags(category).join(', ')
}

function applyPreview(preview: WebsitePreview, url: string): void {
  const fallback = nameFromUrl(url) || '网页工具'
  const name = cleanWebsiteTitle(preview.title || '', fallback)
  const description = preview.description?.trim() || `${name} · ${displayHostname.value}`
  const category = inferCategory(`${name} ${description} ${displayHostname.value}`)

  if (!manual.name) draftName.value = name
  if (!manual.description) draftDescription.value = description.slice(0, 200)
  if (!manual.category) draftCategory.value = category
  if (!manual.tags) draftTags.value = defaultTags(category).join(', ')
}

async function enrichTags(generation: number): Promise<void> {
  if (!normalizedUrl.value || manual.tags) return
  tagLoading.value = true
  try {
    const response = await toolsApi.recommendTags({
      name: draftName.value || fallbackName.value,
      description: draftDescription.value || fallbackDescription.value,
      url: normalizedUrl.value,
      category: draftCategory.value || undefined,
      limit: 6,
    })
    if (generation !== analysisGeneration || manual.tags) return
    const merged = [...new Set([
      ...parseTags(draftTags.value),
      ...response.data.map(item => item.tag.trim()).filter(Boolean),
    ])].slice(0, 5)
    draftTags.value = merged.join(', ')
  } catch {
    // Offline/backend unavailable: deterministic tags above remain usable.
  } finally {
    if (generation === analysisGeneration) tagLoading.value = false
  }
}

async function analyzeUrl(url: string, generation: number): Promise<void> {
  analysisState.value = 'loading'
  try {
    const response = await toolsApi.getWebsitePreview(url)
    if (generation !== analysisGeneration || normalizedUrl.value !== url) return
    applyPreview(response.data, url)
    analysisState.value = 'ready'
  } catch {
    if (generation !== analysisGeneration || normalizedUrl.value !== url) return
    applyFallback(url)
    analysisState.value = 'fallback'
  }
  void enrichTags(generation)
}

function resetManualState(): void {
  manual.name = false
  manual.description = false
  manual.category = false
  manual.tags = false
}

function onUrlInput(): void {
  if (analyzeTimer) clearTimeout(analyzeTimer)
  analysisGeneration += 1
  const generation = analysisGeneration
  formError.value = ''
  analysisState.value = 'idle'
  tagLoading.value = false
  resetManualState()
  customIcon.value = ''
  cardColor.value = ''

  const normalized = tryNormalizeUrl(urlInput.value)
  normalizedUrl.value = normalized
  if (!normalized) {
    draftName.value = ''
    draftDescription.value = ''
    draftCategory.value = ''
    draftTags.value = ''
    return
  }

  applyFallback(normalized)
  analysisState.value = 'loading'
  analyzeTimer = setTimeout(() => {
    analyzeTimer = null
    void analyzeUrl(normalized, generation)
  }, 380)
}

function normalizeInputDisplay(): void {
  if (normalizedUrl.value) urlInput.value = normalizedUrl.value
}

function clearUrl(): void {
  if (analyzeTimer) clearTimeout(analyzeTimer)
  analysisGeneration += 1
  urlInput.value = ''
  normalizedUrl.value = ''
  analysisState.value = 'idle'
  draftName.value = ''
  draftDescription.value = ''
  draftCategory.value = ''
  draftTags.value = ''
  customIcon.value = ''
  cardColor.value = ''
  formError.value = ''
  showAdvanced.value = false
  void nextTick(() => urlInputRef.value?.focus())
}

function handleEnter(): void {
  if (canSave.value && analysisState.value !== 'loading') {
    void save()
  }
}

function onIconFile(event: Event): void {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = loadEvent => {
    const result = loadEvent.target?.result
    customIcon.value = typeof result === 'string' ? result : ''
  }
  reader.readAsDataURL(file)
  ;(event.target as HTMLInputElement).value = ''
}

async function save(): Promise<void> {
  if (!canSave.value || saving.value) return

  const name = (draftName.value || fallbackName.value).trim()
  const description = (draftDescription.value || fallbackDescription.value || name).trim()
  const category = draftCategory.value.trim() || '网页与效率工具'
  const tags = parsedTags.value.length ? parsedTags.value : defaultTags(category)

  if (!name) {
    formError.value = '请填写工具名称'
    return
  }
  if (isDuplicate.value) {
    formError.value = '这个网站已经在工具箱中'
    return
  }

  saving.value = true
  formError.value = ''
  let added = false
  try {
    await tools.addCustomTool({
      name,
      url: normalizedUrl.value,
      desc: description,
      description,
      tags,
      cat: category,
      category,
      icon: customIcon.value,
      customIcon: customIcon.value || null,
      localPath: null,
      local_path: null,
      cardColor: cardColor.value || null,
      card_color: cardColor.value || null,
      isCustom: true,
      is_custom: true,
    })
    ui.showToast(`已添加网页工具「${name}」`)
    added = true
  } catch {
    formError.value = '添加失败，请稍后重试'
  } finally {
    saving.value = false
  }
  if (added) close()
}

function reset(): void {
  if (analyzeTimer) clearTimeout(analyzeTimer)
  analysisGeneration += 1
  urlInput.value = ''
  normalizedUrl.value = ''
  analysisState.value = 'idle'
  saving.value = false
  tagLoading.value = false
  showAdvanced.value = false
  formError.value = ''
  draftName.value = ''
  draftDescription.value = ''
  draftCategory.value = ''
  draftTags.value = ''
  customIcon.value = ''
  cardColor.value = ''
  resetManualState()
}

function open(initialUrl = ''): void {
  reset()
  openState.value = true
  if (initialUrl) {
    urlInput.value = initialUrl
    onUrlInput()
  }
  void nextTick(() => urlInputRef.value?.focus())
}

function close(): void {
  if (saving.value) return
  openState.value = false
  reset()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && openState.value) close()
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown)
}

onUnmounted(() => {
  if (analyzeTimer) clearTimeout(analyzeTimer)
  window.removeEventListener('keydown', onKeydown)
})

defineExpose({ open })
</script>

<style scoped>
.web-import-overlay{position:fixed;inset:0;z-index:2420;display:grid;place-items:center;padding:24px;background:rgb(15 23 42 / 20%);backdrop-filter:blur(16px) saturate(120%);-webkit-backdrop-filter:blur(16px) saturate(120%)}
.web-import-panel{width:min(600px,calc(100vw - 36px));max-height:min(820px,calc(100vh - 40px));overflow:auto;padding:22px;border:1px solid color-mix(in srgb,white 22%,var(--glass-border));border-radius:20px;background:linear-gradient(145deg,rgb(255 255 255 / 20%),transparent 44%),color-mix(in srgb,var(--glass-bg) 88%,var(--bg-primary));box-shadow:0 18px 60px rgb(0 0 0 / 10%),inset 0 1px 0 rgb(255 255 255 / 26%);backdrop-filter:blur(28px) saturate(150%);-webkit-backdrop-filter:blur(28px) saturate(150%)}
.web-import-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.web-import-brand{display:flex;gap:12px;min-width:0}.brand-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:14px;background:color-mix(in srgb,var(--primary) 9%,var(--glass-bg));box-shadow:inset 0 1px 0 rgb(255 255 255 / 28%);color:var(--primary)}.brand-icon svg{width:22px;height:22px;stroke:currentColor;stroke-width:1.65;stroke-linecap:round;stroke-linejoin:round}.eyebrow{display:block;margin-bottom:3px;color:var(--primary);font-size:.58rem;font-weight:760;letter-spacing:.12em}.web-import-header h2{margin:0;color:var(--text-primary);font-size:1.18rem;font-weight:720;letter-spacing:-.03em}.web-import-header p{margin:5px 0 0;max-width:440px;color:var(--text-tertiary);font-size:.68rem;line-height:1.6}.close-button{width:30px;height:30px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--text-tertiary);font-size:1.15rem;cursor:pointer;transition:transform .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1),color .3s cubic-bezier(.25,.1,.25,1)}.close-button:hover{background:var(--btn-bg);color:var(--text-primary)}.close-button:active{transform:scale(.98)}
.url-entry{display:grid;gap:6px}.url-entry>label{color:var(--text-secondary);font-size:.62rem;font-weight:660}.url-input-shell{height:50px;display:grid;grid-template-columns:22px minmax(0,1fr) 24px;align-items:center;gap:6px;padding:0 12px;border:1px solid color-mix(in srgb,var(--glass-border) 84%,white 16%);border-radius:15px;background:color-mix(in srgb,var(--input-bg) 90%,transparent);box-shadow:inset 0 1px 0 rgb(255 255 255 / 18%);transition:border-color .3s cubic-bezier(.25,.1,.25,1),box-shadow .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1)}.url-input-shell:focus-within{border-color:color-mix(in srgb,var(--primary) 52%,var(--glass-border));box-shadow:0 0 0 4px color-mix(in srgb,var(--primary) 8%,transparent),inset 0 1px 0 rgb(255 255 255 / 18%);background:color-mix(in srgb,var(--input-bg) 96%,var(--bg-primary) 4%)}.url-input-shell.invalid{border-color:color-mix(in srgb,#ff453a 46%,var(--glass-border))}.link-icon{display:grid;place-items:center;color:var(--primary);font-size:.9rem}.url-input-shell input{width:100%;height:100%;padding:0;border:0;outline:0;background:transparent;color:var(--text-primary);font:inherit;font-size:.79rem}.url-input-shell input::placeholder{color:var(--text-tertiary)}.clear-url{width:24px;height:24px;border:0;border-radius:8px;background:transparent;color:var(--text-tertiary);cursor:pointer}.clear-url:hover{background:var(--btn-bg);color:var(--text-primary)}.analysis-spinner{width:15px;height:15px;justify-self:center;border:1.8px solid color-mix(in srgb,var(--primary) 20%,transparent);border-top-color:var(--primary);border-radius:50%;animation:spin .8s cubic-bezier(.25,.1,.25,1) infinite}.url-status{min-height:17px;padding:0 2px;color:var(--text-tertiary);font-size:.56rem}.status-error{color:#ff453a}
.preview-card{display:grid;grid-template-columns:54px minmax(0,1fr);gap:13px;margin-top:14px;padding:15px;border:1px solid color-mix(in srgb,var(--glass-border) 82%,white 18%);border-radius:18px;background:linear-gradient(145deg,rgb(255 255 255 / 14%),transparent 52%),color-mix(in srgb,var(--glass-bg) 76%,transparent);box-shadow:0 8px 30px rgb(0 0 0 / 4%),inset 0 1px 0 rgb(255 255 255 / 20%)}.preview-icon{width:54px;height:54px;padding:8px;border-radius:16px;background:color-mix(in srgb,var(--primary) 6%,var(--accent-soft));box-shadow:inset 0 1px 0 rgb(255 255 255 / 22%)}.preview-copy{min-width:0;display:grid;align-content:start;gap:3px}.preview-copy strong{overflow:hidden;color:var(--text-primary);font-size:.86rem;font-weight:690;text-overflow:ellipsis;white-space:nowrap}.preview-copy>span{overflow:hidden;color:var(--text-tertiary);font-size:.56rem;text-overflow:ellipsis;white-space:nowrap}.preview-copy p{margin:4px 0 5px;display:-webkit-box;overflow:hidden;color:var(--text-secondary);font-size:.62rem;line-height:1.5;-webkit-box-orient:vertical;-webkit-line-clamp:2}.preview-meta{display:flex;flex-wrap:wrap;gap:5px}.preview-meta span{padding:3px 7px;border-radius:999px;background:color-mix(in srgb,var(--primary) 5%,var(--btn-bg));color:var(--text-tertiary);font-size:.5rem}.preview-meta .category-pill{color:var(--primary);font-weight:630}
.advanced-toggle{width:100%;min-height:36px;display:flex;align-items:center;justify-content:space-between;margin-top:10px;padding:0 4px;border:0;background:transparent;color:var(--text-tertiary);font-size:.59rem;font-weight:600;cursor:pointer}.advanced-toggle:hover{color:var(--text-secondary)}.advanced-panel{margin-top:2px;padding:13px;border:1px solid color-mix(in srgb,var(--glass-border) 70%,transparent);border-radius:15px;background:color-mix(in srgb,var(--glass-bg) 54%,transparent)}.advanced-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.advanced-grid label{display:grid;gap:5px}.advanced-grid .wide{grid-column:1/-1}.advanced-grid label>span,.icon-setting>span,.color-setting>span{color:var(--text-tertiary);font-size:.56rem;font-weight:620}.advanced-grid input,.advanced-grid textarea{width:100%;padding:0 10px;border:1px solid color-mix(in srgb,var(--glass-border) 80%,transparent);border-radius:10px;outline:0;background:color-mix(in srgb,var(--input-bg) 86%,transparent);color:var(--text-primary);font:inherit;font-size:.64rem;transition:border-color .3s cubic-bezier(.25,.1,.25,1),box-shadow .3s cubic-bezier(.25,.1,.25,1)}.advanced-grid input{height:36px}.advanced-grid textarea{min-height:58px;padding-block:9px;resize:vertical;line-height:1.5}.advanced-grid input:focus,.advanced-grid textarea:focus{border-color:color-mix(in srgb,var(--primary) 45%,var(--glass-border));box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 7%,transparent)}.advanced-grid small{color:var(--text-tertiary);font-size:.5rem}.advanced-row{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:11px}.icon-setting,.color-setting{display:grid;gap:6px}.icon-setting>div,.color-setting>div{display:flex;align-items:center;gap:7px}.secondary-mini{min-height:30px;padding:0 9px;border:1px solid var(--glass-border);border-radius:9px;background:var(--btn-bg);color:var(--text-secondary);font-size:.56rem;cursor:pointer}.text-mini{padding:0;border:0;background:transparent;color:var(--primary);font-size:.54rem;cursor:pointer}.color-setting input[type='color']{width:34px;height:30px;padding:2px;border:1px solid var(--glass-border);border-radius:9px;background:var(--btn-bg);cursor:pointer}
.form-error{margin:9px 0 0;color:#ff453a;font-size:.59rem}.web-import-actions{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:15px;padding-top:13px;border-top:1px solid color-mix(in srgb,var(--divider) 60%,transparent)}.privacy-hint{display:grid;gap:2px;color:var(--text-tertiary);font-size:.5rem;line-height:1.45}.action-buttons{display:flex;gap:8px}.action-buttons button{min-height:35px;padding:0 14px;border-radius:10px;font:inherit;font-size:.63rem;font-weight:650;cursor:pointer;transition:transform .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1),opacity .3s cubic-bezier(.25,.1,.25,1)}.action-buttons button:active:not(:disabled){transform:scale(.98)}.action-buttons .secondary{border:1px solid var(--glass-border);background:var(--btn-bg);color:var(--text-secondary)}.action-buttons .primary{border:1px solid color-mix(in srgb,var(--primary) 72%,transparent);background:var(--primary);color:#fff}.action-buttons button:disabled{opacity:.42;cursor:not-allowed}
.web-import-enter-active,.web-import-leave-active{transition:opacity .3s cubic-bezier(.25,.1,.25,1)}.web-import-enter-active .web-import-panel,.web-import-leave-active .web-import-panel{transition:transform .3s cubic-bezier(.25,.1,.25,1),opacity .3s cubic-bezier(.25,.1,.25,1)}.web-import-enter-from,.web-import-leave-to{opacity:0}.web-import-enter-from .web-import-panel,.web-import-leave-to .web-import-panel{opacity:0;transform:translateY(10px) scale(.985)}.advanced-enter-active,.advanced-leave-active{transition:opacity .3s cubic-bezier(.25,.1,.25,1),transform .3s cubic-bezier(.25,.1,.25,1)}.advanced-enter-from,.advanced-leave-to{opacity:0;transform:translateY(-4px)}@keyframes spin{to{transform:rotate(360deg)}}
:global([data-theme='dark']) .web-import-panel{border-color:rgb(255 255 255 / 9%);box-shadow:0 22px 70px rgb(0 0 0 / 28%),inset 0 1px 0 rgb(255 255 255 / 6%)}@media(max-width:640px){.web-import-overlay{padding:12px}.web-import-panel{width:100%;padding:17px;border-radius:18px}.web-import-header p{font-size:.62rem}.advanced-grid,.advanced-row{grid-template-columns:1fr}.advanced-grid .wide{grid-column:auto}.web-import-actions{align-items:stretch;flex-direction:column}.privacy-hint{order:2}.action-buttons{width:100%}.action-buttons button{flex:1}}
</style>
