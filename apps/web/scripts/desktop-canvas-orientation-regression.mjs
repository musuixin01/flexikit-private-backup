import assert from 'node:assert/strict'
import { build } from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const output = await build({
  entryPoints: [path.join(root, 'src/desktop/canvasTemplates.ts')],
  platform: 'node', format: 'esm', bundle: true, write: false, target: 'es2022',
  plugins: [{
    name: 'isolated-registry',
    setup(builder) {
      builder.onResolve({ filter: /^@\/desktop\/widgetRegistry$/ }, () => ({ path: 'registry', namespace: 'memory' }))
      builder.onLoad({ filter: /.*/, namespace: 'memory' }, () => ({
        loader: 'js',
        contents: `export function getWidgetDefinition(type) { return { type, title:type, defaultWidth:320, defaultHeight:180 }};export function getWidgetConfigDefaults() { return {} }`,
      }))
    },
  }], logLevel:'silent',
})
const source = output.outputFiles[0].text
const m = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))
const memory = new Map()
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key,value) => memory.set(key,String(value)),
  removeItem: key => memory.delete(key),
}
const monitor = { id:'simulated',name:'Synthetic',x:-1920,y:0,width:1648,height:810,scaleFactor:1.25,isPrimary:true }
const smaller = {...monitor,width:960,height:640}
const request = (id,orientation,position,extra={}) => ({
  id,orientation,position,offsetX:0,offsetY:0,...extra,
})
const allIds = ['command','creator','focus']
const allPositions = ['top-left','top-center','top-right','center-left','center','center-right','bottom-left','bottom-center','bottom-right']
function overlap(a,b) {
  return a.x < b.x+b.width && a.x+a.width > b.x && a.y < b.y+b.height && a.y+a.height > b.y
}
let checks = 0
for(const area of [monitor,smaller]) {
  for(const id of allIds) {
    for(const orientation of ['horizontal','vertical']) {
      for(const position of allPositions) {
        const items=m.createCanvasTemplateWidgets(request(id,orientation,position),area)
        assert.equal(items.length,m.CANVAS_CONSOLE_TEMPLATES.find(t=>t.id===id).items.length)
        const widgets=items.map(item=>item.options.frame)
        for (const widget of widgets) {
          assert.ok(widget.x >= area.x && widget.y >= area.y, 'Layout must not escape top/left monitor edges')
          assert.ok(widget.x + widget.width <= area.x+area.width+20 && widget.y+widget.height<=area.y+area.height+20, 'Layout must fit display')
        }
        for(let i=0;i<widgets.length;i++) for(let j=i+1;j<widgets.length;j++)
          assert.equal(overlap(widgets[i],widgets[j]),false,
            'Widgets overlap: '+id+' '+orientation+' '+position+' '+area.width+' '+i+'/'+j)
        checks++
      }
    }
  }
}
for(const orientation of ['horizontal','vertical']) {
 const items=m.createCanvasTemplateWidgets(request('custom',orientation,'bottom-right',
  {items:['clock','search','tool-dock','notes','disk','ai']}),monitor)
 assert.equal(items.length,6)
 assert.equal(items.find(entry=>entry.type==='tool-dock').options.config.toolDockOrientation,orientation)
 for (const [index,item] of items.entries()) for(let j=index+1;j<items.length;j++) assert.equal(overlap(item.options.frame,items[j].options.frame),false)
 checks++
}
const start=m.createCanvasTemplateWidgets(request('command','horizontal','top-left'),monitor)
const end=m.createCanvasTemplateWidgets(request('command','horizontal','bottom-right'),monitor)
assert.ok(start[0].options.frame.x < end[0].options.frame.x)
assert.ok(start[0].options.frame.y < end[0].options.frame.y)
const offset=m.createCanvasTemplateWidgets(request('command','horizontal','center',{offsetX:60,offsetY:-40}),monitor)
const base=m.createCanvasTemplateWidgets(request('command','horizontal','center'),monitor)
assert.notEqual(offset[0].options.frame.x,base[0].options.frame.x)
assert.notEqual(offset[0].options.frame.y,base[0].options.frame.y)
checks+=4
m.saveCustomCanvasConsole({
 name:'  我的纵向桌面  ',items:['clock','tool-dock','notes','clock','unknown'],
 orientation:'vertical',position:'bottom-left',offsetX:-80,offsetY:20,
})
const saved=m.loadCustomCanvasConsole()
assert.deepEqual(saved.items,['clock','tool-dock','notes'])
assert.equal(saved.name,'我的纵向桌面')
assert.equal(saved.orientation,'vertical')
assert.equal(saved.position,'bottom-left')
assert.equal(saved.offsetX,-80)
checks+=5
memory.set(m.CUSTOM_CONSOLE_STORAGE_KEY,'{"version":100,"items":["clock"]}')
assert.equal(m.loadCustomCanvasConsole(),null)
memory.set(m.CUSTOM_CONSOLE_STORAGE_KEY,'{broken')
assert.equal(m.loadCustomCanvasConsole(),null)
checks+=2
assert.equal(m.createCanvasTemplateWidgets(request('custom','horizontal','center',{items:['unknown']}),monitor).length,0)
checks++
console.log(JSON.stringify({outcome:'PASS',checks,storage:'memory-only',testedAreas:2,orientations:2,dockingPositions:9,templates:3,custom:true}))
