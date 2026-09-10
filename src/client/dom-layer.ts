/**
 * 头像 DOM 层：MutationObserver 驱动的增量装饰层（唯一职责：把头像贴到聊天行上）。
 *
 * - 用户头像：每条 user/steering 行 → 右外侧；
 * - AI 头像：按轮次分组，挂该轮「最后一条有正文的 assistant-step」左侧（轮次开始时只有第一条，
 *   后续步骤出现即后移，整轮结束停在最终回答上）——一轮只有一个。
 * 随「启用」开关装卸；停用或隐藏时清空包裹层（不留空框）。
 */
import { API, getAvatarVersion, getSettings, hasAvatar } from './state.js'
import { clampSize } from '../pure/settings.js'
import type { AvatarKind } from '../pure/avatars.js'

const ROW_SELECTOR = '[data-chat-flow-kind]'
const USER_ROW_SELECTOR = '[data-chat-flow-kind="user"],[data-chat-flow-kind="steering"]'
const AI_ROW_SELECTOR = '[data-chat-flow-kind="assistant-step"]'
const USER_KINDS = new Set(['user', 'steering'])

const WRAP: Record<AvatarKind, string> = { ai: 'dsh-av-aiavatar', user: 'dsh-av-useravatar' }
const IMG = 'dsh-av-avatar'
const DEBOUNCE_MS = 120

let observer: MutationObserver | null = null
let timer: number | null = null
let active = false

// ── 生命周期 ──
export function startLayer(): void {
  if (active) return
  active = true
  observer = new MutationObserver(() => { scheduleProcessRows() })
  observer.observe(document.body, { childList: true, subtree: true })
  scheduleProcessRows()
}

export function stopLayer(): void {
  if (!active) return
  active = false
  observer?.disconnect()
  observer = null
  if (timer !== null) { window.clearTimeout(timer); timer = null }
  document.querySelectorAll(`.${WRAP.ai}, .${WRAP.user}`).forEach((wrap) => wrap.remove())
}

export function scheduleProcessRows(): void {
  if (!active || timer !== null) return
  timer = window.setTimeout(() => {
    timer = null
    decorate('user', Array.from(document.querySelectorAll<HTMLElement>(USER_ROW_SELECTOR)))
    decorate('ai', answerRows())
  }, DEBOUNCE_MS)
}

/**
 * 把某一侧的头像贴到给定行上；不在目标集合里的同类包裹层一律清掉
 * （覆盖「关掉显示」「换过目标行」「React 重建了行」三种残留）。
 */
function decorate(kind: AvatarKind, rows: HTMLElement[]): void {
  const cfg = getSettings()[kind]
  const live = cfg.showAvatar && hasAvatar(kind)
  const targets = new Set<HTMLElement>()
  if (live) {
    const size = clampSize(cfg.avatarSize)
    for (const row of rows) {
      targets.add(row)
      const img = ensureWrap(row, kind)
      img.style.width = img.style.height = size + 'px'
      img.dataset.shape = cfg.shape
      img.src = `${API}/avatar?kind=${kind}&v=${getAvatarVersion(kind)}`
    }
  }
  document.querySelectorAll<HTMLElement>(`.${WRAP[kind]}`).forEach((wrap) => {
    const parent = wrap.parentElement
    if (!parent || !targets.has(parent)) wrap.remove()
  })
}

/** 每轮一个 AI 头像：优先该轮最后一条有正文的 assistant-step，都没有正文时退回最后一条。 */
function answerRows(): HTMLElement[] {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTOR))
  const out: HTMLElement[] = []
  let steps: HTMLElement[] = []
  const flush = (): void => {
    if (steps.length === 0) return
    const withText = steps.filter((row) => row.innerText.trim() !== '')
    out.push(withText.length > 0 ? withText[withText.length - 1] : steps[steps.length - 1])
    steps = []
  }
  for (const row of rows) {
    const kind = row.getAttribute('data-chat-flow-kind') ?? ''
    if (USER_KINDS.has(kind)) { flush(); continue }
    if (row.matches(AI_ROW_SELECTOR)) steps.push(row)
  }
  flush()
  return out
}

// ── 包裹层 ──
function ensureWrap(row: HTMLElement, kind: AvatarKind): HTMLImageElement {
  const cls = WRAP[kind]
  let wrap = row.querySelector<HTMLElement>(`:scope > .${cls}`)
  if (!wrap) {
    wrap = document.createElement('div')
    wrap.className = cls
    row.insertBefore(wrap, row.firstChild)
  }
  let img = wrap.querySelector<HTMLImageElement>(`:scope > .${IMG}`)
  if (!img) {
    img = document.createElement('img')
    img.className = IMG
    img.alt = kind === 'ai' ? 'AI 头像' : '用户头像'
    img.draggable = false
    wrap.appendChild(img)
  }
  return img
}
