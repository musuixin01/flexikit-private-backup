<template>
  <section class="launcher-widget">
    <div class="launcher-widget-head">
      <span>
        <strong>{{ widget.title }}</strong>
        <small>{{ pinnedEntries.length }} 个常用 · {{ configuredPinnedKeys ? '已固定' : '自动学习' }}{{ invalidPinnedCount ? ` · ${invalidPinnedCount} 个失效` : '' }}</small>
      </span>
      <button type="button" @click.stop="openCenter">展开</button>
    </div>

    <div v-if="pinnedEntries.length" class="launcher-grid">
      <button
        v-for="entry in pinnedEntries"
        :key="entry.key"
        class="launcher-item"
        :class="{ 'is-invalid': entry.kind === 'invalid-app' }"
        type="button"
        :disabled="entry.kind === 'invalid-app'"
        :title="entry.kind === 'invalid-app' ? entry.subtitle : entry.name"
        @click="entry.kind !== 'invalid-app' && launch(entry)"
      >
        <span class="launcher-icon">
          <ToolIcon v-if="entry.kind === 'tool'" :tool="entry.tool" />
          <img v-else-if="entry.kind === 'app' && installedIcon(entry.app)" :src="installedIcon(entry.app) || ''" alt="" draggable="false">
          <span v-else-if="entry.kind === 'invalid-app'" class="invalid-app-icon">!</span>
          <span v-else class="local-app-letter">{{ entry.name.slice(0, 1).toUpperCase() }}</span>
        </span>
        <span>{{ entry.name }}</span>
      </button>
    </div>
    <button v-else class="widget-empty widget-empty-action" type="button" @click="openLaunchpad">
      {{ installedAppsLoading ? '正在识别常用应用…' : '添加常用应用' }}
    </button>

    <Teleport to="body">
      <Transition name="launcher-expand" @after-enter="notifyCanvasRegionsChanged" @after-leave="notifyCanvasRegionsChanged">
        <div
          v-if="mode !== 'compact'"
          class="launcher-overlay"
          :class="{ 'is-launchpad': mode === 'launchpad' }"
          @pointerdown.self="closeOverlay"
        >
          <section class="launcher-panel">
            <header class="launcher-overlay-head">
              <div class="overlay-title">
                <button v-if="mode === 'launchpad'" class="back-button" type="button" @click="mode = 'center'">‹</button>
                <span>
                  <strong>{{ mode === 'launchpad' ? '应用库' : '快速启动' }}</strong>
                  <small>{{ mode === 'launchpad' ? `${filteredLibraryEntries.length} 个可用应用` : `${pinnedEntries.length} 个常用应用` }}</small>
                </span>
              </div>
              <label class="launcher-search">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
                <input v-model="query" type="search" placeholder="搜索应用、工具和网站…" autocomplete="off">
              </label>
              <button class="overlay-close" type="button" aria-label="关闭" @click="closeOverlay">×</button>
            </header>

            <template v-if="mode === 'center'">
              <div class="center-copy">
                <span>{{ organizing ? '拖拽调整顺序 · 点击 − 移除' : (configuredPinnedKeys ? '常用应用' : '常用应用 · 自动学习') }}</span>
                <div class="center-actions">
                  <button v-if="pinnedEntries.length" type="button" :class="{ active: organizing }" @click="toggleOrganizing">
                    {{ organizing ? '完成' : '整理' }}
                  </button>
                  <button type="button" @click="openLaunchpad">全部应用 <i>›</i></button>
                </div>
              </div>
              <div v-if="centerEntries.length" ref="centerGridRef" class="center-grid" :class="{ 'is-organizing': organizing }" @dragstart.capture.prevent>
                <div
                  v-for="entry in centerEntries"
                  :key="entry.key"
                  class="app-tile-shell"
                  :data-tool-key="entry.key"
                >
                  <button
                    class="app-tile"
                    :class="{ 'is-invalid': entry.kind === 'invalid-app' }"
                    type="button"
                    :disabled="entry.kind === 'invalid-app' && !organizing"
                    :aria-disabled="organizing || entry.kind === 'invalid-app'"
                    @click="!organizing && entry.kind !== 'invalid-app' && launch(entry)"
                  >
                    <span class="app-icon">
                      <ToolIcon v-if="entry.kind === 'tool'" :tool="entry.tool" />
                      <img v-else-if="entry.kind === 'app' && installedIcon(entry.app)" :src="installedIcon(entry.app) || ''" alt="" draggable="false">
                      <span v-else-if="entry.kind === 'invalid-app'" class="invalid-app-icon">!</span>
                      <span v-else class="local-app-letter">{{ entry.name.slice(0, 1).toUpperCase() }}</span>
                    </span>
                    <strong>{{ entry.name }}</strong>
                    <small>{{ entry.subtitle }}</small>
                  </button>
                  <button
                    v-if="organizing && isPinned(entry)"
                    class="pin-action remove"
                    type="button"
                    :aria-label="`从常用中移除 ${entry.name}`"
                    @click.stop="togglePinned(entry)"
                  >−</button>
                  <span v-if="organizing && isPinned(entry)" class="drag-grip" aria-hidden="true">⋮⋮</span>
                </div>
              </div>
              <div v-else class="overlay-empty">
                <strong>{{ query.trim() ? '没有找到相关常用应用' : '还没有常用应用' }}</strong>
                <button v-if="!query.trim()" type="button" @click="openLaunchpad">从应用库添加</button>
              </div>
              <footer class="launcher-footer">
                <button type="button" @click="openLaunchpad">
                  <span class="mini-grid" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></span>
                  <span><strong>打开应用库</strong><small>添加、移除或查找本地软件与工具</small></span>
                  <b>›</b>
                </button>
              </footer>
            </template>

            <template v-else>
              <nav class="category-strip" aria-label="应用分类">
                <button
                  v-for="category in categories"
                  :key="category"
                  type="button"
                  :class="{ active: activeCategory === category }"
                  @click="activeCategory = category"
                >
                  {{ category }}
                </button>
              </nav>
              <div class="launchpad-grid">
                <div
                  v-for="entry in filteredLibraryEntries"
                  :key="entry.key"
                  class="launchpad-app-shell"
                  @mouseenter="entry.kind === 'app' && ensureInstalledIcon(entry.app)"
                  @focusin="entry.kind === 'app' && ensureInstalledIcon(entry.app)"
                >
                  <button
                    class="launchpad-app"
                    type="button"
                    @click="launch(entry)"
                  >
                    <span class="launchpad-icon">
                      <ToolIcon v-if="entry.kind === 'tool'" :tool="entry.tool" />
                      <img v-else-if="entry.kind === 'app' && installedIcon(entry.app)" :src="installedIcon(entry.app) || ''" alt="">
                      <span v-else class="local-app-letter">{{ entry.name.slice(0, 1).toUpperCase() }}</span>
                    </span>
                    <strong>{{ entry.name }}</strong>
                    <small>{{ entry.subtitle }}</small>
                  </button>
                  <button
                    class="pin-action launchpad-pin"
                    :class="{ pinned: isPinned(entry) }"
                    type="button"
                    :aria-label="isPinned(entry) ? `从常用中移除 ${entry.name}` : `添加 ${entry.name} 到常用`"
                    @click.stop="togglePinned(entry)"
                  >{{ isPinned(entry) ? '✓' : '+' }}</button>
                </div>
              </div>
              <div v-if="!filteredLibraryEntries.length" class="overlay-empty">没有找到相关应用或工具</div>
            </template>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Sortable, { type SortableEvent } from 'sortablejs'
