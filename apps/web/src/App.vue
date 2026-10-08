<template>
  <router-view v-if="isPetWindow || isCanvasWindow" />

  <template v-else>
    <div class="bg-layer" aria-hidden="true"></div>
    <DesktopTitlebar v-if="isDesktop" />
    <div :class="['app-window-content', { 'desktop-window-content': isDesktop }]">
      <div v-if="showDesktopShell" class="desktop-app-shell">
        <Sidebar compact-mode />
        <main class="desktop-app-stage">
          <router-view />
        </main>
      </div>
      <router-view v-else />
    </div>
    <SettingsPanel />
    <GlobalSearchOverlay v-if="isDesktop && !isPetWindow && !isCanvasWindow" />
    <CookieConsent v-if="!isDesktop" />
  </template>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SettingsPanel from '@/components/layout/SettingsPanel.vue'
import Sidebar from '@/components/layout/Sidebar.vue'
import DesktopTitlebar from '@/components/layout/DesktopTitlebar.vue'
import CookieConsent from '@/components/common/CookieConsent.vue'
import GlobalSearchOverlay from '@/components/desktop/GlobalSearchOverlay.vue'
import { isDesktopRuntime } from '@/api/runtime'
import { useUiStore } from '@/stores/ui'

const isDesktop = isDesktopRuntime()
const route = useRoute()
const router = useRouter()
const ui = useUiStore()
const isPetWindow = computed(() => isDesktop && route.name === 'Pet')
const isCanvasWindow = computed(() => isDesktop && route.name === 'DesktopCanvas')
const showDesktopShell = computed(() => isDesktop && route.name !== 'Home' && route.name !== 'Pet' && route.name !== 'DesktopCanvas')
watchEffect(() => {
  // Opaque main window uses a stable, low-cost paint surface at all sizes.
  // Never paint the transparent Pet or Canvas window backgrounds.
  if (isDesktop) {
    document.documentElement.classList.toggle('desktop-main-window', !isPetWindow.value && !isCanvasWindow.value)
  }
})

function applyPetSearch() {
  if (!isDesktop || isPetWindow.value || isCanvasWindow.value) return
  const keyword = localStorage.getItem('flexikit-pet-search')?.trim()
  if (!keyword) return
  localStorage.removeItem('flexikit-pet-search')
  ui.searchQuery = keyword
  void router.push('/app')
}

onMounted(() => {
  window.addEventListener('focus', applyPetSearch)
  window.setTimeout(applyPetSearch, 250)
})

onBeforeUnmount(() => {
  window.removeEventListener('focus', applyPetSearch)
  document.documentElement.classList.remove('desktop-main-window')
})
</script>

<style>
/* 只让 FlexiKit 品牌 Logo 跟随主题色，工具卡片中的网站 Logo 保持品牌原色。 */
img[src$="/icon/icon_256x256.ico"] {
  filter: var(--brand-logo-filter, none);
  opacity: var(--brand-logo-opacity, .98);
  transition: filter .3s cubic-bezier(.25, .1, .25, 1), opacity .3s cubic-bezier(.25, .1, .25, 1);
}

.app-window-content {
  width: 100%;
  min-width: 0;
  flex: 1 1 auto;
}

.desktop-app-shell {
  position: relative;
  z-index: 1;
  display: flex;
  width: 100%;
  min-height: calc(100vh - 44px);
  padding: clamp(12px, 1vw, 18px);
  gap: clamp(16px, 1.2vw, 20px);
}

.desktop-window-content {
  width: 100%;
  min-height: 100vh;
  padding-top: 44px;
}

.desktop-window-content > .app-layout {
  min-height: calc(100vh - 44px);
}

.desktop-window-content .sidebar.desktop-runtime {
  top: 58px;
  height: calc(100vh - 74px);
}

.desktop-app-stage {
  flex: 1;
  min-width: 0;
}

.desktop-app-stage > .app-layout,
.desktop-app-stage > .legal-page,
.desktop-app-stage > .data-page {
  width: 100%;
  max-width: none;
  min-height: calc(100vh - 36px);
  margin: 0;
}

.desktop-app-stage .main-content.full-width {
  width: 100%;
  max-width: none;
  padding: 4px 8px 32px;
}

.desktop-app-stage .login-page {
  padding: 0;
}
</style>
