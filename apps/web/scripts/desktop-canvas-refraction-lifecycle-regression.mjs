import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { transformSync } from 'esbuild'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const helper = readFileSync(path.resolve(root,'src/desktop/canvasRefractionLifecycle.ts'),'utf8')
const compiled = transformSync(helper,{loader:'ts',format:'esm',target:'es2022'}).code
const {canvasMonitorFingerprint,hasCanvasMonitorTopologyChanged,createCanvasFrameProfiler} = await import(
  'data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'))
const main=readFileSync(path.resolve(root,'../desktop/src-tauri/src/main.rs'),'utf8')
const view=readFileSync(path.resolve(root,'src/views/DesktopCanvas.vue'),'utf8')
const surface=readFileSync(path.resolve(root,'src/components/desktop/CanvasRefractionLayer.vue'),'utf8')
const native=readFileSync(path.resolve(root,'../desktop/src-tauri/src/desktop_canvas_windows.rs'),'utf8')
let count=0
function check(expression,message){assert.ok(expression,message);count++}
const primary={id:'\\\\.\\DISPLAY1',x:0,y:0,width:1648,height:810,scaleFactor:1,isPrimary:true}
const second={id:'\\\\.\\DISPLAY2',x:-1920,y:0,width:1920,height:1080,scaleFactor:1.25,isPrimary:false}
const original=[primary,second]
const cloned=structuredClone(original)
check(!hasCanvasMonitorTopologyChanged(original,cloned),'Unchanged physical arrangement retains refraction')
check(!hasCanvasMonitorTopologyChanged(original,[second,primary]),'Monitor enumeration order does not matter')
check(canvasMonitorFingerprint(original)===canvasMonitorFingerprint([second,primary]),'Monitor fingerprint stable order')
check(!hasCanvasMonitorTopologyChanged(original,[{...primary,x:.00049},second]),'Sub-pixel jitter does not trigger reset')
for(const field of ['x','y','width','height','scaleFactor']){
 const altered={...second,[field]:second[field]+2}
 check(hasCanvasMonitorTopologyChanged(original,[primary,altered]),'Changed '+field+' invalidates')
}
check(hasCanvasMonitorTopologyChanged(original,[{...primary,isPrimary:false},second]),'Primary monitor switch invalidates')
check(hasCanvasMonitorTopologyChanged(original,[primary]),'Monitor removal invalidates')
check(hasCanvasMonitorTopologyChanged(original,[primary,{...second,id:'DISPLAY3'}]),'Display identity change invalidates')
const profiler=createCanvasFrameProfiler(5)
check(profiler.summary().samples===0 && profiler.summary().p95_ms===0,'Empty diagnostics')
for(const value of [1,2,3,4,5,6,7])profiler.record(value)
check(profiler.summary().samples===5,'Bounded diagnostics buffer')
check(profiler.summary().p50_ms===5,'Rolling median')
check(profiler.summary().p95_ms===7,'Rolling P95')
check(profiler.summary().max_ms===7,'Rolling max')
for(const bad of [-2,NaN,Infinity,3000])profiler.record(bad)
check(profiler.summary().samples===5,'Invalid CPU frame readings ignored')
profiler.clear()
check(profiler.summary().samples===0,'Profiler clears after disabling optics')
const seeded=createCanvasFrameProfiler()
for(let i=1;i<=120;i++){seeded.record(i/3);check(seeded.summary().samples<=120,'Capacity bounded '+i)}
check(seeded.summary().p95_ms > seeded.summary().p50_ms,'P95 higher than median on a sample')
check(main.includes('CANVAS_REFRACTION_SESSION_OPT_IN: AtomicBool'),'Native opt-in is volatile per process')
check(main.includes('CANVAS_REFRACTION_RECOVERY_GENERATION: AtomicUsize'),'Recovery is tied to generation')
check(main.includes('compare_exchange(generation, 0'),'Recovery flag is single-consumer')
check(main.includes('clear_canvas_refraction_session();'),'Native close revokes consent')
check(main.includes('set_canvas_refraction_session_opt_in,') && main.includes('consume_canvas_refraction_recovery_opt_in,'),'Native handlers registered')
check(view.includes('consume_canvas_refraction_recovery_opt_in') && view.includes('if (resume) void toggleWallpaperRefraction()'),'Recovery requests explicitly opted-in rehydration')
check(view.includes('hasCanvasMonitorTopologyChanged(canvas.monitors, monitorList)'),'Topology fingerprint protects harmless resize')
check(!view.includes('function handleCanvasTopologyChanged(): void {\n  disableWallpaperRefraction()'),'No unconditional reset on resize')
check(view.includes('disableWallpaperRefraction(false)'),'View dispose does not revoke native permission during HWND recreation')
check(surface.includes('createCanvasFrameProfiler(120)') && surface.includes("emit('stats'"),'Bounded CPU submission timing included')
check(surface.includes("renderer?.dispose()") && surface.includes('frameProfiler.clear()'),'GPU and diagnostics disposed')
check(native.includes('rebuild_canvas_after_explorer_restart(&app)'),'Recovery paths retain main process state')
check(!view.includes('localStorage.setItem('),'No wallpaper pixels or opt-in written to localStorage')
check(native.includes('start_recovery_monitor('),'WorkerW recovery monitor is installed')
check(native.includes('IsWindow(hwnd)') && native.includes('rebuild_canvas_after_explorer_restart'), 'Destroyed Canvas HWND enters controlled rebuild path')
check(native.includes('expected_visible()'), 'Recovery keeps visibility state instead of blindly restoring')
console.log(JSON.stringify({outcome:'PASS',checks:count,topology:'physical snapshot',consent:'process-memory-only',performance:'CPU submission-only'}))
