import { getCurrentWindow } from '@tauri-apps/api/window'
import { invokeDesktop, isDesktopRuntime } from '@/api/runtime'
import { discoverInstalledApps, getInstalledAppIcon } from '@/desktop/installedApps'

type NativeLocalToolInspection = [
  path: string,
  name: string,
  extension: string,
  icon: string | null,
  error: string | null,
]

export interface LocalToolCandidate {
  path: string
  name: string
  extension: string
  icon: string | null
  error: string | null
}

export interface LocalToolDropState {
  active: boolean
  paths?: string[]
  position?: { x: number; y: number }
}

const SUPPORTED_LOCAL_TOOL_EXTENSIONS = new Set(['exe', 'lnk', 'url', 'msi'])

function normalizeWindowsPath(value: string): string {
  return value.trim().replace(/\//g, '\\').toLocaleLowerCase()
}

function fallbackCandidate(path: string): LocalToolCandidate {
  const trimmed = path.trim()
  const fileName = trimmed.split(/[\\/]/).pop() || ''
  const dot = fileName.lastIndexOf('.')
  const extension = dot > 0 ? fileName.slice(dot + 1).toLocaleLowerCase() : ''
  const name = dot > 0 ? fileName.slice(0, dot) : fileName

  return {
    path: trimmed,
    name: name || '本地工具',
    extension,
    icon: null,
    error: SUPPORTED_LOCAL_TOOL_EXTENSIONS.has(extension)
      ? null
      : '仅支持 .exe、.lnk、.url、.msi',
  }
}

async function inspectLocalToolPathsCompat(paths: string[]): Promise<LocalToolCandidate[]> {
  const candidates = paths.slice(0, 32).map(fallbackCandidate)

  try {
    const apps = await discoverInstalledApps(false)
    const appByPath = new Map<string, string>()
    for (const app of apps) {
      for (const value of [app.entryPath, app.launchTarget]) {
        if (value?.trim()) appByPath.set(normalizeWindowsPath(value), app.name)
      }
    }

    await Promise.all(candidates.map(async candidate => {
      if (candidate.error) return
      const appName = appByPath.get(normalizeWindowsPath(candidate.path))
      if (!appName) return
      try {
        candidate.icon = await getInstalledAppIcon(appName)
      } catch {
        // Icon enrichment is optional in compatibility mode.
      }
    }))
  } catch {
    // Older shells can still import dropped files without app discovery.
  }

  return candidates
}

export async function inspectLocalToolPaths(paths: string[]): Promise<LocalToolCandidate[]> {
  if (!isDesktopRuntime()) throw new Error('本地工具导入仅支持桌面端')

  try {
    const rows = await invokeDesktop<NativeLocalToolInspection[]>('inspect_local_tool_paths', { paths })
    return rows.map(([path, name, extension, icon, error]) => ({
      path,
      name,
      extension,
      icon,
      error,
    }))
  } catch {
    // Keep drag-import usable with an older Desktop shell. The eventual
    // open_local_path command still performs the native path/extension guard.
    return inspectLocalToolPathsCompat(paths)
  }
}

export async function pickLocalToolFile(): Promise<string | null> {
  if (!isDesktopRuntime()) throw new Error('本地工具导入仅支持桌面端')
  try {
    return await invokeDesktop<string | null>('pick_local_tool_file')
  } catch {
    throw new Error('当前桌面组件暂不支持文件选择，请直接把启动程序拖入上方区域')
  }
}

export async function subscribeLocalToolDrops(
  listener: (state: LocalToolDropState) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) return () => {}

  const currentWindow = getCurrentWindow()
  const scaleFactor = Math.max(
    await currentWindow.scaleFactor().catch(() => globalThis.devicePixelRatio || 1),
    1,
  )

  const toLogicalPosition = (position: { x: number; y: number }) => ({
    x: position.x / scaleFactor,
    y: position.y / scaleFactor,
  })

  return currentWindow.onDragDropEvent(event => {
    if (event.payload.type === 'drop') {
      listener({
        active: false,
        paths: event.payload.paths,
        position: toLogicalPosition(event.payload.position),
      })
      return
    }
    if (event.payload.type === 'leave') {
      listener({ active: false })
      return
    }
    listener({ active: true, position: toLogicalPosition(event.payload.position) })
  })
}
