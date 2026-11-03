# 08: mock 全链路回归与构建收尾

**What to build:** 把 mock 仓库补齐为完整演示环境，跑通全部用户路径并做交付前回归：无会话空态、新对话草稿、首问转正、历史查看、多轮追问、停止、失败、未召回、重试、切换、删除、404/409/网络中断；同时确认文档管理页、主导航、窄屏布局未回归，构建命令通过。

**Blocked by:** 01、02、03、04、05、06、07

**Status:** ready-for-agent

**后端并行:** 否（作为 mock 回归与联调前基线；真实后端联调另做，不在本 ticket 范围）

**范围:** mock 完整性、手工验收矩阵、构建与静态检查、回归

**预估:** 1h

- [x] `?mock=1` 下 8 个核心场景全部可演示：空态、草稿、首问、历史、多轮、停止、删除、错误
- [x] mock 首事件为 `meta`；标题 20 code point；列表按 `updateTime` 倒序；刷新即重置
- [x] mock 停止后历史中出现 `STOPPED` 助手消息并保留半截正文；失败轮保留 `FAILED`
- [x] 404 / 409 / 未召回 / 网络中断四条错误路径均可复现
- [x] 桌面与窄屏（420px）均无横向溢出；会话侧栏可折叠（联调阶段补修，见 Comments）
- [ ] 确认弹窗关闭后焦点回到删除按钮的可见焦点环（桌面行为已由 jsdom 断言，浏览器截图层面未验）
- [x] 文档管理页上传、列表、切片抽屉不受影响；主导航正常
- [x] 无裸 `fetch`、无组件层 mock 分支、无 `console.log`、无新增依赖
- [x] `npm run typecheck`、`npm run lint`、`npm run build` 全部通过

## Comments

- 2026-11-03：新增 `src/api/mock.test.ts`(5)：meta 四标识、标题 20 code point、列表倒序、STOPPED/FAILED 历史终态与半截正文、刷新重置、忙碌 409 / 缺失 404。
- 静态检查：`fetch(` 仅出现在 `src/api/client.ts` 与 `src/api/qa.ts`；`src/features` 无 mock 分支（仅测试文件设置 `?mock=1`）；全仓无 `console.*`；`package.json` 依赖未新增（仅原测试栈）。
- UI 回归（dev server + mock）：文档管理页 3 条文档、查看切片抽屉可开可关；导航切到对话页显示空态欢迎语与输入框；首问 + 追问两轮并存、侧栏 1 条；流式中「停止」显示「已停止」并保留部分正文；侧栏折叠/展开正常；当前视口 `scrollWidth=960`、`innerWidth=960`，无横向溢出。
- 全量回归：17 个测试文件 / 75 个用例通过；`typecheck`、`build` 通过；`lint` 0 error（3 条既有 fast-refresh warning）。
- 未验证：窄屏 420px 下的布局（浏览器工具无法调整视口），需人工缩放窗口复核；确认弹窗关闭后的可见焦点环由 jsdom 单测断言 `document.activeElement`，未在浏览器截图层面复核。

### 联调回填：420px 窄屏修复（2026-11-03）

**归属判断**：本项归票 08。票 02 的验收口径是「三栏布局可用、1440px 无横向溢出」，窄屏无溢出属于本票「桌面与窄屏均无横向溢出」的交付回归项；代码落点虽是票 02 建立的 `AppShell` 与 `ChatPage` 主区，但不改变票 02 的验收标准，故不向票 02 回填。

**问题**：`AppShell` 左侧主导航固定 224px，420px 视口下叠加会话侧栏（40px 折叠态）与检索面板（40px 折叠态）后，主区只剩约 190px，标题、回答卡片与输入区/发送按钮被右侧裁切，出现横向溢出。

**修复**：
- `src/components/AppShell.tsx`：`<640px` 时主导航收为 56px 图标栏——隐藏品牌文案、导航文字与「知识库概览」卡，导航项居中并补 `aria-label`；头部水平留白 `px-3 sm:px-5`。`≥640px` 保持原 224px 行为不变。
- `src/features/chat/ChatPage.tsx`：主区水平留白 `px-6 → px-3 sm:px-6`。

**420px 实测（headless Edge/Chromium + CDP `Emulation.setDeviceMetricsOverride` 420×900）**：
- `innerWidth=420`、`documentElement.scrollWidth=420`（无横向溢出）
- 主区宽 284px、回答卡片 256px、输入框 234px、发送按钮右边界约 355px（完整在视口内）
- 侧栏折叠态 40px 与检索面板折叠态 40px 均正常显示

**验证方式**：CDP `Runtime.evaluate` 读取 `getBoundingClientRect` 与 `scrollWidth` 量值，`Page.captureScreenshot` 留档；另用 960px 视口跑完首问、追问、停止、409/404、删除确认等真实后端交互，确认 `≥640px` 无回归。修复前基线截图见 `.screenshots/chat-420.png`，修复后见 `.screenshots/chat-420-cdp.png`（`.screenshots/` 不入库）。注意 `--window-size` 直出截图与实际 viewport 存在偏差，量值以 CDP 为准。

**回归**：17 个测试文件 / 75 个用例通过；`typecheck`、`build` 通过；`lint` 0 error（3 条既有 fast-refresh warning）。