import ToolIcon from '@/components/tools/ToolIcon.vue'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { useDesktopCanvasStore } from '@/stores/desktopCanvas'
import type { Tool } from '@/types/tool'
import {
  discoverInstalledApps,
  getInstalledAppIcon,
  launchInstalledApp,
  type InstalledApp,
} from '@/desktop/installedApps'
import { openDesktopTool } from '@/desktop/openTool'
import type { DesktopWidget } from '@/types/desktopWidget'
import {
  getInstalledAppRecommendationScore,
  getInstalledAppStableKey,
  readGlobalSearchAppBoosts,
  readInstalledAppUsage,
  recordInstalledAppUsage,
} from '@/utils/installedAppUsage'

const props = defineProps<{ widget: DesktopWidget }>()

type LauncherMode = 'compact' | 'center' | 'launchpad'
type LauncherEntry =
  | { kind: 'tool'; key: string; name: string; subtitle: string; tool: Tool }
  | { kind: 'app'; key: string; name: string; subtitle: string; app: InstalledApp }
  | { kind: 'invalid-app'; key: string; name: string; subtitle: string }

const store = useToolsStore()
const ui = useUiStore()
const canvas = useDesktopCanvasStore()
const mode = ref<LauncherMode>('compact')
const query = ref('')
const activeCategory = ref('全部')
const organizing = ref(false)
const centerGridRef = ref<HTMLElement | null>(null)
const installedApps = ref<InstalledApp[]>([])
const installedIcons = ref<Record<string, string>>({})
const installedAppsLoading = ref(false)
const usageRevision = ref(0)
const lastCatalogRefreshAt = ref(0)
const catalogRefreshIntervalMs = 60_000
const iconFailures = new Set<string>()
let launcherSortable: Sortable | null = null

