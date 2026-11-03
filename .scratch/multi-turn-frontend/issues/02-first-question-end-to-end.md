# 02: 空态、新对话与首问端到端

**What to build:** 用户第一次打开对话页时，看到的是欢迎语 + 输入框；侧栏顶部有「新对话」，下方是空的「最近」分组。点击「新对话」进入草稿态，列表不新增条目；用户直接提问即可完成第一条端到端链路：请求不带 `conversationId`，助手气泡先以 `tmp-<seq>` 渲染，收到 `meta` 后转成真实会话，条目插入「最近」最前并高亮，回答继续流式显示到 `done`。

**Blocked by:** 01 契约基座与规范对齐

**Status:** ready-for-agent

**后端并行:** 可（mock 生成 `meta`，按契约模拟懒创建；真实后端联调放到联调阶段）

**范围:** 空态、会话侧栏外壳、草稿态、首问 SSE、`meta` 转正、三栏布局

**预估:** 2h

- [x] 进入 `/chat` 调 `GET /api/conversations`；为空时主区显示欢迎语，输入框可用，不自动建档
- [x] 侧栏顶部是「新对话」，下方只有「最近」分组，不出现「项目」分组
- [x] 三栏布局可用：会话侧栏 240px（可折叠）、对话主区 1fr、检索面板 300px（可折叠）；1440px 无横向溢出
- [x] 点击「新对话」进入草稿态：列表条目数不变，主区出现「未保存」标识
- [x] 草稿态再次点击「新对话」清空当前草稿，仍为草稿；草稿不写本地持久化
- [x] 草稿直接发送可用，等同于首问；请求体不含 `conversationId`，`topK` 不传，但携带 `X-User-Id`
- [x] 发送后立即出现用户气泡与助手占位，`Turn.id` 匹配 `tmp-<seq>`，`messageId / roundId / userMessageId` 为 `null`
- [x] SSE 首事件为 `meta`；到达后 `Turn.id` 替换为 `assistantMessageId`，记录 `roundId`、`userMessageId`
- [x] 收到 `meta` 后条目出现在「最近」首位并高亮；标题等于首问前 20 个 code point
- [ ] 首问在 `meta` 前失败（超时 / 网络）时保持草稿，列表无新增条目；重发仍按首问处理
- [x] 之后继续消费 `sources → delta* → done`，正文逐段追加；`done` 后显示 provider / 耗时 / 引用数
- [x] `meta` 四字段缺失或类型错误时本轮标记失败，不继续消费后续事件
- [x] mock 模式可完整演示「空态 → 新对话 → 首问 → 转正 → 列表条目出现」

## Comments

- 2026-11-03：TDD 完成。新增 `qa.test.ts`(6)、`conversations.test.ts`(4)、`history.test.ts`(5)、`ConversationSidebar.test.tsx`(6)、`useQaStream.test.tsx`(3)；全仓 10 个文件 / 39 个用例通过，`typecheck` / `build` 通过，`lint` 0 error。
- UI 手工验证（`/chat?mock=1`，dev server 实际运行）：空态欢迎语 + 输入框 + 侧栏「新对话 / 最近」且无「项目」；点击「新对话」出现「未保存」且列表不增条目；发送首问后回答逐段出现，侧栏出现同名条目并高亮。
- 未验证项：`meta` 到达前的网络 / 超时失败路径（mock 未构造该时序，留待票 07 与真实后端联调）；`:hover` 伪类下的删除按钮显隐仅由 `group-hover` 类保证，未用真实鼠标悬停验证（删除交互在票 06 验收）。
- 2026-11-03 输入区快捷键改造：提示文案改为「Enter 发送 · Alt+Enter 换行」；`Enter` 发送、`Alt+Enter` 在光标处插入 `\n`（`preventDefault` + 受控值改写 + `caretRef` 回填光标）、`Shift+Enter` 保留浏览器默认换行（兼容既有习惯）；IME 组合态（`isComposing` / `keyCode 229`）下 `Enter` 只上屏不发送。`Composer.test.tsx` 扩到 6 例（先红后绿），全仓 17 文件 / 80 用例通过，`typecheck` / `build` 通过。
- 浏览器实测（headless Edge + CDP，dev server 5173 热更新生效）：Alt+Enter → 值末尾追加换行、光标落在新行首、不发送；Shift+Enter → 同样换行、不发送；合成 `isComposing` Enter → 无变化不发送；Enter → 发送成功并进入流式。`Alt+Enter` 在 Edge headless 下正常触发，未被浏览器/输入法吞掉。
