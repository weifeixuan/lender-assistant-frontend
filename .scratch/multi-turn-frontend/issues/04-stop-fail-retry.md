# 04: 停止、失败、未召回与重试

**What to build:** 用户在生成过程中可以停止，已生成的半截正文保留并标记「已停止」；后端推送 `error` 事件时，本轮保留已到达正文与来源，展示服务端原因并提供「重试」；本轮未召回时不出现 `sources`，按普通提示展示而不是错误。重试是在当前会话发起新一轮，旧轮原样保留。

**Blocked by:** 03 重新打开、历史轮次与多轮追问

**Status:** ready-for-agent

**后端并行:** 可（mock 用关键词模拟空召回与生成失败，停止用 `AbortController` 驱动）

**范围:** 停止、`error` 事件、空召回、轮次级重试、历史失败/停止展示

**预估:** 1.5h

- [x] 点击停止后 `AbortController.abort()`，本轮状态为 `stopped`，已生成正文与已到达来源保留
- [x] 停止后输入框恢复可用，可继续提问；停止不算失败，不弹错误
- [x] 收到 SSE `error` 事件：本轮状态为 `error`，保留半截正文与来源，展示服务端原因 + 「重试」
- [x] 未收到 `sources` 或 `sourceCount === 0`：展示未召回普通提示，不标记失败
- [x] 重试在当前会话发起新一轮，旧轮内容与状态不变；新轮使用后端返回的新 `roundId`
- [x] 流式期间禁止重复提交；停止按钮仅在流式中可用
- [x] 历史 `FAILED` 轮可重试，历史 `STOPPED` 轮显示「已停止」且正文保留
- [x] mock 模式可演示停止、空召回、生成失败、重试四种路径

## Comments

- 2026-11-03：新增 `Composer.test.tsx`(3)、`Thread.test.tsx` 重试点击断言、`useQaStream.test.tsx` 扩充停止/错误/空召回/重试 4 例；全仓 12 个文件 / 53 个用例通过，`typecheck` / `build` 通过，`lint` 0 error。
- UI 手工验证（dev server + 全站 mock）：流式中点「停止」→「已停止 已生成的内容保留」、部分正文与来源保留、输入框恢复；「没有资料的问题」→未召回提示且无错误；「请模拟生成失败」→错误原文 + 重试；点重试后新增一轮成功回答，失败轮保留。
- mock 生成失败与网络中断各只触发一次，便于演示「重试恢复」；增量节奏调慢到 70ms/段，保证停止按钮有可点击窗口。

### 联调回填：FAILED 端到端演练（2026-11-03）

**触发方式（后端既有开关，前端零改动）**

```powershell
$env:RAG_RESILIENCE_CHAOS = "true"; java -jar target/lender-assistant-0.1.0-SNAPSHOT.jar
```

后端 `e:\project\lender-assistant`（8080），前端 dev server（5173，`VITE_USE_MOCK` 关闭）连真实后端；演练结束已停掉两个服务并换回干净进程。

**已知局限（如实标注）**：chaos 在模型调用**返回之后**才抛错（`ResilientLlmExecutor` 里 `call.get()` 成功后抛 `chaos: 模拟模型故障`），本次真实观测到的序列是 `meta → sources → delta×140 → error`，表现为**完整回答流完之后**才失败；「流到一半突然失败」的中间态本次**未覆盖**。另外连续触发后熔断器打开，后续轮次走熔断分支，属预期行为。

**后端侧事实（只读核对，未改后端）**

- SSE 序列：`meta`(1) → `sources`(1) → `delta`(140) → `error`(1)；`error` 原文 `问答失败：chaos: 模拟模型故障（rag.resilience.chaos=true）`；随后连接异常关闭（curl 18 / undici terminated），与 `QaServiceImpl` 的 `completeWithError` 一致。
- 落库：同轮 USER(DONE) + ASSISTANT(FAILED)，`error_msg` 与 SSE 一致，`sources` 4 条；历史接口返回该轮 `status=FAILED`、`sources` 完整。
- 熔断轮：SSE error 是「模型服务熔断中（连续失败已触发保护），…」，历史 `error_msg` 存的是短句「模型服务熔断中」。两处均为后端原文，前端不做改写；仅记录差异，不算前端 bug。

**逐项结果**

1. 当场失败态与文案来源：**PASS**。气泡为危险色块 + 「重试」，文案与后端 `error` 逐字符一致（`hasChaos=true`、`hasConnLost=false`）。证据 `.screenshots/chaos-1-failed-bubble.png`。
2. 重试：**PASS**（前端行为）。新增一轮，新 `roundId=5cc23186…` 与旧轮 `563c510f…` 不同，未串位到旧问题，旧轮内容与失败态不变；chaos 仍开时重试**再次失败**（走熔断分支返回后端原文），属预期、非 bug。证据 `.screenshots/chaos-2-retry-new-round.png`。
3. 刷新/重开：**PASS**。两轮均按 `roundId` 分组渲染、均为 FAILED、附「— · 耗时 — · 引用 4 条」。真实数据（12 个会话）中不存在缺角色轮次，「缺角色整组跳过」**未验证**（无法用现有数据构造）。证据 `.screenshots/chaos-3-refreshed-history.png`。
4. 输入框与发送按钮：修复前 **FAIL**，修复后 **PASS**——失败后 `textarea.disabled=false`、placeholder 恢复、填入文字后发送按钮可用。
5. 失败轮来源：**PASS**。检索过程侧栏仍可展开，来源明细 #1–#4 完整（双通道 / 向量距离 / 关键词命中 / 融合分数齐全），正文【来源3】【来源4】与明细编号一致。

**发现并修复的前端 bug（红 → 绿）**

- 现象：收到 `error` 后界面停在「回答生成中」，输入框与发送按钮保持禁用（需等连接最终关闭才恢复）；此时点「重试」会 abort 那条悬挂流，把旧失败轮改写成「已停止」。
- 根因：`src/api/qa.ts` 把 `error` 当普通事件后继续 `reader.read()`；后端 `completeWithError` 断流后浏览器侧读取长时间悬挂，`streamQa` 不返回，`useQaStream` 的 `finally` 清不掉 `streamingTurnId`，下一次 `ask()` 又 abort 这条悬挂流。
- 修复：`error` 即本轮终态——置 `halted`、跳出读取循环、`reader.cancel()` 释放连接后正常返回（协议异常同路径）；错误文案仍以 `onError` 原文落在气泡，不被兜底文案覆盖。
- 新增用例：`qa.test.ts`「ends the round on an SSE error event without waiting for the connection to close」、`useQaStream.test.tsx`「clears the streaming state when a real SSE error event arrives」。

**回归**：17 个测试文件 / 77 个用例通过；`typecheck`、`build` 通过。

**截图**（`.screenshots/` 不入库）：`chaos-1-failed-bubble.png`、`chaos-2-retry-new-round.png`、`chaos-3-refreshed-history.png`。

