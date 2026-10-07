<template>
  <span class="tool-icon" aria-hidden="true">
    <span v-if="customSvg" class="tool-icon-svg" v-html="customSvg"></span>
    <img
      v-else-if="currentSource"
      class="tool-icon-image"
      :src="currentSource"
      :alt="`${tool.name} 图标`"
      referrerpolicy="no-referrer"
      loading="lazy"
      @error="useNextSource"
    />
    <svg v-else-if="isLocal" class="tool-icon-local" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
    <span v-else class="tool-icon-initial" :style="initialStyle">{{ initial }}</span>
  </span>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Tool } from '@/types/tool'
import { resolveApiUrl } from '@/api/runtime'

const props = defineProps<{
  tool: Tool
}>()

const sourceIndex = ref(0)
const isLocal = computed(() => Boolean(props.tool.localPath || props.tool.local_path))

const customSvg = computed(() => {
  const customIcon = props.tool.customIcon?.trim()
  if (customIcon?.startsWith('<svg')) return customIcon
  const storedIcon = props.tool.icon?.trim()
  return storedIcon?.startsWith('<svg') ? storedIcon : ''
})

const faviconSources = computed<string[]>(() => {
  if (customSvg.value) return []

  const sources: string[] = []
  for (const icon of [props.tool.customIcon?.trim(), props.tool.icon?.trim()]) {
    if (icon && (icon.startsWith('data:image/') || /^https?:\/\//i.test(icon))) {
      sources.push(icon)
    }
  }

  if (isLocal.value) return [...new Set(sources)]

  try {
    const websiteUrl = new URL(props.tool.url)
    if (!['http:', 'https:'].includes(websiteUrl.protocol)) return sources

    const hostname = websiteUrl.hostname.replace(/^www\./i, '')
    const encodedUrl = encodeURIComponent(websiteUrl.href)

    // 官网解析优先，公共 favicon 服务仅作为网络受限时的兜底。
    sources.push(
      resolveApiUrl(`/api/tools/favicon?url=${encodedUrl}`),
      `${websiteUrl.origin}/favicon.ico`,
      `${websiteUrl.origin}/favicon.png`,
      `${websiteUrl.origin}/apple-touch-icon.png`,
    )

    sources.push(
      `https://favicon.im/${hostname}?size=128`,
      `https://api.iowen.cn/favicon/${hostname}.png`,
      `https://icons.duckduckgo.com/ip3/${hostname}.ico`,
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostname)}&sz=128`,
    )
  } catch {
    // 无效网址直接进入首字母兜底。
  }

  return [...new Set(sources)]
})

const currentSource = computed(() => faviconSources.value[sourceIndex.value] || '')
const initial = computed(() => (props.tool.name.trim().charAt(0) || '?').toUpperCase())
const initialStyle = computed(() => {
  let hash = 0
  for (const character of props.tool.name) {
    hash = character.charCodeAt(0) + ((hash << 5) - hash)
  }
  return { '--icon-hue': String(Math.abs(hash) % 360) }
})

watch(
  () => [props.tool.url, props.tool.icon, props.tool.customIcon, props.tool.localPath, props.tool.local_path],
  () => { sourceIndex.value = 0 },
)

function useNextSource() {
  sourceIndex.value += 1
}
</script>

<style scoped>
.tool-icon,
.tool-icon-svg {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-icon-image,
.tool-icon-local,
.tool-icon-svg :deep(svg) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.tool-icon-local {
  color: var(--accent);
}

.tool-icon-initial {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: hsl(var(--icon-hue) 62% 42%);
  background: hsl(var(--icon-hue) 70% 93%);
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
}

:global([data-theme='dark']) .tool-icon-initial {
  color: hsl(var(--icon-hue) 75% 76%);
  background: hsl(var(--icon-hue) 38% 22%);
}
</style>
