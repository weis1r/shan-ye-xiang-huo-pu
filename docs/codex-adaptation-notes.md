# 从 Claude Code Game Studios 到 Codex 的适配说明

这份模板不是原样移植，而是按 Codex 的能力边界重做过一遍。

## 核心映射

| 原版思路 | 这里怎么替代 |
| --- | --- |
| `CLAUDE.md` | 根级 `AGENTS.md` |
| path-scoped rules | 分目录 `AGENTS.md` |
| 48 agents | 8 个工作模式 |
| 37 skills / slash commands | `prompts/` 里的提示卡 |
| 自动 hooks | `scripts/studio-check.sh` 手动校验 |
| 会话恢复 | `production/studio-status.md` |

## 为什么这样改

### 1. 减少角色负担

Codex 更适合“一个强助手，按任务切模式”，而不是长期维持几十个角色层级。

### 2. 保留路径规则

Codex 官方支持在仓库里放 `AGENTS.md`。
因此最有价值的“路径约束”能力，可以通过根目录和分目录规则继续保留。

### 3. 放弃过重自动化

原版有不少 hook 和命令编排。
对独立开发来说，先保留一个稳定的手动检查入口，往往比一开始就铺满自动化更实用。

## 故意删掉了什么

- 多层级 agent 委派体系
- 大量 engine-specific specialist 文件
- 强依赖 Claude slash command 的交互形式
- 偏“公司化”的流程外壳

## 故意保留了什么

- 项目先对齐再动手的习惯
- 设计、实现、验证三者同步
- 按目录约束 AI 的做法
- 让 AI 提供选项，而不是替你抢决策

## 如果以后要扩展

建议按这个顺序加：

1. 先补更多模板
2. 再补更多提示卡
3. 再补引擎专用脚本
4. 最后才考虑更复杂的自动化
