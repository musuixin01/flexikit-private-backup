<template>
  <Teleport to="body">
    <Transition name="local-import">
      <div v-if="openState" class="local-import-overlay" @pointerdown.self="close">
        <section
          class="local-import-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="local-import-title"
          @pointerdown.stop
        >
          <header class="local-import-header">
            <div class="local-import-brand">
              <span class="brand-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="5" width="16" height="14" rx="4"/>
                  <path d="M8 9.5h8M8 13h5"/>
                  <path d="M16.5 14.5v4M14.5 16.5h4"/>
                </svg>
              </span>
              <div>
                <span class="eyebrow">LOCAL TOOL</span>
                <h2 id="local-import-title">添加本地工具</h2>
                <p>拖入 Windows 启动程序，FlexiKit 会自动读取名称、路径和程序图标。</p>
              </div>
            </div>
            <button class="close-button" type="button" aria-label="关闭" @click="close">×</button>
          </header>

          <div
            class="drop-zone"
            ref="dropZoneRef"
            :class="{ active: dragActive, loading }"
            role="button"
            tabindex="0"
            @click="pickFile"
            @keydown.enter.prevent="pickFile"
            @keydown.space.prevent="pickFile"
          >
            <span class="drop-icon" aria-hidden="true">
              <svg viewBox="0 0 28 28" fill="none">
                <path d="M14 18V7m0 0-4 4m4-4 4 4"/>
                <path d="M6.5 17.5v2A2.5 2.5 0 0 0 9 22h10a2.5 2.5 0 0 0 2.5-2.5v-2"/>
              </svg>
            </span>
            <strong>{{ loading ? '正在读取程序信息…' : dragActive ? '松开即可添加' : '将启动程序拖到这里' }}</strong>
            <span :class="{ 'drop-status-error': dropListenerError }">
              {{ dropListenerError || (dropReady ? '支持 .exe、.lnk、.url、.msi · 拖放已就绪' : '正在启用桌面拖放…') }}
            </span>
            <button type="button" :disabled="loading" @click.stop="pickFile">
              {{ loading ? '读取中…' : '选择启动程序' }}
            </button>
          </div>

          <div v-if="current" class="candidate-card">
            <div class="candidate-summary">
              <span class="candidate-icon">
                <img v-if="current.icon" :src="current.icon" alt="">
                <span v-else aria-hidden="true">▦</span>
              </span>
              <div class="candidate-copy">
                <div class="candidate-title-row">
                  <strong>{{ current.draftName }}</strong>
                  <span class="file-type">.{{ current.extension.toUpperCase() }}</span>
                  <span v-if="queue.length > 1" class="queue-count">待确认 {{ queue.length }} 个</span>
                </div>
                <small :title="current.path">{{ current.path }}</small>
              </div>
            </div>

            <div class="candidate-form">
              <label>
                <span>名称</span>
                <input v-model.trim="current.draftName" maxlength="60" autocomplete="off">
              </label>
              <label>
                <span>分类</span>
                <input
                  v-model.trim="current.draftCategory"
                  list="local-tool-category-options"
                  maxlength="60"
                  placeholder="本地工具"
                  autocomplete="off"
                >
                <datalist id="local-tool-category-options">
                  <option v-for="category in categoryOptions" :key="category" :value="category"></option>
                </datalist>
              </label>
            </div>

            <p v-if="formError" class="form-error" role="alert">{{ formError }}</p>

            <footer class="candidate-actions">
              <button class="secondary" type="button" @click="skipCurrent">
                {{ queue.length > 1 ? '跳过这个' : '取消' }}
              </button>
              <button class="primary" type="button" :disabled="saving" @click="confirmCurrent">
                {{ saving ? '添加中…' : queue.length > 1 ? '添加并继续' : '添加到工具箱' }}
              </button>
            </footer>
          </div>

          <div v-else class="local-import-hint">
            <span>拖入多个程序时会逐个确认，不会打乱现有工具排序。</span>
            <span>离线也可以添加；联网后的同步行为沿用现有工具数据规则。</span>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { isDesktopRuntime } from '@/api/runtime'
