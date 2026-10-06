import { getCurrentWebview } from '@tauri-apps/api/webview'
import { invokeDesktop, isDesktopRuntime } from '@/api/runtime'

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

export async function inspectLocalToolPaths(paths: string[]): Promise<LocalToolCandidate[]> {
  if (!isDesktopRuntime()) throw new Error('本地工具导入仅支持桌面端')
  const rows = await invokeDesktop<NativeLocalToolInspection[]>('inspect_local_tool_paths', { paths })
  return rows.map(([path, name, extension, icon, error]) => ({
    path,
    name,
    extension,
    icon,
    error,
  }))
}

export async function pickLocalToolFile(): Promise<string | null> {
  if (!isDesktopRuntime()) throw new Error('本地工具导入仅支持桌面端')
  return invokeDesktop<string | null>('pick_local_tool_file')
}

export async function subscribeLocalToolDrops(
  listener: (state: LocalToolDropState) => void,
): Promise<() => void> {
  if (!isDesktopRuntime()) return () => {}

  return getCurrentWebview().onDragDropEvent(event => {
    if (event.payload.type === 'drop') {
      listener({ active: false, paths: event.payload.paths, position: event.payload.position })
      return
    }
    if (event.payload.type === 'leave') {
      listener({ active: false })
      return
    }
    listener({ active: true, position: event.payload.position })
  })
}
