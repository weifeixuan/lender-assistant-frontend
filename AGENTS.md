# 前端 Agent 契约（lender-assistant-frontend）

> 本文件是本仓库（独立前端项目）的唯一技术规范入口，只约束**怎么实现**，不新增产品行为。
> 产品需求按阶段放在 `docs/prd/`；本文件只约束实现，不复述需求。
> 后端仓库在同级目录 `../lender-assistant`，前后端分离、各自独立构建与部署。

## 0. 适用范围

- 只影响本仓库，与其后端仓库解耦；不迁移、不复用任何后端页面或样式。
- 后端接口字段以后端仓库的接口实现为准；前端只在 `src/api/types.ts` 里镜像一次，
  **其他文件不得私自定义后端字段类型**，契约变化只改这一处。

## 1. 技术栈（不引入清单外的库）

| 项   | 选型                              | 说明                                |
| --- | ------------------------------- | --------------------------------- |
| 构建  | Vite 5                          | `dev` / `build` / `preview`       |
| 框架  | React 18 + TypeScript 5（strict） | 函数组件 + hooks                      |
| 路由  | react-router-dom 6              | `/documents`、`/chat`，其余重定向到文档页  |
| 样式  | Tailwind CSS 3 + CSS 变量         | token 见 §6                        |
| 校验  | ESLint 9（flat config）+ Prettier | `npm run lint` / `npm run format` |
| 测试  | Vitest 2 + Testing Library（jsdom） | `npm test`（即 `vitest run`）        |

禁止引入：组件库（antd/MUI/shadcn）、状态管理库（redux/zustand/jotai）、数据请求库（axios/swr/react-query）、
日期库（dayjs/moment）、图标包、i18n 框架。需要新依赖时先在 issue 或 ADR 里说明理由，不要顺手装。

## 2. 目录结构

```
lender-assistant-frontend/
├── index.html
├── src/
│   ├── main.tsx                 # 挂载 + 路由
│   ├── App.tsx                  # 路由表（默认导出）
│   ├── styles/index.css         # Tailwind 入口 + CSS 变量 + 全局基础样式
│   ├── api/                     # 与后端交互的一切（组件不得直接 fetch）
│   │   ├── types.ts             # 后端契约镜像（唯一）
│   │   ├── client.ts            # fetch 封装、ApiResponse 解包、ApiError、X-User-Id 注入
│   │   ├── sse.ts               # SSE 报文解析（纯函数，可单测）
│   │   ├── documents.ts         # 文档相关接口
│   │   ├── conversations.ts     # 会话列表 / 历史消息 / 删除
│   │   ├── qa.ts                # 问答流式接口
│   │   └── mock.ts              # 本地 mock 数据与延迟
│   ├── components/              # 跨页面复用的展示组件（无业务语义）
│   │   ├── ui.tsx               # Button / Tag / EmptyState / Spinner / Skeleton
│   │   ├── Drawer.tsx
│   │   ├── ConfirmDialog.tsx
│   │   ├── AppShell.tsx         # 左侧导航 + 面包屑 + 主区
│   │   └── icons.tsx            # 内联 SVG，统一 16px
│   ├── features/
│   │   ├── documents/           # 文档管理页（页面 + 子组件 + hooks）
│   │   └── chat/                # 知识库对话页（页面 + 会话/流式 hooks + 子组件）
│   ├── lib/
│   │   ├── format.ts            # 千分位 / 时间 / 距今 / 单位格式化
│   │   ├── identity.ts          # 开发期用户标识（X-User-Id 的字面量唯一来源）
│   │   ├── knowledge.tsx        # 跨页共享的知识库概览状态（Provider + hook）
│   │   └── uploadFile.ts        # docId 生成、docId 与上传文件的本地校验
│   └── test/                    # Vitest 全局 setup 与冒烟测试
```

规则：

- `features/<域>/` 内部允许自由分层；跨域复用必须先下沉到 `components/` 或 `lib/`，禁止 `features/a` 直接 import `features/b`。
- 测试文件与源码就近同目录，命名以 `.test.ts` / `.test.tsx` 结尾。
- `App.tsx` 用默认导出；其余组件、hook、工具一律具名导出。文件名用 PascalCase（组件）或 camelCase（工具/hook）。
- 组件超过 ~200 行或承担两类职责时拆分，不为"以后可能复用"提前抽象。

## 3. TypeScript 规则

