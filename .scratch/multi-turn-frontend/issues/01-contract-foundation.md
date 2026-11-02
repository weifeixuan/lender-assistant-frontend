# 01: 契约基座与规范对齐

**What to build:** 建立多轮会话所需的共享契约与请求身份基座：会话/消息/meta 类型在唯一契约镜像文件里就位，所有会话与问答请求统一携带 `X-User-Id`，同时把仓库规范中「单轮对话」「SSE 只有四种事件」的旧约束改掉。完成后，后续每个 slice 都能直接消费同一套类型与请求头，不再各自定义。

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**后端并行:** 可（后端 P1 阶段即可开工，契约已定稿）

**范围:** 契约镜像、身份常量、请求客户端、仓库规范

**预估:** 1h

- [x] `ConversationSummary`、`MessageList`、`MessageItem`、`MessageRole`、`MessageStatus`、`QaMeta` 在 `src/api/types.ts` 只声明一次；可空字段一律 `null`
- [x] `QaSourceItem` 以 `type QaSourceItem = QaSource` 别名镜像，不重复声明两份来源结构
- [x] `src/lib/format.ts` 提供按 code point 截 20 字的标题函数，供乐观插入与 mock 共用
- [x] 新增 `src/lib/identity.ts` 导出 `DEV_USER_ID`，全仓库只有这一处出现 `dev-user-001` 字面量
- [x] `src/api/client.ts` 提供统一的请求头构造，`request()` 自动注入 `X-User-Id`
- [x] 现有文档管理页请求仍正常，`npm run typecheck` 通过
- [x] `AGENTS.md` 删除「对话是单轮 / 不提供新会话按钮」约束，SSE 事件集合加入 `meta`，并保留「不新增依赖」等其余约束

## Comments

- 2026-11-03：TDD 完成。新增测试 `format.test.ts`(5)、`identity.test.ts`(2)、`client.test.ts`(4)、`types.test.ts`(3)；全仓 5 个测试文件 15 个用例通过，`typecheck` / `lint`（0 error，3 条既有 warning）/ `build` 通过。
