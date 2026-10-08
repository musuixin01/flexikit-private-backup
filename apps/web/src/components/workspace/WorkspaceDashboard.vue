<template>
  <section class="workspace-dashboard" aria-labelledby="dashboard-title">
    <header class="dashboard-hero">
      <div>
        <span class="eyebrow">WORKSPACE</span>
        <h1 id="dashboard-title">{{ title }}</h1>
        <p>把常用工具、最近使用和收藏集中到一个入口。</p>
      </div>
      <div class="hero-actions">
        <button v-if="isDesktop" class="action primary" type="button" @click="emit('add-local-tool')">＋ 添加本地工具</button>
        <button :class="['action', { primary: !isDesktop }]" type="button" @click="emit('add-tool')">{{ isDesktop ? '添加网页工具' : '＋ 添加工具' }}</button>
        <button class="action" type="button" @click="emit('open-library', '全部')">全部工具</button>
        <RouterLink class="action" to="/discover">发现</RouterLink>
      </div>
    </header>

    <div class="status-row" aria-label="工作台概览">
      <span><b>{{ tools.allTools.length }}</b> 工具</span><i></i>
      <span><b>{{ tools.favoriteTools.size }}</b> 收藏</span><i></i>
      <span><b>{{ localCount }}</b> 本地</span><i></i>
      <span><b>{{ tools.customTools.length }}</b> 自定义</span>
    </div>

    <div class="main-grid">
      <section class="panel">
        <header class="panel-head">
          <div><span class="eyebrow">RECENT</span><h2>最近使用</h2></div>
          <button type="button" @click="emit('open-library', '全部')">查看全部</button>
        </header>
        <div v-if="recent.length" class="tool-list">
          <button v-for="tool in recent" :key="tools.getToolKey(tool)" class="tool-row" type="button" @click="openTool(tool)">
            <span class="tool-icon"><ToolIcon :tool="tool" /></span>
            <span class="tool-copy"><b>{{ tool.name }}</b><small>{{ tool.cat }}</small></span>
            <small class="tool-time">{{ recentLabel(tool) }}</small>
            <span class="arrow">›</span>
          </button>
        </div>
        <div v-else class="empty">
          <span>最近打开的工具会出现在这里。</span>
          <button type="button" @click="emit('open-library', '全部')">去打开一个工具</button>
        </div>
      </section>

      <section class="panel">
        <header class="panel-head">
          <div><span class="eyebrow">FAVORITES</span><h2>收藏</h2></div>
          <button type="button" @click="openFavorites">管理收藏</button>
        </header>
        <div v-if="favorites.length" class="tool-list">
          <button v-for="tool in favorites" :key="tools.getToolKey(tool)" class="tool-row" type="button" @click="openTool(tool)">
            <span class="tool-icon"><ToolIcon :tool="tool" /></span>
            <span class="tool-copy"><b>{{ tool.name }}</b><small>{{ tool.localPath || tool.local_path ? '本地应用' : tool.cat }}</small></span>
            <span class="star">★</span>
            <span class="arrow">›</span>
          </button>
        </div>
        <div v-else class="empty">
          <span>收藏常用工具后，可以从这里快速打开。</span>
          <button type="button" @click="emit('open-library', '全部')">浏览工具</button>
        </div>
      </section>
    </div>

    <section class="panel category-panel">
      <header class="panel-head">
        <div><span class="eyebrow">CATEGORIES</span><h2>快速进入</h2></div>
      </header>
      <div class="category-row">
        <button v-for="(item, index) in categories" :key="item.name" type="button" class="category-chip" @click="emit('open-library', item.name)">
          <i :style="{ background: colors[index % colors.length] }"></i>
          <span>{{ item.name }}</span>
          <small>{{ item.count }}</small>
        </button>
      </div>
    </section>

    <section class="panel">
      <header class="panel-head">
        <div><span class="eyebrow">ADDED</span><h2>最近添加</h2></div>
        <button type="button" @click="emit('add-tool')">＋ 添加</button>
      </header>
      <div v-if="recentAdded.length" class="added-grid">
        <button v-for="tool in recentAdded" :key="tools.getToolKey(tool)" type="button" class="added-item" @click="openTool(tool)">
          <span class="tool-icon"><ToolIcon :tool="tool" /></span>
          <span class="tool-copy"><b>{{ tool.name }}</b><small>{{ tool.cat }}</small></span>
        </button>
      </div>
      <div v-else class="empty compact">还没有自定义工具，添加后会显示在这里。</div>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import type { Tool } from '@/types/tool'
import ToolIcon from '@/components/tools/ToolIcon.vue'
import { openDesktopTool } from '@/desktop/openTool'
import { getToolUsageKey, readToolUsage } from '@/utils/toolUsage'
import { isDesktopRuntime } from '@/api/runtime'

