import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AVATAR_MAX,
  AVATAR_MIN,
  DEFAULT_AVATAR_SIZE,
  DEFAULT_SETTINGS,
  clampSize,
  isAvatarShape,
  sanitizeSettings,
  type Settings,
} from '../src/pure/settings.js'

test('默认值：两侧头像 + 插件开关', () => {
  assert.equal(DEFAULT_SETTINGS.plugin.enabled, true)
  assert.equal(DEFAULT_SETTINGS.ai.showAvatar, true)
  assert.equal(DEFAULT_SETTINGS.user.showAvatar, true)
  assert.equal(DEFAULT_SETTINGS.ai.avatarSize, DEFAULT_AVATAR_SIZE)
  assert.equal(DEFAULT_SETTINGS.user.avatarSize, DEFAULT_AVATAR_SIZE)
  assert.equal(DEFAULT_SETTINGS.user.avatarSize, DEFAULT_AVATAR_SIZE)
  assert.equal(DEFAULT_SETTINGS.ai.shape, 'circle')
  assert.equal(DEFAULT_SETTINGS.user.shape, 'circle')
})

test('isAvatarShape：只认 circle / square', () => {
  assert.equal(isAvatarShape('circle'), true)
  assert.equal(isAvatarShape('square'), true)
  assert.equal(isAvatarShape('rounded'), false)
  assert.equal(isAvatarShape(undefined), false)
})

test('clampSize：区间与非法值', () => {
  assert.equal(clampSize(AVATAR_MIN - 100), AVATAR_MIN)
  assert.equal(clampSize(AVATAR_MAX + 100), AVATAR_MAX)
  assert.equal(clampSize(40.4), 40)
  assert.equal(clampSize('abc'), DEFAULT_AVATAR_SIZE)
  assert.equal(clampSize(Number.NaN), DEFAULT_AVATAR_SIZE)
})

test('sanitizeSettings：非法类型回落、未知字段丢弃', () => {
  const base: Settings = DEFAULT_SETTINGS
  const next = sanitizeSettings({
    plugin: { enabled: 'yes' },
    ai: { showAvatar: 'x', avatarPath: 123, avatarSize: 999, shape: 'triangle' },
    user: { avatarSize: 2, showAvatar: false, shape: 'square' },
    // 历史遗留字段（含已删除的轮次标签开关）：应被丢弃
    roundLabel: true,
    ui: { foldGlobal: 'folded' },
    export: { showButton: true },
    historyCount: 20,
  }, base)

  assert.equal(next.plugin.enabled, base.plugin.enabled)
  assert.equal(next.ai.showAvatar, base.ai.showAvatar)
  assert.equal(next.ai.avatarPath, base.ai.avatarPath)
  assert.equal(next.ai.avatarSize, AVATAR_MAX)
  assert.equal(next.user.showAvatar, false)
  assert.equal(next.user.avatarSize, AVATAR_MIN)
  assert.equal(next.ai.shape, 'circle') // 非法形状回落 current
  assert.equal(next.user.shape, 'square')
  assert.deepEqual(Object.keys(next).sort(), ['ai', 'plugin', 'user'])
  assert.deepEqual(Object.keys(next.ai).sort(), ['avatarPath', 'avatarSize', 'shape', 'showAvatar'])
})

test('sanitizeSettings：合法 patch 生效', () => {
  const next = sanitizeSettings({
    plugin: { enabled: false },
    ai: { showAvatar: false, avatarPath: '/tmp/x.png', avatarSize: 48, shape: 'square' },
  }, DEFAULT_SETTINGS)
  assert.equal(next.plugin.enabled, false)
  assert.equal(next.ai.showAvatar, false)
  assert.equal(next.ai.avatarPath, '/tmp/x.png')
  assert.equal(next.ai.avatarSize, 48)
  assert.equal(next.ai.shape, 'square')
})

test('浅合并：patch 覆盖、缺省保留 base', () => {
  const merged = sanitizeSettings({
    plugin: { enabled: false },
    user: { avatarSize: 200 },
  }, DEFAULT_SETTINGS)
  assert.equal(merged.plugin.enabled, false)
  assert.equal(merged.user.avatarSize, AVATAR_MAX)
  assert.equal(merged.user.showAvatar, DEFAULT_SETTINGS.user.showAvatar)
  assert.equal(merged.ai.avatarSize, DEFAULT_SETTINGS.ai.avatarSize)
  assert.equal(merged.ai.shape, DEFAULT_SETTINGS.ai.shape)
  assert.equal(merged.user.shape, 'circle')
})

test('空输入是恒等变换（且对同一输入幂等）', () => {
  assert.deepEqual(sanitizeSettings(undefined, DEFAULT_SETTINGS), DEFAULT_SETTINGS)
  assert.deepEqual(sanitizeSettings(null, DEFAULT_SETTINGS), DEFAULT_SETTINGS)
  const once = sanitizeSettings({ ai: { avatarSize: 999 } }, DEFAULT_SETTINGS)
  assert.deepEqual(sanitizeSettings(once, DEFAULT_SETTINGS), once)
})
