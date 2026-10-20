# VIBE 知识影像工坊

把一个知识主题逐步变成可编辑脚本、分镜与代码绘制短片的创作工作台。

## 功能

- 输入想法，通过兼容 OpenAI Chat Completions 的模型 API 生成脚本与分镜。
- 在工作台中预览、修改脚本和分镜，并选择画面风格。
- 使用 Canvas 绘制动态画面，以浏览器 MediaRecorder 录制并下载 WebM 视频。
- 草稿保存在当前浏览器；模型 API Key 只在页面会话中使用，不写入浏览器存储或服务端持久存储。

视频成片使用代码绘制和浏览器录制，不会自动调用外部文生视频服务。模型生成和 API 连通测试可能产生服务商用量费用。

## 本地运行

要求 Node.js `^20.19.0` 或 `>=22.12.0`，pnpm `10.18.0`。

```bash
corepack enable
corepack prepare pnpm@10.18.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

默认打开 <http://localhost:3000>。在页面的“模型设置”中填写兼容服务的 HTTPS Base URL、模型名称和 API Key；API Key 刷新页面后需要重新填写。只应使用自己有权限的模型服务，并留意其计费规则。

## 常用命令

```bash
pnpm check  # TypeScript 检查
pnpm test   # 自动化测试
pnpm build  # 生产构建
pnpm start  # 启动生产构建
```

## 技术结构

- `client/`：React 创作工作台、数据模型、浏览器本地草稿和视频渲染。
- `server/`：Express 应用与同源模型 API 转发路由。
- `shared/`：前后端共享类型和工具。

模型服务需兼容 `POST /chat/completions`。服务端会限制目标为 HTTPS 公网地址，并对上游调用施加超时和响应大小限制。请勿把 API Key 写入源码、提交记录或公开 issue。
