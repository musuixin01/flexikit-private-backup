<template>
  <Transition name="canvas-sheet">
    <div v-if="open" class="canvas-tool-sheet" @pointerdown.self="emit('close')">
      <section class="canvas-tool-panel liquid-panel" role="dialog" aria-modal="true" aria-label="桌面画布添加工具">
        <header class="sheet-head">
          <div><small>YOUR DESKTOP · TOOL LIBRARY</small><h2>添加工具到画布</h2><p>使用已有工具箱，不会创建重复记录。支持网页和本地程序。</p></div>
          <button type="button" class="sheet-close" aria-label="关闭" @click="emit('close')">×</button>
        </header>
        <div class="sheet-search"><span aria-hidden="true">⌕</span><input v-model="query" type="search" placeholder="搜索工具名称、类别或标签…" autofocus></div>
        <nav class="sheet-filters" aria-label="工具类型">
          <button v-for="item in filters" :key="item.id" type="button" :class="{ active: filter === item.id }" @click="filter = item.id">{{ item.label }}</button>
          <span>{{ visible.length }} 个结果</span>
        </nav>
        <div class="sheet-list">
          <button v-for="tool in visible" :key="tools.getToolKey(tool)" type="button" class="sheet-tool" :class="{ pinned: selected.includes(tools.getToolKey(tool)) }" @click="emit('toggle', tools.getToolKey(tool))">
            <span class="sheet-icon"><ToolIcon :tool="tool" /></span>
            <span class="sheet-detail"><strong>{{ tool.name }}</strong><small>{{ tool.localPath || tool.local_path ? '本地应用' : tool.cat }}</small></span>
            <span class="sheet-status">{{ selected.includes(tools.getToolKey(tool)) ? '✓ 已固定' : '＋ 添加' }}</span>
          </button>
          <div v-if="!visible.length" class="sheet-empty">没有找到符合条件的工具。可以创建新的网页或本地工具。</div>
        </div>
        <footer class="sheet-foot">
          <div><small>新建后再次打开“添加工具”即可固定到画布</small><div><button type="button" @click="emit('create-web')">＋ 网页工具</button><button type="button" @click="emit('create-local')">＋ 本地程序</button></div></div>
          <button type="button" class="sheet-done" @click="emit('close')">完成</button>
        </footer>
      </section>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolIcon from '@/components/tools/ToolIcon.vue'
import { useToolsStore } from '@/stores/tools'

type Filter = 'all' | 'web' | 'local'
const props = defineProps<{ open: boolean; selected: string[] }>()
const emit = defineEmits<{ close: []; toggle: [key: string]; 'create-web': []; 'create-local': [] }>()
const tools = useToolsStore()
const query = ref('')
const filter = ref<Filter>('all')
const filters: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: '全部' }, { id: 'web', label: '网页工具' }, { id: 'local', label: '本地程序' },
]
const visible = computed(() => {
  const q = query.value.trim().toLowerCase()
  return tools.allTools.filter(tool => {
    const local = Boolean(tool.localPath || tool.local_path)
    if (filter.value === 'web' && local) return false
    if (filter.value === 'local' && !local) return false
    return !q || [tool.name, tool.cat, tool.desc, ...(tool.tags || [])].some(value => value?.toLowerCase().includes(q))
  }).slice(0, 150)
})
</script>

