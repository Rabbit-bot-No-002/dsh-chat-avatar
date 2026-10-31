/**
 * Host 半离线冒烟测试：用假的 ctx.webServer 收集路由，再用假 req/res 打一遍。
 * 数据目录指向 /tmp（用完即删），不碰真实 $DSH_HOME。
 * 运行：npm run smoke
 */
process.env.DSH_HOME = '/tmp/dsh-chat-avatar-smoke'

import { Readable } from 'node:stream'
import { existsSync, readFileSync, rmSync } from 'node:fs'

rmSync('/tmp/dsh-chat-avatar-smoke', { recursive: true, force: true })

const mod = await import('../lib/index.js')
const routes = new Map()
const ctx = {
  webServer: { register: (opts) => { routes.set(opts.path, opts.handler); return () => {} } },
  effect: (fn) => { fn() },
}
mod.apply(ctx)
console.log('注册的路由:', [...routes.keys()].join(', '))

function call(path, { method = 'GET', body, host = '127.0.0.1:3080', origin } = {}) {
  return new Promise((resolve) => {
    const headers = { host }
    if (origin) headers.origin = origin
    const req = Readable.from(body === undefined ? [] : [Buffer.from(body)])
    req.method = method
    req.url = path
    req.headers = headers
    const chunks = []
    const res = {
      status: 0,
      headers: {},
      writeHead(status, h) { this.status = status; if (h) this.headers = h; return this },
      end(data) {
        if (data !== undefined && data !== null) chunks.push(Buffer.isBuffer(data) ? data : Buffer.from(String(data)))
        resolve({ status: this.status, headers: this.headers, body: Buffer.concat(chunks) })
      },
    }
    const handler = routes.get(path.split('?')[0])
    if (!handler) { resolve({ status: 0, headers: {}, body: Buffer.from('no route') }); return }
    handler(req, res)
  })
}

const PNG_1x1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8AAAwAB/AF+7lPWAAAAAElFTkSuQmCC'
const results = []
const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? '✔' : '✘'} ${name}${extra ? '  ' + extra : ''}`) }

// 1) 默认设置 + 可用性（全新数据目录：两侧都没有头像）
let r = await call('/dsh-chat-avatar/settings')
let payload = JSON.parse(r.body.toString())
check('GET /settings 200 且结构完整',
  r.status === 200 && payload.settings.ai && payload.settings.user && payload.settings.plugin
  && Object.keys(payload.settings).sort().join(',') === 'ai,plugin,user')
check('全新环境下两侧 available 均为 false',
  payload.available.ai === false && payload.available.user === false, JSON.stringify(payload.available))

// 2) 写设置：clamp + 丢弃未知节
r = await call('/dsh-chat-avatar/settings', { method: 'POST', body: JSON.stringify({ ai: { avatarSize: 999 }, ui: { foldGlobal: 'folded' } }) })
const settings = JSON.parse(r.body.toString()).settings
check('POST /settings clamp 到 128 且丢弃旧节', settings.ai.avatarSize === 128 && settings.ui === undefined)

// 3) 没有上传图时不提供默认图
r = await call('/dsh-chat-avatar/avatar?kind=ai')
check('未上传 AI 头像时 GET 404（无内置默认图）', r.status === 404)

// 4) 非法 kind → 400
r = await call('/dsh-chat-avatar/avatar?kind=whatever')
check('GET /avatar?kind=whatever 400', r.status === 400)

// 5) 上传 AI 头像 → available 翻真 → 再取回
r = await call('/dsh-chat-avatar/avatar-upload', { method: 'POST', body: JSON.stringify({ kind: 'ai', dataUrl: `data:image/png;base64,${PNG_1x1}` }) })
const uploadRes = JSON.parse(r.body.toString())
check('POST /avatar-upload 200 且 available.ai 变 true', r.status === 200 && uploadRes.ok === true && uploadRes.available.ai === true)
check('上传文件落到数据目录', existsSync('/tmp/dsh-chat-avatar-smoke/dsh-chat-avatar/avatar-ai.png'))
r = await call('/dsh-chat-avatar/avatar?kind=ai')
check('GET /avatar?kind=ai 返回上传图', r.status === 200 && r.headers['Content-Type'] === 'image/png' && r.body.equals(Buffer.from(PNG_1x1, 'base64')))

// 6) 用户头像仍为空
r = await call('/dsh-chat-avatar/avatar?kind=user')
check('用户头像未上传仍 404', r.status === 404)

// 7) 上传用户头像后两侧都可用
r = await call('/dsh-chat-avatar/avatar-upload', { method: 'POST', body: JSON.stringify({ kind: 'user', dataUrl: `data:image/webp;base64,${PNG_1x1}` }) })
check('POST /avatar-upload 用户侧 200', r.status === 200)
check('按扩展名落盘 avatar-user.webp', existsSync('/tmp/dsh-chat-avatar-smoke/dsh-chat-avatar/avatar-user.webp'))
r = await call('/dsh-chat-avatar/settings')
check('GET /settings available 双 true', JSON.parse(r.body.toString()).available.ai === true && JSON.parse(r.body.toString()).available.user === true)

// 8) 非法上传 → 400
r = await call('/dsh-chat-avatar/avatar-upload', { method: 'POST', body: JSON.stringify({ kind: 'user', dataUrl: 'data:image/svg+xml;base64,AAAA' }) })
check('POST /avatar-upload 非法 dataUrl 400', r.status === 400)
r = await call('/dsh-chat-avatar/avatar-upload', { method: 'POST', body: JSON.stringify({ kind: 'nope', dataUrl: `data:image/png;base64,${PNG_1x1}` }) })
check('POST /avatar-upload 非法 kind 400', r.status === 400)

// 9) 信任边界
r = await call('/dsh-chat-avatar/settings', { host: 'evil.example.com' })
check('非回环 Host 403', r.status === 403)
r = await call('/dsh-chat-avatar/settings', { host: '127.0.0.1:3080', origin: 'http://evil.example.com' })
check('跨站 Origin 403', r.status === 403)

// 10) 昵称与运行中显示：净化 + 回读
r = await call('/dsh-chat-avatar/settings', { method: 'POST', body: JSON.stringify({ ai: { name: '  AI   助手 ', showRunning: false }, user: { name: '阿水' } }) })
let named = JSON.parse(r.body.toString()).settings
check('POST /settings 昵称折叠空白', named.ai.name === 'AI 助手' && named.user.name === '阿水')
check('POST /settings showRunning=false 保留', named.ai.showRunning === false)
r = await call('/dsh-chat-avatar/settings')
named = JSON.parse(r.body.toString()).settings
check('GET /settings 回读昵称与运行中开关', named.ai.name === 'AI 助手' && named.ai.showRunning === false)

// 11) 设置落盘
const stored = JSON.parse(readFileSync('/tmp/dsh-chat-avatar-smoke/dsh-chat-avatar/settings.json', 'utf8'))
check('settings.json 落盘且无旧节', stored.ai.avatarSize === 128 && stored.ui === undefined)
check('settings.json 含昵称与运行中开关', stored.ai.name === 'AI 助手' && stored.ai.showRunning === false && stored.user.name === '阿水')

const failed = results.filter(([, ok]) => !ok)
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`)
rmSync('/tmp/dsh-chat-avatar-smoke', { recursive: true, force: true })
process.exit(failed.length === 0 ? 0 : 1)
