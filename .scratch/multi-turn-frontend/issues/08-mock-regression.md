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
- [ ] 桌面与窄屏均无横向溢出；会话侧栏可折叠；确认弹窗关闭后焦点回到删除按钮（桌面已验；窄屏与可见焦点环未验，见 Comments）
- [x] 文档管理页上传、列表、切片抽屉不受影响；主导航正常
- [x] 无裸 `fetch`、无组件层 mock 分支、无 `console.log`、无新增依赖
- [x] `npm run typecheck`、`npm run lint`、`npm run build` 全部通过

## Comments

- 2026-11-03：新增 `src/api/mock.test.ts`(5)：meta 四标识、标题 20 code point、列表倒序、STOPPED/FAILED 历史终态与半截正文、刷新重置、忙碌 409 / 缺失 404。
- 静态检查：`fetch(` 仅出现在 `src/api/client.ts` 与 `src/api/qa.ts`；`src/features` 无 mock 分支（仅测试文件设置 `?mock=1`）；全仓无 `console.*`；`package.json` 依赖未新增（仅原测试栈）。
- UI 回归（dev server + mock）：文档管理页 3 条文档、查看切片抽屉可开可关；导航切到对话页显示空态欢迎语与输入框；首问 + 追问两轮并存、侧栏 1 条；流式中「停止」显示「已停止」并保留部分正文；侧栏折叠/展开正常；当前视口 `scrollWidth=960`、`innerWidth=960`，无横向溢出。
- 全量回归：17 个测试文件 / 75 个用例通过；`typecheck`、`build` 通过；`lint` 0 error（3 条既有 fast-refresh warning）。
- 未验证：窄屏 420px 下的布局（浏览器工具无法调整视口），需人工缩放窗口复核；确认弹窗关闭后的可见焦点环由 jsdom 单测断言 `document.activeElement`，未在浏览器截图层面复核。

