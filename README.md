# Codex Game Studio Lite

这是一个给独立游戏开发者使用的轻量工作室模板。
它借鉴了 Claude Code Game Studios 的思路，但改成了更适合当前 Codex 环境的做法：

- 用 `AGENTS.md` 代替 Claude 专用配置
- 用分目录 `AGENTS.md` 代替 path-scoped rules
- 用 `prompts/` 里的提示卡代替大量 slash commands
- 用一个手动校验脚本代替一整套自动 hooks

## 适合谁

- 1 到 3 人的小团队或个人开发者
- 需要从概念、设计、实现一直推进到可玩版本
- 希望 AI 有结构，但不想被 48 个角色和大量流程压垮

## 你现在拿到的东西

- 1 个根级 `AGENTS.md`
- 5 个分目录 `AGENTS.md`
- 6 张可直接复用的提示卡
- 4 份核心文档模板
- 1 个轻量校验脚本
- 1 份工作室状态文件

## 3 分钟上手

1. 先打开根目录里的 `AGENTS.md`
2. 填一下 `production/studio-status.md`
3. 把 `prompts/00-start.md` 发给 Codex，确认你当前处于哪个阶段
4. 如果还没想清楚做什么，用 `prompts/01-brainstorm.md`
5. 如果已经有方向，先用模板写 `design/gdd/` 里的设计文档，再让 Codex 开始实现
6. 每次做完一轮改动后，运行：

```bash
bash scripts/studio-check.sh
```

## 精简版工作模式

完整版思路被压缩成 8 个常用工作模式，详情见 `docs/solo-studio-lite.md`：

1. 概念探索
2. 系统设计
3. 技术决策
4. 核心实现
5. 内容与界面
6. 代码评审与 QA
7. 计划推进
8. 打磨与发布准备

## 目录说明

```text
AGENTS.md
src/
  AGENTS.md
  gameplay/
assets/
  AGENTS.md
  data/
design/
  AGENTS.md
  gdd/
docs/
  AGENTS.md
  architecture/
  templates/
production/
  AGENTS.md
  studio-status.md
  sprints/
  milestones/
prompts/
scripts/
tests/
  AGENTS.md
```

## 建议工作流

### 新项目

1. `prompts/00-start.md`
2. `prompts/01-brainstorm.md`
3. `docs/templates/game-concept.md`
4. `prompts/02-design-system.md`
5. `docs/templates/sprint-plan.md`
6. `prompts/04-implement-feature.md`

### 已有项目

1. `prompts/00-start.md`
2. 更新 `production/studio-status.md`
3. `prompts/03-sprint-plan.md`
4. `prompts/04-implement-feature.md`
5. `prompts/05-code-review.md`

## 设计原则

- 先问清楚，再写文件
- 先做最小可玩的切片，不要一口吃完整系统
- 设计改动要同步文档，实现改动要同步验证
- 让 Codex 扮演“结构化搭档”，不是“自动驾驶”

## 进一步说明

- 精简版工作室模型：`docs/solo-studio-lite.md`
- Codex 适配说明：`docs/codex-adaptation-notes.md`
- 设计和规划模板：`docs/templates/`

## 当前游戏原型

当前已经包含一个可玩的网页原型《山野香火铺》：

- 入口：`index.html`
- 数据：`assets/data/festival-content.json`
- 逻辑：`src/gameplay/main.js`
- 系统文档：`design/gdd/festival-booth-system.md`

### 本地运行

```bash
python3 -m http.server 4387
```

打开 `http://127.0.0.1:4387`

### 静态打包

```bash
npm run build
```

打包结果会输出到 `dist/`，适合直接部署到 CloudBase Hosting。
