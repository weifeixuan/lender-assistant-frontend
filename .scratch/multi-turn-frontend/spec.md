Status: ready-for-agent

# 多轮对话前端 Spec

> 范围：`lender-assistant-frontend`（前端侧，不改后端）。
> 契约输入：`../lender-assistant/docs/requirements/multi-turn-backend.md`、`multi-turn-frontend.md`、`multi-turn-ui-prototype.html`。
> 口径优先级（冲突时从高到低）：本 spec 的「侧栏与空态决策」→ 后端文档 §2 跨端共享契约 → 前端需求文档 → UI 原型 → 现有 `AGENTS.md`。
> 说明：`to-spec` 的「与用户确认 seam」步骤按用户要求跳过，本 spec 直接综合既有对话与契约。

## Problem Statement

知识库问答页目前是单轮问答：每次提问都是独立记录，历史只展示、不参与生成。用户无法围绕同一个话题连续追问，刷新页面后讨论无法找回，也没有任何会话层面的组织、切换与清理能力。用户需要的是一套可回到、可继续、可删除的多轮会话工作台，而不是一个一次性问答框。

## Solution

把 `/chat` 从单轮问答升级为多轮会话：

- 对话页成为三栏布局：会话侧栏、对话主区、检索来源面板。
- 侧栏顶部是「新对话」，下方只有「最近」分组；「项目」分组本次不做。
- 「新对话」只进入本地草稿，不建服务端记录、不占列表；用户发出首问后，会话由后端懒创建，条目插入「最近」顶部并高亮。
- 已有会话可切换、可继续追问；历史消息按 `roundId` 还原为「问题—回答—引用」。
- 每个会话条目 hover 显示删除按钮，二次确认后软删；草稿态没有删除入口。
- 无会话首页是欢迎语 + 输入框，用户可以直接开始提问。
- 保留停止、失败、未召回、重试，并补齐 404 / 409 / 网络中断分支。
- mock 模式提供内存会话仓库，无后端也能完整演示。

## User Stories

1. 作为知识库使用者，我希望打开对话页就能看到最近的会话列表，以便快速回到上一次的讨论。
2. 作为知识库使用者，我希望没有会话时看到欢迎语和输入框，以便不用先找按钮就能直接提问。
3. 作为知识库使用者，我希望点击顶部「新对话」进入草稿态，以便在不污染列表的情况下准备新话题。
4. 作为知识库使用者，我希望草稿态不写入会话列表、不落库、不写本地持久化，以便随便试问也不会留下垃圾记录。
5. 作为知识库使用者，我希望发出首问后会话条目自动出现在「最近」分组最前面并高亮，以便确认当前正在哪个会话里。
6. 作为知识库使用者，我希望首问请求不携带 `conversationId`，由后端懒创建，以便前端不会伪造会话标识。
7. 作为知识库使用者，我希望收到首问的 `meta` 后立即拿到真实会话 id，以便后续追问、刷新和删除都能定位到同一会话。
8. 作为知识库使用者，我希望在同一会话里继续追问，并且历史问答参与生成，以便形成连贯的多轮对话。
9. 作为知识库使用者，我希望刷新页面或换标签页后历史仍然存在，以便不丢失上下文。
10. 作为知识库使用者，我希望历史消息按轮次展示为「问题—回答—引用」，而不是靠接口顺序猜测配对。
11. 作为知识库使用者，我希望点击回答里的【来源N】能联动右侧检索面板并高亮对应来源，以便核对依据。
12. 作为知识库使用者，我希望历史中生成失败的轮次显示错误原因和「重试」，以便补答。
13. 作为知识库使用者，我希望历史中已停止的轮次显示「已停止」，以便知道内容可能不完整。
14. 作为知识库使用者，我希望点击停止时保留已生成的半截正文，以便不必从头再来。
15. 作为知识库使用者，我希望本轮未召回时看到普通提示而不是错误，以便换个问法或先补充文档。
16. 作为知识库使用者，我希望鼠标悬停会话条目时出现小删除按钮，以便整理会话列表。
17. 作为知识库使用者，我希望删除前有二次确认，并明确说明删除后不可恢复，以便避免误删。
18. 作为知识库使用者，我希望草稿态没有删除入口，以便不会对不存在的会话发起删除请求。
19. 作为知识库使用者，我希望删除当前会话后自动切换到最近的会话，列表为空时回到空态，以便不卡在空白页。
20. 作为知识库使用者，我希望切换会话时上一个会话的流式请求被中止且不残留旧内容，以便回答不会串会话。
21. 作为知识库使用者，我希望会话不存在或已删除（404）时该会话从列表移除并提示，以便不再向失效 id 发请求。
22. 作为知识库使用者，我希望会话正在生成（409）时看到服务端原因、原问题回到输入框且不自动重试，以便手动决定何时重发。
23. 作为知识库使用者，我希望网络中断时保留已到达的正文与来源，并可以手动重试，以便不丢失已有结果。
24. 作为知识库使用者，我希望所有会话与问答请求都携带统一的用户标识，以便后端按用户隔离会话。
25. 作为知识库使用者，我希望窄屏下会话侧栏可以折叠，以便对话主区不被挤爆。
26. 作为知识库使用者，我希望「新对话」、会话条目、删除按钮和确认弹窗都能用键盘与屏幕阅读器操作，以便无障碍使用。
27. 作为知识库使用者，我希望没有后端时也能用 mock 模式演示草稿、首问、多轮、停止、切换、删除与错误分支，以便联调和演示。
28. 作为知识库使用者，我希望界面上不出现空空的「项目」分组，以便不承诺本次未实现的能力。
29. 作为知识库使用者，我希望会话标题由首问前 20 个字符自动生成，以便不用手动命名。
30. 作为知识库使用者，我希望会话列表按最近更新倒序，以便最新讨论始终在前。
31. 作为知识库使用者，我希望刷新页面后草稿不残留，以便理解草稿不持久这一限制。
32. 作为知识库使用者，我希望首次进入页面自动选中最近更新的会话，以便少一次点击。
33. 作为知识库使用者，我希望删除非当前会话不影响当前对话，以便连续整理列表。
34. 作为知识库使用者，我希望首问超时重发可能产生重复会话时能手动删除多余条目，以便接受当前 MVP 的已知限制。

