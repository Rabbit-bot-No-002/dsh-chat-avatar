/**
 * 设置模型的单一事实源（Host 与 Client 共用同一份净化实现）。
 * 纯函数：无 node: / DOM 依赖。
 *
 * `sanitizeSettings(patch, current)` 同时承担两个角色：
 * Host 收到 POST 时的权威净化，以及 Client 收到响应后的浅合并
 * —— 两者语义相同（「有就用、非法或缺失就沿用当前值」），所以只留一个实现。
 */

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

export interface Settings {
  plugin: { enabled: boolean }
  ai: KindSettings
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

const DEFAULT_KIND: KindSettings = { showAvatar: true, avatarPath: '', avatarSize: DEFAULT_AVATAR_SIZE, shape: 'circle' }

export const DEFAULT_SETTINGS: Settings = { plugin: { enabled: true }, ai: DEFAULT_KIND, user: DEFAULT_KIND }

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
    ai: pickKind(p.ai, current.ai),
    user: pickKind(p.user, current.user),
  }
}
