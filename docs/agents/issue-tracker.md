# Issue tracker：本地 Markdown

本仓库的 issue 与 spec 以 markdown 文件形式存放在 `.scratch/` 下。

## 约定

- 每个特性一个目录：`.scratch/<feature-slug>/`
- 该特性的 spec 为 `.scratch/<feature-slug>/spec.md`
- 实施类 issue 一票一文件：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，编号从 `01` 开始，不允许把所有 ticket 合并成单个文件
- triage 状态记录在 issue 文件顶部的 `Status:` 行（角色字符串见 `triage-labels.md`）
- 评论与对话历史追加到文件底部的 `## Comments` 标题下

## 当技能要求"发布到 issue tracker"

在 `.scratch/<feature-slug>/` 下新建文件（目录不存在则创建）。

## 当技能要求"获取相关 ticket"

直接读取被引用的路径。用户通常会直接给出路径或 issue 编号。

## Wayfinding 操作

供 `/wayfinder` 使用。**map** 是一个文件，每个 ticket 对应一个 **child** 文件。

- **Map**：`.scratch/<effort>/map.md`（承载 Notes / Decisions-so-far / Fog 正文）。
- **Child ticket**：`.scratch/<effort>/issues/NN-<slug>.md`，编号从 `01` 开始，问题写在正文里。`Type:` 行记录 ticket 类型（`research`/`prototype`/`grilling`/`task`）；`Status:` 行记录 `claimed`/`resolved`。
- **阻塞**：靠近顶部的 `Blocked by: NN, NN` 行。当它列出的每个文件都是 `resolved` 时，该 ticket 才算解除阻塞。
- **Frontier**：扫描 `.scratch/<effort>/issues/`，找出 open、未阻塞且未被认领的文件；编号最小者优先。
- **认领**：先写入 `Status: claimed` 并保存，再开始工作。
- **解决**：在 `## Answer` 标题下追加答案，写入 `Status: resolved`，然后把上下文指针（要点 + 链接）追加到 `map.md` 的 Decisions-so-far 中。
