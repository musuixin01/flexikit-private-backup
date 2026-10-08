import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { DEF_ICON, FAC } from '@/data/data'
import type { Tool, DeletedBatch, DeletedItem, ExportData } from '@/types/tool'
import { useUiStore } from '@/stores/ui'
import { useUserStore } from '@/stores/user'
import { toolsApi } from '@/api/tools'
import { favoritesApi } from '@/api/favorites'
import { categoriesApi } from '@/api/categories'
import { backendToFrontend, type BackendTool } from '@/api/toolMapper'
import { resolveApiUrl } from '@/api/runtime'
import { migrateToolExportData, TOOL_EXPORT_VERSION } from '@/migrations/toolExportMigrations'
import { recordRecommendationBehaviorEvent } from '@/recommendations/behaviorEvents'

export const useToolsStore = defineStore('tools', () => {
  const builtinTools = ref<Tool[]>([])
  const customTools = ref<Tool[]>([])
  const favoriteTools = ref<Set<string>>(new Set())
  const lastDeletedBatch = ref<DeletedBatch | null>(null)
  const isLoaded = ref(false)
  const categoryNames = ref<string[]>([])

  const allTools = computed<Tool[]>(() => {
    // 内置工具 + 自定义工具（无论是否登录都显示）
    return [...builtinTools.value, ...customTools.value]
  })

  const categoryList = computed<string[]>(() => {
    const ui = useUiStore()
    const filtered = allTools.value.filter(t => {
      if (ui.toolTypeFilter === 'web') {
        if (t.local_path && t.local_path.trim() !== '') return false
      } else if (ui.toolTypeFilter === 'local') {
        if (!t.local_path || t.local_path.trim() === '') return false
      }
      return true
    })
    const cats = new Set(filtered.map(t => t.cat))
    return Array.from(cats).sort((a, b) => a.localeCompare(b))
  })

  const categoryCounts = computed<Record<string, number>>(() => {
    const ui = useUiStore()
    const filtered = allTools.value.filter(t => {
      if (ui.toolTypeFilter === 'web') {
        if (t.local_path && t.local_path.trim() !== '') return false
      } else if (ui.toolTypeFilter === 'local') {
        if (!t.local_path || t.local_path.trim() === '') return false
      }
      return true
    })
    const counts: Record<string, number> = {}
    for (const tool of filtered) {
      counts[tool.cat] = (counts[tool.cat] || 0) + 1
    }
    counts['全部'] = filtered.length
    return counts
  })

  const favoriteIds = computed<number[]>(() => {
    const ids: number[] = []
    for (const tool of allTools.value) {
      if (tool.id == null) continue
      if (favoriteTools.value.has(getToolKey(tool))) ids.push(tool.id)
    }
    return ids
  })

  function normalizeTool(tool: Tool): Tool {
    const cat = tool.cat || tool.category || '未分类'
    const desc = tool.desc || tool.description || ''
    const localPath = tool.localPath ?? tool.local_path ?? null
    const isCustom = tool.isCustom ?? tool.is_custom ?? false
    return {
      ...tool,
      cat,
      category: cat,
      desc,
      description: desc,
      localPath,
      local_path: localPath,
      isCustom,
      is_custom: isCustom,
      cardColor: tool.cardColor ?? tool.card_color ?? null,
      card_color: tool.cardColor ?? tool.card_color ?? null,
      tags: tool.tags || [],
      icon: tool.icon || (isCustom && !localPath ? '' : DEF_ICON),
      customIcon: tool.customIcon ?? null,
    }
  }

  function getToolKey(tool: Tool): string {
    return tool.isCustom ? `custom:${tool.name}` : `builtin:${tool.name}`
  }

  function escapeHtml(str: string): string {
    if (!str) return ''
    return str.replace(/[&<>]/g, m => (m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;'))
  }

  function getDomainFromUrl(url: string): string {
    try {
      return new URL(url).hostname
    } catch {
      return ''
    }
  }

  function getFaviconUrl(url: string): string | null {
    if (!url || url === '#') return null
    try {
      const u = new URL(url)
      const domain = u.hostname
      // 优先使用国内可用的源，然后 fallback 到国际服务
      return `https://api.iowen.cn/favicon/${domain}.png`
    } catch {
      return null
    }
  }

  // 获取多个 favicon 源，用于小尺寸确认弹窗的 fallback。
  function getFaviconSources(url: string): string[] {
    if (!url || url === '#') return []
    try {
      const u = new URL(url)
      let domain = u.hostname
      // 去掉 www 前缀，很多 favicon 服务只接受主域名
      if (domain.startsWith('www.')) {
        domain = domain.slice(4)
      }
      const encodedUrl = encodeURIComponent(url)
      return [
        // 优先使用后端解析接口（最稳定，直接从网站获取）
        resolveApiUrl(`/api/tools/favicon?url=${encodedUrl}`),
        // 国内 favicon 服务
        `https://api.iowen.cn/favicon/${domain}.png`,
        // Yandex favicon（俄罗斯的，国内可能能访问）
        `https://favicon.yandex.net/favicon/${domain}`,
        // 网站自己的 favicon
        `${u.origin}/favicon.ico`,
        `${u.origin}/apple-touch-icon.png`,
        // 国际源 fallback
        `https://icons.duckduckgo.com/ip3/${domain}.ico`,
        `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`,
      ]
    } catch {
      return []
    }
  }

  function getSmallIconHtml(tool: Tool): string {
    if (tool.customIcon && tool.customIcon.trim() !== '') {
      if (tool.customIcon.startsWith('data:image') || tool.customIcon.startsWith('http')) {
        return `<img src="${tool.customIcon}" style="width:20px;height:20px;object-fit:contain;display:inline-block;" alt="">`
      }
      if (tool.customIcon.startsWith('<svg')) {
        return `<span style="display:inline-block;width:20px;height:20px;">${tool.customIcon}</span>`
      }
    }

    const faviconSources = getFaviconSources(tool.url)
    if (faviconSources.length > 0) {
      // 构建多层 onerror fallback
      let onerrorStr = ''
      for (let i = 1; i < faviconSources.length; i++) {
        onerrorStr += `this.onerror=null;this.src='${faviconSources[i]}';`
      }
      onerrorStr += `this.onerror=null;this.style.display='none';`
      return `<img src="${faviconSources[0]}" referrerpolicy="no-referrer" onerror="${onerrorStr}" style="width:20px;height:20px;object-fit:contain;display:inline-block;" alt="">`
    }

    return `<span style="display:inline-block;width:20px;height:20px;">${tool.icon || DEF_ICON}</span>`
  }

  function getVisibleTools(): Tool[] {
    const ui = useUiStore()
    const q = ui.searchQuery.trim().toLowerCase()
    let filtered = allTools.value.filter(t => {
      if (ui.activeCategory !== '全部' && t.cat !== ui.activeCategory) return false
      // 工具类型筛选
      if (ui.toolTypeFilter === 'web') {
        // 只显示网页工具（没有 local_path 的）
        if (t.local_path && t.local_path.trim() !== '') return false
      } else if (ui.toolTypeFilter === 'local') {
        // 只显示本地工具（有 local_path 的）
        if (!t.local_path || t.local_path.trim() === '') return false
      }
      if (!q) return true
      return (
        t.name.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q)) ||
        t.cat.toLowerCase().includes(q)
      )
    })

    if (ui.showOnlyFav) {
      filtered = filtered.filter(t => favoriteTools.value.has(getToolKey(t)))
    }

    return filtered
  }

  async function loadFromBackend() {
    const user = useUserStore()
    const requestWasLoggedIn = user.isLoggedIn
    const requestUserId = user.profile?.id ?? null
    const sessionUnchanged = () => (
      requestWasLoggedIn === user.isLoggedIn
      && (!requestWasLoggedIn || user.profile?.id === requestUserId)
    )

    try {
      const res = await toolsApi.getTools({ limit: 500 })
      if (!sessionUnchanged()) return

      const items: BackendTool[] = res.data.items || []
      const builtin: Tool[] = []
      const custom: Tool[] = []

      for (const item of items) {
        const ft = normalizeTool(backendToFrontend(item))
        // 只有 is_custom 为 true 且 user_id 不为空的才是真正的自定义工具
        // 防止脏数据（is_custom=true 但 user_id=null）被当成自定义工具显示给所有人
        if (item.is_custom && item.user_id !== null && item.user_id !== undefined) {
          custom.push(ft)
        } else {
          builtin.push(ft)
        }
      }

      // 总是更新工具列表（即使为空）
      if (builtin.length > 0) {
        builtinTools.value = builtin
      }
      customTools.value = custom

      if (user.isLoggedIn) {
        try {
          const favRes = await favoritesApi.getFavorites()
          if (!sessionUnchanged()) return

          const favIds: number[] = favRes.data || []
          const favSet = new Set<string>()
          for (const favId of favIds) {
            const bt = items.find(t => t.id === favId)
            if (bt) {
              favSet.add(bt.is_custom ? `custom:${bt.name}` : `builtin:${bt.name}`)
            }
          }
          favoriteTools.value = favSet
          saveFavorites()
        } catch {
          console.warn('Failed to load favorites from backend, keeping local')
        }
      } else {
        loadFavorites()
      }

      if (builtinTools.value.length === 0) {
        await loadDefaultFAC()
      }

      try {
        const catRes = await categoriesApi.getCategories()
        categoryNames.value = (catRes.data || []).map(c => c.name)
      } catch {
        // ignore category failures
      }

      // 会话变化时丢弃旧请求结果，Access Token 轮换本身不视为会话变化。
      if (!sessionUnchanged()) return

      isLoaded.value = true
      if (user.isLoggedIn) {
        persistData()
      }
      await loadLocalIcons()
    } catch (e) {
      console.warn('Backend unavailable, loading from localStorage...', e)
      // 退出或切换账号后，不让旧请求的本地回退数据覆盖新会话。
      if (!sessionUnchanged()) return
      loadCustomTools()
      loadFavorites()
      if (builtinTools.value.length === 0) {
        await loadDefaultFAC()
      }
      isLoaded.value = true
    }
  }

  async function loadDefaultFAC() {
    try {
      const mod = { FAC }
      builtinTools.value = (mod.FAC as Tool[]).map(tool => normalizeTool({
        ...tool,
        isCustom: false,
        is_custom: false,
      }))
    } catch {
      builtinTools.value = []
    }
  }

  async function loadLocalIcons() {

    for (const tool of allTools.value) {
      if (tool.localPath && !tool.customIcon) {
        try {
          const res = await toolsApi.getLocalIcon(tool.localPath)
          if (res.data?.icon && res.data.icon.startsWith('data:image')) {
            tool.customIcon = res.data.icon
          }
        } catch {
          // keep existing icon
        }
      }
    }
    builtinTools.value = [...builtinTools.value]
    customTools.value = [...customTools.value]
  }

  function persistData() {
    try {
      localStorage.setItem('gtb-custom', JSON.stringify(customTools.value))
      const orderKeys = allTools.value.map(t => (t.isCustom ? `custom:${t.name}` : `builtin:${t.name}`))
      localStorage.setItem('gtb-order', JSON.stringify(orderKeys))
    } catch (e) {
      console.warn('Persist error:', e)
    }
  }

  function loadCustomTools() {
    const stored = localStorage.getItem('gtb-custom')
    if (!stored) return
    try {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        customTools.value = parsed.map((c: Tool) =>
          normalizeTool({
            ...c,
            isCustom: true,
            is_custom: true,
            icon: c.icon || (c.localPath || c.local_path ? DEF_ICON : ''),
          })
        )
      }
    } catch {
      customTools.value = []
    }
  }

  function loadFavorites() {
    const stored = localStorage.getItem('gtb-favorites')
    if (!stored) return
    try {
      favoriteTools.value = new Set(JSON.parse(stored))
    } catch {
      favoriteTools.value = new Set()
    }
  }

  function saveFavorites() {
    localStorage.setItem('gtb-favorites', JSON.stringify([...favoriteTools.value]))
  }

  async function initData() {
    loadCustomTools()
    loadFavorites()
    if (builtinTools.value.length === 0) {
      await loadDefaultFAC()
    }
    loadFromBackend().catch(e => console.warn('Backend load failed, using local data:', e.message))
  }

  function saveAndRefresh() {
    persistData()
  }

  async function addCustomTool(tool: Tool) {
    const localPath = tool.localPath ?? tool.local_path ?? null
    const newTool = normalizeTool({
      ...tool,
      isCustom: true,
      is_custom: true,
      desc: tool.desc || tool.description || '',
      description: tool.desc || tool.description || '',
      cat: tool.cat || tool.category || '未分类',
      category: tool.cat || tool.category || '未分类',
      localPath,
      local_path: localPath,
      icon: tool.customIcon || tool.icon || (localPath ? DEF_ICON : ''),
    })
    customTools.value.push(newTool)
    saveAndRefresh()

    try {
      await toolsApi.createTool({
        name: tool.name,
        url: tool.url,
        local_path: tool.localPath || tool.local_path || null,
        description: tool.desc || tool.description || '',
        category: tool.cat || tool.category || '未分类',
        tags: tool.tags,
        icon: tool.customIcon || tool.icon,
        card_color: tool.cardColor || tool.card_color || null,
      })
    } catch (e) {
      console.warn('Failed to sync tool to backend:', e)
    }
  }

  async function updateCustomTool(index: number, tool: Tool) {
    if (index < 0 || index >= customTools.value.length) return

    const oldKey = `custom:${customTools.value[index].name}`
    const newKey = `custom:${tool.name}`
    if (favoriteTools.value.has(oldKey) && oldKey !== newKey) {
      favoriteTools.value.delete(oldKey)
      favoriteTools.value.add(newKey)
      saveFavorites()
    }

    Object.assign(
      customTools.value[index],
      normalizeTool({
        ...tool,
        isCustom: true,
        is_custom: true,
      })
    )

    if (tool.customIcon !== undefined) {
      const localPath = tool.localPath ?? tool.local_path ?? null
      customTools.value[index].icon = tool.customIcon || tool.icon || (localPath ? DEF_ICON : '')
    }

    saveAndRefresh()
  }

  function replaceBuiltinWithCustom(originalTool: Tool, newData: Tool, customIcon: string | null) {
    const idx = builtinTools.value.findIndex(t => t.name === originalTool.name && t.url === originalTool.url)
    if (idx !== -1) builtinTools.value.splice(idx, 1)

    customTools.value.push(
      normalizeTool({
        name: newData.name,
        url: newData.url,
        desc: newData.desc,
        description: newData.desc,
        tags: newData.tags,
        cat: newData.cat,
        category: newData.cat,
        isCustom: true,
        is_custom: true,
        cardColor: newData.cardColor || null,
        card_color: newData.cardColor || null,
        icon: customIcon || (newData.localPath || newData.local_path ? DEF_ICON : ''),
        customIcon: customIcon || null,
      })
    )

    saveAndRefresh()
  }

  function deleteBuiltinTool(index: number) {
    if (index < 0 || index >= builtinTools.value.length) return

    const tool = builtinTools.value[index]
    const key = `builtin:${tool.name}`
    lastDeletedBatch.value = { items: [{ tool, type: 'builtin', index }], isBatch: false }
    favoriteTools.value.delete(key)
    saveFavorites()
    builtinTools.value.splice(index, 1)
    saveAndRefresh()
  }

  async function deleteCustomTool(index: number) {
    if (index < 0 || index >= customTools.value.length) return

    const tool = customTools.value[index]
    const key = `custom:${tool.name}`
    lastDeletedBatch.value = { items: [{ tool, type: 'custom', index }], isBatch: false }
    favoriteTools.value.delete(key)
    saveFavorites()
    customTools.value.splice(index, 1)
    saveAndRefresh()

    if (tool.id) {
      try {
        await toolsApi.deleteTool(tool.id)
      } catch {
        // ignore backend delete failure
      }
    }
  }

  function batchDelete(keys: Set<string>) {
    const toDelete: DeletedItem[] = []

    for (const key of keys) {
      if (key.startsWith('builtin:')) {
        const name = key.slice(8)
        const idx = builtinTools.value.findIndex(t => t.name === name)
        if (idx !== -1) toDelete.push({ tool: builtinTools.value[idx], type: 'builtin', index: idx })
      } else if (key.startsWith('custom:')) {
        const name = key.slice(7)
        const idx = customTools.value.findIndex(t => t.name === name)
        if (idx !== -1) toDelete.push({ tool: customTools.value[idx], type: 'custom', index: idx })
      }
    }

    const sorted = [...toDelete].sort((a, b) => b.index - a.index)
    lastDeletedBatch.value = { items: sorted, isBatch: true }

    for (const item of sorted) {
      const key = `${item.type}:${item.tool.name}`
      favoriteTools.value.delete(key)
      if (item.type === 'builtin') builtinTools.value.splice(item.index, 1)
      else customTools.value.splice(item.index, 1)
    }

    saveFavorites()
    saveAndRefresh()
  }

  function undoDelete() {
    const batch = lastDeletedBatch.value
    if (!batch) return

    const items = batch.isBatch ? [...batch.items].sort((a, b) => a.index - b.index) : batch.items
    for (const item of items) {
      if (item.type === 'builtin') builtinTools.value.splice(item.index, 0, item.tool)
      else customTools.value.splice(item.index, 0, item.tool)
    }

    lastDeletedBatch.value = null
    saveAndRefresh()
  }

  function renameCategory(oldName: string, newName: string) {
    if (!newName || oldName === newName) return
    for (const tool of allTools.value) {
      if (tool.cat === oldName) {
        tool.cat = newName
        tool.category = newName
      }
    }
    const ui = useUiStore()
    if (ui.activeCategory === oldName) ui.activeCategory = newName
    saveAndRefresh()
  }

  function moveToolToCategory(tool: Tool, targetCat: string) {
    if (tool.cat === targetCat) return
    tool.cat = targetCat
    tool.category = targetCat
    saveAndRefresh()
  }

  function reorderTools(newOrder: Tool[]) {
    const remaining = allTools.value.filter(t => !newOrder.includes(t))
    const final = [...newOrder, ...remaining]
    builtinTools.value = final.filter(t => !t.isCustom)
    customTools.value = final.filter(t => t.isCustom)
    persistData()
  }

  async function toggleFavorite(toolKey: string): Promise<boolean> {
    const user = useUserStore()
    const ui = useUiStore()

    if (!user.isLoggedIn) {
      ui.showToast('请先登录以收藏工具')
      return false
    }

    const targetTool = allTools.value.find(t => getToolKey(t) === toolKey)
    if (!targetTool) {
      ui.showToast('工具不存在')
      return false
    }

    if (favoriteTools.value.has(toolKey)) {
      favoriteTools.value.delete(toolKey)
      saveFavorites()
      if (targetTool.id) {
        try {
          await favoritesApi.removeFavorite(targetTool.id)
        } catch {
          console.warn('Failed to remove favorite on backend, local state kept in sync')
        }
        recordRecommendationBehaviorEvent('favorite_remove', targetTool.id)
      }
      ui.showToast('已取消收藏')
      return false
    }

    favoriteTools.value.add(toolKey)
    saveFavorites()
    if (targetTool.id) {
      try {
        await favoritesApi.addFavorite(targetTool.id)
      } catch {
        console.warn('Failed to add favorite on backend, local state kept in sync')
      }
      recordRecommendationBehaviorEvent('favorite_add', targetTool.id)
    }
    ui.showToast('已添加到收藏')
    return true
  }

  function exportData(): string {
    const data: ExportData = {
      version: TOOL_EXPORT_VERSION,
      exportDate: new Date().toISOString(),
      customTools: customTools.value.map(t => ({ ...t, isCustom: true, is_custom: true })),
      catOrder: [],
      toolOrder: allTools.value.map(t => (t.isCustom ? `custom:${t.name}` : `builtin:${t.name}`)),
      theme: document.documentElement.getAttribute('data-theme') || 'auto',
      favorites: [...favoriteTools.value],
    }
    return JSON.stringify(data, null, 2)
  }

  function importData(jsonStr: string): number {
    let raw: unknown
    try {
      raw = JSON.parse(jsonStr)
    } catch {
      throw new Error('工具导入文件不是有效 JSON')
    }
    const imported = migrateToolExportData(raw)

    const existingMap = new Map<string, Tool>()
    for (const tool of customTools.value) {
      existingMap.set(`${tool.name}|${tool.url}`, tool)
    }

    let addedCount = 0
    for (const newTool of imported.customTools) {
      const key = `${newTool.name}|${newTool.url}`
      if (!existingMap.has(key)) {
        customTools.value.push(
          normalizeTool({
            ...newTool,
            isCustom: true,
            is_custom: true,
            icon: newTool.icon || DEF_ICON,
            customIcon: newTool.customIcon || null,
          })
        )
        addedCount++
      }
    }

    if (imported.toolOrder && Array.isArray(imported.toolOrder)) {
      const orderKeys = imported.toolOrder.filter((key: string) => {
        const parts = key.split(':')
        const name = parts[1]
        const isCustomKey = parts[0] === 'custom'
        return allTools.value.some(t => t.isCustom === isCustomKey && t.name === name)
      })
      if (orderKeys.length) localStorage.setItem('gtb-order', JSON.stringify(orderKeys))
    }

    if (imported.theme && ['light', 'dark', 'auto'].includes(imported.theme)) {
      document.documentElement.setAttribute('data-theme', imported.theme)
      localStorage.setItem('gtb-theme', imported.theme)
      const ui = useUiStore()
      ui.theme = imported.theme
    }

    if (imported.favorites && Array.isArray(imported.favorites)) {
      favoriteTools.value = new Set(imported.favorites)
      saveFavorites()
    }

    saveAndRefresh()
    return addedCount
  }

  function clearUserData() {
    customTools.value = []
    favoriteTools.value = new Set()
    categoryNames.value = []

    const ui = useUiStore()
    ui.showOnlyFav = false
    ui.searchQuery = ''
    ui.activeCategory = '全部'
    ui.toolTypeFilter = 'all'
    ui.exitSelectMode()

    localStorage.removeItem('gtb-custom')
    localStorage.removeItem('gtb-favorites')
    localStorage.removeItem('gtb-order')
    localStorage.removeItem('gtb-cat-order')

    lastDeletedBatch.value = null
    isLoaded.value = false
  }

  // 监听用户登录状态，退出登录时强制清空用户数据
  const userStore = useUserStore()
  watch(() => userStore.isLoggedIn, (isLoggedIn) => {
    if (!isLoggedIn) {
      clearUserData()
    }
  })

  return {
    builtinTools,
    customTools,
    favoriteTools,
    favoriteIds,
    lastDeletedBatch,
    isLoaded,
    categoryNames,
    allTools,
    tools: allTools,
    categoryList,
    categories: categoryList,
    categoryCounts,
    normalizeTool,
    getToolKey,
    getSmallIconHtml,
    getVisibleTools,
    getDomainFromUrl,
    getFaviconUrl,
    escapeHtml,
    initData,
    loadFromBackend,
    persistData,
    saveAndRefresh,
    addCustomTool,
    updateCustomTool,
    replaceBuiltinWithCustom,
    deleteBuiltinTool,
    deleteCustomTool,
    batchDelete,
    undoDelete,
    renameCategory,
    moveToolToCategory,
    reorderTools,
    toggleFavorite,
    exportData,
    importData,
    saveFavorites,
    clearUserData,
  }
})
