import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AVATAR_SLOT_RE,
  MAX_SESSION_AVATARS,
  avatarSlotFileNames,
  avatarSlotStem,
  isAvatarSlot,
} from '../src/pure/avatars.js'
import {
  AVATAR_EXTS,
  avatarFileNames,
  avatarFileStem,
  contentTypeForExt,
  extFromMime,
  isAvatarKind,
  isSupportedExt,
  parseImageDataUrl,
} from '../src/pure/avatars.js'

test('isAvatarKind：只认 ai / user', () => {
  assert.equal(isAvatarKind('ai'), true)
  assert.equal(isAvatarKind('user'), true)
  assert.equal(isAvatarKind('AI'), false)
  assert.equal(isAvatarKind(''), false)
  assert.equal(isAvatarKind(undefined), false)
})

test('文件名规则：主干与全部扩展名', () => {
  assert.equal(avatarFileStem('ai'), 'avatar-ai')
  assert.equal(avatarFileStem('user'), 'avatar-user')
  assert.deepEqual(avatarFileNames('user'), AVATAR_EXTS.map((ext) => 'avatar-user' + ext))
  assert.equal(avatarFileNames('ai').length, AVATAR_EXTS.length)
})

test('扩展名与 Content-Type', () => {
  assert.equal(isSupportedExt('.PNG'), true)
  assert.equal(isSupportedExt('.bmp'), false)
  assert.equal(contentTypeForExt('.jpg'), 'image/jpeg')
  assert.equal(contentTypeForExt('.JPEG'), 'image/jpeg')
  assert.equal(contentTypeForExt('.webp'), 'image/webp')
  assert.equal(contentTypeForExt('.gif'), 'image/gif')
  assert.equal(contentTypeForExt('.png'), 'image/png')
  assert.equal(contentTypeForExt('.unknown'), 'image/png')
})

test('extFromMime：支持的图片 MIME', () => {
  assert.equal(extFromMime('image/png'), '.png')
  assert.equal(extFromMime('image/jpeg'), '.jpg')
  assert.equal(extFromMime('image/webp'), '.webp')
  assert.equal(extFromMime('image/gif'), '.gif')
  assert.equal(extFromMime('image/svg+xml'), null)
  assert.equal(extFromMime('text/plain'), null)
})

test('parseImageDataUrl：合法输入', () => {
  const parsed = parseImageDataUrl('data:image/png;base64,AAAA')
  assert.deepEqual(parsed, { ext: '.png', base64: 'AAAA' })
  assert.deepEqual(parseImageDataUrl('data:image/jpeg;base64,AAAA'), { ext: '.jpg', base64: 'AAAA' })
})

test('parseImageDataUrl：非法输入一律 null', () => {
  assert.equal(parseImageDataUrl(undefined), null)
  assert.equal(parseImageDataUrl(123), null)
  assert.equal(parseImageDataUrl('data:image/svg+xml;base64,AAAA'), null)
  assert.equal(parseImageDataUrl('data:image/png,AAAA'), null)
  assert.equal(parseImageDataUrl('data:image/png;base64,'), null)
  assert.equal(parseImageDataUrl('data:image/png;base64,AAA'), null)
  assert.equal(parseImageDataUrl('data:image/png;base64,AA*A'), null)
})

test('isAvatarSlot：只接受小写字母数字与 - _，长度 1–32', () => {
  assert.equal(isAvatarSlot('abc'), true)
  assert.equal(isAvatarSlot('s1a2b3'), true)
  assert.equal(isAvatarSlot('a-b_c'), true)
  assert.equal(isAvatarSlot('a'.repeat(32)), true)
  assert.equal(isAvatarSlot('a'.repeat(33)), false)
  assert.equal(isAvatarSlot(''), false)
  assert.equal(isAvatarSlot('-lead'), false) // 不能以 - 开头
  assert.equal(isAvatarSlot('Upper'), false)
  assert.equal(isAvatarSlot('../etc'), false) // 直接进文件名，必须挡住路径穿越
  assert.equal(isAvatarSlot(null), false)
  assert.equal(isAvatarSlot(123), false)
  assert.equal(AVATAR_SLOT_RE.test('ok'), true)
  assert.equal(MAX_SESSION_AVATARS, 20)
})

test('avatarSlotStem / avatarSlotFileNames：文件名主干带槽位，不与默认图冲突', () => {
  assert.equal(avatarSlotStem('abc'), 'avatar-ai-abc')
  const names = avatarSlotFileNames('abc')
  assert.equal(names.length, 5)
  assert.ok(names.every((n) => n.startsWith('avatar-ai-abc.')))
  assert.ok(!names.includes('avatar-ai.png')) // 默认 AI 头像不带槽位
})
