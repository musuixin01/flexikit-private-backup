<template>
  <header class="desktop-titlebar" aria-label="FlexiKit 桌面窗口栏">
    <div class="titlebar-brand" @mousedown.left="startWindowDrag">
      <img src="/icon/icon_256x256.ico" alt="">
      <span>FlexiKit</span>
    </div>

    <div class="titlebar-drag-region" @mousedown.left="startWindowDrag" @dblclick="toggleMaximize">
      <span v-if="connectionLabel" class="titlebar-connection"><i></i>{{ connectionLabel }}</span>
      <span class="titlebar-status">灵巧箱 · 桌面工作台</span>
    </div>

    <div class="titlebar-actions">
      <button class="titlebar-action" type="button" title="收起到桌面宠物" aria-label="收起到桌面宠物" @click="hideToPet">
        <img class="titlebar-pet-logo" src="/icon/icon_256x256.ico" alt="">
        <span>桌面宠物</span>
      </button>

      <button class="titlebar-icon-action" type="button" title="外观与布局" aria-label="外观与布局" @click="ui.toggleSettingsPanel()">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.12-1.3l2-1.55-2-3.46-2.45 1A7 7 0 0 0 14.2 5.4L13.85 3h-4l-.35 2.4a7 7 0 0 0-2.22 1.29l-2.45-1-2 3.46 2 1.55A7 7 0 0 0 4.7 12c0 .44.04.87.12 1.3l-2 1.55 2 3.46 2.45-1a7 7 0 0 0 2.22 1.29l.35 2.4h4l.35-2.4a7 7 0 0 0 2.22-1.29l2.45 1 2-3.46-2-1.55c.08-.43.12-.86.12-1.3Z"/></svg>
      </button>

      <button class="titlebar-account" type="button" :title="accountLabel" @click="openAccount">
        <span class="titlebar-avatar">
          <img v-if="avatarIsImage" :src="user.avatarDisplay" alt="">
          <span v-else>{{ user.isLoggedIn ? user.avatarDisplay : '👤' }}</span>
        </span>
        <span>{{ accountLabel }}</span>
      </button>

      <span class="titlebar-divider" aria-hidden="true"></span>

      <button class="window-control" type="button" title="最小化" aria-label="最小化" @click="minimize">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6h8"/></svg>
      </button>
      <button class="window-control" type="button" title="最大化或还原" aria-label="最大化或还原" @click="toggleMaximize">
        <svg viewBox="0 0 12 12" aria-hidden="true"><rect x="2.25" y="2.25" width="7.5" height="7.5" rx="1"/></svg>
      </button>
      <button class="window-control close-control" type="button" title="隐藏到桌面宠物" aria-label="隐藏到桌面宠物" @click="hideToPet">
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 2.5 7 7m0-7-7 7"/></svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { invokeDesktop } from '@/api/runtime'
import { connectivityMode } from '@/network/connectivity'

const router = useRouter()
const ui = useUiStore()
const user = useUserStore()

const accountLabel = computed(() => user.isLoggedIn ? '个人中心' : '登录')
const avatarIsImage = computed(() => user.isLoggedIn && user.avatarDisplay.startsWith('data:image'))
const connectionLabel = computed(() => {
  if (connectivityMode.value === 'offline') return '离线模式'
  if (connectivityMode.value === 'service-unavailable') return '服务离线'
  return ''
})

function startWindowDrag(event: MouseEvent) {
  if (event.button !== 0 || event.detail > 1) return
  event.preventDefault()
  void invokeDesktop('start_main_window_drag').catch(error => {
    console.warn('Failed to start window drag', error)
  })
}

function openAccount() {
  router.push(user.isLoggedIn ? '/profile' : '/login')
}

async function minimize() {
  await invokeDesktop('minimize_main_window')
}

async function toggleMaximize() {
  await invokeDesktop('toggle_maximize_main_window')
}

async function hideToPet() {
  await invokeDesktop('hide_main_window')
}
</script>

<style scoped>
.desktop-titlebar {
  position: fixed;
  inset: 0 0 auto;
  z-index: 1200;
  display: flex;
  align-items: center;
  height: 44px;
  padding-left: 10px;
  border-bottom: 1px solid color-mix(in srgb, white 19%, var(--glass-border));
  background: linear-gradient(180deg, rgb(255 255 255 / 30%), rgb(255 255 255 / 9%)), color-mix(in srgb, var(--glass-bg) 82%, transparent);
  box-shadow: 0 4px 18px rgb(15 23 42 / 3.5%), inset 0 1px 0 rgb(255 255 255 / 26%);
  backdrop-filter: blur(26px) saturate(180%);
  -webkit-backdrop-filter: blur(26px) saturate(180%);
  user-select: none;
}

