<template>
  <section class="tool-dock" :class="{ 'is-vertical': isVertical }">
    <header class="dock-head">
      <div><span class="dock-eyebrow">QUICK ACCESS</span><strong>{{ widget.title }}</strong></div>
      <button type="button" aria-label="管理工具" title="管理工具" @click.stop="manage">＋</button>
    </header>
    <div v-if="items.length" class="dock-items">
      <button v-for="tool in items" :key="tools.getToolKey(tool)" type="button" class="dock-tile" :title="tool.name" @click.stop="launch(tool)">
        <span class="dock-icon"><ToolIcon :tool="tool" /></span>
        <strong>{{ tool.name }}</strong>
        <small>{{ tool.localPath || tool.local_path ? '本地应用' : tool.cat }}</small>
      </button>
    </div>
    <button v-else type="button" class="dock-empty" @click.stop="manage">
      <span aria-hidden="true">＋</span><strong>添加常用工具</strong><small>本地应用与网页，一键直达</small>
    </button>
    <footer class="dock-footer"><small>{{ items.length }} 个快捷入口</small><button type="button" @click.stop="manage">编辑工具 ↗</button></footer>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ToolIcon from '@/components/tools/ToolIcon.vue'
import { useToolsStore } from '@/stores/tools'
import { useUiStore } from '@/stores/ui'
import { openDesktopTool } from '@/desktop/openTool'
import type { Tool } from '@/types/tool'
import type { DesktopWidget } from '@/types/desktopWidget'

const props = defineProps<{ widget: DesktopWidget }>()
const tools = useToolsStore()
const isVertical = computed(() => props.widget.config.toolDockOrientation === 'vertical'
  || (props.widget.config.toolDockOrientation !== 'horizontal' && props.widget.frame.height > props.widget.frame.width * 1.15))
const ui = useUiStore()
const pinned = computed<string[] | null>(() => {
  const value = props.widget.config.toolKeys
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : null
})
const items = computed(() => {
  const byKey = new Map(tools.allTools.map(tool => [tools.getToolKey(tool), tool]))
  const keys = pinned.value ?? tools.allTools.slice(0, 8).map(tools.getToolKey)
  return keys.map(key => byKey.get(key)).filter((tool): tool is Tool => Boolean(tool))
})
function manage(): void {
  window.dispatchEvent(new CustomEvent('flexikit:canvas-open-tool-picker', { detail: { widgetId: props.widget.id } }))
}
async function launch(tool: Tool): Promise<void> {
  try {
    if (!await openDesktopTool(tool)) ui.showToast('该工具的启动入口无效，请在工具箱中检查')
  } catch {
    ui.showToast('工具启动失败，请确认程序或网址仍可使用')
  }
}
</script>

<style scoped>
.tool-dock{height:100%;display:flex;flex-direction:column;padding:17px 16px 13px;gap:12px;color:var(--text-primary)}
.dock-head{display:flex;justify-content:space-between;align-items:center;gap:10px}
.dock-head>div{display:grid;gap:2px;min-width:0}
.dock-eyebrow{color:var(--text-tertiary);font-size:9px;letter-spacing:.15em;font-weight:700}
.dock-head strong{font-size:16px;letter-spacing:-.025em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dock-head button{width:30px;height:30px;border:1px solid var(--glass-border);border-radius:10px;background:var(--btn-bg);font-size:20px;color:var(--text-primary);cursor:pointer}
.dock-items{flex:1;min-height:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:7px;overflow-y:auto;align-content:start}
.is-vertical .dock-items{grid-template-columns:1fr;align-content:start}
.is-vertical .dock-tile{display:grid;grid-template-columns:36px minmax(0,1fr);grid-template-rows:18px 15px;column-gap:10px;align-items:center;justify-items:start;padding:8px 10px}
.is-vertical .dock-tile .dock-icon{grid-column:1;grid-row:1/3}
.is-vertical .dock-tile strong{grid-column:2;grid-row:1;text-align:left}
.is-vertical .dock-tile small{grid-column:2;grid-row:2;text-align:left}

.dock-tile{display:flex;flex-direction:column;min-width:0;align-items:center;gap:5px;padding:9px 5px 8px;border:1px solid transparent;border-radius:14px;background:color-mix(in srgb,var(--glass-bg) 36%,transparent);color:var(--text-primary);cursor:pointer;transition:transform .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1)}
.dock-tile:hover,.dock-tile:focus-visible{background:var(--btn-bg-hover);border-color:var(--glass-border);transform:translateY(-2px)}
.dock-tile:active{transform:scale(.98)}
.dock-icon{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:var(--icon-surface);box-shadow:inset 0 1px 0 rgb(255 255 255 / 15%)}
.dock-icon :deep(img),.dock-icon :deep(svg){max-width:27px;max-height:27px;object-fit:contain}
.dock-tile strong,.dock-tile small{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dock-tile strong{font-size:11px;font-weight:630}.dock-tile small{font-size:9px;color:var(--text-tertiary)}
.dock-empty{flex:1;display:grid;place-content:center;justify-items:center;gap:7px;border:1px dashed var(--glass-border);border-radius:14px;background:transparent;color:var(--text-secondary);cursor:pointer}
.dock-empty span{font-size:24px}.dock-empty strong{font-size:12px}.dock-empty small{color:var(--text-tertiary);font-size:10px}
.dock-footer{display:flex;justify-content:space-between;align-items:center;gap:8px}.dock-footer small{font-size:10px;color:var(--text-tertiary)}
.dock-footer button{border:0;background:none;color:var(--text-secondary);font-size:10px;font-weight:650;cursor:pointer}
.dock-footer button:hover{color:var(--text-primary)}
</style>