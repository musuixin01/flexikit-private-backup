/**
 * Backend Tool entity to frontend Tool shape mapping.
 */

export interface BackendTool {
  id: number
  user_id: number | null
  name: string
  url: string
  description: string | null
  category: string | null
  tags: string[] | null
  icon: string | null
  is_custom: boolean
  local_path: string | null
  card_color: string | null
  created_at: string
  updated_at: string
}

export interface FrontendTool {
  name: string
  cat: string
  desc: string
  url: string
  tags: string[]
  icon: string
  isCustom?: boolean
  customIcon?: string | null
  localPath?: string | null
  cardColor?: string | null
  card_color?: string | null
  id?: number
  description?: string
  category?: string | null
  is_custom?: boolean
  local_path?: string | null
}

export function backendToFrontend(bt: BackendTool): FrontendTool {
  const category = bt.category || '未分类'
  const description = bt.description || ''
  const localPath = bt.local_path || null

  return {
    id: bt.id,
    name: bt.name,
    url: bt.url || '#',
    desc: description,
    description,
    cat: category,
    category,
    tags: bt.tags || [],
    icon:
      bt.icon ||
      (bt.is_custom && !localPath
        ? ''
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="2" y="3" width="20" height="18" rx="2" stroke-width="2"/><circle cx="8" cy="8" r="2"/><path d="m12 8 2 2-2 2"/></svg>'),
    isCustom: bt.is_custom,
    is_custom: bt.is_custom,
    cardColor: bt.card_color || null,
    card_color: bt.card_color || null,
    customIcon: bt.is_custom ? bt.icon : null,
    localPath,
    local_path: localPath,
  }
}