## Implementation Decisions

### 1. 改动范围与组件落位

现有组件树（真实文件）：

```text
src/App.tsx
└─ ChatPage (src/features/chat/ChatPage.tsx)
   └─ AppShell (src/components/AppShell.tsx)
      └─ 两栏 grid：对话主区 1fr | TracePanel 300px
         ├─ 页头 h1 + 知识库规模
         ├─ 滚动区：EmptyState / Thread
         │  └─ Thread (src/features/chat/Thread.tsx) → AnswerBody (citations.tsx)
         ├─ Composer (src/features/chat/Composer.tsx)
         └─ TracePanel (src/features/chat/TracePanel.tsx)
```

目标落位（新增/修改标注）：

```text
src/features/chat/ChatPage.tsx                  MOD：三栏编排、模式状态、切换/删除/错误编排
src/features/chat/ConversationSidebar.tsx      NEW：顶部「新对话」+「最近」分组 + 条目 + hover 删除 + 折叠
src/features/chat/useConversations.ts          NEW：会话列表加载、刷新、草稿转正、删除、当前会话
src/features/chat/useConversationHistory.ts    NEW：单会话历史加载状态
src/features/chat/history.ts                   NEW：MessageItem[] → Turn[] 的纯函数（按 roundId 分组）
src/features/chat/useQaStream.ts               MOD：多轮入参、tmp id、meta 转正、停止/失败
src/features/chat/Thread.tsx                   MOD：历史 FAILED / STOPPED / 重试 / 引用
src/features/chat/Composer.tsx                 MOD：受控 value 或可恢复输入
src/features/chat/TracePanel.tsx               MOD：按轮次取来源，历史轮次不再显示流式状态
src/api/conversations.ts                       NEW：列表 / 删除 / 历史消息
src/api/qa.ts                                  MOD：streamQa 多轮签名 + meta 分发
src/api/types.ts                               MOD：契约镜像（唯一）
src/api/mock.ts                                MOD：内存会话仓库
src/api/client.ts                              MOD：X-User-Id 注入、SSE 错误复用
src/lib/identity.ts                            NEW：DEV_USER_ID
src/lib/format.ts                              MOD：首问标题截断（按 code point）
src/components/ConfirmDialog.tsx               REUSE：删除会话确认，不新建弹窗组件
AGENTS.md                                      MOD：删除单轮约束、事件集合加入 meta（见 §10）
```

约束：不新增第三方依赖；不新增路由；不修改文档管理页与 `AppShell` 主导航。

### 2. 状态模型

侧栏与空态的新要求让 `activeConversationId === null` 同时可能表示「空态」和「草稿态」，因此用一个显式判别字段，而不是额外布尔标志：

