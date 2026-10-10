import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (relativePath) => fs.readFileSync(path.resolve(root, relativePath), 'utf8')
const main = read('desktop/src-tauri/src/main.rs')
const native = read('desktop/src-tauri/src/canvas_wallpaper_windows.rs')
const layoutNative = read('desktop/src-tauri/src/canvas_wallpaper_layout_windows.rs')
const wallpaperLayout = read('web/src/desktop/wallpaperLayout.ts')
const renderer = read('web/src/desktop/wallpaperRefraction.ts')
const component = read('web/src/components/desktop/CanvasRefractionLayer.vue')
const view = read('web/src/views/DesktopCanvas.vue')
const css = read('web/src/styles/canvas-liquid-glass.css')
let count = 0
function check(value, why) {
  assert.ok(value, why)
  count += 1
}
check(main.includes('get_canvas_wallpaper_preview') && main.includes('desktop canvas only'), 'Native interface is Canvas-only')
check(layoutNative.includes('GetMonitorDevicePathCount') && layoutNative.includes('GetMonitorRECT') && layoutNative.includes('GetWallpaper('), 'Per-monitor Windows wallpaper and physical rectangle metadata are used')
check(layoutNative.includes('GetPosition') && layoutNative.includes('GetBackgroundColor'), 'Native wallpaper positioning and background colors are read')
check(native.includes('SPI_GETDESKWALLPAPER') && !native.includes('BitBlt(') && !native.includes('PrintWindow('), 'Only static wallpaper is used, never screenshots')
check(native.includes('MAX_WALLPAPER_BYTES: u64 = 8 * 1024 * 1024'), 'Native payload is size-bounded')
check(native.includes('meta.is_file()') || native.includes('metadata.is_file()') && native.includes('bytes.len() as u64'), 'Native file and read contents are bounded')
check(native.includes('data:{mime};base64,') && !native.includes('println!') && !native.includes('eprintln!'), 'Path is never returned or logged')
check(renderer.includes('webgl2') && renderer.includes('sampler2D u_image') && renderer.includes('createWallpaperAtlas('), 'GPU-backed shared virtual-desktop wallpaper atlas')
check(renderer.includes('roundRectSdf') && renderer.includes('gl.scissor('), 'Refraction rendering stays within rounded widget regions')
check(renderer.includes('MAX_TEXTURE_SIZE = 2048') && renderer.includes('MAX_DEVICE_SCALE = 1.5'), 'Wallpaper GPU memory and pixel density are capped')
check(renderer.includes('gl.deleteTexture(') && renderer.includes('gl.deleteProgram(') && renderer.includes('canvas.width = 0'), 'GPU resources are released on disable')
check(component.includes("new ResizeObserver(schedule)") && component.includes('requestAnimationFrame(draw)'), 'Geometry updates are rAF-coalesced')
check(component.includes('lastPointerFrame < 32') && component.includes('prefers-reduced-motion: reduce'), 'Pointer redraw is capped and respects reduced motion')
check(view.includes('试用折射') && view.includes('get_canvas_wallpaper_preview'), 'Preview must be explicitly user-triggered')
check(view.includes('wallpaperSample.value = null') && view.includes('refractionReady.value = false'), 'Turning it off frees in-memory wallpaper and returns to ordinary glass')
check(view.includes('validateWallpaperSnapshot(sample)') && view.includes('onWallpaperRefractionError'), 'Unsupported wallpaper metadata falls back without persistence')
check(wallpaperLayout.includes('wallpaperAtlasGeometry') && wallpaperLayout.includes('wallpaperPlacement') && wallpaperLayout.includes('MAX_ATLAS_SIZE = 2048'), 'Validated shared virtual-desktop atlas geometry with limited GPU texture')
check(wallpaperLayout.includes("mode === 'span'") && wallpaperLayout.includes("mode === 'tile'"), 'All native wallpaper layout modes are supported by atlas composition')
check(!view.includes('localStorage.setItem') && !renderer.includes('localStorage'), 'Refraction does not persist wallpaper pixels or experimental mode')
check(css.includes('is-wallpaper-refracting') && css.includes('preset-glass') && css.includes('preset-dense'), 'Only supported material shell density changes when GPU is ready')
check(css.includes('prefers-reduced-transparency:reduce') || css.includes('prefers-reduced-transparency: reduce'), 'Reduced-transparency accessibility fallback remains available')
// Optical direction: the displaced wallpaper sample must move into the
// rounded glass face, not pull bright background objects from outside.
check(renderer.includes('vec2 samplePoint = pixel - bend;')
  && !renderer.includes('vec2 samplePoint = pixel + bend;'), 'Glass-edge sampling bends toward the card interior')