const configuredPinnedKeys = computed(() => {
  const value = props.widget.config.launcherPinnedKeys
  return Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string') : null
})

const recommendedInstalledApps = computed(() => {
  usageRevision.value
  const usage = readInstalledAppUsage()
  const globalSearchBoosts = readGlobalSearchAppBoosts()

  return installedApps.value
    .filter(app => Boolean(app.launchKind && app.launchTarget))
    .map(app => ({
      app,
      score: getInstalledAppRecommendationScore(app, usage, globalSearchBoosts),
    }))
    .filter(item => Number.isFinite(item.score) && item.score > 0)
    .sort((left, right) => right.score - left.score || left.app.name.localeCompare(right.app.name, 'zh-CN'))
    .slice(0, 12)
    .map(item => item.app)
})

const defaultPinnedKeys = computed(() => {
  const appKeys = recommendedInstalledApps.value.map(getInstalledAppStableKey)
  const toolKeys = store.allTools
    .slice(0, Math.max(0, 12 - appKeys.length))
    .map(toolKey)
  return [...appKeys, ...toolKeys]
})

const pinnedKeys = computed(() => configuredPinnedKeys.value ?? defaultPinnedKeys.value)
const toolByKey = computed(() => new Map(store.allTools.map(tool => [toolKey(tool), tool])))
const appByKey = computed(() => new Map(installedApps.value.map(app => [getInstalledAppStableKey(app), app])))

const pinnedEntries = computed<LauncherEntry[]>(() => pinnedKeys.value
  .map(key => {
    const app = appByKey.value.get(key)
    if (app) {
      if (!app.launchKind || !app.launchTarget) {
        return {
          kind: 'invalid-app' as const,
          key,
          name: app.name,
          subtitle: '应用入口已失效，可在整理模式中移除',
        }
      }
      return {
        kind: 'app' as const,
        key,
        name: app.name,
        subtitle: app.publisher || (app.launchKind === 'aumid' ? 'Microsoft Store' : '本地应用'),
        app,
      }
    }
    const tool = toolByKey.value.get(key)
    if (tool) {
      return {
        kind: 'tool' as const,
        key,
        name: tool.name,
        subtitle: tool.cat,
        tool,
      }
    }
    if (key.startsWith('app:')) {
      return {
        kind: 'invalid-app' as const,
        key,
        name: displayNameFromAppKey(key),
        subtitle: '应用已卸载或入口不存在，可在整理模式中移除',
      }
    }
    return null
  })
  .filter((entry): entry is LauncherEntry => entry !== null))

const invalidPinnedCount = computed(() => pinnedEntries.value
  .filter(entry => entry.kind === 'invalid-app')
  .length)