```ts
type ChatMode = 'empty' | 'draft' | 'conversation';

interface ConversationViewState {
  mode: ChatMode;
  activeConversationId: string | null; // mode === 'conversation' 时非空
  conversations: ConversationSummary[];
  listStatus: 'loading' | 'ready' | 'error';
  listError: string | null;
  deleteTarget: ConversationSummary | null;
  deleteBusy: boolean;
  deleteError: string | null;
}
```

本轮对话状态（流式与历史共用一套形状）：

```ts
type TurnStatus = 'streaming' | 'done' | 'stopped' | 'error';

interface Turn {
  id: string;               // 渲染 key：流式期间 tmp-<seq>，收到 meta 后替换为 assistantMessageId
  messageId: string | null; // 服务端助手消息 id；收到 meta 后与 id 相同
  roundId: string | null;   // 本轮关联键
  userMessageId: string | null;
  question: string;
  answer: string;
  sources: QaSource[];
  status: TurnStatus;
  error: string | null;
  meta: QaDone | null;
  origin: 'live' | 'history';
  createTime: string | null;
}
```

沿用现有 `Turn.id` 作为渲染 key，避免无谓改名；`useQaStream` 里表示「当前流式轮」的 `activeId` 改名为 `streamingTurnId`，与 `activeConversationId` 区分。

状态归属：

- `useConversations`：列表、`mode`、`activeConversationId`、删除目标与删除忙碌态。
- `useConversationHistory`：只负责 `GET .../messages` 的加载状态与 `MessageItem[]` 结果，不持有 `Turn[]`。
- `useQaStream`：继续持有当前视图的 `turns` 与 `streamingTurnId`；新增 `resetTurns(turns)` 供历史加载后灌入，新增 `removeTurn(id)` 供错误回滚。
- `ChatPage`：唯一编排层，历史加载成功后调用 `resetTurns(buildTurns(messages))`；`onMeta` 在同一次回调里调用 `useConversations.adopt()` 与 `useQaStream` 的 id 替换。

`ask` 的返回值用于区分「流前被拒」与「流内失败」，避免 ChatPage 反解析错误对象：

```ts
type AskResult =
  | { kind: 'finished'; status: 'done' | 'stopped' | 'error'; hadMeta: boolean }
  | { kind: 'rejected'; status: 400 | 404 | 409; message: string; question: string };
```

- `rejected` 时 `useQaStream` 已回滚本轮乐观气泡，ChatPage 根据 `status` 做 400/404/409 三种会话级处理。
- 5xx / 网络失败不归入 `rejected`：气泡保留为 `error`，返回 `finished` 且 `hadMeta` 表示是否已收到 `meta`。

模式合法转移：

| 当前 | 事件 | 结果 | 同步动作 |
|---|---|---|---|
| empty | 列表加载到非空 | conversation | 选中列表首项并加载历史 |
| empty | 列表为空 | empty | 展示欢迎语 + 输入框 |
| empty | 点击「新对话」 | draft | 清空 turns，`activeConversationId = null` |
| empty | 直接在输入框发送 | draft →（meta 后）conversation | 请求体不带 `conversationId` |
| draft | 再次点击「新对话」 | draft | 清空当前草稿，列表不变 |
| draft | 首问收到 `meta` | conversation | 设置 active id、条目插入最近首位并高亮、替换临时 id |
| draft | 首问在 meta 前失败 | draft | 本轮标记失败；不产生列表条目 |
| draft | 点击已有会话 | conversation | 丢弃草稿、中止请求、加载目标历史 |
| conversation | 点击「新对话」 | draft | 中止流式、清空 turns、`activeConversationId = null` |
| conversation | 点击其他会话 | conversation | 中止流式、清空旧 turns、加载新历史 |
| conversation | 点击当前会话 | conversation | 不重载，只保留当前视图 |
| conversation | 当前会话删除成功 | conversation 或 empty | 切换到剩余列表首项；无剩余则回到空态 |
| conversation | 当前会话 404 | conversation 或 empty | 从列表移除并切换；不自动重试 |
| conversation | 当前会话历史加载失败 | conversation | 展示错误 + 重试，不保留上一会话残留 |
| 任意 | 刷新页面 | empty 或 conversation | 重新拉列表；草稿按约定丢弃 |

不变量：

- `mode === 'conversation'` 时 `activeConversationId` 必非空；其他模式下必为 `null`。
- 同一时刻最多一个 `Turn.status === 'streaming'`；流式期间输入框禁用。
- `deleteTarget !== null` 只可能是真实会话；草稿态不渲染删除入口。
- 临时 id 不持久化、不进入请求体/URL；历史与重试只认服务端 `messageId` / `conversationId`。
- `conversation` 模式下切换/加载期间不得展示上一会话的消息或来源。

