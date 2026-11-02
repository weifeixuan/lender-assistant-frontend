# 领域文档

工程类技能在探索代码库时应如何消费本仓库的领域文档。

## 探索前先读这些

- 仓库根目录的 **`GLOSSARY.md`**；
- 仓库根目录若存在 **`GLOSSARY-MAP.md`**：它指向每个上下文的 `GLOSSARY.md`，读取与当前主题相关的那些；
- **`docs/adr/`**：读取与即将改动的区域相关的 ADR。多上下文仓库还需检查 `src/<context>/docs/adr/` 下的上下文级决策。

若这些文件不存在，**静默继续**，不要提示缺失，也不要主动建议先创建它们。`/domain-modeling` 技能（可通过 `/grill-with-docs` 与 `/improve-codebase-architecture` 触达）会在术语或决策真正被确定时按需创建。

## 文件结构

本仓库为单上下文（single-context）：

```
/
├── GLOSSARY.md
├── docs/
│   ├── adr/
│   │   └── ADR-0001-前端独立仓库与契约镜像.md
│   └── agents/
└── src/
```

ADR 文件名格式为 `docs/adr/ADR-NNNN-<slug>.md`，编号四位、递增。

## 使用 glossary 的词汇

当输出中要命名某个领域概念时（issue 标题、重构提案、假设、测试名等），使用 `GLOSSARY.md` 中定义的术语，不要漂移到 glossary 明确回避的同义词。

若需要表达的概念尚未进入 glossary，这是一个信号：要么是在发明项目并不使用的语言（重新考虑），要么是存在真实缺口（为 `/domain-modeling` 记录下来）。

## 标注 ADR 冲突

若输出与既有 ADR 相矛盾，请显式暴露出来，而不是静默覆盖：

> _与 ADR-0007（event-sourced orders）矛盾，但值得重开讨论，因为……_
