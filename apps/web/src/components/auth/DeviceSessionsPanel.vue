<template>
  <section class="section-card account-panel device-sessions-panel">
    <div class="device-panel-header">
      <div>
        <div class="device-title-row">
          <h3 class="section-title">登录设备</h3>
          <span v-if="sessions.length" class="session-count">{{ sessions.length }}</span>
        </div>
        <p class="device-panel-description">
          查看当前仍可续期的登录会话，并移除不再使用的其他设备。
        </p>
      </div>
      <button
        type="button"
        class="refresh-sessions-btn"
        :disabled="loading"
        @click="loadSessions"
      >
        {{ loading ? '刷新中…' : '刷新' }}
      </button>
    </div>

    <div v-if="loading && sessions.length === 0" class="device-state">
      正在读取登录设备…
    </div>

    <div v-else-if="errorMessage && sessions.length === 0" class="device-state error">
      <span>{{ errorMessage }}</span>
      <button type="button" @click="loadSessions">重试</button>
    </div>

    <div v-else-if="sessions.length === 0" class="device-state">
      暂无可管理的登录会话
    </div>

    <template v-else>
      <div v-if="!hasCurrentSession" class="legacy-session-notice">
        当前 Access Token 来自旧版本，暂时无法安全识别“当前设备”。重新登录后即可管理其他设备。
      </div>

      <div class="device-session-list">
        <article
          v-for="session in sessions"
          :key="session.session_id"
          class="device-session-item"
          :class="{ current: session.is_current }"
        >
          <div class="device-session-icon" aria-hidden="true">
            {{ clientIcon(session.client_type) }}
          </div>

          <div class="device-session-main">
            <div class="device-session-heading">
              <strong>{{ session.client_name || clientTypeLabel(session.client_type) }}</strong>
              <span v-if="session.is_current" class="current-session-badge">当前设备</span>
              <span v-else class="client-type-badge">{{ clientTypeLabel(session.client_type) }}</span>
            </div>

            <p class="device-session-meta">
              {{ activityLabel(session) }}
            </p>
            <p class="device-session-meta">
              有效至 {{ formatDateTime(session.expires_at) }}
            </p>
          </div>

          <button
            v-if="!session.is_current"
            type="button"
            class="revoke-session-btn"
            :disabled="revokingSessionId === session.session_id || !hasCurrentSession"
            @click="revokeSession(session)"
          >
            {{ revokingSessionId === session.session_id ? '移除中…' : '移除此会话' }}
          </button>
        </article>
      </div>

      <p class="device-security-note">
        移除后该会话的 Refresh Token 与已签发的 Session-bound Access Token 都会立即失效。旧版本未携带 Session 标识的 Access Token 仍按迁移兼容策略处理。
      </p>

      <div v-if="errorMessage" class="device-inline-error">
        {{ errorMessage }}
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  authApi,
  type ManagedAuthSession,
} from '@/api/auth'
import { getApiErrorMessage } from '@/api/client'
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()

const sessions = ref<ManagedAuthSession[]>([])
const loading = ref(false)
const errorMessage = ref('')
const revokingSessionId = ref<string | null>(null)

const hasCurrentSession = computed(() => sessions.value.some(session => session.is_current))

function clientTypeLabel(type: ManagedAuthSession['client_type']): string {
  switch (type) {
    case 'desktop':
      return 'Desktop'
    case 'web':
      return 'Web'
    case 'mobile':
      return 'Mobile'
    case 'extension':
      return 'Browser Companion'
    default:
      return '旧版客户端'
  }
}

function clientIcon(type: ManagedAuthSession['client_type']): string {
  switch (type) {
    case 'desktop':
      return '▣'
    case 'web':
      return '◎'
    case 'mobile':
      return '▯'
    case 'extension':
      return '◈'
    default:
      return '◇'
  }
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '未知'
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function activityLabel(session: ManagedAuthSession): string {
  if (session.last_used_at) {
    return `最近续期 ${formatDateTime(session.last_used_at)}`
  }
  return `登录于 ${formatDateTime(session.created_at)}`
}

async function loadSessions(): Promise<void> {
  if (loading.value) return

  loading.value = true
  errorMessage.value = ''
  try {
    const response = await authApi.listSessions()
    sessions.value = response.data
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error, '登录设备加载失败')
  } finally {
    loading.value = false
  }
}

async function revokeSession(session: ManagedAuthSession): Promise<void> {
  if (session.is_current || revokingSessionId.value) return

  const confirmed = window.confirm(
    `确定移除“${session.client_name || clientTypeLabel(session.client_type)}”的登录会话吗？`,
  )
  if (!confirmed) return

  revokingSessionId.value = session.session_id
  errorMessage.value = ''
  try {
    await authApi.revokeSession(session.session_id)
    sessions.value = sessions.value.filter(item => item.session_id !== session.session_id)
    ui.showToast('该登录会话已移除')
  } catch (error: unknown) {
    errorMessage.value = getApiErrorMessage(error, '移除登录会话失败')
  } finally {
    revokingSessionId.value = null
  }
}