const appLibraryEntries = computed<LauncherEntry[]>(() => {
  usageRevision.value
  const usage = readInstalledAppUsage()
  const globalSearchBoosts = readGlobalSearchAppBoosts()
  return installedApps.value
    .filter(app => Boolean(app.launchKind && app.launchTarget))
    .map(app => ({
      app,
      score: getInstalledAppRecommendationScore(app, usage, globalSearchBoosts),
    }))
    .sort((left, right) => right.score - left.score || left.app.name.localeCompare(right.app.name, 'zh-CN'))
    .map(({ app }) => ({
      kind: 'app' as const,
      key: getInstalledAppStableKey(app),
      name: app.name,
      subtitle: app.publisher || (app.launchKind === 'aumid' ? 'Microsoft Store' : '本地应用'),
      app,
    }))
})

const toolLibraryEntries = computed<LauncherEntry[]>(() => store.allTools.map(tool => ({
  kind: 'tool' as const,
  key: toolKey(tool),
  name: tool.name,
  subtitle: tool.cat,
  tool,
})))

const categories = computed(() => [
  '全部',
  '本地应用',
  'FlexiKit 工具',
  ...Array.from(new Set(store.allTools.map(tool => tool.cat).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
])

const filteredLibraryEntries = computed<LauncherEntry[]>(() => {
  const keyword = query.value.trim().toLowerCase()
  return [...appLibraryEntries.value, ...toolLibraryEntries.value].filter(entry => {
    if (activeCategory.value === '本地应用' && entry.kind !== 'app') return false
    if (activeCategory.value === 'FlexiKit 工具' && entry.kind !== 'tool') return false
    if (!['全部', '本地应用', 'FlexiKit 工具'].includes(activeCategory.value)) {
      if (entry.kind !== 'tool' || entry.tool.cat !== activeCategory.value) return false
    }
    if (!keyword) return true
    return entrySearchValues(entry)
      .some(value => value?.toLowerCase().includes(keyword))
  })
})

const centerEntries = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return pinnedEntries.value
  return pinnedEntries.value.filter(entry => entrySearchValues(entry)
    .some(value => value.toLowerCase().includes(keyword)))
})

function toolKey(tool: Tool): string {
  return String(tool.id ?? `${tool.name}-${tool.url}`)
}

function entrySearchValues(entry: LauncherEntry): string[] {
  if (entry.kind === 'app') {
    return [entry.name, entry.app.publisher, entry.app.version, '本地应用']
  }
  if (entry.kind === 'invalid-app') {
    return [entry.name, entry.subtitle, '失效应用']
  }
  return [entry.name, entry.tool.desc, entry.tool.cat, ...(entry.tool.tags || [])]
}

