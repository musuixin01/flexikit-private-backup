<template>
  <div class="app-layout login-page">
    <div class="login-container" :class="{ 'register-container': tab === 'register' }">
      <!-- Logo -->
      <div class="login-logo">
        <img src="/icon/icon_256x256.ico" alt="FlexiKit">
        <h1>FlexiKit</h1>
        <p>灵巧箱 · 高度可自定义的通用工具箱</p>
      </div>

      <!-- 卡片 -->
      <ConnectivityNotice message="登录、注册和云端资料同步需要网络；本地工作台与桌面功能仍可使用。" @reconnected="errorMsg = ''" />

      <div class="login-card" :class="{ 'register-card': tab === 'register' }">
        <!-- 登录欢迎 -->
        <div v-if="tab === 'login'" class="welcome-header">
          <h2>登录你的 FlexiKit</h2>
          <p class="welcome-desc">用你的账号访问自定义工具箱，随时随地管理你的效率工具</p>
        </div>

        <!-- 个人资料标题 -->
        <div v-if="tab === 'profile'" class="tab-bar">
          <h2 class="register-title">个人资料</h2>
        </div>

        <!-- ===== 登录表单 ===== -->
        <LoginForm
          v-if="tab === 'login'"
          :loading="loading"
          :error="errorMsg"
          @submit="handleLogin"
          @switch-tab="switchTab"
          @forgot-pwd="openForgotPwd"
        />

        <!-- ===== 注册表单 ===== -->
        <RegisterForm
          v-if="tab === 'register'"
          :loading="loading"
          :error="errorMsg"
          @submit="handleRegister"
          @switch-tab="switchTab"
        />

        <!-- ===== 资料编辑 ===== -->
        <ProfileForm
          v-if="tab === 'profile' && userStore.isLoggedIn"
          :initial-display-name="profileForm.displayName"
          :initial-avatar="profileForm.avatar"
          :initial-avatar-type="profileForm.avatarType"
          :initial-avatar-data="profileForm.avatarData"
          @update="handleUpdateProfile"
          @logout="handleLogout"
        />
      </div>

      <!-- 返回首页（美化） -->
      <div class="back-home">
        <router-link to="/">← 返回首页</router-link>
      </div>
    </div>

    <!-- 忘记密码弹窗 -->
    <Teleport to="body">
      <div v-if="showForgotModal" class="forgot-overlay" @click.self="showForgotModal = false">
        <div class="forgot-card">
          <h3>找回密码</h3>
          <div v-if="!forgotStep">
            <p class="forgot-desc">输入你的用户名，我们将帮你重置密码。</p>
            <div class="field">
              <label>用户名</label>
              <input v-model="forgotUsername" placeholder="输入用户名" maxlength="20" @keydown.enter="handleFindAccount">
            </div>
            <div v-if="forgotError" class="error">{{ forgotError }}</div>
            <button class="submit-btn" @click="handleFindAccount">查找账号</button>
          </div>
          <div v-else>
            <div class="forgot-success">
              <span style="font-size:28px;">✅</span>
              <p>找到账号 <strong>{{ forgotUsername }}</strong></p>
            </div>
            <div class="field">
              <label>新密码</label>
              <input :type="showResetPwd ? 'text' : 'password'" v-model="forgotNewPwd" placeholder="输入新密码（至少6位）" maxlength="30" minlength="6">
              <button type="button" class="pwd-toggle" @click="showResetPwd = !showResetPwd">{{ showResetPwd ? '🙈' : '👁' }}</button>
            </div>
            <div v-if="forgotError" class="error">{{ forgotError }}</div>
            <button class="submit-btn" @click="handleResetPwd">重置密码</button>
            <button class="secondary-btn" @click="showForgotModal = false">取消</button>
          </div>
          <button class="close-btn" @click="showForgotModal = false">✕</button>
        </div>
      </div>
    </Teleport>
  </div>

  <ToastMessage />
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useUserStore, PRESET_AVATARS } from '@/stores/user'
import { useUiStore } from '@/stores/ui'
import ToastMessage from '@/components/common/ToastMessage.vue'
import ConnectivityNotice from '@/components/common/ConnectivityNotice.vue'
import LoginForm from '@/components/auth/LoginForm.vue'
import RegisterForm from '@/components/auth/RegisterForm.vue'
import ProfileForm from '@/components/auth/ProfileForm.vue'
import { getApiErrorMessage } from '@/api/client'
import { connectivityMode } from '@/network/connectivity'