onMounted(() => {
  void loadSessions()
})
</script>

<style scoped>
.device-sessions-panel {
  overflow: hidden;
}

.device-panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 16px;
}

.device-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title {
  margin: 0;
}

.session-count {
  min-width: 24px;
  height: 24px;
  padding: 0 7px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  color: var(--primary);
  background: var(--primary-light);
  font-size: 0.72rem;
  font-weight: 750;
}

.device-panel-description,
.device-security-note,
.device-session-meta {
  color: var(--text-tertiary);
  line-height: 1.6;
}

.device-panel-description {
  margin: 7px 0 0;
  font-size: 0.82rem;
}

.refresh-sessions-btn,
.revoke-session-btn,
.device-state button {
  min-height: 36px;
  border: 1px solid var(--divider);
  border-radius: 11px;
  background: var(--btn-bg);
  color: var(--text-secondary);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
  transition:
    transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1),
    background 300ms cubic-bezier(0.25, 0.1, 0.25, 1),
    border-color 300ms cubic-bezier(0.25, 0.1, 0.25, 1),
    color 300ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.refresh-sessions-btn {
  padding: 0 13px;
  flex-shrink: 0;
}

.refresh-sessions-btn:hover:not(:disabled),
.device-state button:hover:not(:disabled) {
  color: var(--text-primary);
  background: var(--btn-bg-hover);
}

.refresh-sessions-btn:active:not(:disabled),
.revoke-session-btn:active:not(:disabled),
.device-state button:active:not(:disabled) {
  transform: scale(0.98);
}

.refresh-sessions-btn:disabled,
.revoke-session-btn:disabled {
  cursor: default;
  opacity: 0.5;
}

.device-state {
  min-height: 92px;
  display: grid;
  place-items: center;
  gap: 8px;
  color: var(--text-tertiary);
  font-size: 0.84rem;
  text-align: center;
}

.device-state.error {
  color: var(--danger);
}

.device-state button {
  padding: 0 14px;
}

.legacy-session-notice {
  margin-bottom: 12px;
  padding: 11px 13px;
  border: 1px solid color-mix(in srgb, var(--primary) 18%, transparent);
  border-radius: 13px;
  background: color-mix(in srgb, var(--primary) 7%, transparent);
  color: var(--text-secondary);
  font-size: 0.78rem;
  line-height: 1.6;
}

.device-session-list {
  display: grid;
  gap: 10px;
}

.device-session-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 13px;
  padding: 14px;
  border: 1px solid var(--divider);
  border-radius: 16px;
  background: color-mix(in srgb, var(--glass-bg) 82%, transparent);
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 18%, transparent);
  transition:
    transform 300ms cubic-bezier(0.25, 0.1, 0.25, 1),
    border-color 300ms cubic-bezier(0.25, 0.1, 0.25, 1),
    background 300ms cubic-bezier(0.25, 0.1, 0.25, 1);
}

.device-session-item:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--primary) 20%, var(--divider));
}

.device-session-item.current {
  border-color: color-mix(in srgb, var(--primary) 30%, transparent);
  background: color-mix(in srgb, var(--primary) 6%, var(--glass-bg));
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--primary) 8%, transparent),
    inset 0 1px 0 color-mix(in srgb, white 18%, transparent);
}

.device-session-icon {
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 13px;
  background: var(--btn-bg);
  color: var(--text-primary);
  font-size: 1.15rem;
  font-weight: 750;
}

.device-session-main {
  min-width: 0;
}

.device-session-heading {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  margin-bottom: 4px;
}

.device-session-heading strong {
  color: var(--text-primary);
  font-size: 0.9rem;
  overflow-wrap: anywhere;
}

.current-session-badge,
.client-type-badge {
  padding: 3px 7px;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 700;
}

.current-session-badge {
  color: var(--primary);
  background: var(--primary-light);
}

.client-type-badge {
  color: var(--text-tertiary);
  background: var(--btn-bg);
}

.device-session-meta {
  margin: 1px 0 0;
  font-size: 0.72rem;
}

.revoke-session-btn {
  padding: 0 12px;
  color: var(--danger);
}

.revoke-session-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--danger) 35%, transparent);
  background: var(--danger-soft);
}

.device-security-note {
  margin: 14px 2px 0;
  font-size: 0.72rem;
}

.device-inline-error {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 12px;
  color: var(--danger);
  background: var(--danger-soft);
  font-size: 0.76rem;
}

@media (max-width: 620px) {
  .device-panel-header {
    align-items: stretch;
    flex-direction: column;
  }

  .refresh-sessions-btn {
    align-self: flex-start;
  }

  .device-session-item {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .revoke-session-btn {
    grid-column: 1 / -1;
    justify-self: stretch;
  }
}
</style>
