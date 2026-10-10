/**
 * Pure wallpaper geometry for the explicit, offline-only GPU optics preview.
 * Physical rectangles come from IDesktopWallpaper, including negative origins.
 * Each monitor's image stays within its own original display rectangle.
 */
export type WallpaperMode = 'fill' | 'fit' | 'stretch' | 'center' | 'tile' | 'span'
export type MonitorWallpaper = [number, number, number, number, string]
export type WallpaperSnapshot = [WallpaperMode, string, MonitorWallpaper[]]
export interface WallpaperRect { x: number; y: number; width: number; height: number }
export interface WallpaperPlacement extends WallpaperRect { scaleX: number; scaleY: number }
export interface WallpaperAtlasGeometry {
  bounds: WallpaperRect
  monitors: WallpaperRect[]
}

const MODES = new Set<WallpaperMode>(['fill', 'fit', 'stretch', 'center', 'tile', 'span'])
const MAX_MONITORS = 6
const MAX_BYTES_BASE64 = 32 * 1024 * 1024
export function validateWallpaperSnapshot(sample: unknown): sample is WallpaperSnapshot {
  if (!Array.isArray(sample) || sample.length !== 3) return false
  const [mode, background, monitors] = sample
  if (typeof mode !== 'string' || !MODES.has(mode as WallpaperMode)) return false
  if (typeof background !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(background)) return false
  if (!Array.isArray(monitors) || monitors.length < 1 || monitors.length > MAX_MONITORS) return false
  let total = 0
  for (const monitor of monitors) {
    if (!Array.isArray(monitor) || monitor.length !== 5) return false
    if (!monitor.slice(0, 4).every((number: unknown) => typeof number === 'number' && Number.isFinite(number))) return false
    const [x, y, width, height, image] = monitor
    if (Math.abs(x) > 100000 || Math.abs(y) > 100000
      || width <= 0 || height <= 0 || width > 16384 || height > 16384) return false
    if (typeof image !== 'string' || !/^data:image\/(jpeg|png|webp|bmp);base64,[a-zA-Z0-9+/=]+$/.test(image)) return false
    total += image.length
    if (total > MAX_BYTES_BASE64) return false
  }
  return true
}

export function wallpaperAtlasGeometry(monitors: readonly MonitorWallpaper[]): WallpaperAtlasGeometry | null {
  if (!monitors.length) return null
  const left = Math.min(...monitors.map(row => row[0]))
  const top = Math.min(...monitors.map(row => row[1]))
  const right = Math.max(...monitors.map(row => row[0] + row[2]))
  const bottom = Math.max(...monitors.map(row => row[1] + row[3]))
  const width = right - left
  const height = bottom - top
  if (!(width > 0 && height > 0 && width <= 32768 && height <= 32768)) return null
  return {
    bounds: { x: left, y: top, width, height },
    monitors: monitors.map(row => ({ x: row[0] - left, y: row[1] - top, width: row[2], height: row[3] })),
  }
}

export function wallpaperPlacement(
  mode: WallpaperMode, rect: WallpaperRect, imageWidth: number, imageHeight: number,
): WallpaperPlacement | null {
  if (![rect.x, rect.y, rect.width, rect.height, imageWidth, imageHeight].every(Number.isFinite)
    || rect.width <= 0 || rect.height <= 0 || imageWidth <= 0 || imageHeight <= 0) return null
  let scaleX = rect.width / imageWidth
  let scaleY = rect.height / imageHeight
  if (mode === 'fill' || mode === 'fit') {
    const scale = mode === 'fill' ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY)
    scaleX = scale
    scaleY = scale
  } else if (mode === 'center' || mode === 'tile') {
    scaleX = 1
    scaleY = 1
  }
  const width = imageWidth * scaleX
  const height = imageHeight * scaleY
  return { x: rect.x + (rect.width - width) / 2, y: rect.y + (rect.height - height) / 2, width, height, scaleX, scaleY }
}

