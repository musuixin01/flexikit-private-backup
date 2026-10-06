<template>
  <aside v-if="visible" class="connectivity-notice" role="status" aria-live="polite">
    <span class="notice-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4.5 9.5a11.5 11.5 0 0 1 15 0M7.7 12.8a6.9 6.9 0 0 1 8.6 0M10.6 16a2.7 2.7 0 0 1 2.8 0"/>
        <path v-if="mode === 'offline'" d="m4 4 16 16"/>
      </svg>
    </span>
    <span class="notice-copy">
      <strong>{{ title }}</strong>
      <small>{{ description }}</small>
    </span>
    <button type="button" :disabled="checking" @click="retry">
      {{ checking ? '检测中…' : '重试连接' }}
    </button>
  </aside>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { connectivityMode } from '@/network/connectivity'
import { probeApiConnectivity } from '@/api/client'

const props = withDefaults(defineProps<{
  message?: string
}>(), {
  message: '',
})

const emit = defineEmits<{
  reconnected: []
}>()

const checking = ref(false)
const mode = connectivityMode
const visible = computed(() => mode.value !== 'online')
const title = computed(() =>
  mode.value === 'offline' ? '离线模式' : '网络服务暂不可用',
)
const description = computed(() => props.message || (
  mode.value === 'offline'
    ? '本地功能仍可正常使用，联网功能会在恢复连接后继续。'
    : 'FlexiKit 本地界面不受影响，可稍后重试联网功能。'
))

async function retry(): Promise<void> {
  if (checking.value) return
  checking.value = true
  try {
    if (await probeApiConnectivity()) emit('reconnected')
  } finally {
    checking.value = false
  }
}
</script>

<style scoped>
.connectivity-notice{
  display:flex;
  align-items:center;
  gap:10px;
  min-height:46px;
  padding:8px 10px;
  border:1px solid color-mix(in srgb,var(--primary) 13%,var(--glass-border));
  border-radius:14px;
  background:linear-gradient(145deg,rgb(255 255 255 / 18%),transparent 58%),color-mix(in srgb,var(--glass-bg) 78%,var(--bg-primary));
  box-shadow:0 8px 30px rgb(0 0 0 / 4%),inset 0 1px 0 rgb(255 255 255 / 20%);
  backdrop-filter:blur(22px) saturate(145%);
  -webkit-backdrop-filter:blur(22px) saturate(145%);
}
.notice-icon{
  display:grid;
  place-items:center;
  width:30px;
  height:30px;
  flex:0 0 auto;
  border-radius:10px;
  background:color-mix(in srgb,var(--primary) 8%,transparent);
  color:var(--primary);
}
.notice-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round}
.notice-copy{display:grid;min-width:0;gap:2px;flex:1}
.notice-copy strong{color:var(--text-primary);font-size:.72rem;font-weight:660}
.notice-copy small{color:var(--text-tertiary);font-size:.63rem;line-height:1.45}
.connectivity-notice button{
  min-height:30px;
  padding:0 10px;
  border:1px solid color-mix(in srgb,var(--primary) 16%,var(--glass-border));
  border-radius:9px;
  background:color-mix(in srgb,var(--primary) 6%,var(--btn-bg));
  color:var(--primary);
  font:inherit;
  font-size:.64rem;
  font-weight:620;
  cursor:pointer;
  transition:transform .3s cubic-bezier(.25,.1,.25,1),background .3s cubic-bezier(.25,.1,.25,1),border-color .3s cubic-bezier(.25,.1,.25,1);
}
.connectivity-notice button:hover:not(:disabled){transform:translateY(-1px);background:color-mix(in srgb,var(--primary) 10%,var(--btn-bg))}
.connectivity-notice button:active:not(:disabled){transform:scale(.98)}
.connectivity-notice button:disabled{cursor:default;opacity:.48}
@media(max-width:560px){.connectivity-notice{align-items:flex-start;flex-wrap:wrap}.connectivity-notice button{margin-left:40px}}
</style>
