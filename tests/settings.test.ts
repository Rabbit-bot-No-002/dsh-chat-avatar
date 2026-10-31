import test from 'node:test'
import assert from 'node:assert/strict'
import {
  AVATAR_MAX,
  AVATAR_MIN,
  DEFAULT_AVATAR_SIZE,
  DEFAULT_SETTINGS,
  NAME_MAX,
  clampSize,
  isAvatarShape,
  sanitizeName,
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
  // 昵称默认空（不显示）；运行中显示默认开（生成过程中也能看到头像）
  assert.equal(DEFAULT_SETTINGS.ai.name, '')
  assert.equal(DEFAULT_SETTINGS.user.name, '')
  assert.equal(DEFAULT_SETTINGS.ai.showRunning, true)
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

test('sanitizeName：折叠空白、按码点截断、非字符串回落', () => {
  assert.equal(sanitizeName('  阿  水  ', ''), '阿 水')
  assert.equal(sanitizeName('AI\u3000助手', ''), 'AI 助手') // 全角空格同样折叠
  assert.equal(sanitizeName(123, '默认'), '默认')
  assert.equal(sanitizeName(undefined, '默认'), '默认')
  assert.equal(sanitizeName('', '默认'), '')
  assert.equal(Array.from(sanitizeName('名'.repeat(NAME_MAX + 5), '')).length, NAME_MAX)
  // emoji 按码点截断：不会留下半个代理对
  const emoji = '🙂'.repeat(NAME_MAX + 2)
  const cut = sanitizeName(emoji, '')
  assert.equal(Array.from(cut).length, NAME_MAX)
  assert.equal(cut, '🙂'.repeat(NAME_MAX))
})

test('sanitizeSettings：昵称与运行中显示', () => {
  const next = sanitizeSettings({
    ai: { name: '  AI   助手 ', showRunning: false },
    user: { name: '阿水' },
  }, DEFAULT_SETTINGS)
  assert.equal(next.ai.name, 'AI 助手')
  assert.equal(next.ai.showRunning, false)
  assert.equal(next.user.name, '阿水')
  // 用户侧没有运行中开关：未知字段丢弃
  assert.equal('showRunning' in next.user, false)
  // 非法类型沿用当前值
  const kept = sanitizeSettings({ ai: { name: 42, showRunning: 'yes' } }, next)
  assert.equal(kept.ai.name, 'AI 助手')
  assert.equal(kept.ai.showRunning, false)
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
  assert.deepEqual(Object.keys(next.ai).sort(),
    ['avatarPath', 'avatarSize', 'name', 'shape', 'showAvatar', 'showRunning'])
  assert.deepEqual(Object.keys(next.user).sort(),
    ['avatarPath', 'avatarSize', 'name', 'shape', 'showAvatar'])
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
