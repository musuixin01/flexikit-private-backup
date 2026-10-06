<template>
  <main class="assistant-page">
    <section class="assistant-shell" aria-labelledby="assistant-title">
      <header class="assistant-header">
        <div>
          <span class="assistant-kicker">FLEXIKIT AI</span>
          <h1 id="assistant-title">AI 助手</h1>
          <p>当前每次提问独立生成；页面内消息只保存在内存，刷新即清空。</p>
        </div>
        <RouterLink to="/profile" class="settings-link">API Key 设置</RouterLink>
      </header>

      <ConnectivityNotice
        message="AI 生成需要网络连接；本地文件选择、剪贴板读取和当前工具上下文仍可正常使用。"
        @reconnected="loadCatalogs"
      />

      <section class="assistant-controls" aria-label="AI 模型设置">
        <div class="segmented">
          <button
            type="button"
            :class="{ active: billingMode === 'platform' }"
            @click="billingMode = 'platform'"
          >
            平台模型
          </button>
          <button
            type="button"
            :class="{ active: billingMode === 'byok' }"
            @click="billingMode = 'byok'"
          >
            我的 API Key
          </button>
        </div>

        <label>
          <span>Provider</span>
          <select v-model="selectedProviderId" :disabled="catalogLoading">
            <option v-if="billingMode === 'platform'" value="">自动选择</option>
            <option
              v-for="provider in activeProviders"
              :key="provider.id"
              :value="provider.id"
            >
              {{ provider.displayName }}
            </option>
          </select>
        </label>

        <label>
          <span>模型</span>
          <select v-model="selectedModelId" :disabled="!selectedProvider">
            <option value="">
              {{ selectedProvider ? '默认模型' : '跟随自动路由' }}
            </option>
            <option
              v-for="model in selectedProvider?.models ?? []"
              :key="model.id"
              :value="model.id"
            >
              {{ model.displayName }}
            </option>
          </select>
        </label>
      </section>

      <section class="history-policy" aria-label="Prompt 历史隐私策略">
        <div class="history-policy-copy">
          <span>Prompt 历史隐私</span>
          <strong>{{ assistantHistoryPolicy.displayLabel }}</strong>
          <small>刷新或关闭页面后清空；Prompt/回复不会写入服务器、本地存储或备份，工具/文件/Clipboard 上下文也不会进入历史。</small>
        </div>
        <button
          type="button"
          class="context-button subtle"
          :disabled="messages.length === 0 || loading"
          @click="clearSessionMessages"
        >
          清空本次对话
        </button>
      </section>

      <section v-if="currentTool" class="tool-context" aria-label="当前工具上下文">
        <div class="tool-context-copy">
          <span>当前工具上下文</span>
          <strong>{{ currentTool.name }}</strong>
          <small>{{ currentToolSummary }}</small>
        </div>
        <label class="context-toggle">
          <input v-model="includeCurrentTool" type="checkbox">
          <span>随本次问题发送</span>
        </label>
      </section>

      <section class="tool-context file-context" aria-label="当前文件上下文">
        <div class="tool-context-copy">
          <span>当前文件上下文</span>
          <strong>{{ currentFile?.name ?? '未选择文件' }}</strong>
          <small>{{ currentFileSummary }}</small>
        </div>
        <div class="file-context-actions">
          <label v-if="currentFile" class="context-toggle">
            <input v-model="includeCurrentFile" type="checkbox">
            <span>随本次问题发送</span>
          </label>
          <button
            type="button"
            class="context-button"
            :disabled="filePickerLoading || loading"
            @click="selectCurrentFile"
          >
            {{ filePickerLoading ? '选择中…' : currentFile ? '更换文件' : '选择文件' }}
          </button>
          <button
            v-if="currentFile"
            type="button"
            class="context-button subtle"
            :disabled="loading"
            @click="removeCurrentFile"
          >
            移除
          </button>
        </div>
      </section>
      <p v-if="fileContextError" class="status error" role="alert">{{ fileContextError }}</p>

      <section class="tool-context clipboard-context" aria-label="Clipboard 按需上下文">
        <div class="tool-context-copy">
          <span>Clipboard 按需上下文</span>
          <strong>{{ currentClipboard ? '已读取剪贴板文本' : '未读取剪贴板' }}</strong>
          <small>{{ currentClipboardSummary }}</small>
        </div>
        <div class="file-context-actions">
          <label v-if="currentClipboard" class="context-toggle">
            <input v-model="includeCurrentClipboard" type="checkbox">
            <span>随本次问题发送</span>
          </label>
          <button
            type="button"
            class="context-button"
            :disabled="clipboardLoading || loading"
            @click="readCurrentClipboard"
          >
            {{ clipboardLoading ? '读取中…' : currentClipboard ? '重新读取' : '读取剪贴板' }}
          </button>
          <button
            v-if="currentClipboard"
            type="button"
            class="context-button subtle"
            :disabled="loading"
            @click="removeCurrentClipboard"
          >
            移除
          </button>
        </div>
      </section>
      <p v-if="clipboardContextError" class="status error" role="alert">{{ clipboardContextError }}</p>

      <p v-if="catalogError" class="status error" role="alert">{{ catalogError }}</p>
      <p
        v-else-if="billingMode === 'platform' && !catalogLoading && activeProviders.length === 0"
        class="status"
      >
        当前服务器没有平台 Provider，可切换到“我的 API Key”。
      </p>

      <section class="quick-actions" aria-label="AI 快捷操作">
        <div class="quick-actions-copy">
          <span>快捷操作</span>
          <small>点击只会填入输入框，不会自动发送，也不会读取新的文件或剪贴板内容。</small>
        </div>
        <div class="quick-actions-list">
          <button
            v-for="action in assistantQuickActions"
            :key="action.id"
            type="button"
            class="quick-action-button"
            :disabled="isQuickActionDisabled(action)"
            @click="applyQuickAction(action)"
          >
            {{ action.label }}
          </button>
        </div>
      </section>

      <section ref="conversationRef" class="conversation" aria-live="polite">
        <div v-if="messages.length === 0" class="empty-state">
          <div class="assistant-orb" aria-hidden="true"><span></span></div>
          <h2>需要我帮你做什么？</h2>
          <p>工具、文件和剪贴板都只在明确可见的上下文卡片中按需附带；剪贴板不会自动读取或监听。</p>
        </div>

        <article
          v-for="message in messages"
          :key="message.id"
          :class="['message', message.role]"
        >
          <div class="message-label">{{ message.role === 'user' ? '你' : 'FlexiKit AI' }}</div>
          <div class="message-content">{{ message.text }}</div>
          <div v-if="message.meta" class="message-meta">{{ message.meta }}</div>
        </article>

        <article v-if="loading" class="message assistant pending">
          <div class="message-label">FlexiKit AI</div>
          <div class="typing" aria-label="AI 正在生成"><span></span><span></span><span></span></div>
        </article>
      </section>

      <form class="composer" @submit.prevent="sendMessage">
        <textarea
          ref="composerInputRef"
          v-model="draft"
          rows="3"
          maxlength="16000"
          placeholder="输入你的问题…"
          :disabled="loading"
          @keydown="onComposerKeydown"
        ></textarea>
        <div class="composer-footer">
          <span>{{ privacyHint }}</span>
          <button
            type="submit"
            :disabled="loading || !draft.trim() || catalogLoading || assistantUnavailable"
          >
            {{ loading ? '生成中…' : '发送' }}
          </button>
        </div>
      </form>

      <p v-if="requestError" class="status error" role="alert">{{ requestError }}</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { aiApi, type AiProviderCatalogItem } from '@/api/ai'