const MAX_ATLAS_SIZE = 2048
const MAX_IMAGE_PIXELS = 48_000_000

/** One composite atlas image, hence one WebGL texture for all monitors. */
export async function createWallpaperAtlas(sample: WallpaperSnapshot, viewportWidth: number, viewportHeight: number, signal?: AbortSignal): Promise<HTMLCanvasElement> {
  if (!validateWallpaperSnapshot(sample)) throw new Error('Unsupported wallpaper snapshot')
  const [mode, background, monitors] = sample
  const geometry = wallpaperAtlasGeometry(monitors)
  if (!geometry || !(viewportWidth > 0 && viewportHeight > 0)) throw new Error('Invalid virtual desktop')
  // Wallpaper rects from the native API are physical; CSS Canvas uses one
  // canvas.scale_factor() for the entire virtual desktop. Reject inconsistent
  // proportions rather than misrepresenting mixed-DPI layouts as exact.
  const sourceAspect = geometry.bounds.width / geometry.bounds.height
  const screenAspect = viewportWidth / viewportHeight
  if (Math.abs(sourceAspect / screenAspect - 1) > .035) {
    throw new Error('Canvas and desktop topology are not aligned')
  }
  const scale = Math.min(1, MAX_ATLAS_SIZE / Math.max(geometry.bounds.width, geometry.bounds.height))
  const atlas = document.createElement('canvas')
  atlas.width = Math.max(1, Math.round(geometry.bounds.width * scale))
  atlas.height = Math.max(1, Math.round(geometry.bounds.height * scale))
  const context = atlas.getContext('2d', { alpha: true })
  if (!context) throw new Error('Wallpaper atlas 2D canvas unavailable')
  context.fillStyle = background
  context.fillRect(0, 0, atlas.width, atlas.height)
  const painted = new Set<string>()
  const images = new Map<string, HTMLImageElement>()
  try {
    if (signal?.aborted) throw new Error('Wallpaper decode cancelled')
    for (const monitor of monitors) {
      if (images.has(monitor[4])) continue
      const image = new Image()
      image.src = monitor[4]
      await image.decode()
      if (signal?.aborted) throw new Error('Wallpaper decode cancelled')
      if (image.naturalWidth <= 0 || image.naturalHeight <= 0
        || image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) throw new Error('Unsupported wallpaper dimensions')
      images.set(monitor[4], image)
    }
    if (signal?.aborted) throw new Error('Wallpaper atlas cancelled')
    for (let i = 0; i < monitors.length; i += 1) {
      const item = monitors[i]
      const image = images.get(item[4])
      if (!image) continue
      const bounds = geometry.monitors[i]
      const x = bounds.x * scale
      const y = bounds.y * scale
      const width = bounds.width * scale
      const height = bounds.height * scale
      context.save()
      context.beginPath()
      context.rect(x, y, width, height)
      context.clip()
      if (mode === 'span') {
        // Windows SPAN uses the single image for the union of all displays.
        if (!painted.has(item[4])) {
          painted.add(item[4])
        }
        context.drawImage(image, 0, 0, atlas.width, atlas.height)
      } else if (mode === 'tile') {
        const pattern = context.createPattern(image, 'repeat')
        if (pattern) {
          context.translate(x, y)
          context.scale(scale, scale)
          context.fillStyle = pattern
          context.fillRect(0, 0, bounds.width, bounds.height)
        }
      } else {
        const placed = wallpaperPlacement(mode, bounds, image.naturalWidth, image.naturalHeight)
        if (!placed) throw new Error('Wallpaper positioning failed')
        context.drawImage(image, placed.x * scale, placed.y * scale, placed.width * scale, placed.height * scale)
      }
      context.restore()
    }
    return atlas
  } catch (error) {
    atlas.width = 0
    atlas.height = 0
    throw error
  } finally {
    for (const image of images.values()) image.src = ''
  }
}