import {
  inspectLocalToolPaths,
  pickLocalToolFile,
  subscribeLocalToolDrops,
  type LocalToolCandidate,
} from '@/desktop/localToolImport'

interface PendingLocalTool extends LocalToolCandidate {
  draftName: string
  draftCategory: string
}

const tools = useToolsStore()
const ui = useUiStore()
const openState = ref(false)
const dragActive = ref(false)
const loading = ref(false)
const saving = ref(false)
const formError = ref('')
const dropListenerError = ref('')
const dropReady = ref(false)
const queue = ref<PendingLocalTool[]>([])
const dropZoneRef = ref<HTMLElement | null>(null)
let stopDropListener: (() => void) | null = null
let listenerGeneration = 0

const current = computed(() => queue.value[0] ?? null)
const categoryOptions = computed(() => {
  const categories = ['本地工具', ...tools.categoryList]
  return [...new Set(categories.filter(Boolean))]
})

function normalizePath(path: string): string {
  return path.trim().replace(/\//g, '\\').toLocaleLowerCase()
}

function existingPathSet(): Set<string> {
  return new Set(
    tools.allTools
      .map(tool => tool.localPath || tool.local_path || '')
      .filter(Boolean)
      .map(normalizePath),
  )
}

async function addPaths(paths: string[]): Promise<void> {
  const cleaned = [...new Set(paths.map(path => path.trim()).filter(Boolean))]
  if (!cleaned.length || loading.value) return

  loading.value = true
  formError.value = ''
  try {
    const inspections = await inspectLocalToolPaths(cleaned)
    const existing = existingPathSet()
    const queued = new Set(queue.value.map(item => normalizePath(item.path)))
    let invalidCount = 0
    let duplicateCount = 0

    for (const item of inspections) {
      if (item.error) {
        invalidCount += 1
        continue
      }

      const key = normalizePath(item.path)
      if (existing.has(key) || queued.has(key)) {
        duplicateCount += 1
        continue
      }

      queue.value.push({
        ...item,
        draftName: item.name || '本地工具',
        draftCategory: '本地工具',
      })
      queued.add(key)
    }

    if (!queue.value.length && duplicateCount) {
      ui.showToast('这些程序已经在工具箱中')
    } else if (!queue.value.length && invalidCount) {
      ui.showToast('没有可添加的启动程序，仅支持 .exe、.lnk、.url、.msi')
    } else if (invalidCount || duplicateCount) {
      const notes = [
        invalidCount ? invalidCount + ' 个文件不受支持' : '',
        duplicateCount ? duplicateCount + ' 个程序已存在' : '',
      ].filter(Boolean)
      ui.showToast('已跳过：' + notes.join('，'))
    }
  } catch (error: unknown) {
    ui.showToast(error instanceof Error ? error.message : '读取启动程序失败')
  } finally {
    loading.value = false
    dragActive.value = false
  }
}

async function pickFile(): Promise<void> {
  if (!isDesktopRuntime() || loading.value) return
  try {
    const path = await pickLocalToolFile()
    if (path) await addPaths([path])
  } catch (error: unknown) {
    ui.showToast(error instanceof Error ? error.message : '选择启动程序失败')
  }
}

function isInsideDropZone(position?: { x: number; y: number }): boolean {
  const element = dropZoneRef.value
  if (!element || !position) return false
  const rect = element.getBoundingClientRect()
  return (
    position.x >= rect.left
    && position.x <= rect.right
    && position.y >= rect.top
    && position.y <= rect.bottom
  )
}

async function startDropListener(): Promise<void> {
  const generation = ++listenerGeneration
  dropReady.value = false
  dropListenerError.value = ''

  try {
    const unlisten = await subscribeLocalToolDrops(state => {
      if (!openState.value) return
      const inside = isInsideDropZone(state.position)
      dragActive.value = state.active && inside
      if (state.paths?.length && inside) void addPaths(state.paths)
    })

    if (!openState.value || generation !== listenerGeneration) {
      unlisten()
      return
    }
    stopDropListener = unlisten
    dropReady.value = true
  } catch (error: unknown) {
    if (!openState.value || generation !== listenerGeneration) return
    const detail = error instanceof Error ? error.message : String(error)
    dropListenerError.value = '当前桌面组件未开放拖放权限，请更新桌面端后重试'
    console.warn('Failed to subscribe local tool drag/drop', detail)
  }
}
function stopListening(): void {
  listenerGeneration += 1
  stopDropListener?.()
  stopDropListener = null
  dragActive.value = false
  dropReady.value = false
}

function open(): void {
  if (!isDesktopRuntime()) {
    ui.showToast('添加本地工具仅支持 FlexiKit 桌面端')
    return
  }
  stopListening()
  queue.value = []
  formError.value = ''
  dropListenerError.value = ''
  openState.value = true
  void startDropListener()
}

function close(): void {
  if (saving.value) return
  stopListening()
  openState.value = false
  queue.value = []
  formError.value = ''
}

function skipCurrent(): void {
  if (queue.value.length <= 1) {
    close()
    return
  }
  queue.value.shift()
  formError.value = ''
}

async function confirmCurrent(): Promise<void> {
  const item = current.value
  if (!item || saving.value) return

  const name = item.draftName.trim()
  const category = item.draftCategory.trim() || '本地工具'
  if (!name) {
    formError.value = '请填写工具名称'
    return
  }

  if (existingPathSet().has(normalizePath(item.path))) {
    formError.value = '这个程序已经在工具箱中'
    return
  }

  saving.value = true
  formError.value = ''
  try {
    await tools.addCustomTool({
      name,
      url: '#',
      desc: '本地应用',
      description: '本地应用',
      tags: ['本地'],
      cat: category,
      category,
      localPath: item.path,
      local_path: item.path,
      icon: item.icon || '▦',
      customIcon: item.icon,
      isCustom: true,
      is_custom: true,
    })
    ui.showToast('已添加本地工具「' + name + '」')
    queue.value.shift()
    if (!queue.value.length) close()
  } catch {
    formError.value = '添加失败，请稍后重试'
  } finally {
    saving.value = false
  }
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && openState.value) close()
}