.titlebar-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 100%;
  color: var(--text-primary);
  font-size: .76rem;
  font-weight: 680;
  letter-spacing: -.01em;
  flex: 0 0 auto;
}

.titlebar-brand,
.titlebar-drag-region {
  cursor: grab;
}

.titlebar-brand:active,
.titlebar-drag-region:active {
  cursor: grabbing;
}

.titlebar-brand img,
.titlebar-pet-logo {
  width: 23px;
  height: 23px;
  border-radius: 7px;
}

.titlebar-drag-region {
  display: flex;
  align-items: center;
  justify-content: center;
  align-self: stretch;
  min-width: 0;
  flex: 1;
}

.titlebar-connection {
  display:inline-flex;
  align-items:center;
  gap:5px;
  margin-right:8px;
  padding:3px 7px;
  border:1px solid color-mix(in srgb,var(--primary) 13%,var(--glass-border));
  border-radius:999px;
  background:color-mix(in srgb,var(--primary) 6%,transparent);
  color:var(--text-secondary);
  font-size:.58rem;
  font-weight:620;
  pointer-events:none;
}
.titlebar-connection i{width:5px;height:5px;border-radius:50%;background:var(--text-tertiary)}

.titlebar-status {
  color: var(--text-tertiary);
  font-size: .62rem;
  letter-spacing: .025em;
  pointer-events: none;
}

.titlebar-actions {
  display: flex;
  align-items: center;
  height: 100%;
  gap: 4px;
  flex: 0 0 auto;
}

.titlebar-action,
.titlebar-account,
.titlebar-icon-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 30px;
  padding: 0 9px;
  border: 1px solid color-mix(in srgb, white 16%, var(--glass-border));
  border-radius: 9px;
  background: linear-gradient(145deg, rgb(255 255 255 / 18%), transparent 54%), color-mix(in srgb, var(--btn-bg) 72%, transparent);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 20%);
  color: var(--text-secondary);
  font: inherit;
  font-size: .68rem;
  cursor: pointer;
  transition: transform .3s cubic-bezier(.25,.1,.25,1), color .3s cubic-bezier(.25,.1,.25,1), border-color .3s cubic-bezier(.25,.1,.25,1), background .3s cubic-bezier(.25,.1,.25,1), box-shadow .3s cubic-bezier(.25,.1,.25,1);
  flex: 0 0 auto;
}

.titlebar-icon-action {
  width: 30px;
  padding: 0;
}

.titlebar-icon-action svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.titlebar-action:hover,
.titlebar-account:hover,
.titlebar-icon-action:hover {
  color: var(--primary);
  border-color: color-mix(in srgb, var(--primary) 26%, var(--glass-border));
  background: linear-gradient(145deg, rgb(255 255 255 / 24%), transparent 55%), color-mix(in srgb, var(--primary) 8%, var(--glass-bg));
  box-shadow: 0 6px 16px color-mix(in srgb, var(--primary) 7%, transparent), inset 0 1px 0 rgb(255 255 255 / 28%);
  transform: translateY(-1px);
}

.titlebar-action:active,
.titlebar-account:active,
.titlebar-icon-action:active {
  transform: scale(.97);
}

.titlebar-avatar {
  display: grid;
  place-items: center;
  width: 21px;
  height: 21px;
  overflow: hidden;
  border-radius: 7px;
  background: color-mix(in srgb, var(--primary) 9%, var(--glass-bg));
  font-size: .78rem;
}

.titlebar-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.titlebar-divider {
  width: 1px;
  height: 20px;
  margin: 0 3px;
  background: var(--divider);
}

.window-control {
  display: grid;
  place-items: center;
  width: 42px;
  height: 100%;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color .3s cubic-bezier(.25,.1,.25,1), background .3s cubic-bezier(.25,.1,.25,1);
}

.window-control svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.15;
}

.window-control:hover {
  color: var(--text-primary);
  background: color-mix(in srgb, var(--primary) 8%, var(--btn-bg-hover));
}

.close-control:hover {
  color: white;
  background: #e5484d;
}

button:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--primary) 50%, transparent);
  outline-offset: -2px;
}

:global([data-theme="dark"]) .desktop-titlebar {
  background: linear-gradient(180deg, rgb(255 255 255 / 4%), transparent), color-mix(in srgb, var(--glass-bg) 88%, transparent);
  border-bottom-color: rgb(255 255 255 / 7%);
  box-shadow: 0 8px 24px rgb(0 0 0 / 14%), inset 0 1px 0 rgb(255 255 255 / 6%);
}
</style>