<style scoped>
.canvas-tool-sheet{position:fixed;inset:0;z-index:20010;display:flex;justify-content:center;align-items:center;padding:25px;background:rgb(8 12 20 / 24%);backdrop-filter:blur(5px)}
.canvas-tool-panel{display:flex;flex-direction:column;width:min(620px,calc(100vw - 48px));height:min(620px,calc(100vh - 60px));min-height:280px;border:1px solid var(--glass-border);border-radius:24px;background:color-mix(in srgb,var(--canvas-material-base,rgb(247 249 252)) 96%,transparent);backdrop-filter:blur(34px) saturate(130%);-webkit-backdrop-filter:blur(34px) saturate(130%);box-shadow:0 24px 85px rgb(0 0 0 / 17%),inset 0 1px 0 rgb(255 255 255 / 18%);color:var(--text-primary);padding:22px;gap:14px}
.sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
.sheet-head small{font-size:10px;letter-spacing:.13em;color:var(--text-tertiary);font-weight:700}
.sheet-head h2{margin:5px 0;font-size:22px;letter-spacing:-.04em}
.sheet-head p{font-size:12px;color:var(--text-secondary);margin:0}
.sheet-close{width:32px;height:32px;border:1px solid var(--glass-border);border-radius:50%;background:var(--btn-bg);color:var(--text-primary);font-size:21px;cursor:pointer}
.sheet-search{display:flex;align-items:center;gap:9px;min-height:43px;padding:0 13px;border:1px solid var(--glass-border);border-radius:13px;background:var(--input-bg)}
.sheet-search span{font-size:23px;color:var(--text-tertiary)}.sheet-search input{flex:1;min-width:0;border:0;background:transparent;outline:0;color:var(--text-primary);font:inherit;font-size:13px}
.sheet-filters{display:flex;gap:7px;align-items:center;flex-wrap:wrap}
.sheet-filters button{border:1px solid var(--glass-border);background:transparent;color:var(--text-secondary);border-radius:9px;padding:7px 12px;font:inherit;font-size:11px;cursor:pointer}
.sheet-filters button.active{color:var(--text-primary);background:var(--btn-bg-hover);border-color:var(--text-tertiary)}
.sheet-filters>span{margin-left:auto;color:var(--text-tertiary);font-size:11px}
.sheet-list{flex:1;overflow-y:auto;display:grid;align-content:start;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.sheet-tool{min-width:0;display:flex;align-items:center;text-align:left;gap:10px;padding:9px 10px;border:1px solid var(--glass-border);border-radius:13px;background:color-mix(in srgb,var(--btn-bg) 60%,transparent);cursor:pointer;color:var(--text-primary);transition:background .3s cubic-bezier(.25,.1,.25,1),transform .3s cubic-bezier(.25,.1,.25,1)}
.sheet-tool:hover{transform:translateY(-1px);background:var(--btn-bg-hover)}.sheet-tool:active{transform:scale(.98)}
.sheet-tool.pinned{border-color:color-mix(in srgb,var(--primary) 28%,var(--glass-border))}
.sheet-icon{width:34px;height:34px;border-radius:10px;display:grid;place-items:center;flex:0 0 auto;background:var(--icon-surface)}
.sheet-icon :deep(img),.sheet-icon :deep(svg){max-width:25px;max-height:25px}
.sheet-detail{display:grid;min-width:0;gap:3px;flex:1}.sheet-detail strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.sheet-detail small{font-size:10px;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sheet-status{font-size:10px;flex:0 0 auto;color:var(--text-secondary)}.sheet-tool.pinned .sheet-status{color:var(--primary)}
.sheet-empty{grid-column:1/-1;text-align:center;padding:35px 10px;color:var(--text-tertiary);font-size:12px}
.sheet-foot{display:flex;justify-content:space-between;align-items:end;gap:12px;border-top:1px solid var(--glass-border);padding-top:14px}.sheet-foot>div{display:grid;gap:7px}.sheet-foot small{font-size:10px;color:var(--text-tertiary)}.sheet-foot>div>div{display:flex;gap:7px}
.sheet-foot button{height:33px;border:1px solid var(--glass-border);padding:0 12px;border-radius:10px;background:var(--btn-bg);color:var(--text-primary);font:inherit;font-size:11px;cursor:pointer}
.sheet-foot .sheet-done{padding:0 22px;background:var(--text-primary);color:var(--bg-secondary)}
.canvas-sheet-enter-active,.canvas-sheet-leave-active{transition:opacity .3s cubic-bezier(.25,.1,.25,1)}.canvas-sheet-enter-from,.canvas-sheet-leave-to{opacity:0}
@media(max-width:520px){.sheet-list{grid-template-columns:1fr}.sheet-foot{align-items:start;flex-direction:column}.canvas-tool-panel{padding:15px}}
</style>