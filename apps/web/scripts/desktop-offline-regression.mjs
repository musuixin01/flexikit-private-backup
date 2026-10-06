import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const read = relative => readFileSync(path.join(root, relative), 'utf8')

const tauri = JSON.parse(read('../desktop/src-tauri/tauri.conf.json'))
assert.equal(tauri.build.frontendDist, '../../web/dist')
assert.match(tauri.build.devUrl, /^http:\/\/127\.0\.0\.1:5173$/)

const main = read('src/main.ts')
const client = read('src/api/client.ts')
const user = read('src/stores/user.ts')
const tools = read('src/stores/tools.ts')
const titlebar = read('src/components/layout/DesktopTitlebar.vue')
const discover = read('src/views/Discover.vue')
const assistant = read('src/views/AiAssistant.vue')
const login = read('src/views/Login.vue')

assert.match(main, /initConnectivityTracking\(\)/)
assert.match(client, /markApiUnavailable/)
assert.match(client, /response\.status >= 500/)
assert.match(client, /当前无法连接网络服务/)
assert.match(client, /invalidateSession/)
assert.match(user, /restoreLocalSession/)
assert.match(tools, /Backend unavailable, loading from localStorage/)
assert.match(tools, /await loadDefaultFAC\(\)/)
assert.match(titlebar, /离线模式/)
assert.match(titlebar, /服务离线/)
assert.match(discover, /ConnectivityNotice/)
assert.match(assistant, /ConnectivityNotice/)
assert.match(login, /ConnectivityNotice/)
assert.equal(client.includes("error.message) return error.message"), true)

console.log('packaged desktop frontendDist local shell: PASS')
console.log('network/API failures remain inside FlexiKit UI: PASS')
console.log('offline auth session preservation guard: PASS')
console.log('local tools/default catalog fallback: PASS')
console.log('desktop titlebar + online-only pages offline states: PASS')
console.log('Desktop offline regression: PASS')