interface RegisterFormData {
  username: string
  email: string
  displayName: string
  password: string
  confirmPassword: string
  avatar: string
  avatarType: 'upload' | 'preset' | 'emoji'
  avatarData: string
}

interface ProfileFormData {
  displayName: string
  avatar: string
  avatarType: 'upload' | 'preset' | 'emoji'
  avatarData: string
}

const router = useRouter()
const route = useRoute()
const userStore = useUserStore()
const ui = useUiStore()

const tab = ref<'login' | 'register' | 'profile'>(
  route.query.tab === 'profile' ? 'profile' :
  route.query.tab === 'register' ? 'register' : 'login'
)
const errorMsg = ref('')
const loading = ref(false)
const showResetPwd = ref(false)

const profileForm = reactive({
  displayName: userStore.profile?.displayName || '',
  avatar: userStore.profile?.avatar || 'emoji-🦊',
  avatarType: (userStore.profile?.avatarType || 'emoji') as 'upload' | 'preset' | 'emoji',
  avatarData: userStore.profile?.avatarType === 'upload' ? (userStore.profile?.avatar || '') : '',
})

// ========== 忘记密码 ==========
const showForgotModal = ref(false)
const forgotStep = ref(false)
const forgotUsername = ref('')
const forgotNewPwd = ref('')
const forgotError = ref('')

onMounted(() => {
  if (tab.value === 'profile' && !userStore.isLoggedIn) {
    tab.value = 'login'
  }
})

function openForgotPwd() {
  showForgotModal.value = true
  forgotStep.value = false
  forgotUsername.value = ''
  forgotNewPwd.value = ''
  forgotError.value = ''
  showResetPwd.value = false
}

function handleFindAccount() {
  forgotError.value = '当前版本暂不支持密码自助重置，请联系管理员'
}

function handleResetPwd() {
  forgotError.value = '当前版本暂不支持密码自助重置，请联系管理员'
}

function switchTab(t: 'login' | 'register' | 'profile') {
  tab.value = t
  errorMsg.value = ''
}

// ========== Auth ==========
async function handleLogin(data: { username: string; password: string }) {
  errorMsg.value = ''
  if (connectivityMode.value !== 'online') {
    errorMsg.value = '当前处于离线模式，联网后即可登录'
    return
  }
  if (!data.username || !data.password) { errorMsg.value = '请填写用户名/邮箱和密码'; return }
  loading.value = true
  try {
    const result = await userStore.login(data.username, data.password)
    if (result.success) { ui.showToast('登录成功！'); router.push('/app') }
    else errorMsg.value = result.error || '登录失败'
  } catch (e: unknown) {
    errorMsg.value = getApiErrorMessage(e, '登录失败')
  } finally {
    loading.value = false
  }
}

async function handleRegister(data: RegisterFormData) {
  errorMsg.value = ''
  if (connectivityMode.value !== 'online') {
    errorMsg.value = '当前处于离线模式，联网后即可注册'
    return
  }
  if (data.password !== data.confirmPassword) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }
  if (data.password.length < 6) {
    errorMsg.value = '密码至少6个字符'
    return
  }
  loading.value = true
  try {
    const result = await userStore.register(data.username, data.email, data.password, data.displayName)
    if (result.success) {
      applyAvatar(data.avatar, data.avatarType, data.avatarData)
      ui.showToast('注册成功！')
      router.push('/app')
    } else errorMsg.value = result.error || '注册失败'
  } catch (e: unknown) {
    errorMsg.value = getApiErrorMessage(e, '注册失败')
  } finally {
    loading.value = false
  }
}

async function handleUpdateProfile(data: ProfileFormData) {
  errorMsg.value = ''
  if (connectivityMode.value !== 'online') {
    errorMsg.value = '当前离线，资料修改会在联网后再进行'
    return
  }
  if (!userStore.profile) return
  try {
    await userStore.updateProfile({ displayName: data.displayName || userStore.profile.username })
    applyAvatar(data.avatar, data.avatarType, data.avatarData)
    ui.showToast('资料已更新')
  } catch (e: unknown) {
    errorMsg.value = getApiErrorMessage(e, '更新失败')
  }
}

