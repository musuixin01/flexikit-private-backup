<template>
  <button type="button" class="quick-entry" @click="open">
    <span class="quick-entry-icon" aria-hidden="true">↗</span>
    <span>浏览器快速添加</span>
    <span class="quick-entry-chevron" aria-hidden="true">›</span>
  </button>

  <Teleport to="body">
    <Transition name="quick-start-fade">
      <div v-if="visible" class="quick-start-overlay" @pointerdown.self="close" @keydown.esc.stop="close">
        <section class="quick-start-panel" role="dialog" aria-modal="true" aria-labelledby="quick-start-heading">
          <div class="quick-start-head">
            <div class="quick-start-brand" aria-hidden="true">↗</div>
            <button type="button" class="quick-start-close" aria-label="关闭" @click="close">×</button>
          </div>
          <span class="quick-start-eyebrow">FLEXIKIT · 快速收纳</span>
          <h2 id="quick-start-heading">收藏好用的网站，不用打断浏览</h2>
          <p class="quick-start-intro">选择适合你的方式，之后添加网站会更轻松。</p>

          <div class="quick-start-choice">
            <div class="quick-start-choice-top">
              <span class="quick-start-choice-icon" aria-hidden="true">＋</span>
              <div><strong>浏览器一键添加</strong><p>安装一次，浏览网页时点一下即可保存。</p></div>
            </div>
            <template v-if="storeChoices.length">
              <button v-for="choice in storeChoices" :key="choice.browser" type="button"
                class="quick-start-primary" @click="openStore(choice.url)">
                前往 {{ choice.label }} 官方商店 <span aria-hidden="true">↗</span>
              </button>
              <p class="quick-start-help">浏览器会询问是否允许安装；FlexiKit 不会绕过浏览器确认。</p>
            </template>
            <template v-else>
              <p class="quick-start-unavailable">浏览器扩展尚未正式上架，当前暂不能从商店安装。</p>
              <p class="quick-start-help">不需要开启开发者模式。先用下面的方式添加即可。</p>
            </template>
          </div>

          <div class="quick-start-choice secondary">
            <div class="quick-start-choice-top">
              <span class="quick-start-choice-icon" aria-hidden="true">⌁</span>
              <div><strong>直接添加网址</strong><p>无需安装扩展，复制网址后粘贴，自动识别网站资料。</p></div>
            </div>
            <button type="button" class="quick-start-secondary" @click="openImport">粘贴网址添加 <span aria-hidden="true">→</span></button>
          </div>

          <details class="quick-start-pairing">
            <summary>已安装扩展？连接你的 FlexiKit 账号</summary>
            <p>只确认你本人在 FlexiKit 官方浏览器扩展中刚刚生成的配对码，绝不确认他人发送的号码。配对成功后扩展将获得独立登录会话，可随时在账号设备管理中撤销。</p>
            <form @submit.prevent="approve">
              <label for="quick-start-code">扩展中显示的配对码</label>
              <div class="quick-start-pair-row">
                <input id="quick-start-code" :value="code" maxlength="10" inputmode="text" autocomplete="off"
                  spellcheck="false" placeholder="10 位配对码" @input="onCodeInput">
                <button type="submit" :disabled="busy || code.length !== 10 || !user.isLoggedIn">
                  {{ busy ? '确认中…' : '确认连接' }}
                </button>
              </div>
              <p v-if="!user.isLoggedIn" class="quick-start-help">请先登录 FlexiKit，再确认配对。</p>
              <p v-if="pairMessage" class="quick-start-message" :class="{ error: pairError }" role="status">{{ pairMessage }}</p>
            </form>
          </details>
          <details v-if="isDevelopment" class="quick-start-developer">
            <summary>开发人员：本地安装方法</summary>
            <p>在 Chrome / Edge 扩展管理页开启开发者模式，加载项目内已构建的 <code>apps/browser-extension/dist</code> 目录。此方式仅用于本地测试。</p>
          </details>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useUserStore } from '@/stores/user'
