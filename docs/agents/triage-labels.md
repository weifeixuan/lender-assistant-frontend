# Triage 标签

各技能使用五个规范化的 triage 角色。本文件把角色映射到本仓库 issue tracker 实际使用的标签字符串。

| mattpocock/skills 中的标签 | 本仓库 tracker 中的标签 | 含义 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 维护者需要先评估该 issue |
| `needs-info` | `needs-info` | 等待提交者补充信息 |
| `ready-for-agent` | `ready-for-agent` | 规格已完备，可交给 agent 离线执行 |
| `ready-for-human` | `ready-for-human` | 需人工实现 |
| `wontfix` | `wontfix` | 不予处理 |

本仓库的 tracker 是本地 markdown（见 `issue-tracker.md`），因此"标签"落在 issue 文件顶部的 `Status:` 行，例如：

```markdown
Status: ready-for-agent
```

当技能提到某个角色（如"打上 AFK-ready 的 triage 标签"）时，使用上表对应的字符串。

如需沿用其他命名，直接修改"本仓库 tracker 中的标签"列即可。
