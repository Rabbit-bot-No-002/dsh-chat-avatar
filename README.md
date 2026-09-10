# dsh-chat-avatar

给 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh`）的 Web 界面加头像：**每轮 AI 回复左侧**一个、**你的每条输入右侧**一个，两侧各自可自定义。

An avatar plugin for the DeepSeek Harness Web UI: one avatar on the left of each turn's final AI reply, one on the right of each of your messages.

## 功能 / Features

- **AI 头像** —— 每轮**最终 AI 回复左侧**，贴该条消息第一行的左上角。一轮只有一个：轮次开始时挂在第一条助手步骤上，出现更靠后的步骤就移过去，整轮结束停在最终回答上。
- **用户头像** —— 每条输入（含运行期追问）右侧，贴第一行右上角。
- **两侧各自可配**：显示 / 隐藏、上传图片（PNG / JPG / WebP / GIF，**动态图会动**，≤ 20MB）、尺寸 16–128 px、头像框形状（**圆形 / 方形**，默认圆形）。
- **没上传就不显示**：不会出现空头像框，也没有内置默认图。
- 设置入口：**设置 → 左侧边栏 →「头像」**（不占会话头部，避免与其它插件抢位置）。
- 不依赖任何 `@deepseek-ai/*` 包（客户端只用 `slots`，宿主只用 `webServer`），没有 peer 版本耦合问题。

## 安装 / Install

```bash
# 从 GitHub（源码安装，会本地构建一次）
dsh plugin --profile web add github:Rabbit-bot-No-002/dsh-chat-avatar

# 从本地目录
dsh plugin --profile web add link:/path/to/dsh-chat-avatar
```

> - 从源码安装时 pnpm 会执行本仓库的 `prepare`（`tsdown`）来构建 `lib/`；如果你的 pnpm 拦了构建脚本，按提示把该包加入 profile 的 `allowBuilds` 后重跑安装即可。
> - 也可以直接用 GitHub Release 里的预构建 tarball 安装，免构建。
> - ⚠️ **npm 上的 `dsh-chat-avatar` 是别人占名的空包**，请用上面的 GitHub 方式安装；本插件没有以该名字发布到 npm。

装好后刷新页面（改到 Host 半的改动需要重启一次 `dsh`）。

## 使用 / Usage

设置 → 左侧边栏 →「头像」：

| 项 | 说明 |
|---|---|
| AI 头像 / 用户头像 | 两张卡片，各自独立配置 |
| 显示头像 | 关掉即移除该侧头像（设置保留） |
| 上传图片 | PNG / JPG / WebP / GIF，≤ 20MB |
| 头像大小 | 16 – 128 px |
| 头像框形状 | 圆形（默认）/ 方形（按比例圆角） |
| 启用插件 | 关闭后移除全部头像 |

## 数据与接口 / Data & endpoints

宿主半把数据放在 `$DSH_HOME/dsh-chat-avatar/`：

```
settings.json         # 设置
avatar-ai.<ext>       # 上传的 AI 头像
avatar-user.<ext>     # 上传的用户头像
```

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/dsh-chat-avatar/avatar?kind=ai\|user` | 图片字节；没上传 → 404 |
| GET / POST | `/dsh-chat-avatar/settings` | 读 / 写设置（返回里带 `available: { ai, user }`） |
| POST | `/dsh-chat-avatar/avatar-upload` | `{ kind, dataUrl }` |

三条路由都只接受**回环 Host + 同源 Origin** 的请求，不读取数据目录以外的文件，上传体积上限 20MB。插件只做头像展示，不采集、不外传任何数据。

## 开发 / Development

```bash
npm install
npm run typecheck     # host + client 两套 tsconfig
npm test              # pure 层单元测试（15 项）
npm run smoke         # Host 半离线冒烟：假 ctx 打全部路由（17 项，数据目录指到 /tmp）
npm run build         # tsdown → lib/index.js（host）+ lib/client.js（client）
npm run watch         # 增量构建
npm run pack:tgz      # 产出 dist/dsh-chat-avatar.tgz（文件名不带版本号，便于 latest/download 链接）
```

## 目录 / Layout

```
src/index.ts            Host：3 条路由 + 磁盘 + 设置读写
src/pure/settings.ts    设置模型（默认值 / clamp / sanitize 浅合并，Host+Client 共用）
src/pure/avatars.ts     种类与文件名、MIME、dataURL 解析
src/client/index.ts     生命周期 + 设置入口注册（settings.section）
src/client/state.ts     客户端状态 / 可用性 / fetchJson / load·saveSettings
src/client/dom-layer.ts MutationObserver + 两种头像挂载
src/client/panel.ts     设置面板
src/client/styles.ts    全部 CSS（dsh-av-* 前缀）
scripts/smoke-host.mjs  Host 半离线冒烟
tests/                  pure 层单元测试（node:test）
```

## 发布 / Publishing

```bash
npm run pack:tgz      # dist/dsh-chat-avatar.tgz（文件名不带版本号，便于 latest/download 链接）
```

投稿到 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 的条目已备好：`contrib/awesome-dsh-plugin.yml`（复制到该仓库 `data/plugins/Rabbit-bot-No-002__dsh-chat-avatar.yml`）。

## License

MIT
