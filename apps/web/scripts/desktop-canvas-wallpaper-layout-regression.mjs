import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { transformSync } from 'esbuild'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const code = transformSync(readFileSync(path.join(root, 'src/desktop/wallpaperLayout.ts'), 'utf8'),
  { loader:'ts', format:'esm', target:'es2022' }).code
const { validateWallpaperSnapshot, wallpaperAtlasGeometry, wallpaperPlacement } =
  await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+EryqEwAAAABJRU5ErkJggg=='
let checks = 0
function test(ok, description) { assert.ok(ok, description); checks++ }
const rows = [[-1920, 0, 1920, 1080, png],[0,-240,2560,1440,png],[2560,0,1080,1920,png]]
const snapshot = ['fill','#123456',rows]
test(validateWallpaperSnapshot(snapshot),'3-monitor negative-origin snapshot')
const geometry=wallpaperAtlasGeometry(rows)
test(geometry.bounds.x===-1920 && geometry.bounds.y===-240,'Virtual desktop negative origin')
test(geometry.bounds.width===5560 && geometry.bounds.height===2160,'Virtual desktop union bounds')
test(geometry.monitors[0].x===0 && geometry.monitors[0].y===240,'First normalized monitor')
test(geometry.monitors[1].x===1920 && geometry.monitors[1].y===0,'Second normalized monitor')
test(geometry.monitors[2].x===4480 && geometry.monitors[2].y===240,'Third normalized monitor')
test(wallpaperAtlasGeometry([])===null,'Empty desktop')
test(!validateWallpaperSnapshot(['bad','#000000',rows]),'Invalid wallpaper layout rejected')
test(!validateWallpaperSnapshot(['fill','black',rows]),'Invalid background rejected')
test(!validateWallpaperSnapshot(['fill','#000000',Array(7).fill([0,0,1,1,png])]),'Too many monitors rejected')
test(!validateWallpaperSnapshot(['fill','#000000',[[0,0,0,100,png]]]),'Invalid monitor size rejected')
test(!validateWallpaperSnapshot(['fill','#000000',[[0,0,100,100,'file:///wallpaper']]]),'Local path rejected instead of data URL')
const rect={x:100,y:150,width:1000,height:700}
const expected={
 fill:{x:-100,y:150,width:1400,height:700},
 fit:{x:100,y:250,width:1000,height:500},
 stretch:{x:100,y:150,width:1000,height:700},
 center:{x:200,y:300,width:800,height:400},
 tile:{x:200,y:300,width:800,height:400},
 span:{x:100,y:150,width:1000,height:700},
}
for(const [mode,fields] of Object.entries(expected)){
 const actual=wallpaperPlacement(mode,rect,800,400)
 for(const [field,value] of Object.entries(fields))test(Math.abs(actual[field]-value)<1e-6,mode+' '+field)
}
for(let i=1;i<=54;i++){
 const width=200+i*17, height=300+i*11
 const mode=i%2?'fill':'fit'
 const placed=wallpaperPlacement(mode,{x:-width,y:-height/2,width,height},500,800)
 test(!!placed && placed.width>0 && placed.height>0,'Physical bounds '+i)
 if(mode==='fill')test(placed.width>=width-1e-7 && placed.height>=height-1e-7,'Fill covers '+i)
 else test(placed.width<=width+1e-7 && placed.height<=height+1e-7,'Fit contains '+i)
}
console.log(JSON.stringify({outcome:'PASS',checks,monitors:3,wallpaperModes:6,persistentData:false}))
