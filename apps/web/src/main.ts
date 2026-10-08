import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUiStore } from './stores/ui'
import { runLocalDataMigrations } from './migrations/localDataMigrations'
import { initConnectivityTracking } from './network/connectivity'
import { invokeDesktop, isDesktopRuntime } from './api/runtime'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/navbar.css'
import './styles/responsive.css'
import './styles/desktop-resize.css'

try {
  runLocalDataMigrations(localStorage)
} catch (error) {
  console.error('FlexiKit local data migration failed', error)
  const root = document.getElementById('app')
  if (root) {
    root.textContent = '本地数据升级失败或来自更新版本。为避免覆盖数据，FlexiKit 已停止启动。请升级到最新版本后重试。'
  }
  throw error
}

initConnectivityTracking()

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
type FrontendFailureKind = 'script' | 'promise' | 'vue'
let failureReports = 0

function recordFrontendFailure(kind: FrontendFailureKind): void {
  // Only a bounded number of category codes stay in local diagnostics.
  // Never pass error messages, stack traces, URLs or user content.
  if (!isDesktopRuntime() || failureReports >= 12) return
  failureReports += 1
  void invokeDesktop('record_frontend_failure', { kind }).catch(() => {
    // Diagnostics must never interfere with a user's workflow.
  })
}

if (isDesktopRuntime()) {
  window.addEventListener('error', () => recordFrontendFailure('script'))
  window.addEventListener('unhandledrejection', () => recordFrontendFailure('promise'))
  app.config.errorHandler = (error) => {
    recordFrontendFailure('vue')
    if (import.meta.env.DEV) console.error('FlexiKit component failure', error)
  }
}


// 初始化UI设置（主题、布局、CSS变量）
const ui = useUiStore()
ui.initAll()

app.mount('#app')
