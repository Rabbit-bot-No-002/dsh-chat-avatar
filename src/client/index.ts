/**
 * dsh-chat-avatar —— Client 半入口：样式注入、DOM 层装卸、设置入口注册、设置加载。
 * 设置入口只有一处：settings.section →「设置 → 左侧边栏」的「头像」一节
 * （order 16，落在官方分区 plugins=15 与 agent-presets=20 之间；不用会话头部，避免与别的插件/官方更新抢位）。
 */
import { getSettings, loadSettings, notify, setLayerSync } from './state.js'
import { scheduleProcessRows, startLayer, stopLayer } from './dom-layer.js'
import { STYLES } from './styles.js'
import { AvatarPanel } from './panel.js'

export const inject = ['slots']

export function apply(ctx: any): void {
  // 1) 样式注入（停用态下设置面板仍需要）
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = 'dsh-chat-avatar'
    style.textContent = STYLES
    document.head.appendChild(style)
    return () => { style.remove() }
  })

  // 2) DOM 层随「启用」开关动态装卸；插件卸载时兜底停层
  ctx.effect(() => () => stopLayer())
  setLayerSync(() => {
    if (getSettings().plugin.enabled !== false) {
      startLayer()
      scheduleProcessRows()
    } else {
      stopLayer()
    }
  })

  // 3) 设置入口：只保留「设置 → 左侧边栏」一节
  //    order 16 落在官方分区 general=0 / models=10 / plugins=15 / agent-presets=20 之间
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'dsh-chat-avatar',
    order: 16,
    label: () => '头像',
  }, AvatarPanel))

  // 4) 加载设置并同步层状态
  loadSettings()
  notify()
}
