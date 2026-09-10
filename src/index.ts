/**
 * dsh-chat-avatar —— Host 半：webServer 路由 + 磁盘存储 + 设置读写。
 *
 * 路由（每个都过同一道「回环 + 同源」信任闸，全部挂 ctx.effect，卸载即净）：
 *   GET  /dsh-chat-avatar/avatar?kind=ai|user   → 头像图片字节（没上传 → 404）
 *   GET  /dsh-chat-avatar/settings              → { settings, available }
 *   POST /dsh-chat-avatar/settings              → 部分 patch 写入
 *   POST /dsh-chat-avatar/avatar-upload         → { kind, dataUrl } 上传
 *
 * 存储：$DSH_HOME/dsh-chat-avatar/{settings.json, avatar-ai.<ext>, avatar-user.<ext>}
 * 纯逻辑在 src/pure/*（与 Client 半共享同一份实现）。
 */
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { extname, join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'
import {
  MAX_UPLOAD_BYTES,
  avatarFileNames,
  avatarFileStem,
  contentTypeForExt,
  isAvatarKind,
  isSupportedExt,
  parseImageDataUrl,
  type AvatarKind,
} from './pure/avatars.js'
import { DEFAULT_SETTINGS, sanitizeSettings, type Settings } from './pure/settings.js'

const DATA_DIR = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-chat-avatar')
const DATA_DIR_ABS = resolve(DATA_DIR)
const SETTINGS_FILE = join(DATA_DIR, 'settings.json')

interface RouteOpts {
  kind: 'exact' | 'prefix'
  path: string
  handler: (req: any, res: any) => void
}
/**
 * 结构化的宿主上下文（只声明用到的部分）：刻意不从 `cordis` 取类型，
 * 这样本插件不需要任何 `@deepseek-ai/*` / cordis peer，也就不会遇到宿主版本漂移。
 */
interface AppContext {
  webServer: { register(opts: RouteOpts): () => void }
  effect(fn: () => (() => void) | void): void
}

export const name = 'dsh-chat-avatar'
export const inject = ['webServer']

const JSON_HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
const TEXT_HEADERS = { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }

// 信任判据：Host 必须是本机回环（防 DNS rebinding）；浏览器请求的 Origin 还须与 Host 同源（防 CSRF）。
// 非浏览器客户端不带 Origin，直接放行。
const LOCAL_HOST_RE = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i

function trustedRequest(req: any): boolean {
  const { host = '', origin = '' } = req.headers ?? {}
  if (typeof host !== 'string' || !LOCAL_HOST_RE.test(host)) return false
  if (origin === '') return true
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function send(res: any, status: number, body: string | Buffer, headers: Record<string, string> = JSON_HEADERS): void {
  try {
    res.writeHead(status, { ...headers, ...(typeof body === 'string' ? { 'Content-Length': String(Buffer.byteLength(body)) } : {}) })
    res.end(body)
  } catch {
    // 套接字已断开：忽略
  }
}

const sendJson = (res: any, status: number, payload: unknown): void => send(res, status, JSON.stringify(payload))

function respondError(res: any, err: unknown): void {
  // 413（请求体/图片超限）保留状态码，其余一律 400。
  const code = (err as any)?.statusCode === 413 ? 413 : 400
  sendJson(res, code, { ok: false, error: String((err as any)?.message ?? err) })
}

function readBody(req: any): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_UPLOAD_BYTES) {
        const err = Object.assign(new Error(`body exceeds ${MAX_UPLOAD_BYTES} bytes`), { statusCode: 413 })
        req.pause()
        reject(err)
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

const readJson = async (req: any): Promise<any> => JSON.parse((await readBody(req)) || '{}')

function readSettings(): Settings {
  try {
    return sanitizeSettings(JSON.parse(readFileSync(SETTINGS_FILE, 'utf8')), DEFAULT_SETTINGS)
  } catch {
    // 损坏的配置不静默丢弃：留一份 .bak 再回默认值。
    try {
      if (existsSync(SETTINGS_FILE)) renameSync(SETTINGS_FILE, SETTINGS_FILE + '.bak')
    } catch {
      // 备份失败也继续
    }
    return sanitizeSettings({}, DEFAULT_SETTINGS)
  }
}

function writeSettings(next: Settings): void {
  mkdirSync(DATA_DIR, { recursive: true })
  writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2) + '\n', 'utf8')
}

