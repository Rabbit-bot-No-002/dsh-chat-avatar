/**
 * 头像种类与文件名规则（Host / Client 共享的纯逻辑，无 node: 与 DOM 依赖）。
 */

export type AvatarKind = 'ai' | 'user'

/** 允许的图片扩展名（顺序即 Host 查找优先级）。 */
export const AVATAR_EXTS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'] as const

/** MIME → 扩展名（点号开头，与 AVATAR_EXTS 同集合）。 */
const MIME_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

/** 单次上传体积上限。 */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

export function isAvatarKind(value: unknown): value is AvatarKind {
  return value === 'ai' || value === 'user'
}

/** 某一种头像在数据目录里的文件名主干：`avatar-ai` / `avatar-user`。 */
export function avatarFileStem(kind: AvatarKind): string {
  return kind === 'ai' ? 'avatar-ai' : 'avatar-user'
}

/** 该种类所有允许的文件名（用于查找与清理旧扩展名）。 */
export function avatarFileNames(kind: AvatarKind): string[] {
  const stem = avatarFileStem(kind)
  return AVATAR_EXTS.map((ext) => stem + ext)
}

/** 小写扩展名比较（含点号）。 */
export function isSupportedExt(ext: string): boolean {
  return (AVATAR_EXTS as readonly string[]).includes(ext.toLowerCase())
}

/** data URL 的 MIME → 扩展名；不支持返回 null。 */
export function extFromMime(mime: string): string | null {
  return MIME_EXT[mime.toLowerCase()] ?? null
}

/** 扩展名 → Content-Type（未识别时按 png 兜底）。 */
export function contentTypeForExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case '.png': return 'image/png'
    case '.jpg':
    case '.jpeg': return 'image/jpeg'
    case '.webp': return 'image/webp'
    case '.gif': return 'image/gif'
    default: return 'image/png'
  }
}

/**
 * 解析 `data:image/<mime>;base64,<payload>`。
 * 只接受受支持的图片 MIME 与合法 base64 字符集；不在这里解码（保持纯函数、可在浏览器复用）。
 */
export function parseImageDataUrl(dataUrl: unknown): { ext: string; base64: string } | null {
  if (typeof dataUrl !== 'string') return null
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  if (!m) return null
  const ext = extFromMime(m[1])
  if (ext === null) return null
  const base64 = m[2]
  // base64 长度必须是 4 的倍数，且 payload 非空。
  if (base64 === '' || base64.length % 4 !== 0) return null
  return { ext, base64 }
}
