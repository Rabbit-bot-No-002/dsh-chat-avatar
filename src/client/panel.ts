/**
 * 设置面板：「设置 → 左侧边栏 → 头像」一节的内容 —— 两侧头像各一张卡片（显示 / 上传 / 尺寸 / 形状）+ 插件总开关。
 */
import { createElement as h, useEffect, useRef, useState, type ChangeEvent } from 'react'
import {
  API,
  bumpAvatarVersion,
  fetchJson,
  getAvatarVersion,
  getSettings,
  hasAvatar,
  notify,
  saveSettings,
  setAvailability,
  subscribe,
  type Settings,
} from './state.js'
import {
  AVATAR_MAX,
  AVATAR_MIN,
  AVATAR_SHAPES,
  NAME_MAX,
  clampSize,
  type AiSettings,
  type AvatarShape,
  type KindSettings,
} from '../pure/settings.js'
import type { AvatarKind } from '../pure/avatars.js'

const SHAPE_LABEL: Record<AvatarShape, string> = { circle: '圆形', square: '方形' }

/** 订阅式读取设置：任何 notify 都让面板重渲染。 */
function useSettings(): Settings {
  const [, force] = useState(0)
  useEffect(() => subscribe(() => force((n) => n + 1)), [])
  return getSettings()
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return h('label', { className: 'dsh-av-toggle' },
    h('input', { type: 'checkbox', checked, onChange: (e: ChangeEvent<HTMLInputElement>) => onChange(e.target.checked) }),
    h('span', { className: 'track' }),
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children?: any }) {
  return h('div', { className: 'dsh-av-row' },
    h('div', null,
      h('div', { className: 'dsh-av-label' }, label),
      hint ? h('div', { className: 'dsh-av-hint' }, hint) : null,
    ),
    h('div', { className: 'dsh-av-group' }, children),
  )
}

interface CardProps {
  kind: AvatarKind
  title: string
  hint: string
  config: AiSettings | KindSettings
  onStatus: (message: string) => void
}

function AvatarCard({ kind, title, hint, config, onStatus }: CardProps) {
  const fileRef = useRef<HTMLInputElement | null>(null)
  const available = hasAvatar(kind)
  const size = clampSize(config.avatarSize)

  /** 只提交这一侧的字段，其余沿用当前值。 */
  const patch = (next: Partial<AiSettings>): void => {
    const merged = { ...config, ...next }
    saveSettings(kind === 'ai' ? { ai: merged as AiSettings } : { user: merged })
  }

  const onFile = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      fetchJson('/avatar-upload', { method: 'POST', body: JSON.stringify({ kind, dataUrl: reader.result }) })
        .then((d) => {
          if (d && d.ok) {
            setAvailability(d.available)
            bumpAvatarVersion(kind) // 破缓存：预览与聊天里的头像同时换新
            onStatus('')
            notify()
          } else {
            onStatus('上传失败：' + ((d && d.error) || '未知错误'))
          }
        })
        .catch((err) => onStatus('上传失败：' + String(err)))
    }
    reader.readAsDataURL(file)
  }

  return h('div', { className: 'dsh-av-card' },
    h('div', { className: 'dsh-av-card-head' },
      h('div', null,
        h('div', { className: 'dsh-av-card-title' }, title),
        h('div', { className: 'dsh-av-card-hint' }, hint),
      ),
      available
        ? h('img', {
            className: 'dsh-av-preview',
            'data-shape': config.shape,
            alt: title + '预览',
            src: `${API}/avatar?kind=${kind}&v=${getAvatarVersion(kind)}`,
          })
        : h('div', { className: 'dsh-av-preview dsh-av-preview-empty', 'data-shape': config.shape }, '未上传'),
    ),
    h(Row, { label: '显示头像', hint: config.showAvatar ? '当前显示' : '当前隐藏' },
      h(Toggle, { checked: config.showAvatar, onChange: (v) => patch({ showAvatar: v }) }),
    ),
    h(Row, { label: '昵称', hint: '显示在头像旁；留空＝不显示' },
      h('input', {
        className: 'dsh-av-text',
        type: 'text',
        placeholder: '留空＝不显示',
        defaultValue: config.name,
        maxLength: NAME_MAX,
        onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ name: e.target.value }),
      }),
    ),
    kind === 'ai'
      ? h(Row, { label: '运行中显示', hint: '生成过程中贴在「运行中」状态行左侧' },
          h(Toggle, {
            checked: (config as AiSettings).showRunning !== false,
            onChange: (v) => patch({ showRunning: v }),
          }),
        )
      : null,
    h(Row, { label: '上传图片', hint: 'PNG / JPG / WebP / GIF，≤ 20MB' },
      h('span', { className: 'dsh-av-btn', onClick: () => fileRef.current?.click() }, '选择图片'),
      h('input', {
        ref: fileRef,
        type: 'file',
        accept: 'image/png,image/jpeg,image/webp,image/gif',
        style: { display: 'none' },
        onChange: onFile,
      }),
    ),
    h(Row, { label: '头像大小', hint: `${AVATAR_MIN} – ${AVATAR_MAX} px` },
      h('input', {
        className: 'dsh-av-range', type: 'range', min: AVATAR_MIN, max: AVATAR_MAX, step: 1,
        value: size,
        onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ avatarSize: clampSize(e.target.value) }),
      }),
      h('input', {
        className: 'dsh-av-num', type: 'number', min: AVATAR_MIN, max: AVATAR_MAX, step: 1,
        value: size,
        onChange: (e: ChangeEvent<HTMLInputElement>) => patch({ avatarSize: clampSize(e.target.value) }),
      }),
      h('span', { className: 'dsh-av-size-val' }, size + ' px'),
    ),
    h(Row, { label: '头像框形状', hint: '默认圆形' },
      h('div', { className: 'dsh-av-seg' },
        AVATAR_SHAPES.map((shape) => h('button', {
          key: shape,
          type: 'button',
          className: 'dsh-av-seg-btn' + (config.shape === shape ? ' active' : ''),
          onClick: () => patch({ shape }),
        }, SHAPE_LABEL[shape])),
      ),
    ),
  )
}

export function AvatarPanel(): any {
  const settings = useSettings()
  const [status, setStatus] = useState('')
  return h('div', { className: 'dsh-av-panel' },
    h(AvatarCard, {
      kind: 'ai',
      title: 'AI 头像',
      hint: '显示在每轮最终 AI 回复左侧；生成中贴在「运行中」状态行旁',
      config: settings.ai,
      onStatus: setStatus,
    }),
    h(AvatarCard, {
      kind: 'user',
      title: '用户头像',
      hint: '显示在你的每条输入右侧',
      config: settings.user,
      onStatus: setStatus,
    }),
    h('div', { className: 'dsh-av-card' },
      h(Row, { label: '启用插件', hint: '关闭后移除全部头像（设置保留）' },
        h(Toggle, {
          checked: settings.plugin.enabled !== false,
          onChange: (v) => saveSettings({ plugin: { enabled: v } }),
        }),
      ),
    ),
    h('div', { className: 'dsh-av-status' }, status),
  )
}