单轮 Turn 的合法转移：

| 起点 | 事件 | 终点 | 说明 |
|---|---|---|---|
| 新轮 | 用户发送 | streaming | 立即插入用户气泡与助手占位，使用 `tmp-<seq>` |
| streaming | `meta` | streaming | 替换 id，记录 messageId / roundId / userMessageId |
| streaming | `sources` / `delta` | streaming | 更新来源与正文 |
| streaming | `done` | done | 记录 provider / elapsedMillis / sourceCount |
| streaming | `error` 事件 | error | 保留已生成正文与来源 |
| streaming | 用户停止 / 切换 / 删除前中止 | stopped | 保留已生成正文 |
| streaming | 流建立前 400/404/409 | 移除该轮 | 回滚乐观气泡；按错误分支处理 |
| streaming | 流建立前 5xx / 网络失败 | error | 气泡保留，可手动重试 |
| streaming | 流中断网 | error | 保留半截正文与已到达来源 |
| done / stopped / error | 重试 | 新 streaming 轮 | 旧轮原样保留，由后端生成新 `roundId` |

### 3. 侧栏与空态（以用户最新说明为准）

- 侧栏顶部是**「新对话」**；不出现旧稿的「新建会话」，也不出现原型顶部的「会话」标题计数。
- 下方只有一个**「最近」**分组；**「项目」分组本次不做**。
- 点击「新对话」进入草稿态，`conversations` 不变，列表不新增条目。
- 首问收到 `meta` 后，新会话条目插入「最近」最前并高亮；高亮项同时是当前会话。
- 每条真实会话 hover / focus-within 时显示小删除按钮；草稿态没有删除入口。
- 删除按钮必须触发 `ConfirmDialog` 二次确认，确认前不发请求；文案写明「删除后不可恢复」。
- 首页空态是欢迎语 + 输入框；在空态直接发送等同于草稿首问，不要求先点「新对话」。
- 布局沿用现有 224px 主导航；对话页内部为「会话侧栏 240px（可折叠）| 对话主区 1fr | 检索面板 300px（可折叠）」。原型为 236 / 288，实现取需求文档的 240 / 300，现状 `TracePanel` 已是 300。
- 会话条目 DOM 不允许按钮嵌套：`li` 内放一个铺满的选择按钮和一个绝对定位的删除按钮。
- 窄屏沿用现有 `collapsed` 思路：会话侧栏可折叠为窄条；不隐藏主导航，不做复杂响应式。

### 4. 会话列表与草稿

- 进入 `/chat`：`GET /api/conversations`；非空选中首项（后端已按 `updateTime DESC` 排序）并加载历史；为空展示欢迎态。
- 列表加载失败：展示错误与重试，不自动进入草稿。
- 草稿标题不落库；首问前 20 个字符由后端生成。前端仅在 `meta` 到达后做一次乐观列表插入，随后用列表接口结果覆盖。
- 乐观条目的 `conversationId` 来自 `meta`，标题与时间仅用于即时展示；刷新接口返回后以服务端字段为准。
- 列表刷新时机：`meta` 到达时（让条目立即出现）与本轮 `done` 后（更新排序/时间）。刷新失败不得改变当前会话视图。
- 删除成功后从本地列表移除；若删的是当前会话，`abort` 当前流并按列表剩余首项切换，列表空则回空态。
- 重复删除返回 404 视为「已经不存在」：移除本地条目并提示，不弹错。
- 草稿不写 `localStorage` / `sessionStorage`；刷新或切走即丢弃。

### 5. API 客户端与 `X-User-Id`

- 唯一用户标识常量在 `src/lib/identity.ts`：`DEV_USER_ID = 'dev-user-001'`；其他文件不得出现该字面量。
- `src/api/client.ts` 提供统一请求头构造（例如 `authHeaders(extra?: HeadersInit): Headers`），`request()` 与 `/api/qa` 的 `fetch` 都必须使用它。
- 注入的是请求头 `X-User-Id`，不在请求体重复传 `userId`。
- 路径统一经 `apiPath()`；现有 Vite `/api` 代理无需修改。

客户端方法清单：