const emit = defineEmits<{ 'add-tool': []; 'add-local-tool': []; 'open-library': [category: string] }>()
const tools = useToolsStore()
const ui = useUiStore()
const user = useUserStore()
const usageVersion = ref(0)
const isDesktop = isDesktopRuntime()
const colors = ['#0071e3', '#5e5ce6', '#ff375f', '#ff9f0a', '#30b0c7', '#af52de']

const title = computed(() => user.isLoggedIn && user.displayName ? user.displayName + '，欢迎回来' : '我的工作台')
const localCount = computed(() => tools.allTools.filter(t => Boolean(t.localPath || t.local_path)).length)
const usage = computed(() => { usageVersion.value; return readToolUsage() })
const recent = computed(() => tools.allTools
  .map(tool => ({ tool, entry: usage.value[getToolUsageKey(tool)] }))
  .filter(item => Boolean(item.entry))
  .sort((a, b) => (b.entry?.lastOpenedAt || 0) - (a.entry?.lastOpenedAt || 0))
  .slice(0, 5).map(item => item.tool))
const favorites = computed(() => tools.allTools.filter(t => tools.favoriteTools.has(tools.getToolKey(t))).slice(0, 5))
const recentAdded = computed(() => tools.customTools.slice(-4).reverse())
const categories = computed(() => tools.categoryList
  .map(name => ({ name, count: tools.categoryCounts[name] || 0 }))
  .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 6))

function recentLabel(tool: Tool) {
  const entry = usage.value[getToolUsageKey(tool)]
  if (!entry) return ''
  const minutes = Math.max(0, Math.round((Date.now() - entry.lastOpenedAt) / 60000))
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return minutes + ' 分钟前'
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours + ' 小时前'
  return Math.round(hours / 24) + ' 天前'
}

async function openTool(tool: Tool) {
  try {
    if (await openDesktopTool(tool)) usageVersion.value += 1
    else ui.showToast('当前环境无法打开这个工具')
  } catch {
    ui.showToast('打开工具失败')
  }
}

function openFavorites() {
  ui.showOnlyFav = true
  emit('open-library', '收藏')
}
</script>

