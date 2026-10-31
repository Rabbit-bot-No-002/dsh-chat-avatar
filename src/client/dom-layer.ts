/**
 * 头像 DOM 层：MutationObserver 驱动的增量装饰层（唯一职责：把头像 + 昵称贴到聊天行上）。
 *
 * - 用户头像：每条 user/steering 行 → 右外侧；
 * - AI 头像：常规情况下按轮次分组，挂该轮「最后一条有正文的 assistant-step」左侧；
 *   生成过程中改挂「运行中」状态行（turn-process / data-chat-running）：
 *   此时该轮还没有带正文的步骤，旧实现会退回最后一条空步骤行——那条行是折叠的隐藏行，
 *   头像会跟着漂到视口外，于是「生成中看不到头像」。一轮始终只有一个 AI 头像。
 * 随「启用」开关装卸；停用或隐藏时清空包裹层（不留空框）。
 */
import { API, getAvatarVersion, getSettings, hasAvatar } from './state.js'
import { clampSize } from '../pure/settings.js'
import { pickAnswerIndexes, type RowInfo } from '../pure/turns.js'
import type { AvatarKind } from '../pure/avatars.js'

const ROW_SELECTOR = '[data-chat-flow-kind]'
const USER_ROW_SELECTOR = '[data-chat-flow-kind="user"],[data-chat-flow-kind="steering"]'
/** 运行状态行的候选选择器（按优先级）：插件版会话流用 turn-process，兼容 [data-chat-running]。 */
const RUNNING_SELECTORS = ['[data-chat-flow-kind="turn-process"]', '[data-chat-running]']

const WRAP: Record<AvatarKind, string> = { ai: 'dsh-av-aiavatar', user: 'dsh-av-useravatar' }
const IMG = 'dsh-av-avatar'
const LABEL = 'dsh-av-name'
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
    decorate('user', userRows(), null)
    // 运行中：AI 头像挂在状态行上；关掉 showRunning 就退回「按轮次」的旧行为
    const run = getSettings().ai.showRunning ? runningRow() : null
    decorate('ai', run === null ? answerRows(null) : [...answerRows(run), run], run)
  }, DEBOUNCE_MS)
}

function userRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(USER_ROW_SELECTOR))
}

/**
 * 把某一侧的头像贴到给定行上；不在目标集合里的同类包裹层一律清掉
 * （覆盖「关掉显示」「换过目标行」「React 重建了行」三种残留）。
 * `running` 是当轮运行状态行：贴上去的那一枚会多一个 data-running，样式改为横排卡片。
 */
function decorate(kind: AvatarKind, rows: HTMLElement[], running: HTMLElement | null): void {
  const cfg = getSettings()[kind]
  const live = cfg.showAvatar && hasAvatar(kind)
  const targets = new Set<HTMLElement>()
  if (live) {
    const size = clampSize(cfg.avatarSize)
    for (const row of rows) {
      targets.add(row)
      const wrap = ensureWrap(row, kind)
      const img = ensureImg(wrap, kind)
      img.style.width = img.style.height = size + 'px'
      img.dataset.shape = cfg.shape
      img.src = `${API}/avatar?kind=${kind}&v=${getAvatarVersion(kind)}`
      const label = ensureLabel(wrap)
      label.textContent = cfg.name
      // 用内联 display 而不是 hidden 属性：`.dsh-av-name{display:block}` 会盖掉 UA 的 [hidden]
      label.style.display = cfg.name === '' ? 'none' : ''
      if (row === running) wrap.dataset.running = '1'
      else delete wrap.dataset.running
    }
  }
  document.querySelectorAll<HTMLElement>(`.${WRAP[kind]}`).forEach((wrap) => {
    const parent = wrap.parentElement
    if (!parent || !targets.has(parent)) wrap.remove()
  })
}

/** 行是否真的占据版面：折叠容器里的行 getClientRects() 为空。 */
function visibleRow(row: HTMLElement): boolean {
  return row.getClientRects().length > 0
}

/** 当前是否在生成中：优先插件版 turn-process 行，其次 [data-chat-running]。 */
function runningRow(): HTMLElement | null {
  for (const selector of RUNNING_SELECTORS) {
    const rows = Array.from(document.querySelectorAll<HTMLElement>(selector)).filter(visibleRow)
    if (rows.length > 0) return rows[rows.length - 1] ?? null
  }
  return null
}

/**
 * 每轮一个 AI 头像的行集合；选行规则见 pure/turns.ts（有单测覆盖）。
 * 生成中 `running` 非空：该轮头像由状态行承载，空步骤组不参与。
 */
function answerRows(running: HTMLElement | null): HTMLElement[] {
  const rows = Array.from(document.querySelectorAll<HTMLElement>(ROW_SELECTOR))
  const info: RowInfo[] = rows.map((row) => ({
    kind: row.getAttribute('data-chat-flow-kind') ?? '',
    text: row.innerText,
  }))
  return pickAnswerIndexes(info, running !== null).map((index) => rows[index]!)
}

// ── 包裹层 ──
function ensureWrap(row: HTMLElement, kind: AvatarKind): HTMLElement {
  const cls = WRAP[kind]
  let wrap = row.querySelector<HTMLElement>(`:scope > .${cls}`)
  if (!wrap) {
    wrap = document.createElement('div')
    wrap.className = cls
    row.insertBefore(wrap, row.firstChild)
  }
  return wrap
}

function ensureImg(wrap: HTMLElement, kind: AvatarKind): HTMLImageElement {
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

function ensureLabel(wrap: HTMLElement): HTMLElement {
  let label = wrap.querySelector<HTMLElement>(`:scope > .${LABEL}`)
  if (!label) {
    label = document.createElement('span')
    label.className = LABEL
    wrap.appendChild(label)
  }
  return label
}