function displayNameFromAppKey(key: string): string {
  const name = key.slice(4).trim()
  if (!name) return '失效应用'
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function launcherKey(value: Tool | LauncherEntry): string {
  return 'kind' in value ? value.key : toolKey(value)
}

function isLauncherEntry(value: Tool | LauncherEntry): value is LauncherEntry {
  return 'kind' in value
}

function persistPinnedKeys(keys: string[]): void {
  canvas.updateWidget(props.widget.id, {
    config: {
      ...props.widget.config,
      launcherPinnedKeys: Array.from(new Set(keys)),
    },
  })
}

function isPinned(value: Tool | LauncherEntry): boolean {
  return pinnedKeys.value.includes(launcherKey(value))
}

function togglePinned(value: Tool | LauncherEntry): void {
  const key = launcherKey(value)
  const next = isPinned(value)
    ? pinnedKeys.value.filter(item => item !== key)
    : [...pinnedKeys.value, key]
  persistPinnedKeys(next)
  void nextTick(initSortable)
}

function installedIcon(app: InstalledApp): string | null {
  return installedIcons.value[getInstalledAppStableKey(app)] || null
}

async function ensureInstalledIcon(app: InstalledApp): Promise<void> {
  const key = getInstalledAppStableKey(app)
  if (installedIcons.value[key] || iconFailures.has(key)) return
  try {
    const icon = await getInstalledAppIcon(app.name)
    if (icon) {
      installedIcons.value = { ...installedIcons.value, [key]: icon }
    } else {
      iconFailures.add(key)
    }
  } catch {
    iconFailures.add(key)
  }
}

async function loadInstalledApps(forceRefresh = false): Promise<void> {
  installedAppsLoading.value = true
  try {
    installedApps.value = await discoverInstalledApps(forceRefresh)
    lastCatalogRefreshAt.value = Date.now()
  } catch {
    if (!installedApps.value.length) installedApps.value = []
  } finally {
    installedAppsLoading.value = false
  }
}

function refreshInstalledAppsIfNeeded(): void {
  if (Date.now() - lastCatalogRefreshAt.value < catalogRefreshIntervalMs) return
  void loadInstalledApps(true)
}

function notifyCanvasRegionsChanged(): void {
  void nextTick(() => {
    window.dispatchEvent(new CustomEvent('flexikit:canvas-regions-changed'))
  })
}

function openCenter(): void {
  activeCategory.value = '全部'
  refreshInstalledAppsIfNeeded()
  mode.value = 'center'
  void nextTick(initSortable)
}

function openLaunchpad(): void {
  organizing.value = false
  activeCategory.value = '全部'
  refreshInstalledAppsIfNeeded()
  mode.value = 'launchpad'
  destroySortable()
}

function closeOverlay(): void {
  mode.value = 'compact'
  organizing.value = false
  query.value = ''
  activeCategory.value = '全部'
  destroySortable()
}

function toggleOrganizing(): void {
  organizing.value = !organizing.value
  void nextTick(initSortable)
}

function disableNativeLauncherDrag(): void {
  if (!centerGridRef.value) return
  centerGridRef.value
    .querySelectorAll<HTMLElement>('.app-tile-shell, .app-tile, img')
    .forEach(element => {
      element.draggable = false
      element.setAttribute('draggable', 'false')
    })
}

function initSortable(): void {
  destroySortable()
  if (!organizing.value || mode.value !== 'center' || query.value.trim() || !centerGridRef.value) return

  disableNativeLauncherDrag()

  launcherSortable = new Sortable(centerGridRef.value, {
    animation: 200,
    draggable: '.app-tile-shell',
    filter: '.pin-action',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 3,
    swapThreshold: 0.65,
    ghostClass: 'launcher-drag-ghost',
    chosenClass: 'launcher-drag-chosen',
    dragClass: 'launcher-dragging',
    onEnd: handleSortEnd,
  })
}

function handleSortEnd(event: SortableEvent): void {
  const container = event.target
  const keys = Array.from(container.querySelectorAll<HTMLElement>('.app-tile-shell'))
    .map(element => element.dataset.toolKey)
    .filter((key): key is string => Boolean(key))
  persistPinnedKeys(keys)
  notifyCanvasRegionsChanged()
}

function destroySortable(): void {
  launcherSortable?.destroy()
  launcherSortable = null
}

function launch(value: Tool | LauncherEntry): void {
  void (async () => {
    let opened = false
    try {
      if (!isLauncherEntry(value)) {
        await openDesktopTool(value)
        opened = true
        return
      }
      if (value.kind === 'invalid-app') return
      if (value.kind === 'tool') {
        await openDesktopTool(value.tool)
        opened = true
        return
      }
      opened = await launchInstalledApp(value.app.name)
      if (opened) {
        recordInstalledAppUsage(value.app)
        usageRevision.value += 1
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      ui.showToast(`打开失败: ${message}`)
      await loadInstalledApps(true)
    } finally {
      if (opened && mode.value !== 'compact') closeOverlay()
    }
  })()
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && organizing.value) {
    organizing.value = false
    destroySortable()
    return
  }
  if (event.key === 'Escape' && mode.value !== 'compact') closeOverlay()
}

watch(mode, notifyCanvasRegionsChanged)
watch([organizing, pinnedEntries], () => {
  void nextTick(initSortable)
})
watch(pinnedEntries, entries => {
  entries.forEach(entry => {
    if (entry.kind === 'app') void ensureInstalledIcon(entry.app)
  })
}, { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  void loadInstalledApps(true)
})

onBeforeUnmount(() => {
  destroySortable()
  window.removeEventListener('keydown', onKeyDown)
})
</script>

<style scoped>
.launcher-widget{height:100%;display:flex;flex-direction:column;padding:10px;overflow:hidden}
.launcher-widget-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 3px 8px}
.launcher-widget-head>span{display:grid;gap:1px;min-width:0}
.launcher-widget-head strong{font-size:.72rem;font-weight:680;color:var(--text-primary)}
.launcher-widget-head small{font-size:.56rem;color:var(--text-tertiary)}
.launcher-widget-head button{height:27px;padding:0 9px;border:1px solid var(--glass-border);border-radius:9px;background:var(--btn-bg);color:var(--primary);font:inherit;font-size:.61rem;font-weight:620;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.launcher-widget-head button:hover{background:var(--btn-bg-hover);transform:scale(1.02)}
.launcher-widget-head button:active{transform:scale(.98)}
.launcher-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(72px,1fr));grid-auto-rows:minmax(82px,auto);align-content:start;gap:8px;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable}
.launcher-item{min-width:0;border:0;background:transparent;color:var(--text-secondary);display:grid;place-items:center;gap:6px;padding:8px 5px;border-radius:14px;font:inherit;font-size:.66rem;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.launcher-item:hover{background:var(--btn-bg-hover);color:var(--text-primary);transform:scale(1.02)}
.launcher-item:active{transform:scale(.98)}
.launcher-item.is-invalid{opacity:.58;cursor:not-allowed;filter:saturate(.55)}
.launcher-item.is-invalid:hover{background:transparent;transform:none}
.invalid-app-icon{display:grid;place-items:center;width:100%;height:100%;border-radius:inherit;color:var(--danger);font-size:1rem;font-weight:800;background:color-mix(in srgb,var(--danger) 9%,transparent)}
.launcher-icon{width:38px;height:38px;display:grid;place-items:center;border-radius:12px;background:var(--icon-surface)}
.launcher-icon :deep(img),.launcher-icon :deep(svg){width:28px;height:28px;object-fit:contain}
.local-app-letter{display:grid;place-items:center;width:100%;height:100%;border-radius:inherit;color:var(--text-secondary);font-size:.9rem;font-weight:720;letter-spacing:-.03em;background:color-mix(in srgb,var(--primary) 8%,transparent)}
.launcher-item>span:last-child{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.widget-empty{height:100%;display:grid;place-items:center;color:var(--text-tertiary);font-size:.75rem}
.widget-empty-action{border:0;background:transparent;font:inherit;cursor:pointer}
.widget-empty-action:hover{color:var(--primary)}

.launcher-overlay{position:fixed;z-index:50000;inset:0;display:grid;place-items:center;padding:5vh 5vw;background:rgba(4,8,14,.18);backdrop-filter:blur(12px) saturate(125%);-webkit-backdrop-filter:blur(12px) saturate(125%)}
.launcher-panel{width:min(860px,92vw);max-height:86vh;display:flex;flex-direction:column;overflow:hidden;border:1px solid color-mix(in srgb,white 26%,var(--glass-border));border-radius:28px;background:color-mix(in srgb,var(--glass-bg) 92%,transparent);backdrop-filter:blur(42px) saturate(165%);-webkit-backdrop-filter:blur(42px) saturate(165%);box-shadow:0 28px 80px rgb(0 0 0 / 18%),inset 0 1px 0 rgb(255 255 255 / 28%),inset 0 0 0 1px rgb(255 255 255 / 5%)}
.is-launchpad{padding:22px}
.is-launchpad .launcher-panel{width:min(1180px,calc(100vw - 44px));height:min(820px,calc(100vh - 44px));max-height:none;border-radius:32px}
.launcher-overlay-head{display:grid;grid-template-columns:minmax(150px,1fr) minmax(240px,420px) minmax(34px,1fr);align-items:center;gap:16px;padding:18px 20px;border-bottom:1px solid var(--glass-border)}
.overlay-title{display:flex;align-items:center;gap:9px;min-width:0}
.overlay-title>span{display:grid;gap:2px}
.overlay-title strong{font-size:.9rem;color:var(--text-primary);font-weight:700}
.overlay-title small{font-size:.6rem;color:var(--text-tertiary)}
.back-button,.overlay-close{border:0;background:var(--btn-bg);color:var(--text-secondary);cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.back-button{width:32px;height:32px;border-radius:10px;font-size:1.35rem;line-height:1}
.overlay-close{justify-self:end;width:32px;height:32px;border-radius:50%;font-size:1.05rem}
.back-button:hover,.overlay-close:hover{background:var(--btn-bg-hover);color:var(--text-primary);transform:scale(1.02)}
.back-button:active,.overlay-close:active{transform:scale(.98)}
.launcher-search{height:38px;display:flex;align-items:center;gap:9px;padding:0 12px;border:1px solid var(--glass-border);border-radius:13px;background:var(--input-bg);box-shadow:inset 0 1px 0 rgb(255 255 255 / 14%)}
.launcher-search svg{width:16px;height:16px;fill:none;stroke:var(--text-tertiary);stroke-width:1.8}
.launcher-search input{width:100%;border:0;outline:0;background:transparent;color:var(--text-primary);font:inherit;font-size:.72rem}
.launcher-search input::placeholder{color:var(--text-tertiary)}
.center-copy{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px 8px;color:var(--text-secondary);font-size:.68rem;font-weight:650}
.center-actions{display:flex;align-items:center;gap:10px}
.center-copy button{border:0;background:transparent;color:var(--primary);font:inherit;font-size:.65rem;cursor:pointer}
.center-copy button.active{font-weight:720}
.center-copy i{font-style:normal;font-size:.9rem}
.center-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));grid-auto-rows:112px;align-content:start;gap:10px;padding:4px 20px 12px;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable}
.app-tile-shell,.launchpad-app-shell{position:relative;min-width:0}
.app-tile{width:100%;min-width:0;display:grid;place-items:center;gap:6px;padding:13px 7px;border:1px solid transparent;border-radius:18px;background:transparent;color:var(--text-secondary);font:inherit;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.app-tile:hover{background:var(--btn-bg-hover);border-color:var(--glass-border);transform:scale(1.02)}
.app-tile:active{transform:scale(.98)}
.app-tile.is-invalid{opacity:.58;cursor:not-allowed;filter:saturate(.55)}
.app-tile.is-invalid:hover{background:transparent;border-color:transparent;transform:none}
.center-grid.is-organizing .app-tile-shell,.center-grid.is-organizing .app-tile{cursor:grab;touch-action:none;user-select:none;-webkit-user-drag:none}
.center-grid.is-organizing img{-webkit-user-drag:none;user-select:none}
.app-icon{width:48px;height:48px;display:grid;place-items:center;border-radius:15px;background:var(--icon-surface);box-shadow:0 6px 18px rgb(0 0 0 / 7%),inset 0 1px 0 rgb(255 255 255 / 18%)}
.app-icon :deep(img),.app-icon :deep(svg){width:34px;height:34px;object-fit:contain}
.app-tile strong{max-width:100%;font-size:.66rem;font-weight:620;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.app-tile small{max-width:100%;font-size:.55rem;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pin-action{position:absolute;z-index:3;display:grid;place-items:center;width:22px;height:22px;padding:0;border:1px solid var(--glass-border);border-radius:50%;background:color-mix(in srgb,var(--glass-bg) 90%,transparent);color:var(--text-secondary);font:700 .75rem/1 system-ui;cursor:pointer;backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:all .2s cubic-bezier(.25,.1,.25,1)}
.pin-action:hover{transform:scale(1.08);color:var(--primary);border-color:color-mix(in srgb,var(--primary) 35%,var(--glass-border))}
.pin-action.remove{top:3px;right:3px;color:var(--danger)}
.drag-grip{position:absolute;z-index:2;left:50%;bottom:1px;min-width:34px;height:16px;display:grid;place-items:center;transform:translateX(-50%);color:var(--text-tertiary);font-size:.62rem;letter-spacing:-2px;pointer-events:auto;cursor:grab;touch-action:none}
.launcher-drag-ghost{opacity:.36}
.launcher-drag-chosen{background:var(--btn-bg-hover);border-radius:18px}
.launcher-dragging{cursor:grabbing!important}
.launcher-footer{padding:10px 20px 18px}
.launcher-footer>button{width:100%;display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid var(--glass-border);border-radius:16px;background:var(--btn-bg);color:var(--text-secondary);font:inherit;text-align:left;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.launcher-footer>button:hover{background:var(--btn-bg-hover);transform:scale(1.01)}
.launcher-footer>button:active{transform:scale(.99)}
.launcher-footer>button>span:nth-child(2){display:grid;gap:2px;flex:1}
.launcher-footer strong{font-size:.68rem;color:var(--text-primary)}
.launcher-footer small{font-size:.56rem;color:var(--text-tertiary)}
.launcher-footer b{font-size:1.1rem;color:var(--text-tertiary);font-weight:400}
.mini-grid{width:30px;height:30px;display:grid;grid-template-columns:repeat(3,1fr);gap:3px;padding:4px;border-radius:9px;background:var(--icon-surface)}
.mini-grid i{border-radius:2px;background:var(--primary);opacity:.72}
.category-strip{display:flex;gap:7px;padding:14px 20px 8px;overflow-x:auto}
.category-strip button{flex:0 0 auto;height:30px;padding:0 11px;border:1px solid var(--glass-border);border-radius:999px;background:var(--btn-bg);color:var(--text-secondary);font:inherit;font-size:.62rem;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.category-strip button:hover{transform:scale(1.02);background:var(--btn-bg-hover)}
.category-strip button:active{transform:scale(.98)}
.category-strip button.active{background:color-mix(in srgb,var(--primary) 13%,var(--btn-bg));border-color:color-mix(in srgb,var(--primary) 35%,var(--glass-border));color:var(--primary)}
.launchpad-grid{flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(108px,1fr));grid-auto-rows:122px;align-content:start;gap:12px;padding:14px 24px 28px;overflow-y:auto;overflow-x:hidden;scrollbar-gutter:stable}
.launchpad-app{width:100%;min-width:0;display:grid;place-items:center;gap:7px;padding:12px 6px;border:0;border-radius:20px;background:transparent;color:var(--text-secondary);font:inherit;cursor:pointer;transition:all .3s cubic-bezier(.25,.1,.25,1)}
.launchpad-app:hover{background:var(--btn-bg-hover);transform:scale(1.02)}
.launchpad-app:active{transform:scale(.98)}
.launchpad-icon{width:58px;height:58px;display:grid;place-items:center;border-radius:18px;background:var(--icon-surface);box-shadow:0 8px 22px rgb(0 0 0 / 8%),inset 0 1px 0 rgb(255 255 255 / 20%)}
.launchpad-icon :deep(img),.launchpad-icon :deep(svg){width:42px;height:42px;object-fit:contain}
.launchpad-app strong{max-width:100%;font-size:.67rem;font-weight:620;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.launchpad-app small{max-width:100%;font-size:.55rem;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.launchpad-pin{top:5px;right:9px}
.launchpad-pin.pinned{background:color-mix(in srgb,var(--primary) 13%,var(--glass-bg));color:var(--primary);border-color:color-mix(in srgb,var(--primary) 34%,var(--glass-border))}
.overlay-empty{min-height:180px;display:grid;place-items:center;align-content:center;gap:10px;color:var(--text-tertiary);font-size:.7rem}
.overlay-empty strong{color:var(--text-secondary)}
.overlay-empty button{border:0;background:transparent;color:var(--primary);font:inherit;font-size:.66rem;cursor:pointer}
.launcher-expand-enter-active,.launcher-expand-leave-active{transition:opacity .3s cubic-bezier(.25,.1,.25,1)}
.launcher-expand-enter-active .launcher-panel,.launcher-expand-leave-active .launcher-panel{transition:transform .3s cubic-bezier(.25,.1,.25,1),opacity .3s cubic-bezier(.25,.1,.25,1)}
.launcher-expand-enter-from,.launcher-expand-leave-to{opacity:0}
.launcher-expand-enter-from .launcher-panel,.launcher-expand-leave-to .launcher-panel{opacity:0;transform:translateY(18px) scale(.96)}
[data-theme="dark"] .launcher-panel{background:rgba(11,16,24,.9);border-color:rgba(255,255,255,.1);box-shadow:0 32px 90px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.08)}

@media (max-width:760px){
  .center-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
  .launcher-overlay-head{grid-template-columns:1fr auto}
  .launcher-search{grid-column:1/-1;grid-row:2}
  .overlay-close{grid-column:2;grid-row:1}
}
</style>