import { authApi } from '@/api/auth'
import { isDesktopRuntime } from '@/api/runtime'
import { detectCompanionBrowser, validatedStoreListing, cleanPairingCode } from './browserExtensionStores'

const emit = defineEmits<{ (e: 'open-web-import'): void }>()
const user = useUserStore()
const visible = ref(false)
const code = ref('')
const busy = ref(false)
const pairMessage = ref('')
const pairError = ref(false)
const isDevelopment = import.meta.env.DEV
const browser = detectCompanionBrowser(typeof navigator === 'undefined' ? '' : navigator.userAgent)
// WebView2 identifies as Edge even if Chrome is the user's default browser.
// In Desktop, offer the installed browser choices instead of guessing.
const desktop = typeof window !== 'undefined' && isDesktopRuntime()
const storeChoices = computed(() => {
  const choices: Array<{ browser: 'chrome' | 'edge'; label: string; url: string }> = []
  const chrome = validatedStoreListing(import.meta.env.VITE_CHROME_EXTENSION_STORE_URL || '', 'chrome')
  const edge = validatedStoreListing(import.meta.env.VITE_EDGE_EXTENSION_STORE_URL || '', 'edge')
  if (chrome && (desktop || browser === 'chrome' || browser === 'other')) {
    choices.push({ browser: 'chrome', label: 'Chrome', url: chrome })
  }
  if (edge && (desktop || browser === 'edge' || browser === 'other')) {
    choices.push({ browser: 'edge', label: 'Edge', url: edge })
  }
  return choices
})
function open(): void { visible.value = true }
function close(): void { if (!busy.value) visible.value = false }
function openStore(url: string): void {
  if (storeChoices.value.some(choice => choice.url === url)) {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
function openImport(): void {
  close()
  emit('open-web-import')
}
function onCodeInput(event: Event): void {
  code.value = cleanPairingCode((event.target as HTMLInputElement).value)
  pairMessage.value = ''
}
async function approve(): Promise<void> {
  if (busy.value || !user.isLoggedIn || code.value.length !== 10) return
  busy.value = true
  pairMessage.value = ''
  pairError.value = false
  try {
    await authApi.approveExtensionPair(code.value)
    code.value = ''
    pairMessage.value = '已确认配对。返回浏览器扩展，连接将自动完成。'
  } catch {
    pairError.value = true
    pairMessage.value = '配对码无效或已过期。请返回扩展生成新配对码。'
  } finally {
    busy.value = false
  }
}
function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && visible.value) close()
}
onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.quick-entry{display:inline-flex;align-items:center;gap:9px;border:1px solid color-mix(in srgb,var(--primary) 16%,var(--glass-border));border-radius:13px;padding:8px 12px;color:var(--text-primary);background:color-mix(in srgb,var(--glass-bg) 86%,transparent);font:inherit;font-size:12px;font-weight:650;cursor:pointer;transition:background 300ms cubic-bezier(.25,.1,.25,1),transform 300ms cubic-bezier(.25,.1,.25,1)}
.quick-entry:hover{background:var(--primary-light);transform:translateY(-1px)}.quick-entry:active{transform:scale(.98)}
.quick-entry-icon{display:grid;place-items:center;width:23px;height:23px;border-radius:8px;background:color-mix(in srgb,var(--primary) 12%,transparent);color:var(--primary);font-weight:800}.quick-entry-chevron{color:var(--text-secondary);font-size:18px}
.quick-start-overlay{position:fixed;inset:0;z-index:3250;display:grid;place-items:center;padding:20px;background:rgb(11 17 29 / 30%);backdrop-filter:blur(15px)}
.quick-start-panel{width:min(520px,calc(100vw - 30px));max-height:min(760px,calc(100vh - 36px));overflow-y:auto;padding:26px;border-radius:24px;border:1px solid color-mix(in srgb,var(--glass-border) 60%,white);background:color-mix(in srgb,var(--bg-primary) 94%,white);box-shadow:0 24px 68px rgb(15 23 42 / 17%),inset 0 1px rgb(255 255 255 / 55%);color:var(--text-primary)}
.quick-start-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.quick-start-brand{display:grid;place-items:center;width:45px;height:45px;border-radius:15px;background:color-mix(in srgb,var(--primary) 11%,transparent);color:var(--primary);font-size:24px}
.quick-start-close{width:32px;height:32px;border:0;border-radius:10px;background:color-mix(in srgb,var(--text-secondary) 8%,transparent);color:var(--text-secondary);font-size:21px;cursor:pointer}
.quick-start-eyebrow{color:var(--primary);font-size:10px;letter-spacing:.09em;font-weight:780}
.quick-start-panel h2{font-size:21px;letter-spacing:-.035em;margin:5px 0 8px}
.quick-start-intro,.quick-start-choice p,.quick-start-pairing p,.quick-start-developer p{color:var(--text-secondary);font-size:12px;line-height:1.65}
.quick-start-intro{margin:0 0 20px}
.quick-start-choice{padding:15px;margin-bottom:11px;border:1px solid color-mix(in srgb,var(--primary) 22%,var(--glass-border));border-radius:17px;background:color-mix(in srgb,var(--primary) 3%,var(--glass-bg))}
.quick-start-choice.secondary{border-color:var(--glass-border);background:color-mix(in srgb,var(--glass-bg) 85%,transparent)}
.quick-start-choice-top{display:flex;gap:12px;align-items:flex-start}.quick-start-choice-icon{flex:none;display:grid;place-items:center;width:32px;height:32px;border-radius:11px;background:color-mix(in srgb,var(--primary) 10%,transparent);color:var(--primary);font-size:20px}
.quick-start-choice strong{font-size:13px}.quick-start-choice p{margin:4px 0 0}
.quick-start-primary,.quick-start-secondary{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:13px;padding:10px 12px;border:0;border-radius:11px;cursor:pointer;font:inherit;font-size:12px;font-weight:700;transition:transform 300ms cubic-bezier(.25,.1,.25,1)}
.quick-start-primary{background:var(--primary);color:white}.quick-start-secondary{background:color-mix(in srgb,var(--primary) 9%,transparent);color:var(--primary)}.quick-start-primary:hover,.quick-start-secondary:hover{transform:scale(1.01)}
.quick-start-unavailable{padding:10px;background:color-mix(in srgb,var(--text-secondary) 6%,transparent);border-radius:9px}
.quick-start-help{margin-top:8px!important;font-size:11px!important}
.quick-start-pairing,.quick-start-developer{padding:13px 3px;border-top:1px solid var(--glass-border);margin-top:12px}
.quick-start-pairing summary,.quick-start-developer summary{cursor:pointer;font-size:12px;font-weight:700}
.quick-start-pairing form{margin-top:10px}.quick-start-pairing label{font-size:11px;color:var(--text-secondary)}
.quick-start-pair-row{display:flex;gap:8px;margin-top:6px}
.quick-start-pair-row input{flex:1;min-width:0;padding:10px;border:1px solid var(--glass-border);border-radius:10px;background:var(--glass-bg);color:var(--text-primary);text-transform:uppercase;letter-spacing:.11em;font-size:12px}
.quick-start-pair-row button{padding:9px 11px;white-space:nowrap;border:0;border-radius:10px;background:var(--primary);color:white;font-weight:700;cursor:pointer}
.quick-start-pair-row button:disabled{opacity:.5;cursor:default}.quick-start-message{color:var(--primary)!important}.quick-start-message.error{color:#b42318!important}
.quick-start-fade-enter-active,.quick-start-fade-leave-active{transition:opacity 220ms cubic-bezier(.25,.1,.25,1)}.quick-start-fade-enter-from,.quick-start-fade-leave-to{opacity:0}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