import { getApiErrorMessage, isApiNetworkError } from '@/api/client'
import {
  generateAssistantMessage,
  type AiAssistantBillingMode,
} from '@/ai/assistantClient'
import { currentToolContext } from '@/ai/currentToolContext'
import {
  pickCurrentFileContext,
  type CurrentFileContext,
} from '@/ai/currentFileContext'
import {
  readCurrentClipboardContext,
  type CurrentClipboardContext,
} from '@/ai/currentClipboardContext'
import {
  ASSISTANT_QUICK_ACTIONS,
  type AssistantQuickAction,
} from '@/ai/assistantQuickActions'
import { ASSISTANT_HISTORY_POLICY } from '@/privacy/assistantHistoryPolicy'
import ConnectivityNotice from '@/components/common/ConnectivityNotice.vue'
import { connectivityMode } from '@/network/connectivity'

interface AssistantMessage {
  id: number
  role: 'user' | 'assistant'
  text: string
  meta?: string
}

const platformProviders = ref<AiProviderCatalogItem[]>([])
const byokProviders = ref<AiProviderCatalogItem[]>([])
const billingMode = ref<AiAssistantBillingMode>('platform')
const selectedProviderId = ref('')
const selectedModelId = ref('')
const draft = ref('')
const messages = ref<AssistantMessage[]>([])
const loading = ref(false)
const catalogLoading = ref(true)
const catalogError = ref('')
const requestError = ref('')
const conversationRef = ref<HTMLElement | null>(null)
const composerInputRef = ref<HTMLTextAreaElement | null>(null)
const includeCurrentTool = ref(true)
const currentFile = ref<CurrentFileContext | null>(null)
const includeCurrentFile = ref(true)
const filePickerLoading = ref(false)
const fileContextError = ref('')
const currentClipboard = ref<CurrentClipboardContext | null>(null)
const includeCurrentClipboard = ref(true)
const clipboardLoading = ref(false)
const clipboardContextError = ref('')
const assistantHistoryPolicy = ASSISTANT_HISTORY_POLICY
const assistantQuickActions = ASSISTANT_QUICK_ACTIONS
const assistantUnavailable = computed(() => connectivityMode.value !== 'online')
let nextMessageId = 1