check(renderer.includes('normal * (3.0 + 1.0 * u_strength) * band')
  && renderer.includes('tangent * parallax * .35 * band'), 'Refraction uses restrained continuous lens displacement and stable pointer parallax')
check(renderer.includes('gl.UNPACK_FLIP_Y_WEBGL, true')
  && renderer.includes('texture(u_image, vec2(uv.x, 1.0 - uv.y))'), 'Atlas stays right-side up after changing only the refraction vector')
check(css.includes('border:.75px solid color-mix(in srgb,var(--liquid-local-rim) 24%,transparent);'), 'Faint subpixel hairline blends into the frosted body')
check(css.includes('.desktop-canvas .widget-host.liquid-glass::after {content:none;}'), 'Masked secondary rim no longer doubles border')
check(!css.includes('-webkit-mask-composite:xor') && !css.includes('padding:2px;pointer-events:none;opacity:.96'), 'Bright heavy overlay rim has been removed')
check(css.includes('0 0 0 1px color-mix(in srgb,var(--primary) 39%,transparent)'), 'Selected widget remains visible with a single-pixel feedback ring')
check(renderer.includes('(1.0 - exp(-edgeDistance / 4.5))')
  && renderer.includes('exp(-edgeDistance / 17.0)'), 'Single analytic lens curve replaces two-band optical profile')
check(renderer.includes('aa = max(fwidth(sdf) * .7, .75)')
  && renderer.includes('coverage = 1.0 - smoothstep(-aa, aa, sdf)')
  && renderer.includes('.97 * coverage'), 'Antialiased silhouette follows device pixel footprint')
check(!renderer.includes('float frost =') && !renderer.includes('mix(color, frosted')
  && (renderer.match(/texture\(u_image,/g) || []).length === 1,
  'Redundant five-tap GPU blur ring is removed: CSS owns frosting and renderer makes one wallpaper sample')
check(!renderer.includes('sin(dot(local') && !renderer.includes('u_time'),
  'Continuous self-animated water ripples are removed')
check(renderer.includes('vec3(.008) * highlight')
  && renderer.includes('vec3(.004) * deepEdge'), 'Lighter continuous specular edge')
check(css.includes('inset:0;z-index:-1') && css.includes('border-radius:inherit;')
  && css.includes('color-mix(in srgb,var(--liquid-local-plate) 38%,transparent)'), 'Content protection feathers to outer rounded geometry without a 5px inset seam')
check(css.includes('rgb(255 255 255 / 5%) 9%') && css.includes('transparent 31%'),
  'Shell has a transparent graded shoulder, not a solid white border haze')
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x-a)/(b-a)));return t*t*(3-2*t) }
const opticalBand = d => (1-Math.exp(-d/4.5)) * Math.exp(-d/17)
const lens = d => (3 + .75) * opticalBand(d)
check(opticalBand(0)===0 && opticalBand(6)>opticalBand(3)
  && opticalBand(10)<opticalBand(6) && opticalBand(64)<.03,
  'Optical profile is one smooth lobe without a second fog cutoff')
check(Math.max(...Array.from({length:120},(_,i)=>lens(i))) < 2.4,
  'Maximum refraction displacement is below 2.4 GPU pixels for regular glass')
check(Array.from({length:81},(_,i)=>opticalBand(i)).every(v => v>=0 && Number.isFinite(v)),
  'Analytic lens band is finite and nonnegative across glass radius')
for (const [dx, dy] of [[-154, 0], [154, 0], [0, -85], [0, 85]]) {
  const halfWidth = 160
  const halfHeight = 90
  const nx = dx / halfWidth
  const ny = dy / halfHeight
  const length = Math.hypot(nx, ny)
  const sampleX = dx - nx / length * 5.75
  const sampleY = dy - ny / length * 5.75
  check(sampleX * dx + sampleY * dy < dx * dx + dy * dy,
    'Refraction samples toward card center for the four primary edges')
}
console.log(JSON.stringify({ outcome: 'PASS', checks: count, sample: 'read-only local wallpaper', mode: 'opt-in ephemeral', gpu: 'single shared WebGL2 renderer' }))
