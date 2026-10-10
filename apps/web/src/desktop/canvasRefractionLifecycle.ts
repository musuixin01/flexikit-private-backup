import type { CanvasMonitorInfo } from '@/types/desktopWidget'

/** Stable monitor identity, physical placement expressed in Canvas CSS pixels.
 * Excludes volatile display names and rounds sub-pixel float jitter to 0.001px.
 * An unrelated WebView resize must never switch off opted-in GPU refraction.
 */
export function canvasMonitorFingerprint(
  monitors: readonly Pick<CanvasMonitorInfo, 'id' | 'x' | 'y' | 'width' | 'height' | 'scaleFactor' | 'isPrimary'>[],
): string {
  const round = (n: number): number => Math.round(n * 1000) / 1000
  return JSON.stringify(monitors.map(monitor => [
    monitor.id, round(monitor.x), round(monitor.y),
    round(monitor.width), round(monitor.height), round(monitor.scaleFactor), monitor.isPrimary,
  ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))))
}
export function hasCanvasMonitorTopologyChanged(
  previous: Parameters<typeof canvasMonitorFingerprint>[0],
  next: Parameters<typeof canvasMonitorFingerprint>[0],
): boolean {
  return canvasMonitorFingerprint(previous) !== canvasMonitorFingerprint(next)
}

export interface CanvasFrameSummary {
  samples: number
  p50_ms: number
  p95_ms: number
  max_ms: number
}
/** CPU render *submission* only; GPU completion is asynchronous.
 * No wallpaper pixels, identifiers or pointer coordinates are recorded.
 */
export function createCanvasFrameProfiler(capacity = 120): {
  record(durationMs: number): void
  summary(): CanvasFrameSummary
  clear(): void
} {
  const cap = Math.max(1, Math.min(240, Math.floor(capacity)))
  const recent: number[] = []
  return {
    record(durationMs) {
      if (!Number.isFinite(durationMs) || durationMs < 0 || durationMs > 2000) return
      recent.push(durationMs)
      if (recent.length > cap) recent.shift()
    },
    summary() {
      const ordered = [...recent].sort((a, b) => a - b)
      const percentile = (p: number) => ordered.length
        ? Number(ordered[Math.min(ordered.length - 1, Math.ceil(p * ordered.length) - 1)].toFixed(3))
        : 0
      return { samples: ordered.length, p50_ms: percentile(.5), p95_ms: percentile(.95), max_ms: percentile(1) }
    },
    clear() { recent.length = 0 },
  }
}