const activeProviders = computed(() =>
  billingMode.value === 'platform'
    ? platformProviders.value
    : byokProviders.value,
)
const selectedProvider = computed(() =>
  activeProviders.value.find(provider => provider.id === selectedProviderId.value),
)
const currentTool = computed(() => currentToolContext.value)
const currentToolSummary = computed(() => {
  const tool = currentTool.value
  if (!tool) return ''
  return [
    tool.kind === 'local' ? '本地工具' : '网页工具',
    tool.category,
    tool.host,
  ].filter(Boolean).join(' · ')
})
const currentFileSummary = computed(() => {
  if (!currentFile.value) {
    return '仅在你点击“选择文件”后读取；只支持 ≤32 KiB 的 UTF-8 文本文件，不上传本地路径。'
  }
  return currentFile.value.extension.toUpperCase()
    + ' · '
    + currentFile.value.content.length
    + ' 字符 · 仅当前页面内存'
})
const currentClipboardSummary = computed(() => {
  if (!currentClipboard.value) {
    return '仅在你点击“读取剪贴板”时访问；最多 16 KiB UTF-8 文本，不会后台监听。'
  }
  return currentClipboard.value.content.length + ' 字符 · 仅当前页面内存'
})
const hasEnabledContext = computed(() => Boolean(
  (includeCurrentTool.value && currentTool.value)
  || (includeCurrentFile.value && currentFile.value)
  || (includeCurrentClipboard.value && currentClipboard.value),
))
const privacyHint = computed(() => {
  const billingHint = billingMode.value === 'byok'
    ? 'Key 仅用于本次请求，不写入服务端数据库。'
    : 'Prompt 与回答不会写入 AI usage 账本。'
  const hints = [billingHint]
  if (includeCurrentTool.value && currentTool.value) {
    hints.push('当前工具不含本地路径。')
  }
  if (includeCurrentFile.value && currentFile.value) {
    hints.push('所选文件正文仅随本次请求发送，绝对路径不会离开桌面端。')
  }
  if (includeCurrentClipboard.value && currentClipboard.value) {
    hints.push('剪贴板文本仅随本次请求发送，不会持续监听或保存。')
  }
  return hints.join(' ')
})