if (typeof window !== 'undefined') {
  window.addEventListener('keydown', onKeydown)
}

onUnmounted(() => {
  stopListening()
  window.removeEventListener('keydown', onKeydown)
})

defineExpose({ open })
</script>

<style scoped>
.local-import-overlay{position:fixed;inset:0;z-index:2400;display:grid;place-items:center;padding:24px;background:rgb(15 23 42 / 22%);backdrop-filter:blur(16px) saturate(120%);-webkit-backdrop-filter:blur(16px) saturate(120%)}
.local-import-panel{width:min(620px,calc(100vw - 36px));max-height:min(760px,calc(100vh - 40px));overflow:auto;padding:22px;border:1px solid color-mix(in srgb,white 22%,var(--glass-border));border-radius:20px;background:linear-gradient(145deg,rgb(255 255 255 / 20%),transparent 44%),color-mix(in srgb,var(--glass-bg) 88%,var(--bg-primary));box-shadow:0 18px 60px rgb(0 0 0 / 12%),inset 0 1px 0 rgb(255 255 255 / 26%);backdrop-filter:blur(28px) saturate(150%);-webkit-backdrop-filter:blur(28px) saturate(150%)}
.local-import-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:18px}.local-import-brand{display:flex;gap:12px;min-width:0}.brand-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;border-radius:14px;background:color-mix(in srgb,var(--primary) 9%,var(--glass-bg));box-shadow:inset 0 1px 0 rgb(255 255 255 / 28%);color:var(--primary)}.brand-icon svg{width:22px;height:22px;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.eyebrow{display:block;margin-bottom:3px;color:var(--primary);font-size:.58rem;font-weight:760;letter-spacing:.12em}.local-import-header h2{margin:0;color:var(--text-primary);font-size:1.18rem;font-weight:720;letter-spacing:-.03em}.local-import-header p{margin:5px 0 0;max-width:430px;color:var(--text-tertiary);font-size:.68rem;line-height:1.6}.close-button{width:30px;height:30px;border:1px solid transparent;border-radius:10px;background:transparent;color:var(--text-tertiary);font-size:1.15rem;cursor:pointer;transition:transform .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1),color .3s cubic-bezier(.25,.1,.25,1)}.close-button:hover{background:var(--btn-bg);color:var(--text-primary)}.close-button:active{transform:scale(.98)}
.drop-zone{min-height:188px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:22px;border:1.5px dashed color-mix(in srgb,var(--primary) 24%,var(--glass-border));border-radius:20px;background:radial-gradient(circle at 50% 10%,color-mix(in srgb,var(--primary) 7%,transparent),transparent 55%),color-mix(in srgb,var(--glass-bg) 62%,transparent);cursor:pointer;outline:none;transition:transform .3s cubic-bezier(.25,.1,.25,1),border-color .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1),box-shadow .3s cubic-bezier(.25,.1,.25,1)}.drop-zone:hover,.drop-zone:focus-visible{border-color:color-mix(in srgb,var(--primary) 48%,var(--glass-border));background:color-mix(in srgb,var(--primary) 5%,var(--glass-bg));box-shadow:0 8px 30px rgb(0 0 0 / 5%)}.drop-zone.active{transform:scale(1.012);border-color:var(--primary);background:color-mix(in srgb,var(--primary) 10%,var(--glass-bg));box-shadow:0 12px 36px color-mix(in srgb,var(--primary) 10%,transparent),inset 0 0 0 1px color-mix(in srgb,var(--primary) 16%,transparent)}.drop-zone.loading{cursor:progress;opacity:.72}.drop-icon{width:48px;height:48px;display:grid;place-items:center;margin-bottom:2px;border-radius:16px;background:color-mix(in srgb,var(--primary) 8%,var(--glass-bg));color:var(--primary)}.drop-icon svg{width:25px;height:25px;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.drop-zone strong{color:var(--text-primary);font-size:.84rem;font-weight:680}.drop-zone>span:not(.drop-icon){color:var(--text-tertiary);font-size:.62rem}.drop-zone>span.drop-status-error{color:#ff453a}.drop-zone>button{min-height:32px;margin-top:7px;padding:0 13px;border:1px solid color-mix(in srgb,var(--primary) 18%,var(--glass-border));border-radius:10px;background:color-mix(in srgb,var(--primary) 7%,var(--btn-bg));color:var(--primary);font-size:.64rem;font-weight:650;cursor:pointer;transition:transform .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1)}.drop-zone>button:hover:not(:disabled){transform:translateY(-1px);background:color-mix(in srgb,var(--primary) 11%,var(--btn-bg))}.drop-zone>button:active:not(:disabled){transform:scale(.98)}.drop-zone>button:disabled{cursor:progress;opacity:.55}
.candidate-card{margin-top:14px;padding:14px;border:1px solid color-mix(in srgb,var(--glass-border) 82%,white 18%);border-radius:18px;background:linear-gradient(145deg,rgb(255 255 255 / 14%),transparent 52%),color-mix(in srgb,var(--glass-bg) 78%,transparent);box-shadow:0 8px 30px rgb(0 0 0 / 4%),inset 0 1px 0 rgb(255 255 255 / 20%)}.candidate-summary{display:flex;align-items:center;gap:11px;padding-bottom:12px;border-bottom:1px solid color-mix(in srgb,var(--divider) 65%,transparent)}.candidate-icon{width:42px;height:42px;display:grid;place-items:center;flex:0 0 auto;padding:5px;border-radius:13px;background:color-mix(in srgb,var(--primary) 6%,var(--accent-soft));font-size:1.25rem}.candidate-icon img{width:100%;height:100%;object-fit:contain}.candidate-copy{min-width:0;flex:1}.candidate-title-row{display:flex;align-items:center;gap:7px;min-width:0}.candidate-title-row strong{min-width:0;overflow:hidden;color:var(--text-primary);font-size:.76rem;font-weight:680;text-overflow:ellipsis;white-space:nowrap}.file-type,.queue-count{flex:0 0 auto;padding:2px 6px;border-radius:999px;background:color-mix(in srgb,var(--primary) 7%,var(--btn-bg));color:var(--text-tertiary);font-size:.51rem;font-weight:650}.queue-count{color:var(--primary)}.candidate-copy small{display:block;margin-top:4px;overflow:hidden;color:var(--text-tertiary);font-size:.55rem;text-overflow:ellipsis;white-space:nowrap}.candidate-form{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}.candidate-form label{display:grid;gap:5px}.candidate-form label>span{color:var(--text-tertiary);font-size:.57rem;font-weight:620}.candidate-form input{width:100%;height:36px;padding:0 10px;border:1px solid color-mix(in srgb,var(--glass-border) 80%,transparent);border-radius:10px;outline:none;background:color-mix(in srgb,var(--input-bg) 86%,transparent);color:var(--text-primary);font:inherit;font-size:.66rem;transition:border-color .3s cubic-bezier(.25,.1,.25,1),box-shadow .3s cubic-bezier(.25,.1,.25,1)}.candidate-form input:focus{border-color:color-mix(in srgb,var(--primary) 45%,var(--glass-border));box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 8%,transparent)}.form-error{margin:9px 0 0;color:#ff453a;font-size:.59rem}.candidate-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:14px}.candidate-actions button{min-height:34px;padding:0 13px;border-radius:10px;font:inherit;font-size:.63rem;font-weight:650;cursor:pointer;transition:transform .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1)}.candidate-actions button:active:not(:disabled){transform:scale(.98)}.candidate-actions .secondary{border:1px solid var(--glass-border);background:var(--btn-bg);color:var(--text-secondary)}.candidate-actions .primary{border:1px solid color-mix(in srgb,var(--primary) 72%,transparent);background:var(--primary);color:#fff}.candidate-actions button:disabled{opacity:.52;cursor:progress}.local-import-hint{display:flex;justify-content:space-between;gap:16px;margin-top:12px;padding:0 3px;color:var(--text-tertiary);font-size:.54rem;line-height:1.5}
.local-import-enter-active,.local-import-leave-active{transition:opacity .3s cubic-bezier(.25,.1,.25,1)}.local-import-enter-active .local-import-panel,.local-import-leave-active .local-import-panel{transition:transform .3s cubic-bezier(.25,.1,.25,1),opacity .3s cubic-bezier(.25,.1,.25,1)}.local-import-enter-from,.local-import-leave-to{opacity:0}.local-import-enter-from .local-import-panel,.local-import-leave-to .local-import-panel{opacity:0;transform:translateY(10px) scale(.985)}
:global([data-theme='dark']) .local-import-panel{border-color:rgb(255 255 255 / 9%);box-shadow:0 22px 70px rgb(0 0 0 / 28%),inset 0 1px 0 rgb(255 255 255 / 6%)}
@media(max-width:620px){.local-import-overlay{padding:12px}.local-import-panel{width:100%;padding:17px;border-radius:18px}.candidate-form{grid-template-columns:1fr}.local-import-hint{flex-direction:column;gap:4px}.drop-zone{min-height:168px}}
</style>