| 方法 | HTTP / 路径 | 入参 | 返回 | mock |
|---|---|---|---|---|
| `listConversations` | `GET /api/conversations` | 无 | `ConversationSummary[]` | `listConversationsMock` |
| `deleteConversation` | `DELETE /api/conversations/{conversationId}` | `conversationId` | `{ conversationId: string; deleted: true }` | `deleteConversationMock` |
| `listMessages` | `GET /api/conversations/{conversationId}/messages` | `conversationId` | `MessageList` | `listMessagesMock` |
| `streamQa` | `POST /api/qa`（SSE） | `conversationId: string \| null`、`question`、handlers、`signal` | `Promise<void>` | `streamQaMock` |

- 不存在 `POST /api/conversations`；前端不提供 create 方法。
- `conversationId` 为 `null` 时请求体省略该字段；`topK` 不传（后端默认 4）。
- 非 SSE 响应先判 `response.ok`，再解包；失败抛 `ApiError`，`status` 与 `code` 都要保留。
- `MessageList` 按 `id ASC` 扁平返回；`MessageItem` 的 `sources / provider / elapsedMillis / error` 按契约可为 `null`。
- 契约文档新增的 `QaSourceItem` 与现有 `QaSource` 字段一致，用 `type QaSourceItem = QaSource` 别名镜像，避免在同一文件重复声明两份来源结构。

### 6. SSE `meta` 与临时 id

事件顺序：

```text
meta → [sources] → delta* → done
                    ↘ error（纯文本，随后断流）
```

- `meta` 恒为首事件，四字段：`conversationId`、`roundId`、`userMessageId`、`assistantMessageId`，全部为非空字符串；用类型守卫解析，任一缺失按协议错误处理。
- `sse.ts` 的 `parseSseBlock` 不改；`qa.ts` 新增 `meta` 分支与 `onMeta(meta)` 回调，`done` 仍只读三字段。
- 临时 id 的生命周期：
  1. 发送时生成 `tmp-<seq>`（hook 内 `useRef` 计数，不用全局变量）。
  2. 助手气泡与消息列表项先以该 id 渲染，`messageId / roundId / userMessageId` 为 `null`。
  3. 收到 `meta` 的同一事件循环内：把 `Turn.id` 替换为 `assistantMessageId`，写入 `messageId / roundId / userMessageId`，同时把 `activeConversationId` 设为 `conversationId`（草稿转正）。
  4. 之后所有增量、来源、重试、引用定位只认服务端 id。
- id 替换会让该轮 React 节点重挂载一次；发生在首个 `delta` 之前，不影响可见内容。替换后不得保留两份同轮数据。
- `meta` 解析失败（字段缺失或非字符串）：本轮标记 `error`，展示协议错误原因，并中止后续事件消费；草稿保持草稿。
- 首问在 `meta` 前失败：保持草稿、无 `conversationId`；用户重发会新建会话（已知限制，接受）。
- `meta.conversationId` 与当前 active id 不一致时，以 `meta` 为准并刷新列表（防御归属错乱）。

### 7. 历史消息与轮次

- 历史加载是唯一事实源：切换会话、刷新页面后都走 `GET .../messages`，不把本地缓存当事实。
- 前端按 `roundId` 分组，不依赖数组相邻下标，也不依赖 `createTime`：
  - 每组必须恰好有一条 `USER` 与一条 `ASSISTANT`；缺任一角色整组跳过，不与相邻轮拼接。
  - `USER` 在右，`ASSISTANT` 在左；引用取自 `ASSISTANT.sources`。
  - `DONE` 复原为可点击引用的正文；`FAILED` 展示错误 + 重试；`STOPPED` 展示「已停止」。
  - 历史来源 `sources: []` 表示未召回，按普通提示展示。
  - 历史轮次不显示「正在检索 / 回答生成中」，也不显示流式光标。
- 历史 `Turn.meta` 只在 `DONE` 时由 `provider / elapsedMillis / sourceCount` 复原；`FAILED / STOPPED` 允许 `provider / elapsedMillis` 为 `null`，展示为「—」。
- 引用点击进入该轮来源视图；切换会话时重置到最近一轮。
- 历史重试＝同一问题在当前会话新发起一轮，旧轮保持原样；新 `roundId` 由后端返回。

### 8. mock 内存会话仓库

`src/api/mock.ts` 增加模块级内存仓库；事件编排仍留在 `src/api/qa.ts` 的 `streamQaMock` 分支，避免把 SSE 节奏拆到两个文件：

```ts
interface MockConversation {
  conversationId: string; // 模拟后端生成，前端业务层不得自行生成
  title: string;
  createTime: string;     // 'YYYY-MM-DD HH:mm:ss'
  updateTime: string;
  messages: MessageItem[];
}
```