async function handleLogout() {
  await userStore.logout()
  switchTab('login')
  ui.showToast('已退出登录')
}

function applyAvatar(avatar: string, type: 'upload' | 'preset' | 'emoji', data: string) {
  if (type === 'emoji') {
    const emoji = PRESET_AVATARS.find(a => a.id === avatar)?.label || '🦊'
    userStore.setAvatar(emoji, 'emoji')
  } else if (type === 'preset') {
    userStore.setAvatar(avatar, 'preset')
  } else if (type === 'upload') {
    userStore.setAvatar(data, 'upload')
  }
}
</script>

<style scoped>
/* ===== 整体布局 ===== */
.login-page {
  justify-content: flex-start;
  align-items: center;
  min-height: 100vh;
  flex-direction: column;
  padding-top: 30px;
  padding-bottom: 30px;
}

/* ===== 容器 ===== */
.login-container {
  width: 100%;
  max-width: 500px;
  transition: max-width 0.3s ease;
}
.register-container {
  max-width: 760px;
}

/* ===== Logo ===== */
.login-logo {
  text-align: center;
  margin-bottom: 16px;
}
.login-logo img {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  box-shadow: 0 6px 20px rgba(0,0,0,.1);
}
.login-logo h1 {
  font-size: 1.3rem;
  font-weight: 700;
  margin-top: 6px;
  background: var(--logo-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  letter-spacing: -0.5px;
}
.login-logo p {
  font-size: .72rem;
  color: var(--text-tertiary);
  margin-top: 2px;
}

/* ===== 卡片 ===== */
.login-card {
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 24px 28px;
  box-shadow: var(--glass-shadow);
  width: 100%;
}
.register-card {
  padding: 20px 24px;
}

/* ===== 登录欢迎 ===== */
.welcome-header {
  text-align: center;
  margin-bottom: 20px;
}
.welcome-header h2 {
  font-size: 1.3rem;
  font-weight: 700;
  margin: 0 0 2px;
  color: var(--text-primary);  /* 暗黑自动变白 */
}
.welcome-desc {
  font-size: .8rem;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== 个人资料标题 ===== */
.tab-bar { margin-bottom: 20px; }
.tab-bar .register-title { font-size: 1.1rem; font-weight: 700; color: var(--text-primary); text-align: center; }

/* ===== 返回首页（美化） ===== */
.back-home {
  text-align: center;
  margin-top: 20px;
}
.back-home a {
  color: var(--text-tertiary);
  text-decoration: none;
  font-size: 0.85rem;
  transition: color 0.2s, background 0.2s;
  display: inline-block;
  padding: 6px 12px;
  border-radius: 8px;
}
.back-home a:hover {
  color: var(--text-primary);
  background: var(--btn-bg-hover);
}

/* ===== 响应式 ===== */
@media (max-width: 700px) {
  .register-container {
    max-width: 500px;
  }
  .login-container {
    padding: 0 16px;
  }
  .welcome-desc {
    white-space: normal;
  }
}

/* ===== 忘记密码弹窗 ===== */
.forgot-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: var(--overlay-bg);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn .2s;
}
.forgot-card {
  background: var(--modal-bg);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 28px;
  width: 90%;
  max-width: 360px;
  box-shadow: 0 20px 60px rgba(0,0,0,.2);
  position: relative;
  animation: fadeSlideIn .25s ease;
}
.forgot-card h3 {
  font-size: 1.05rem;
  font-weight: 680;
  margin-bottom: 16px;
  color: var(--text-primary);
}
.forgot-desc {
  font-size: .82rem;
  color: var(--text-secondary);
  margin-bottom: 16px;
  line-height: 1.5;
}
.forgot-success {
  text-align: center;
  margin-bottom: 18px;
}
.forgot-success p {
  font-size: .85rem;
  color: var(--text-secondary);
  margin-top: 8px;
}
.close-btn {
  position: absolute;
  top: 14px;
  right: 14px;
  background: transparent;
  border: none;
  font-size: 18px;
  cursor: pointer;
  color: var(--text-tertiary);
}
.close-btn:hover { color: var(--text-primary); }
@keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
@keyframes fadeSlideIn {
  from { opacity:0; transform:translateY(10px); }
  to { opacity:1; transform:translateY(0); }
}
</style>
