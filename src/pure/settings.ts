/**
 * 设置模型的单一事实源（Host 与 Client 共用同一份净化实现）。
 * 纯函数：无 node: / DOM 依赖。
 *
 * `sanitizeSettings(patch, current)` 同时承担两个角色：
 * Host 收到 POST 时的权威净化，以及 Client 收到响应后的浅合并
 * —— 两者语义相同（「有就用、非法或缺失就沿用当前值」），所以只留一个实现。
 */
import { MAX_SESSION_AVATARS, isAvatarSlot } from './avatars.js'

/** 头像框形状：圆形（默认）或方形。 */
export type AvatarShape = 'circle' | 'square'

export const AVATAR_SHAPES: readonly AvatarShape[] = ['circle', 'square']

export interface KindSettings {
  showAvatar: boolean
  /** 自定义图片绝对路径；空串表示用数据目录里的上传图。 */
  avatarPath: string
  avatarSize: number
  shape: AvatarShape
}

/** 一条会话专属头像：槽位名进文件名，sessionId 决定它绑到哪个会话。 */
export interface SessionAvatar {
  slot: string
  sessionId: string
}

/** AI 侧比用户侧多一份会话头像表。 */
export interface AiKindSettings extends KindSettings {
  sessionAvatars: SessionAvatar[]
}

export interface Settings {
  plugin: { enabled: boolean }
  ai: AiKindSettings
  user: KindSettings
}

export const AVATAR_MIN = 16
export const AVATAR_MAX = 128
export const DEFAULT_AVATAR_SIZE = 32

export function isAvatarShape(value: unknown): value is AvatarShape {
  return value === 'circle' || value === 'square'
}

function pickKind(value: unknown, fallback: KindSettings): KindSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    showAvatar: typeof raw.showAvatar === 'boolean' ? raw.showAvatar : fallback.showAvatar,
    avatarPath: typeof raw.avatarPath === 'string' ? raw.avatarPath : fallback.avatarPath,
    avatarSize: clampSize(raw.avatarSize ?? fallback.avatarSize),
    shape: isAvatarShape(raw.shape) ? raw.shape : fallback.shape,
  }
}

/**
 * 会话专属头像条目净化：slot 必须合法且不重复，sessionId 允许暂时为空（面板上刚添还没填）。
 * sessionId 重复不丢条目（解析时取第一条），避免编辑过程中行突然消失。
 */
function sanitizeSessionAvatars(value: unknown, fallback: SessionAvatar[]): SessionAvatar[] {
  if (!Array.isArray(value)) return fallback
  const out: SessionAvatar[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    if (!isAvatarSlot(raw.slot)) continue
    if (out.some((entry) => entry.slot === raw.slot)) continue
    const sessionId = typeof raw.sessionId === 'string' ? raw.sessionId.trim().slice(0, 200) : ''
    out.push({ slot: raw.slot, sessionId })
    if (out.length >= MAX_SESSION_AVATARS) break
  }
  return out
}

function pickAiKind(value: unknown, fallback: AiKindSettings): AiKindSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return { ...pickKind(value, fallback), sessionAvatars: sanitizeSessionAvatars(raw.sessionAvatars, fallback.sessionAvatars) }
}

const DEFAULT_KIND: KindSettings = { showAvatar: true, avatarPath: '', avatarSize: DEFAULT_AVATAR_SIZE, shape: 'circle' }

const DEFAULT_AI: AiKindSettings = { ...DEFAULT_KIND, sessionAvatars: [] }

export const DEFAULT_SETTINGS: Settings = { plugin: { enabled: true }, ai: DEFAULT_AI, user: DEFAULT_KIND }

/** 尺寸钳到 16–128；非法值回落默认。 */
export function clampSize(n: unknown): number {
  const num = typeof n === 'number' ? n : Number(n)
  if (!Number.isFinite(num)) return DEFAULT_AVATAR_SIZE
  return Math.min(AVATAR_MAX, Math.max(AVATAR_MIN, Math.round(num)))
}

/**
 * 逐字段净化 + 浅合并：非法/缺失字段沿用 `current`，未知字段（含历史遗留的 roundLabel 等）直接丢弃。
 * 对同一输入幂等；`current` 传 DEFAULT_SETTINGS 即为「读文件」路径。
 */
export function sanitizeSettings(patch: unknown, current: Settings): Settings {
  const p = patch && typeof patch === 'object' ? (patch as Record<string, unknown>) : {}
  const plugin = p.plugin && typeof p.plugin === 'object' ? (p.plugin as Record<string, unknown>) : {}
  return {
    plugin: { enabled: typeof plugin.enabled === 'boolean' ? plugin.enabled : current.plugin.enabled },
    ai: pickAiKind(p.ai, current.ai),
    user: pickKind(p.user, current.user),
  }
}
