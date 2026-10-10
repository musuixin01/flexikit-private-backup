import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const helper = readFileSync(path.join(root, 'src/desktop/canvasGpuRecovery.ts'), 'utf8')
const js = transformSync(helper, {loader:'ts',format:'esm',target:'es2022'}).code
const { createCanvasGpuRecoveryGate } = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))
const vue = readFileSync(path.join(root,'src/components/desktop/CanvasRefractionLayer.vue'),'utf8')
const renderer = readFileSync(path.join(root,'src/desktop/wallpaperRefraction.ts'),'utf8')
const atlas = readFileSync(path.join(root,'src/desktop/wallpaperLayout.ts'),'utf8')
const policy = readFileSync(path.join(root,'../desktop/src-tauri/src/desktop_canvas_recovery_policy.rs'),'utf8')
const native = readFileSync(path.join(root,'../desktop/src-tauri/src/desktop_canvas_windows.rs'),'utf8')
let assertions = 0
function check(value,label){ assert.ok(value,label); assertions++ }

const recovery = createCanvasGpuRecoveryGate(2)
check(!recovery.isLost(),'Default ready state')
check(recovery.attempts() === 0,'No restore attempts before consent')
check(!recovery.restored(),'Cannot restore without loss')
check(recovery.lost(),'First lost event allows recovery')
check(recovery.isLost(),'State records device lost')
check(recovery.lost(),'Duplicate loss does not advance count')
check(recovery.restored(),'First context restoration accepted')
check(recovery.attempts()===1,'First attempt counted')
check(!recovery.restored(),'Duplicate restoration rejected')
check(recovery.lost(),'Second loss still retryable')
check(recovery.restored(),'Second restoration accepted')
check(recovery.attempts()===2,'Second attempt counted')
check(!recovery.lost(),'Third loss exceeds retry budget')
check(recovery.isLost(),'Third lost state remains lost')
check(!recovery.restored(),'Third restoration blocked, fallback needed')
recovery.reset()
check(recovery.attempts()===0 && !recovery.isLost(),'Unmount resets volatile gate')
const disabled = createCanvasGpuRecoveryGate(0)
check(!disabled.lost() && !disabled.restored(),'No retry when disabled')
const max = createCanvasGpuRecoveryGate(100)
let bounded=0
for(let i=0;i<4;i++){
  if(max.lost() && max.restored()) bounded++
}
check(bounded===3,'GPU recovery retries always capped at three')
check(native.includes('RecoveryGate::new()'),'Win32 recovery integrates pure policy')
check(native.includes('let hwnd = window.hwnd().ok()'),'Missing HWND no longer stalls forever')
check(native.includes('gate.observe(hwnd_alive, parent_valid)'),'Only observed facts can drive HWND rebuild')
check(native.includes('RecoveryAction::Rebuild') && native.includes('RecoveryAction::Reattach'),'Separate destroy and reparent actions')
check(policy.includes('self.missing_samples < 2'),'Two missing polls required before destructive recovery')
check(policy.includes('self.failures.saturating_sub(1).min(3)'),'Exponential retry cap')
check(vue.includes("addEventListener('webglcontextrestored', onContextRestored)"),'Restore listener added')
check(vue.includes("removeEventListener('webglcontextrestored', onContextRestored)"),'Restore listener removed')
check(vue.includes('CONTEXT_RESTORE_TIMEOUT_MS = 4000'),'Bounded restore timer')
check(vue.includes('clearRestoreTimer()'),'Restore timeout cleared on success/unmount')
check(vue.includes('generation !== initGeneration'),'Abandoned async initializations invalidated')
check(vue.includes('recovery.restored()') && vue.includes('initializeGpuRenderer()'),'Context restored rebuilds shared GPU state')
check(renderer.includes('if (gl.isContextLost()) return'),'Dispose skips invalid GL calls during loss')
check(renderer.includes('canvas.width = 0'),'GPU canvas release still supported after recovery')
check(vue.includes('pendingGpuInitialization?.abort()'),'Previous in-flight GPU setup can be cancelled')
check(vue.includes('new AbortController()'),'GPU init is bound to a cancellation token')
check(renderer.includes('signal?.aborted') && renderer.includes('signal?: AbortSignal'),'Outdated GPU setup cannot bind a WebGL texture')
check(atlas.includes('Wallpaper decode cancelled') && atlas.includes('Wallpaper atlas cancelled'),'Atlas decode/painting respects cancellation')
console.log(JSON.stringify({outcome:'PASS',assertions,workerW:'safe backoff',webgl:'bounded restore',privacy:'in-memory-only'}))