行为：

- `qa.ts#streamQaMock(conversationId | null, question, handlers, signal)`，读写 `mock.ts` 的仓库：
  - `conversationId === null`：创建内存会话，标题取首问前 20 个 code point，先插入 `USER` 消息，再回调 `onMeta`；`meta` 由 mock 生成，模拟后端职责。
  - 已有 id：不存在则抛 `ApiError('会话不存在', 404, 404)`；存在则追加本轮 `USER`。
  - 之后按现有节奏回调 `sources / delta / done`；未召回分支沿用关键词触发。
  - 正常结束写入 `ASSISTANT(DONE)`，含 sources / provider / elapsedMillis。
  - `AbortError`：写入 `ASSISTANT(STOPPED)`，保留已生成正文，再把异常抛给上层。
  - 其他异常：写入 `ASSISTANT(FAILED)` 后抛出。
  - 每轮刷新 `updateTime`。
- 列表按 `updateTime` 倒序；删除为内存移除，不存在返回 404；历史返回扁平数组并带 `roundId`。
- mock 只在 `api/` 内生效，组件层不出现 `if (mock)`；`isMockEnabled()` 不变。
- mock 数据刷新即失效，不写任何持久化。

### 9. 错误语义

| 场景 | 前端处理 |
|---|---|
| 流建立前 400 | 展示服务端 `msg` 原文；回滚乐观气泡；恢复输入内容；不自动重试 |
| 流建立前 404 | 从列表移除该会话；提示（优先用服务端 `msg`）；切到剩余最近会话或空态；不再向该 id 发请求 |
| 流建立前 409 | 展示服务端 `msg`（「该会话正在生成回答，请稍后」）；回滚乐观气泡；恢复输入内容；不自动重试 |
| 流建立前 5xx | 保留本轮 error 气泡；可手动重试 |
| 流建立前网络失败 | 保留本轮 error 气泡（草稿仍为草稿）；可手动重试；首问重发可能重复建会话（接受） |
| 流中 `error` 事件 | 保留半截正文与已到达来源；展示原因 + 重试 |
| 流中网络中断 | 同上，文案「连接中断」类，保留已有内容 |
| 用户停止 | 标记 stopped，保留正文；仍可继续提问 |
| 历史加载 404 | 移除会话、提示、切换；不显示上一会话残留 |
| 历史加载 5xx / 网络 | 保留当前会话框架，展示错误 + 重试；不自动切换 |
| 删除 404 | 视为已删除，移除本地条目并提示 |
| 删除 5xx / 网络 | 保留条目与确认弹窗，弹窗内展示服务端原因 |
| 列表首屏失败 | 展示错误 + 重试；不自动创建会话 |

- 错误文案一律优先使用服务端 `msg` 原文，不改写成笼统「操作失败」。
- 409 / 404 不自动重试；重试只能由用户点击。
- 恢复输入通过受控 `Composer`（`value` + `onChange`）或等价的 `restore` 接口完成；不得在渲染期写全局。

### 10. 规范冲突与处理

| 冲突点 | 现有说法 | 本 spec 决策 |
|---|---|---|
| SSE 事件集合 | `AGENTS.md` §5.2 固定四种 `sources/delta/done/error` | 新增第五种 `meta`，必须同步修订 `AGENTS.md`；解析仍走 `parseSseBlock` |
| 单轮约束 | `AGENTS.md` §7「对话是单轮、不提供新会话按钮」 | 本次升级为多轮，必须有「新对话」入口；修订该条 |
| 空态 vs 草稿 | 前端需求文档 §4.2 要求无会话展示空态，§5.3 又用 `activeConversationId === null` 同时表示草稿 | 两者在同一文档内冲突；「首页空态 + 输入框」使 null 歧义，改用 `ChatMode` 判别 |
| 侧栏结构 | 前端需求文档 §4.1/§4.2 与用户最新说明已一致：顶部「新对话」、下方「最近」、空态欢迎语 + 输入框；原型亦同 | 直接遵循；「项目」分组不实现 |
| 首问条目出现时机 | 原型在发送时先插入一条隐藏会话（`hidden: true`），等 meta 才显示 | 按需求文档执行：**收到 `meta` 后**插入「最近」首位并高亮，不在发送时占位 |
| 主导航 | 原型有 4 个导航项 | 保持现有 `AppShell` 两个导航项，不照搬原型 |
| 临时 id | 现有 `useQaStream` 用 `createId()` 生成 UUID 风格本地 id | 改为 `tmp-<seq>`；UUID 只能来自服务端 |
| 输入恢复 | 现有 `Composer` 内部持有文本，发送后立即清空 | 改为可恢复输入，供 409/400 回填 |
| 确认弹窗焦点 | 现有 `ConfirmDialog` 打开时聚焦取消按钮，关闭后未把焦点还给触发元素 | 删除会话弹窗关闭后由调用方把焦点还给条目的删除按钮 |
| `keywordHits` 注释 | `types.ts` 注释「未命中时为 0」 | 契约为 `null`；保留 `number \| null` 并把注释改成「未命中时为 null」 |
| `QaDone` 可空性 | 历史消息的 `provider / elapsedMillis` 可为 `null` | 保留 `QaDone` 供展示复用；历史仅在 `DONE` 时复原，否则按空值展示 |

