# lender-assistant-frontend

「融资智能工作台」的 Web 前端：把后端 `lender-assistant` 的 RAG 知识库能力做成两个页面 —— **文档管理**（上传、切片浏览）与**知识库对话**（多轮问答、流式回答、来源溯源）。

本仓库只负责前端，与后端各自独立构建、独立部署；后端接口字段只在本仓库 `src/api/types.ts` 镜像一次，其余文件不得私自定义后端类型（见 [AGENTS.md](AGENTS.md)）。

## 与后端的关系

- 后端仓库：[weifeixuan/lender-assistant](https://github.com/weifeixuan/lender-assistant)，本地默认放在同级目录 `../lender-assistant`。
- 后端对外提供 REST + SSE 接口，默认监听 `http://localhost:8080`；后端能力、数据库与模型配置见后端 README。
- 前端开发期通过 Vite proxy 把 `/api` 转发到 `http://localhost:8080`，业务代码里只写相对路径。
- 所有业务接口都要求携带 `X-User-Id`；会话由后端懒创建，首问不带 `conversationId` 时由服务端创建并通过 SSE 首个 `meta` 事件回传真实 id。

## 页面与能力

路由表见 `src/App.tsx`：`/documents`、`/chat`，`/` 与未知路径重定向到文档页。

**文档管理页（`/documents`）**

- 文档列表：文档名、原始文件名、字符数、切片数、最近入库时间，支持按文档名 / docId 关键字过滤。
- 上传：单文件（docx / txt / md，以服务端支持的类型为准），docId 可由文件名生成或手动修改；docId 已存在时需勾选覆盖确认。
- 等待态按「解析 → 切分 → 向量化 → 入库」四段点亮，仅为等待态可视化，不提供进度百分比；返回后展示切片数、平均字符数、四段耗时与向量化模型名。
- 切片抽屉：按 20 条一页翻页加载，可展开原文与复制。
- 删除文档：二次确认后调用接口。

**知识库对话页（`/chat`）**

- 会话列表（最近会话 / 新对话）、历史消息加载、删除会话（二次确认）。
- 多轮提问：`POST /api/qa` 的 SSE 流式回答，首问由后端懒创建会话，收到 `meta` 后才进入会话列表。
- 生成中可停止；失败可重试（重试即同一问题的新一轮问答）。
- 回答正文中的【来源N】与右侧检索过程侧栏联动：路由结论（route）、计划步骤（plan / step）、来源明细（sources）。
- 页面不提供登录、用户菜单、设置与全局搜索。

## 技术栈

运行依赖只有三个，其余均为开发依赖（见 `package.json`）：

| 类别 | 选型 |
| --- | --- |
| 构建 | Vite 5 |
| 框架 | React 18.3 + TypeScript 5（strict） |
| 路由 | react-router-dom 6 |
| 样式 | Tailwind CSS 3 + CSS 变量（token 定义在 `src/styles/index.css`） |
| 校验 / 格式化 | ESLint 9（flat config）+ Prettier 3 |
| 测试 | Vitest 2 + Testing Library（jsdom） |

不使用组件库、状态管理库、数据请求库、日期库、图标包或 i18n 框架；新增依赖需先在 issue 或 ADR 中说明理由。

## 目录结构

```
lender-assistant-frontend/
├── index.html
├── src/
│   ├── main.tsx                 # 挂载 + 路由
│   ├── App.tsx                  # 路由表
│   ├── styles/index.css         # Tailwind 入口 + CSS 变量 + 全局基础样式
│   ├── api/                     # 与后端交互的一切（组件不得直接 fetch）
│   │   ├── types.ts             # 后端契约镜像（唯一）
│   │   ├── client.ts            # fetch 封装、统一解包、ApiError、X-User-Id 注入
│   │   ├── sse.ts               # SSE 报文解析（纯函数）
│   │   ├── documents.ts         # 文档列表 / 上传 / 删除 / 切片分页
│   │   ├── conversations.ts     # 会话列表 / 历史消息 / 删除
│   │   ├── qa.ts                # 问答流式接口（含 mock 流）
│   │   └── mock.ts              # 本地 mock 数据与延迟
│   ├── components/              # 跨页面复用的展示组件
│   ├── features/
│   │   ├── documents/           # 文档管理页及子组件
│   │   └── chat/                # 对话页、会话/流式 hooks、侧栏与气泡
│   ├── lib/                     # format / identity / knowledge 状态 / uploadFile 校验
│   └── test/                    # Vitest 全局 setup 与冒烟测试
├── docs/                        # ADR、Agent 文档、PRD
├── AGENTS.md                    # 本仓库实现规范（唯一技术规范入口）
└── .scratch/                    # 本地 issue / spec（约定见 docs/agents/issue-tracker.md）
```

约定：`features/<域>/` 内部自由分层，跨域复用先下沉到 `components/` 或 `lib/`；测试文件与源码同目录，命名以 `.test.ts` / `.test.tsx` 结尾。

## 本地启动与构建

前置：Node.js 与 npm；联调真实接口时需先按后端 README 启动后端（默认 `8080`）。

```bash
npm install
npm run dev         # http://localhost:5173
```

`vite.config.ts` 已把 `/api` 代理到 `http://localhost:8080`，开发期无需额外配置跨域。

| 命令 | 实际执行 |
| --- | --- |
| `npm run dev` | `vite` |
| `npm run build` | `tsc --noEmit && vite build` |
| `npm run preview` | `vite preview` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm run format` | `prettier --write "src/**/*.{ts,tsx,css}"` |
| `npm test` | `vitest run`（全量用例） |
| `npm run test:watch` | `vitest`（监听模式） |

交付前至少通过 `npm test`、`npm run typecheck`、`npm run build`。

## 环境变量

模板见 `.env.example`，复制为 `.env.local` 后按需修改（`.env.*` 已在 `.gitignore` 中忽略）。

| 变量 | 用途 |
| --- | --- |
| `VITE_USE_MOCK` | `true` 时启用 `src/api/` 内的本地 mock；默认关闭，直连真实后端 |
| `VITE_API_BASE` | 后端基址前缀。前后端同源（走 Vite proxy）时留空；不同源时填写后端地址，`client.ts` 会去掉末尾 `/` 后拼接请求路径 |

mock 开关只在 API 层生效（`VITE_USE_MOCK=true` 或 URL 带 `?mock=1`），组件层无感知，禁止在组件里写 mock 分支。

## 与后端对接

**接口层**：所有普通接口走 `src/api/client.ts` 的 `request()`，按 `{ code, msg, data }` 解包；`code !== 200` 抛 `ApiError`，错误文案直接使用服务端 `msg` 原文。

**身份**：`client.ts` 统一注入 `X-User-Id`，取值来自 `src/lib/identity.ts` 的固定开发期标识；调用方传入的同名头会被覆盖，组件不得自行拼装身份头。

**已在用的接口**（路径以源码为准）：

| 方法 | 路径 | 文件 |
| --- | --- | --- |
| GET | `/api/admin/documents` | `src/api/documents.ts` |
| POST | `/api/admin/documents?docId=…`（multipart 字段名固定 `file`） | `src/api/documents.ts` |
| DELETE | `/api/admin/documents/{docId}` | `src/api/documents.ts` |
| GET | `/api/admin/documents/{docId}/chunks?page=…&size=…` | `src/api/documents.ts` |
| GET | `/api/conversations` | `src/api/conversations.ts` |
| GET | `/api/conversations/{conversationId}/messages` | `src/api/conversations.ts` |
| DELETE | `/api/conversations/{conversationId}` | `src/api/conversations.ts` |
| POST | `/api/qa`（SSE） | `src/api/qa.ts` |

**SSE 流式接口** `POST /api/qa`：

- 用 `fetch` + `ReadableStream` 手工解析，不使用 `EventSource`（只支持 GET）。
- 请求体只提交当前问题与可选的 `conversationId`，不伪造上下文。
- 事件顺序：`meta`（首个，含 `conversationId / roundId / userMessageId / assistantMessageId`）→ `route` / `plan` / `step`（仅 PLAN 路径）→ [`sources`]（未召回时省略）→ `delta`（可多次，纯文本）→ `done` 或 `error`（终态）。
- 收到 `done` / `error` 即结束本轮并释放连接；未知事件忽略。
- 停止由 `AbortController.abort()` 实现，已渲染内容保留并标记为「已停止」。

## 测试

测试框架为 Vitest 2 + Testing Library，运行环境 `jsdom`，全局 setup 在 `src/test/setup.ts`（Vite 配置里的 `test` 段）。

```bash
npm test
```

当前实测结果（2026-11-08 执行 `npm test`）：**21 个测试文件、109 个用例全部通过**。覆盖 API 层（client / documents 之外的会话与问答解析）、SSE 消费与终态、会话切换与历史合并、停止 / 失败 / 重试、删除确认、Composer 键盘交互等。

## 文档索引

- [AGENTS.md](AGENTS.md)：实现规范与提交前自查清单（唯一技术规范入口）。
- `docs/adr/ADR-0001-前端独立仓库与契约镜像.md`：为什么前端独立成仓库、契约为何只镜像一处。
- `docs/agents/`：issue tracker 约定、triage 标签、领域文档约定。
- `docs/prd/阶段0_前端react启用.md`：阶段 0 的需求文档；之后实现的多轮会话、路由 / 计划执行已超出该文档范围，规范以 AGENTS.md 为准。
- `.scratch/multi-turn-frontend/`：多轮会话改造的 spec 与各期 ticket（本地 markdown issue）。

## 关联仓库

- 后端：[https://github.com/weifeixuan/lender-assistant](https://github.com/weifeixuan/lender-assistant)
- 前端（本仓库）：[https://github.com/weifeixuan/lender-assistant-frontend](https://github.com/weifeixuan/lender-assistant-frontend)