watch(billingMode, () => {
  selectedModelId.value = ''
  if (billingMode.value === 'platform') {
    selectedProviderId.value = ''
    return
  }
  if (!activeProviders.value.some(provider => provider.id === selectedProviderId.value)) {
    selectedProviderId.value = activeProviders.value[0]?.id ?? ''
  }
})

watch(selectedProviderId, () => {
  selectedModelId.value = ''
})

async function loadCatalogs(): Promise<void> {
  catalogLoading.value = true
  catalogError.value = ''
  try {
    const [platform, byok] = await Promise.all([
      aiApi.getProviders(),
      aiApi.getByokProviders(),
    ])
    platformProviders.value = platform.data.providers
    byokProviders.value = byok.data.providers
  } catch (error: unknown) {
    catalogError.value = isApiNetworkError(error)
      ? 'AI 网络服务当前不可用，请联网后重试'
      : getApiErrorMessage(error, '无法加载 AI Provider')
  } finally {
    catalogLoading.value = false
  }
}

async function scrollToEnd(): Promise<void> {
  await nextTick()
  if (conversationRef.value) {
    conversationRef.value.scrollTop = conversationRef.value.scrollHeight
  }
}

async function selectCurrentFile(): Promise<void> {
  if (filePickerLoading.value || loading.value) return
  fileContextError.value = ''
  filePickerLoading.value = true
  try {
    const selection = await pickCurrentFileContext()
    if (selection) {
      currentFile.value = selection
      includeCurrentFile.value = true
    }
  } catch (error: unknown) {
    fileContextError.value = error instanceof Error
      ? error.message
      : '无法读取所选文件'
  } finally {
    filePickerLoading.value = false
  }
}

function removeCurrentFile(): void {
  currentFile.value = null
  includeCurrentFile.value = true
  fileContextError.value = ''
}

async function readCurrentClipboard(): Promise<void> {
  if (clipboardLoading.value || loading.value) return
  clipboardContextError.value = ''
  clipboardLoading.value = true
  try {
    currentClipboard.value = await readCurrentClipboardContext()
    includeCurrentClipboard.value = true
  } catch (error: unknown) {
    clipboardContextError.value = error instanceof Error
      ? error.message
      : '无法读取剪贴板文本'
  } finally {
    clipboardLoading.value = false
  }
}

function removeCurrentClipboard(): void {
  currentClipboard.value = null
  includeCurrentClipboard.value = true
  clipboardContextError.value = ''
}

function clearSessionMessages(): void {
  messages.value = []
  requestError.value = ''
}

function isQuickActionDisabled(action: AssistantQuickAction): boolean {
  return loading.value || (action.requiresContext && !hasEnabledContext.value)
}

async function applyQuickAction(action: AssistantQuickAction): Promise<void> {
  if (isQuickActionDisabled(action)) return

  const existingDraft = draft.value.trim()
  draft.value = existingDraft
    ? action.prompt + '\n\n' + existingDraft
    : action.prompt
  await nextTick()
  composerInputRef.value?.focus()
}

async function sendMessage(): Promise<void> {
  const message = draft.value.trim()
  if (!message || loading.value) return
  if (assistantUnavailable.value) {
    requestError.value = '当前处于离线模式，AI 生成需要网络连接'
    return
  }

  requestError.value = ''
  messages.value.push({ id: nextMessageId++, role: 'user', text: message })
  draft.value = ''
  loading.value = true
  await scrollToEnd()

  try {
    const result = await generateAssistantMessage({
      message,
      billingMode: billingMode.value,
      ...(selectedProviderId.value ? { providerId: selectedProviderId.value } : {}),
      ...(selectedModelId.value ? { modelId: selectedModelId.value } : {}),
      ...(includeCurrentTool.value && currentTool.value
        ? { currentTool: currentTool.value }
        : {}),
      ...(includeCurrentFile.value && currentFile.value
        ? { currentFile: currentFile.value }
        : {}),
      ...(includeCurrentClipboard.value && currentClipboard.value
        ? { currentClipboard: currentClipboard.value }
        : {}),
    })
    messages.value.push({
      id: nextMessageId++,
      role: 'assistant',
      text: result.text,
      meta: result.providerId + ' · ' + result.modelId,
    })
  } catch (error: unknown) {
    requestError.value = isApiNetworkError(error)
      ? '当前无法连接 AI 网络服务，请稍后重试'
      : getApiErrorMessage(error, 'AI 助手暂时不可用')
  } finally {
    loading.value = false
    await scrollToEnd()
  }
}