ADR-0001 继续有效：后端契约只在 `src/api/types.ts` 镜像一次，其他文件不私自定义字段类型。

### 11. 明确约束

- 不新增依赖、不加路由、不做暗色主题、不做登录/用户切换、不做会话搜索/分页/改名/置顶/未读。
- 不出现禁用词：页码、token/令牌、解析中、待解析、进度百分比、查询改写、重排/rerank、top-k 重排、部门。
- 不伪造上下文：历史是否参与生成由后端决定，前端只负责提交 `conversationId` 与当前问题。
- 不在组件层做裸 `fetch`，不在组件层判断 mock。
- 删除确认弹窗关闭后，焦点必须回到触发它的会话条目删除按钮；会话条目选择按钮与删除按钮不得嵌套。

## Testing Decisions

好的测试只验证外部行为，不验证 hook 内部状态或具体实现分叉。优先使用现有 seam，不新增测试框架依赖。

现有可用 seam：

1. `src/api/sse.ts#parseSseBlock`：纯函数，已有 SSE 分块解析能力。
2. `src/api/qa.ts#streamQa` 的 handlers 边界：`onMeta / onSources / onDelta / onDone / onError`，可用 mock 或可读流驱动。
3. `src/api/client.ts#request`：统一解包与 `ApiError`，现有文档页已在用。

本 spec 新增的最高价值 seam：

- `history.ts` 的纯函数 `MessageItem[] → Turn[]`：验证 `roundId` 分组、缺角色跳过、乱序不影响配对、`FAILED/STOPPED` 保留正文。
- `lib/format.ts` 的首问标题截断：按 code point 截 20 字。
- `ConversationSidebar` 的组件契约（列表/当前项/新建/删除回调）：通过 props 驱动，不依赖网络。

测试决策：

- 仓库当前没有测试运行器（无 vitest / testing-library），本次不引入新依赖；自动化验证以 `npm run typecheck`、`npm run lint`、`npm run build` 为准。
- 行为验证以 `?mock=1` 的手工验收矩阵为主；mock 承担「测试替身」角色，覆盖草稿、首问、多轮、停止、失败、删除、404/409、切换。
- 若后续引入测试运行器，优先为上述纯函数与 `streamQa` handlers 边界补单测，不对 `ChatPage` 内部 state 做快照测试。

可断言的验收清单：

**契约与请求头**

- [ ] 所有会话接口与 `/api/qa` 请求头都带 `X-User-Id: dev-user-001`，草稿首问也不例外。
- [ ] `dev-user-001` 字面量只出现在 `identity.ts`。
- [ ] 草稿首问请求体不含 `conversationId`；已有会话请求体包含当前 `conversationId`。
- [ ] `topK` 不传；非 SSE 响应先判 `response.ok` 再解析。

**进入与空态**

- [ ] 无会话进入 `/chat`：欢迎语 + 输入框可见，不自动建档、不调用删除。
- [ ] 有会话进入 `/chat`：自动选中最近更新项并加载历史。
- [ ] 列表首屏失败：错误 + 重试，不自动进入草稿。
- [ ] 点击「新对话」：`activeConversationId` 为空，列表条目数不变，主区出现「未保存」标识。
- [ ] 草稿态再次点击「新对话」：当前草稿被清空，仍为草稿。
- [ ] 草稿不写 `localStorage`；刷新后列表无新增。

**首问与 meta**

