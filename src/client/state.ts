/**
 * Client 半状态：设置缓存、按种类与按槽位的头像版本号与可用性、Host 通信、订阅通知。
 * 全部可变状态私有于本模块；notify 同时驱动 DOM 层同步（layerSync）。
 */
import { isAvatarSlot } from '../pure/avatars.js'
import { DEFAULT_SETTINGS, sanitizeSettings, type AiKindSettings, type KindSettings, type Settings } from '../pure/settings.js'
import type { AvatarKind } from '../pure/avatars.js'

export type { Settings, KindSettings, AiKindSettings }

/** Host 路由前缀。 */
export const API = '/dsh-chat-avatar'

export type SettingsPatch = {
  plugin?: Partial<{ enabled: boolean }>
  ai?: Partial<AiKindSettings>
  user?: Partial<KindSettings>
}

let settings: Settings = DEFAULT_SETTINGS
const versions: Record<AvatarKind, number> = { ai: 0, user: 0 }
/** 槽位各自的版本号：某个会话换图时只破它自己的缓存，默认头像不受影响。 */
const slotVersions = new Map<string, number>()
/** 模块加载时刻：槽位从没换过图时也拿它当版本，保证 URL 唯一。 */
const bootStamp = Date.now().toString(36)
/** 两侧是否已有可用头像（Host 探测结果）：没有就不渲染，避免空头像框。 */
let availability: Record<AvatarKind, boolean> = { ai: false, user: false }
/** 哪些槽位真的落过图。 */
let slotAvailability: Record<string, boolean> = {}

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

/** 版本号：传了合法 slot 就取槽位的，否则取该侧默认的。 */
export function getAvatarVersion(kind: AvatarKind, slot = ''): number | string {
  if (kind === 'ai' && isAvatarSlot(slot)) return slotVersions.get(slot) ?? bootStamp
  return versions[kind]
}

export function bumpAvatarVersion(kind: AvatarKind, slot = ''): void {
  if (kind === 'ai' && isAvatarSlot(slot)) {
    slotVersions.set(slot, (slotVersions.get(slot) ?? 0) + 1)
    return
  }
  versions[kind] += 1
}

export function hasAvatar(kind: AvatarKind): boolean { return availability[kind] === true }

export function hasSlotAvatar(slot: string): boolean {
  return isAvatarSlot(slot) && slotAvailability[slot] === true
}

/** 该会话 id 绑定的槽位；没绑定返回 null。空 sessionId 的条目永不匹配。 */
export function slotForSession(sessionId: string): string | null {
  if (typeof sessionId !== 'string' || sessionId === '') return null
  const entry = settings.ai.sessionAvatars.find((item) => item.sessionId === sessionId)
  return entry ? entry.slot : null
}

/**
 * 某一行该用哪张图：绑定的槽位有图 → 用它；否则回退默认头像；两者都没有 → null（不渲染）。
 */
export function avatarSrc(kind: AvatarKind, slot: string | null): string | null {
  if (kind === 'ai' && hasSlotAvatar(slot ?? '')) {
    const s = slot as string
    return `${API}/avatar?kind=ai&slot=${encodeURIComponent(s)}&v=${getAvatarVersion('ai', s)}`
  }
  if (!hasAvatar(kind)) return null
  return `${API}/avatar?kind=${kind}&v=${getAvatarVersion(kind)}`
}

/** 采纳 Host 返回的可用性；缺失字段保留旧值（旧 Host 不回 aiSlots 时不清空）。 */
export function setAvailability(next: unknown): void {
  if (!next || typeof next !== 'object') return
  const raw = next as Record<string, unknown>
  availability = {
    ai: typeof raw.ai === 'boolean' ? raw.ai : availability.ai,
    user: typeof raw.user === 'boolean' ? raw.user : availability.user,
  }
  if (raw.aiSlots && typeof raw.aiSlots === 'object') {
    const slots: Record<string, boolean> = {}
    for (const [slot, ok] of Object.entries(raw.aiSlots as Record<string, unknown>)) {
      if (ok === true && isAvatarSlot(slot)) slots[slot] = true
    }
    slotAvailability = slots
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