function onComposerKeydown(event: KeyboardEvent): void {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void sendMessage()
  }
}

onMounted(() => {
  void loadCatalogs()
})
</script>

<style scoped>
.assistant-page{min-height:calc(100vh - 76px);padding:clamp(6px,1.5vw,22px);color:var(--text-primary)}
.assistant-shell{display:grid;grid-template-rows:auto auto auto minmax(280px,1fr) auto auto;gap:14px;min-height:calc(100vh - 98px);max-width:1180px;margin:0 auto;padding:clamp(18px,2.4vw,30px);background:linear-gradient(145deg,rgb(255 255 255 / 18%),transparent 42%),var(--glass-bg);backdrop-filter:blur(28px) saturate(150%);border:1px solid color-mix(in srgb,white 18%,var(--glass-border));border-radius:22px;box-shadow:0 18px 50px rgb(0 0 0 / 7%),inset 0 1px 0 rgb(255 255 255 / 22%)}
.assistant-header{display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
.assistant-kicker{display:inline-block;margin-bottom:7px;color:var(--primary);font-size:.68rem;font-weight:720;letter-spacing:.12em}
.assistant-header h1{margin:0;font-size:clamp(1.55rem,2.4vw,2.2rem);font-weight:720;letter-spacing:-.035em}
.assistant-header p{margin:7px 0 0;max-width:680px;color:var(--text-tertiary);font-size:.82rem;line-height:1.65}
.settings-link,.segmented button,.assistant-controls select,.composer button{transition:all .3s cubic-bezier(.25,.1,.25,1)}
.settings-link{display:inline-flex;align-items:center;min-height:34px;padding:0 13px;color:var(--primary);font-size:.76rem;font-weight:620;text-decoration:none;white-space:nowrap;background:color-mix(in srgb,var(--primary) 7%,var(--btn-bg));border:1px solid color-mix(in srgb,var(--primary) 17%,var(--glass-border));border-radius:11px}
.settings-link:hover{transform:translateY(-1px) scale(1.02)}.settings-link:active{transform:scale(.98)}
.assistant-controls{display:grid;grid-template-columns:minmax(210px,auto) minmax(190px,1fr) minmax(190px,1fr);gap:10px;align-items:end}
.segmented{display:grid;grid-template-columns:1fr 1fr;gap:3px;padding:3px;background:color-mix(in srgb,var(--glass-bg) 82%,transparent);border:1px solid var(--glass-border);border-radius:12px}
.segmented button{min-height:35px;padding:0 11px;color:var(--text-tertiary);font:inherit;font-size:.74rem;font-weight:620;background:transparent;border:0;border-radius:9px;cursor:pointer}
.segmented button.active{color:var(--primary);background:color-mix(in srgb,var(--primary) 9%,var(--btn-bg));box-shadow:inset 0 1px 0 rgb(255 255 255 / 22%)}
.assistant-controls label{display:grid;gap:5px}.assistant-controls label>span{padding-left:3px;color:var(--text-tertiary);font-size:.65rem;font-weight:650}
.assistant-controls select{width:100%;min-height:42px;padding:0 11px;color:var(--text-primary);font:inherit;font-size:.78rem;background:var(--input-bg);border:1px solid var(--glass-border);border-radius:12px;outline:0}
.assistant-controls select:focus{border-color:color-mix(in srgb,var(--primary) 52%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 10%,transparent)}
.history-policy{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 13px;background:color-mix(in srgb,var(--primary) 4%,var(--glass-bg));border:1px solid var(--glass-border);border-radius:14px}.history-policy-copy{display:grid;gap:2px;min-width:0}.history-policy-copy>span{color:var(--text-tertiary);font-size:.62rem;font-weight:700;letter-spacing:.04em}.history-policy-copy strong{font-size:.8rem;font-weight:660}.history-policy-copy small{color:var(--text-tertiary);font-size:.65rem;line-height:1.5}
.tool-context{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 13px;background:linear-gradient(145deg,rgb(255 255 255 / 14%),transparent 52%),color-mix(in srgb,var(--primary) 5%,var(--glass-bg));border:1px solid color-mix(in srgb,var(--primary) 16%,var(--glass-border));border-radius:14px;box-shadow:inset 0 1px 0 rgb(255 255 255 / 16%)}
.tool-context-copy{display:grid;gap:2px;min-width:0}.tool-context-copy>span{color:var(--primary);font-size:.62rem;font-weight:700;letter-spacing:.04em}.tool-context-copy strong{font-size:.8rem;font-weight:660;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.tool-context-copy small{color:var(--text-tertiary);font-size:.65rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.context-toggle{display:flex;align-items:center;gap:7px;flex:0 0 auto;color:var(--text-secondary);font-size:.68rem;font-weight:580;cursor:pointer}.context-toggle input{width:15px;height:15px;accent-color:var(--primary);cursor:pointer}.context-toggle span{white-space:nowrap}
.file-context-actions{display:flex;align-items:center;justify-content:flex-end;gap:7px;flex:0 0 auto}.context-button{min-height:31px;padding:0 10px;color:var(--primary);font:inherit;font-size:.66rem;font-weight:630;background:color-mix(in srgb,var(--primary) 7%,var(--btn-bg));border:1px solid color-mix(in srgb,var(--primary) 16%,var(--glass-border));border-radius:9px;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}.context-button.subtle{color:var(--text-tertiary);background:var(--btn-bg);border-color:var(--glass-border)}.context-button:hover:not(:disabled){transform:translateY(-1px);background:var(--btn-bg-hover)}.context-button:active:not(:disabled){transform:scale(.98)}.context-button:disabled{opacity:.4;cursor:default}
.quick-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 12px;background:color-mix(in srgb,var(--glass-bg) 88%,transparent);border:1px solid var(--glass-border);border-radius:14px}.quick-actions-copy{display:grid;gap:2px;min-width:0}.quick-actions-copy>span{color:var(--text-secondary);font-size:.68rem;font-weight:680}.quick-actions-copy small{color:var(--text-tertiary);font-size:.61rem;line-height:1.45}.quick-actions-list{display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:wrap}.quick-action-button{min-height:30px;padding:0 10px;color:var(--text-secondary);font:inherit;font-size:.65rem;font-weight:620;background:var(--btn-bg);border:1px solid var(--glass-border);border-radius:9px;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}.quick-action-button:hover:not(:disabled){color:var(--primary);transform:translateY(-1px);background:color-mix(in srgb,var(--primary) 7%,var(--btn-bg));border-color:color-mix(in srgb,var(--primary) 16%,var(--glass-border))}.quick-action-button:active:not(:disabled){transform:scale(.98)}.quick-action-button:disabled{opacity:.38;cursor:default}
.status{margin:0;padding:10px 12px;color:var(--text-secondary);font-size:.76rem;line-height:1.5;background:color-mix(in srgb,var(--primary) 5%,var(--glass-bg));border:1px solid var(--glass-border);border-radius:11px}.status.error{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 20%,var(--glass-border))}
.conversation{min-height:300px;max-height:calc(100vh - 370px);overflow-y:auto;overscroll-behavior:contain;padding:18px;background:linear-gradient(145deg,rgb(255 255 255 / 10%),transparent 42%),color-mix(in srgb,var(--glass-bg) 68%,transparent);border:1px solid color-mix(in srgb,white 14%,var(--glass-border));border-radius:20px}
.empty-state{display:grid;place-items:center;align-content:center;min-height:100%;padding:34px 16px;text-align:center}.assistant-orb{display:grid;place-items:center;width:58px;height:58px;margin-bottom:14px;background:radial-gradient(circle at 34% 28%,rgb(255 255 255 / 68%),transparent 28%),color-mix(in srgb,var(--primary) 16%,var(--glass-bg));border:1px solid color-mix(in srgb,var(--primary) 20%,white 16%);border-radius:20px;box-shadow:0 14px 35px color-mix(in srgb,var(--primary) 9%,transparent),inset 0 1px 0 rgb(255 255 255 / 36%)}.assistant-orb span{width:18px;height:18px;background:var(--primary);border-radius:50% 50% 50% 14%;transform:rotate(-18deg);opacity:.82}
.empty-state h2{margin:0;font-size:1.16rem;font-weight:680;letter-spacing:-.02em}.empty-state p{max-width:520px;margin:8px 0 0;color:var(--text-tertiary);font-size:.79rem;line-height:1.7}
.message{width:min(78%,760px);margin-bottom:14px;padding:13px 15px;border:1px solid var(--glass-border);border-radius:17px;box-shadow:inset 0 1px 0 rgb(255 255 255 / 14%);animation:message-in .3s cubic-bezier(.25,.1,.25,1)}
.message.user{margin-left:auto;background:color-mix(in srgb,var(--primary) 10%,var(--glass-bg));border-color:color-mix(in srgb,var(--primary) 20%,var(--glass-border))}.message.assistant{margin-right:auto;background:color-mix(in srgb,var(--glass-bg) 82%,transparent)}
.message-label,.message-meta{color:var(--text-tertiary);font-size:.64rem;font-weight:650}.message-content{margin-top:6px;white-space:pre-wrap;overflow-wrap:anywhere;font-size:.86rem;line-height:1.68}.message-meta{margin-top:8px;font-weight:520}
.typing{display:flex;gap:5px;margin-top:10px}.typing span{width:6px;height:6px;background:var(--text-tertiary);border-radius:50%;animation:typing 1s ease-in-out infinite}.typing span:nth-child(2){animation-delay:.14s}.typing span:nth-child(3){animation-delay:.28s}
.composer{padding:10px;background:linear-gradient(145deg,rgb(255 255 255 / 12%),transparent 50%),var(--glass-bg);border:1px solid color-mix(in srgb,white 15%,var(--glass-border));border-radius:18px;box-shadow:inset 0 1px 0 rgb(255 255 255 / 18%)}.composer textarea{width:100%;min-height:74px;max-height:180px;resize:vertical;padding:5px 7px;color:var(--text-primary);font:inherit;font-size:.86rem;line-height:1.6;background:transparent;border:0;outline:0}.composer textarea::placeholder{color:var(--text-tertiary)}
.composer-footer{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:5px 3px 1px 7px}.composer-footer>span{color:var(--text-tertiary);font-size:.66rem}.composer button{min-width:74px;min-height:34px;padding:0 15px;color:white;font:inherit;font-size:.75rem;font-weight:650;background:var(--primary);border:0;border-radius:11px;box-shadow:0 7px 18px color-mix(in srgb,var(--primary) 20%,transparent);cursor:pointer}.composer button:hover:not(:disabled){transform:translateY(-1px) scale(1.02)}.composer button:active:not(:disabled){transform:scale(.98)}.composer button:disabled{cursor:default;opacity:.45}
@keyframes message-in{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}@keyframes typing{0%,100%{opacity:.35;transform:translateY(0)}50%{opacity:1;transform:translateY(-3px)}}
@media (prefers-reduced-motion:reduce){.message,.typing span{animation:none}}
@media (max-width:820px){.assistant-controls{grid-template-columns:1fr 1fr}.segmented{grid-column:1/-1}.message{width:90%}}
@media (max-width:560px){.assistant-header{display:grid}.assistant-controls{grid-template-columns:1fr}.segmented{grid-column:auto}.history-policy,.tool-context,.quick-actions{align-items:flex-start;flex-direction:column}.file-context-actions,.quick-actions-list{justify-content:flex-start;flex-wrap:wrap}.composer-footer{align-items:flex-end}}
</style>