- [ ] 首问发送后立即出现用户气泡与助手占位，助手 `Turn.id` 匹配 `tmp-<seq>`。
- [ ] SSE 首事件为 `meta`；到达后 `Turn.id` 变为 `assistantMessageId`，并记录 `roundId` 与 `userMessageId`。
- [ ] 首问成功后条目出现在「最近」首位并高亮，标题等于首问前 20 个 code point。
- [ ] 首问在 `meta` 前失败：保持草稿，列表无新增条目。
- [ ] 后续提问请求体携带 `conversationId`，且等于当前 active id。
- [ ] 刷新页面后历史消息的 `messageId` 与流式当时 `meta.assistantMessageId` 一致。
- [ ] `meta` 四字段缺失时不继续消费后续事件，本轮标记失败。

**历史与轮次**

- [ ] 扁平数组按 `roundId` 分组，`USER` 在右、`ASSISTANT` 在左。
- [ ] 组内缺任一角色整组跳过。
- [ ] `createTime` 相同或接口顺序异常时，配对仍正确。
- [ ] `DONE` 历史的【来源N】可点击，右侧面板展示该轮 `sources`、`provider`、耗时与引用数。
- [ ] `sources: []` 的历史轮展示未召回提示。
- [ ] `FAILED` 历史展示错误 + 重试；`STOPPED` 展示「已停止」；两者正文都保留。
- [ ] 历史轮次不显示流式状态；引用点击能切换面板并高亮。
- [ ] 重试历史 `FAILED` 轮后，新轮使用新 `roundId`，旧轮不变。

**删除与切换**

- [ ] hover / focus 会话条目显示删除按钮；草稿态没有删除入口且不发 `DELETE`。
- [ ] 删除必须二次确认；确认前无请求发出。
- [ ] 删除当前会话后切到剩余最近会话；列表空时回空态。
- [ ] 删除非当前会话不改变当前对话。
- [ ] 切换会话会中止上一会话的流，且不显示旧会话正文或来源。
- [ ] 删除失败保留条目与弹窗，并在弹窗内展示服务端原因。
- [ ] 重复删除返回 404 时，本地条目被移除并提示。

**错误与停止**

- [ ] 409：展示服务端原文，原问题回到输入框，无自动重试，无残留助手气泡。
- [ ] 404：移除会话、提示、切到最近或空态，后续不再请求该 id。
- [ ] 网络中断：保留半截正文与已到达来源，显示错误 + 重试。
- [ ] 用户停止：显示「已停止」，正文保留，可再次提问。
- [ ] 400：展示服务端原文并恢复输入内容。

**mock 与构建**

- [ ] `?mock=1` 下草稿、首问、多轮、停止、失败、切换、删除、404/409 全流程可用。
- [ ] mock 首事件为 `meta`，标题为 20 code point，列表按 `updateTime` 倒序。
- [ ] mock 停止后历史中出现 `STOPPED` 助手消息并保留半截正文。
- [ ] mock 刷新即重置，不写持久化。
- [ ] 1440px 无横向溢出；窄屏会话侧栏可折叠。
- [ ] 文档管理页与主导航不受影响。
- [ ] `npm run typecheck`、`npm run lint`、`npm run build` 通过。

## Out of Scope

- 后端任何改动（schema、接口、懒创建、历史装配、锁与落库）。
- 会话标题生成算法本身（后端负责；前端只展示）。
- 会话改名、置顶、未读、搜索、分页、软删恢复、导出。
- 「项目」分组及其任何占位。
- 登录、用户切换、真实鉴权；`X-User-Id` 仍是开发期常量。
- 消息重新生成、编辑、反馈、多选删除。
- 首问幂等（`clientRequestId`）；接受超时重发产生重复会话。
- 暗色主题、i18n、新依赖、新路由、文档管理页改造。
- 自动 UI 测试框架与测试依赖引入。

## Further Notes

- 已知限制一：首问未带 `conversationId`，若请求超时但后端已创建会话，重发会产生第二条会话；前端不做去重，用户可手动删除。
- 已知限制二：草稿不持久；刷新、关闭或切走即丢弃，这是用户可感知且已接受的行为。
- 已知限制三：目前仓库不是 git 仓库、没有 `.issues`、没有 `gh`；按仓库既有 `docs/agents/issue-tracker.md` 的本地 markdown 约定，本 spec 与 tickets 落在 `.scratch/multi-turn-frontend/`。
- 原型只用于对齐视觉：三栏比例、hover 删除、确认弹窗、来源面板。原型的 4 个导航项不采纳；其「发送时先插隐藏会话、meta 后显示」的做法也不采纳，按需求文档在 meta 后插入。
- 实现前需先修订 `AGENTS.md` 的单轮与事件集合约束，否则实现会与仓库规范直接冲突（见 tickets 首项）。