<style scoped>
.workspace-dashboard{width:100%;display:grid;gap:12px;padding:0 2px 42px;animation:enter .3s cubic-bezier(.25,.1,.25,1) both}
.dashboard-hero{min-height:102px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px;padding:18px 20px;border:1px solid color-mix(in srgb,var(--glass-border) 84%,white 16%);border-radius:20px;background:radial-gradient(circle at 0 0,color-mix(in srgb,var(--primary) 8%,transparent),transparent 42%),linear-gradient(145deg,rgb(255 255 255 / 22%),transparent 52%),color-mix(in srgb,var(--glass-bg) 76%,var(--bg-primary) 24%);box-shadow:0 8px 30px rgb(15 23 42 / 5%),inset 0 1px 0 rgb(255 255 255 / 24%);backdrop-filter:blur(22px) saturate(145%)}
.dashboard-hero>div:first-child{min-width:0;display:grid;gap:4px}.eyebrow{color:color-mix(in srgb,var(--primary) 78%,var(--text-tertiary));font-size:.55rem;font-weight:760;letter-spacing:.11em}
.dashboard-hero h1{margin:0;color:var(--text-primary);font-size:clamp(1.5rem,2vw,1.95rem);font-weight:720;letter-spacing:-.05em;line-height:1.08}.dashboard-hero p{margin:2px 0 0;color:var(--text-tertiary);font-size:.72rem}
.hero-actions{display:flex;flex-wrap:wrap;gap:7px;flex:0 1 auto;min-width:0}.action{min-height:36px;display:inline-flex;align-items:center;justify-content:center;padding:0 11px;border:1px solid color-mix(in srgb,var(--glass-border) 84%,white 16%);border-radius:12px;background:color-mix(in srgb,var(--glass-bg) 80%,transparent);color:var(--text-secondary);font-size:.67rem;font-weight:630;text-decoration:none;cursor:pointer;box-shadow:inset 0 1px 0 rgb(255 255 255 / 20%);transition:transform .26s cubic-bezier(.25,.1,.25,1),background .26s cubic-bezier(.25,.1,.25,1),color .26s cubic-bezier(.25,.1,.25,1)}
.action:hover{transform:translateY(-1px);color:var(--text-primary);background:color-mix(in srgb,var(--primary) 6%,var(--glass-bg))}.action:active{transform:scale(.98)}.action.primary{color:#fff;border-color:color-mix(in srgb,var(--primary) 72%,transparent);background:color-mix(in srgb,var(--primary) 92%,#111 8%)}
.status-row{min-height:34px;display:flex;align-items:center;gap:10px;padding:0 10px;color:var(--text-tertiary);font-size:.62rem;white-space:nowrap}.status-row b{margin-right:3px;color:var(--text-primary);font-size:.72rem}.status-row i{width:1px;height:11px;background:color-mix(in srgb,var(--divider) 68%,transparent)}
.main-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.panel{min-width:0;padding:15px;border:1px solid color-mix(in srgb,var(--glass-border) 82%,white 18%);border-radius:18px;background:linear-gradient(145deg,rgb(255 255 255 / 16%),transparent 48%),color-mix(in srgb,var(--glass-bg) 74%,var(--bg-primary) 26%);box-shadow:0 7px 22px rgb(15 23 42 / 4%),inset 0 1px 0 rgb(255 255 255 / 20%);backdrop-filter:blur(20px) saturate(140%)}
.panel-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:10px}.panel-head>div{display:grid;gap:3px}.panel-head h2{margin:0;color:var(--text-primary);font-size:.94rem;font-weight:690;letter-spacing:-.025em}.panel-head>button{padding:5px 3px;border:0;background:transparent;color:var(--text-tertiary);font-size:.61rem;font-weight:600;cursor:pointer}.panel-head>button:hover{color:var(--primary)}
.tool-list{display:grid;gap:6px}.tool-row{width:100%;min-height:54px;display:grid;grid-template-columns:34px minmax(0,1fr) auto 14px;align-items:center;gap:9px;padding:7px 8px;border:1px solid transparent;border-radius:12px;background:transparent;text-align:left;cursor:pointer;transition:transform .26s cubic-bezier(.25,.1,.25,1),background .26s cubic-bezier(.25,.1,.25,1),border-color .26s cubic-bezier(.25,.1,.25,1)}
.tool-row:hover{transform:translateY(-1px);border-color:color-mix(in srgb,var(--primary) 11%,var(--glass-border));background:color-mix(in srgb,var(--primary) 4.5%,var(--glass-bg))}.tool-row:active{transform:scale(.99)}
.tool-icon{width:32px;height:32px;padding:4px;border-radius:10px;background:color-mix(in srgb,var(--primary) 5.5%,var(--accent-soft));box-shadow:inset 0 1px 0 rgb(255 255 255 / 24%)}.tool-copy{min-width:0;display:grid;gap:2px}.tool-copy b{overflow:hidden;color:var(--text-primary);font-size:.70rem;font-weight:650;text-overflow:ellipsis;white-space:nowrap}.tool-copy small,.tool-time{overflow:hidden;color:var(--text-tertiary);font-size:.56rem;text-overflow:ellipsis;white-space:nowrap}.star{color:#f6b51d;font-size:.78rem}.arrow{color:var(--text-tertiary);font-size:1rem}
.empty{min-height:92px;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:9px;padding:10px;color:var(--text-tertiary);font-size:.64rem}.empty.compact{min-height:50px}.empty button{padding:0;border:0;background:transparent;color:var(--primary);font-size:.62rem;font-weight:620;cursor:pointer}
.category-panel{padding-bottom:13px}.category-row{display:flex;gap:7px;overflow-x:auto;padding:1px 0 2px;scrollbar-width:none}.category-row::-webkit-scrollbar{display:none}.category-chip{flex:0 0 auto;min-height:34px;display:inline-flex;align-items:center;gap:7px;padding:0 10px;border:1px solid color-mix(in srgb,var(--glass-border) 72%,transparent);border-radius:11px;background:color-mix(in srgb,var(--glass-bg) 62%,transparent);color:var(--text-secondary);cursor:pointer}.category-chip:hover{background:color-mix(in srgb,var(--primary) 4%,var(--glass-bg));color:var(--text-primary)}.category-chip i{width:6px;height:6px;border-radius:50%}.category-chip span{max-width:11rem;overflow:hidden;font-size:.62rem;font-weight:600;text-overflow:ellipsis;white-space:nowrap}.category-chip small{color:var(--text-tertiary);font-size:.54rem}
.added-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.added-item{min-width:0;min-height:58px;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:9px;padding:8px;border:1px solid color-mix(in srgb,var(--glass-border) 66%,transparent);border-radius:12px;background:color-mix(in srgb,var(--glass-bg) 56%,transparent);text-align:left;cursor:pointer}.added-item:hover{background:color-mix(in srgb,var(--primary) 4%,var(--glass-bg))}
@keyframes enter{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
:global([data-theme='dark']) .dashboard-hero,:global([data-theme='dark']) .panel{border-color:rgb(255 255 255 / 7%);box-shadow:0 10px 30px rgb(0 0 0 / 13%),inset 0 1px 0 rgb(255 255 255 / 5%)}
@media(max-width:1040px){.added-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:760px){.workspace-dashboard{gap:9px;padding-bottom:28px}.dashboard-hero{min-height:0;gap:14px;padding:14px;border-radius:16px}.dashboard-hero h1{font-size:1.34rem}.main-grid{grid-template-columns:1fr;gap:9px}.panel{padding:12px;border-radius:15px}.status-row{overflow-x:auto}.added-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:520px){.hero-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}.action{min-width:0;padding-inline:6px;font-size:.59rem}.tool-row{grid-template-columns:32px minmax(0,1fr) 12px}.tool-time,.star{display:none}.added-grid{grid-template-columns:1fr}}
</style>
