/**
 * 「每轮一个 AI 头像」的选行规则（纯逻辑，无 DOM 依赖，便于单测）。
 *
 * DOM 查询在 `client/dom-layer.ts`：它把会话流里的行映射成 RowInfo 序列，
 * 再用这里返回的下标去挂头像，因此这条最容易出错的规则能被 `node --test` 覆盖。
 */

export interface RowInfo {
  /** 行的 `data-chat-flow-kind`（user / steering / assistant-step / turn-process …）。 */
  kind: string
  /** 行内文本（调用方传 `innerText` 即可；本函数内部自己 trim）。 */
  text: string
}

const USER_KINDS = new Set(['user', 'steering'])
const AI_KIND = 'assistant-step'

/**
 * 给定会话流的行序列，返回该挂 AI 头像的行下标（每轮一个）：
 * - 一轮由 user/steering 行分隔；每轮取最后一条**有正文**的 assistant-step，都没有正文则取最后一条；
 * - `running=true`（正在生成）时，若最后一轮全是无正文步骤则整组剔除：
 *   这一轮的头像由运行状态行承载，否则同一轮会出现两枚，且其中一枚贴在折叠的空行上（会漂到视口外）；
 * - 其余行（工具调用、运行状态行等）不参与分组。
 */
export function pickAnswerIndexes(rows: readonly RowInfo[], running: boolean): number[] {
  const groups: number[][] = []
  let steps: number[] = []
  rows.forEach((row, index) => {
    if (USER_KINDS.has(row.kind)) {
      if (steps.length > 0) {
        groups.push(steps)
        steps = []
      }
      return
    }
    if (row.kind === AI_KIND) steps.push(index)
  })
  if (steps.length > 0) groups.push(steps)

  const last = groups[groups.length - 1]
  const lastIsEmpty = last !== undefined && last.every((index) => rows[index]!.text.trim() === '')
  if (running && lastIsEmpty) groups.pop()

  return groups.map((group) => {
    const withText = group.filter((index) => rows[index]!.text.trim() !== '')
    return withText.length > 0 ? withText[withText.length - 1]! : group[group.length - 1]!
  })
}