- `strict: true`；禁止 `any`、`@ts-ignore`、`@ts-expect-error` 兜底。确实未知用 `unknown` + 收窄函数。
- 禁止非空断言 `!`（`arr[i]!`）。索引访问先用 `array.at()` 或显式判空。
- 后端 JSON 一律先经 `api/types.ts` 的 interface 声明；解析 SSE 的 `JSON.parse` 返回值用类型守卫收窄，不直接断言。
- 枚举式取值用字面量联合（如 `type TurnStatus = 'streaming' | 'done' | 'stopped' | 'error'`），不用 `enum`。
- `import type` 用于纯类型导入。路径别名 `@/` → `src/`（`vite.config.ts` + `tsconfig.json` 同步配置）。

## 4. 组件与 hook 约定

- 组件只负责渲染与交互编排；**取数、流式解析、分页状态全部放 hooks**，页面组件不得出现裸 `fetch`。
- hook 命名 `useXxx`，与使用方同域：页面内部 hook 放 `features/<域>/`，跨页共享的放 `lib/`；返回对象而非位置元组（>2 个返回值时）。
- 受控输入优先；只在输入框这类高频输入上用 ref 或非受控以减少重渲染。
- 事件处理函数命名 `handleXxx`；传给子组件的回调以 `onXxx` 命名。
- 副作用必须有清理：`AbortController`、定时器、事件监听在卸载或重跑时释放。
- 禁止在渲染期做副作用（写 localStorage、发请求、改全局）；禁止用 `useEffect` 同步两个本可由 props 推导的状态。

## 5. API 层与 mock

- 除 `POST /api/qa` 外，所有接口返回统一包装 `{ code, msg, data }`：`client.ts` 统一解包，`code !== 200` 抛 `ApiError`，`message` 直接用服务端 `msg` 原文，**不得改写成"操作失败"**。
- `POST /api/qa` 是 SSE，跳过包装，见 §5.2。
- 请求路径统一走 `client.ts` 的 `apiPath()`（拼接 `import.meta.env.VITE_API_BASE ?? ''`），开发期由 Vite proxy 转发到 `http://localhost:8080`。
- 所有请求经 `client.ts` 统一注入 `X-User-Id`（取值来自 `lib/identity.ts`），调用方传入的同名头会被覆盖；组件不得自行拼装身份头。
- mock 开关：`VITE_USE_MOCK=true`（`.env.local`）或 URL 带 `?mock=1`。mock 只在 `api/` 内部生效，组件无感知；**禁止**在组件里写 `if (mock)` 分支。
- mock 数据必须与真实契约字段完全一致（含可空字段），不得为了好看编造字段。

### 5.1 上传

- `multipart/form-data`，文件字段名固定 `file`，`docId` 走 query 参数（`?docId=`）。
- 上传是**同步阻塞**的：不展示百分比，不伪造进度条；四段式文案只是等待态可视化，真实耗时来自响应 `millis`。

### 5.2 SSE 解析（`api/sse.ts`）

- 必须 `fetch` + POST + `ReadableStream` 手工解析，**不能用 `EventSource`**（只支持 GET）。
- 报文按空行分块；块内 `event:` 行取事件名，`data:` 行按顺序拼接（多行 data 用 `\n` 连接）。
- 事件集合：`meta`（JSON，必须是首个事件，含 `conversationId/roundId/userMessageId/assistantMessageId`）→
  [`sources`]（JSON 数组，未召回时省略）→ `delta`（纯文本，可多次）→ `done`（JSON）或 `error`（纯文本）。
  **不得**新增/消费其他事件名（后端没有 `retrieval`、`progress` 之类）。
- 解析函数为纯函数 `parseSseBlock(block)`，返回 `{ event, data }`，便于测试。
- 停止：`AbortController.abort()`；已渲染内容保留，标记 `已停止`，不算失败。
- 未召回时后端只推 `delta`、不推 `sources`：前端以 `sourceCount === 0` 或"无 sources 事件"判定空召回，按普通提示样式渲染。

## 6. 样式与 design token

- 只用 Tailwind 原子类 + `index.css` 里的 CSS 变量；禁止行内 `style={{ color:'#xxx' }}` 写颜色/间距魔法值（动态宽度、`max-height` 计算除外）。
- 颜色语义：`--kb-bg` 页面底色、`--kb-panel` 卡片、`--kb-ink` 正文、`--kb-muted` 次要文字、`--kb-line` 描边、
  `--kb-brand` 品牌蓝、`--kb-brand-soft` 品牌浅底、`--kb-ok`、`--kb-warn`；完整清单见 `index.css`。
  新增颜色先进 token，再在 `tailwind.config.ts` 映射。