/** 数据目录里该种类的所有候选文件（按扩展名优先级）。 */
const avatarFilePaths = (kind: AvatarKind): string[] => avatarFileNames(kind).map((name) => join(DATA_DIR, name))

/**
 * 该种类实际要返回的文件：settings[kind].avatarPath（限数据目录内 + 受支持扩展名 + 存在）
 * → 数据目录里的上传图 → null（没有就什么都不显示；刻意没有内置默认图）。
 */
function resolveAvatarPath(settings: Settings, kind: AvatarKind): string | null {
  const configured = settings[kind].avatarPath
  if (configured) {
    const p = resolve(configured)
    const inDir = p.toLowerCase().startsWith(DATA_DIR_ABS.toLowerCase() + sep.toLowerCase())
    if (inDir && isSupportedExt(extname(p)) && existsSync(p)) return p
  }
  return avatarFilePaths(kind).find((p) => existsSync(p)) ?? null
}

/** 两侧是否已有可用头像：客户端据此决定渲不渲染，避免出现空头像框。 */
function avatarAvailability(settings: Settings): Record<AvatarKind, boolean> {
  return { ai: resolveAvatarPath(settings, 'ai') !== null, user: resolveAvatarPath(settings, 'user') !== null }
}

export function apply(ctx: AppContext): void {
  mkdirSync(DATA_DIR, { recursive: true })
  const disposers: Array<() => void> = []

  /** 统一包装：信任检查 + 统一错误响应，路由体只写业务。 */
  const on = (path: string, handler: (req: any, res: any) => void | Promise<void>): void => {
    disposers.push(ctx.webServer.register({
      kind: 'exact',
      path,
      handler: (req: any, res: any) => {
        if (!trustedRequest(req)) return sendJson(res, 403, { ok: false, error: 'untrusted request origin' })
        Promise.resolve()
          .then(() => handler(req, res))
          .catch((err) => respondError(res, err))
      },
    }))
  }

  const settingsPayload = (settings: Settings): unknown => ({ ok: true, settings, available: avatarAvailability(settings) })

  // ── 头像字节 ──
  on('/dsh-chat-avatar/avatar', (req, res) => {
    const kind = new URL(req.url ?? '/', 'http://localhost').searchParams.get('kind') ?? 'ai'
    if (!isAvatarKind(kind)) return sendJson(res, 400, { ok: false, error: 'invalid kind' })
    const path = resolveAvatarPath(readSettings(), kind)
    if (path === null) return send(res, 404, 'avatar unavailable', TEXT_HEADERS)
    const bytes = readFileSync(path)
    // URL 带版本号（?v=N），上传后自增 → 可以长期缓存。
    send(res, 200, bytes, {
      'Content-Type': contentTypeForExt(extname(path)),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': String(bytes.length),
    })
  })

  // ── 设置：GET 读 / POST 部分写 ──
  on('/dsh-chat-avatar/settings', async (req, res) => {
    if (req.method !== 'POST') return sendJson(res, 200, settingsPayload(readSettings()))
    const next = sanitizeSettings(await readJson(req), readSettings())
    writeSettings(next)
    sendJson(res, 200, settingsPayload(next))
  })

  // ── 上传头像（dataUrl base64）──
  on('/dsh-chat-avatar/avatar-upload', async (req, res) => {
    const { kind, dataUrl } = (await readJson(req)) ?? {}
    if (!isAvatarKind(kind)) throw new Error('invalid kind')
    const parsed = parseImageDataUrl(dataUrl)
    if (parsed === null) throw new Error('invalid dataUrl')
    const bytes = Buffer.from(parsed.base64, 'base64')
    if (bytes.length === 0) throw new Error('empty image')
    if (bytes.length > MAX_UPLOAD_BYTES) throw Object.assign(new Error(`image exceeds ${MAX_UPLOAD_BYTES} bytes`), { statusCode: 413 })
    // 同一种类的旧扩展名先清掉，避免两份文件互相遮蔽。
    for (const old of avatarFilePaths(kind)) rmSync(old, { force: true })
    writeFileSync(join(DATA_DIR, avatarFileStem(kind) + parsed.ext), bytes)
    sendJson(res, 200, { ok: true, ext: parsed.ext, available: avatarAvailability(readSettings()) })
  })

  ctx.effect(() => () => {
    for (const dispose of disposers) dispose()
  })
}
