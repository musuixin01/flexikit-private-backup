import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useUiStore } from './stores/ui'
import { runLocalDataMigrations } from './migrations/localDataMigrations'
import { initConnectivityTracking } from './network/connectivity'
import './styles/base.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/navbar.css'
import './styles/responsive.css'

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

// 初始化UI设置（主题、布局、CSS变量）
const ui = useUiStore()
ui.initAll()

app.mount('#app')