- 字号档位固定：正文 12.5px（`text-body`）、次要 11px（`text-meta`）、标题 19px（`text-title`）、数字 19px 等宽（`tabular-nums`）。
- 间距用 4 的倍数；页面水平留白 22px；卡片圆角 10px，输入类圆角 8px，抽屉/弹窗圆角 12px。
- 数字展示：切片数/字符数用千分位；向量距离 3 位小数、RRF 分数 5 位小数、命中数整数——统一走 `lib/format.ts`。
- 动效克制（≤150ms 的 border/background 过渡即可）；必须尊重 `prefers-reduced-motion`。
- 不实现暗色主题（本期无此需求）。

## 7. 产品语义红线（写文案时逐条对照）

- 术语只用：文档 / 文档名 / 原始文件名 / 切片 / 序号 / 章节路径 / 字符数 / 召回 / 来源。
- 禁用词：页码、token/令牌、解析中、待解析、进度百分比、查询改写、重排/rerank、top-k 重排、部门。
- 不出现任何文档状态标签；上传返回即最终结果。
- 对话是**多轮**：会话由后端懒创建，历史消息参与生成；前端只提交当前 `conversationId` 与问题，不得伪造上下文记忆。
- 提供「新对话」入口；新会话以本地草稿承载，首问收到 `meta` 后才进入「最近」列表，草稿不落库。
- 检索过程侧栏只反映真实阶段：双通道召回 → RRF 融合 → 送入上下文 → 来源明细。
- 页面不提供登录、用户菜单、设置、全局搜索。

## 8. 异常、空态与危险操作

- 三处空态必须有：无文档、文档 0 切片、本轮未召回。
- 错误一律展示服务端可读原因原文；网络/超时给「重试」，参数类（文件类型、docId 格式）就地提示且不提交。
- 危险操作（覆盖重建、删除文档）必须二次确认，文案写明影响的切片数与"不可恢复"；弹窗点击「确认」前不得发出请求。
- 加载态：列表首屏骨架行；切片抽屉「加载更多」；流式期间禁用重复提交。
- 对话框回复错误时保留已到达的来源，答案区给原因 + 「重试」（重试＝同一问题新一次问答）。

## 9. 可访问性

- 所有交互元素用语义标签（`button`/`input`/`textarea`），`button` 必须显式 `type="button"`（除提交按钮）。
- 图标按钮必须 `aria-label`；纯装饰图标 `aria-hidden`。
- 抽屉/弹窗：`role="dialog"`、`aria-modal="true"`、打开时聚焦容器、`Esc` 关闭、关闭后焦点回到触发元素。
- 键盘：对话 `Enter` 发送 / `Alt+Enter` 换行（`Shift+Enter` 亦可换行）；IME 组合态下 `Enter` 不发送；列表过滤框不劫持方向键。
- 状态变化用 `aria-live="polite"` 播报（流式正文除外，避免逐字轰炸屏幕阅读器）。

## 10. 校验与验收命令

```bash
npm install
npm test            # vitest run，全量用例
npm run typecheck   # tsc --noEmit
npm run lint
npm run build       # 已内含 tsc --noEmit
npm run dev         # http://localhost:5173（默认 mock 关闭，需后端在 8080）
```

- 交付前至少通过 `npm test`、`npm run typecheck`、`npm run build`；无法执行时必须在交付说明里写明原因。
- 手工验收路径：上传 docx → 列表核对文档名 / 切片数 / 最近入库时间 → 打开切片抽屉翻页 → 对话提问 → 侧栏四段与引用芯片联动 → 停止 / 重试 / 删除确认 → 420px 窄屏无横向溢出。

## 11. 提交前自查

- 新增文件是否落在 §2 结构内、是否与已有组件重复。
- 是否有 `any`、魔法颜色、裸 `fetch`、`console.log` 残留。
- 文案是否出现 §7 的禁用词。
- mock 分支是否泄漏到组件层。

## Agent skills

### Issue tracker

本地 markdown：issue 与 spec 存放在仓库内 `.scratch/<feature-slug>/`。详见 `docs/agents/issue-tracker.md`。

### Triage labels

沿用五个默认标签：needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix。详见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文（single-context）：ADR 放在 `docs/adr/`；术语表与领域文档约定见 `docs/agents/domain.md`。
