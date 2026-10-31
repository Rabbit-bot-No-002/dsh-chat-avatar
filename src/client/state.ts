/**
 * Client 半状态：设置缓存、按种类的头像版本号与可用性、Host 通信、订阅通知。
 * 全部可变状态私有于本模块；notify 同时驱动 DOM 层同步（layerSync）。
 */
import { DEFAULT_SETTINGS, sanitizeSettings, type AiSettings, type KindSettings, type Settings } from '../pure/settings.js'
import type { AvatarKind } from '../pure/avatars.js'

export type { Settings, KindSettings, AiSettings }

/** Host 路由前缀。 */
export const API = '/dsh-chat-avatar'

export type SettingsPatch = {
  plugin?: Partial<{ enabled: boolean }>
  ai?: Partial<AiSettings>
  user?: Partial<KindSettings>
}

let settings: Settings = DEFAULT_SETTINGS
const versions: Record<AvatarKind, number> = { ai: 0, user: 0 }
/** 两侧是否已有可用头像（Host 探测结果）：没有就不渲染，避免空头像框。 */
let availability: Record<AvatarKind, boolean> = { ai: false, user: false }

const listeners = new Set<() => void>()
/** DOM 层同步钩子：由 apply 注册，使每次状态刷新都把层对齐到「启用」开关。 */
let layerSync: (() => void) | null = null

export function notify(): void {
  listeners.forEach((fn) => fn())
  layerSync?.()
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setLayerSync(fn: (() => void) | null): void { layerSync = fn }

export function getSettings(): Settings { return settings }
export function getAvatarVersion(kind: AvatarKind): number { return versions[kind] }
export function bumpAvatarVersion(kind: AvatarKind): void { versions[kind] += 1 }
export function hasAvatar(kind: AvatarKind): boolean { return availability[kind] === true }

/** 采纳 Host 返回的可用性；缺失字段保留旧值。 */
export function setAvailability(next: unknown): void {
  if (!next || typeof next !== 'object') return
  const raw = next as Record<string, unknown>
  availability = {
    ai: typeof raw.ai === 'boolean' ? raw.ai : availability.ai,
    user: typeof raw.user === 'boolean' ? raw.user : availability.user,
  }
}

export function fetchJson(path: string, init?: RequestInit): Promise<any> {
  return fetch(API + path, { headers: { 'content-type': 'application/json' }, ...init }).then((r) => r.json())
}

// 请求序号：并发 load/save 时只采纳最新一次的响应（防乱序覆盖）。
let seq = 0

function applyResponse(d: any): void {
  if (d && d.ok && d.settings) {
    settings = sanitizeSettings(d.settings, settings)
    setAvailability(d.available)
    notify()
  }
}

export function loadSettings(): void {
  const mine = ++seq
  fetchJson('/settings').then((d) => { if (mine === seq) applyResponse(d) }).catch(() => {})
}

export function saveSettings(patch: SettingsPatch): void {
  const mine = ++seq
  settings = sanitizeSettings(patch, settings) // 乐观更新，UI 立即响应
  notify()
  fetchJson('/settings', { method: 'POST', body: JSON.stringify(patch) })
    .then((d) => { if (mine === seq) applyResponse(d) })
    .catch(() => {})
}
