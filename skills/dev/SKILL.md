---
name: dev
version: 2.0.0
updated: 2026-01-24
description: |
  统一开发工作流入口（两阶段 + 事件驱动）。

  触发条件：
  - 用户说任何开发相关的需求
  - 用户说 /dev
  - Hook 输出 [SKILL_REQUIRED: dev]

  v2.0.0 变更：
  - 两阶段分离：p0 (发 PR) + p1 (修 CI)
  - Stop Hook 强制质检（会话结束时强制）
  - 事件驱动循环（不挂着等待）
---

# /dev - 统一开发工作流（v2.0）

## 核心定位

**流程编排者 + 两阶段分离**：
- 阶段检测 → `scripts/detect-phase.sh`
- 质检强制 → `hooks/stop.sh` (Stop Hook)
- 放行判断 → `hooks/pr-gate-v2.sh` (PreToolUse:Bash)

判断由专门的规范负责：
- 测试决策 → 参考 `skills/qa/SKILL.md`
- 代码审计 → 参考 `skills/audit/SKILL.md`

---

## 入口：阶段检测（两阶段）

**进入 /dev 后，首先运行阶段检测**：

```bash
# 运行阶段检测
bash scripts/detect-phase.sh

# 输出格式
# PHASE: p0 / p1 / p2 / pending / unknown
# DESCRIPTION: ...
# ACTION: ...
```

### 阶段定义

| 阶段 | 条件 | 目标 | 策略 |
|------|------|------|------|
| **p0** | 无 PR | 发 PR | 质检循环 → 创建 PR → 结束（不等 CI）|
| **p1** | PR + CI fail | 修到 CI 绿 | 事件驱动循环：修复 → push → 退出 → 等唤醒 |
| **p2** | PR + CI pass | 不介入 | 直接退出（GitHub 自动 merge）|
| **pending** | PR + CI pending | - | 直接退出（稍后再查）|
| **unknown** | gh API 错误 | - | 直接退出（不误判）|

**详细文档**: `docs/PHASE-DETECTION.md`

---

## 流程节点（两阶段分离）

### p0 阶段：Published（发 PR 之前）

```
┌─────────────────────────────────────────────────────────┐
│                 p0: Published 阶段                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  阶段检测 (scripts/detect-phase.sh)                     │
│      → PHASE: p0                                        │
│      ↓                                                  │
│  PRD 确定 (01-prd.md)                                   │
│      ↓                                                  │
│  环境检测 (02-detect.md)                                │
│      ↓                                                  │
│  并行开发检测 (02.5-parallel-detect.md)                 │
│      ↓                                                  │
│  分支创建 (03-branch.md)                                │
│      ↓                                                  │
│  DoD 定稿 (04-dod.md)                                   │
│      │   含 QA Decision Node                            │
│      │   产物: docs/QA-DECISION.md                      │
│      ↓                                                  │
│  写代码 + 写测试 (05-code.md, 06-test.md)               │
│      ↓                                                  │
│  质检循环 (07-quality.md) ← Stop Hook 强制              │
│      │   L2A: Audit (Decision: PASS)                    │
│      │   L1: npm run qa:gate                            │
│      │   失败 → 修复 → 重试（质检循环）                 │
│      ↓                                                  │
│  提交 PR (08-pr.md)                                     │
│      │   Stop Hook: PR 创建后立即结束                   │
│      │   不检查 CI（p0 不等待 CI）                      │
│      ↓                                                  │
│  结束对话 ✅ （不等 CI）                                 │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### p1 阶段：CI fail 修复（事件驱动循环）

```
┌─────────────────────────────────────────────────────────┐
│            p1: CI fail 修复（事件驱动）                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  阶段检测 (scripts/detect-phase.sh)                     │
│      → PHASE: p1                                        │
│      ↓                                                  │
│  CI 修复循环 (09-ci.md) ← Stop Hook 强制                │
│      │   1. 拉取 CI 失败详情                            │
│      │      gh pr checks <PR> --json ...                │
│      │   2. 分析失败原因（typecheck/test/build）        │
│      │   3. 修复问题                                    │
│      │   4. push 代码                                   │
│      │   5. 尝试结束                                    │
│      │      Stop Hook:                                  │
│      │        CI fail → exit 2（继续修）                │
│      │        CI pending → exit 0（退出，等唤醒）       │
│      │        CI pass → exit 0（结束）                  │
│      ↓                                                  │
│  结束对话 ✅ （GitHub 自动 merge）                       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### p2 阶段：CI pass（已完成）

```
┌─────────────────────────────────────────────────────────┐
│                    p2: CI pass                          │
├─────────────────────────────────────────────────────────┤
│  阶段检测 → PHASE: p2                                   │
│  直接退出 ✅ （GitHub 自动 merge）                       │
└─────────────────────────────────────────────────────────┘
```

### pending / unknown：中间态

```
┌─────────────────────────────────────────────────────────┐
│                 pending / unknown                       │
├─────────────────────────────────────────────────────────┤
│  pending: CI 运行中 → 直接退出（稍后再查）              │
│  unknown: gh API 错误 → 直接退出（不误判）              │
└─────────────────────────────────────────────────────────┘
```

---

## 核心规则（v2.0）

### 1. 两阶段分离 ✅

```
p0: 发 PR → 结束（不等 CI）
p1: 修 CI → 结束（不等 merge）
p2: 直接退出（GitHub 自动 merge）
```

### 2. Stop Hook 强制质检 ✅

```
p0: 质检未通过 OR PR 未创建 → exit 2（继续）
p1: CI fail → exit 2（继续修）
    CI pending → exit 0（退出，等唤醒）
    CI pass → exit 0（结束）
```

### 3. 事件驱动循环 ✅

```
❌ 不挂着等待: while CI pending; do sleep; done
✅ push 后退出: push → exit 0 → 等下次唤醒
```

### 4. 分支策略

1. **只在 cp-* 或 feature/* 分支写代码** - Hook 强制
2. **develop 是主开发线** - PR 合并回 develop
3. **main 始终稳定** - 只在里程碑时从 develop 合并

### 5. 产物门控

- QA-DECISION.md（Step 4 生成）
- AUDIT-REPORT.md（Step 7 生成，Decision: PASS）
- .quality-gate-passed（Step 7 生成，测试通过）

---

## 版本号规则 (semver)

| commit 类型 | 版本变化 |
|-------------|----------|
| fix: | patch (+0.0.1) |
| feat: | minor (+0.1.0) |
| feat!: / BREAKING: | major (+1.0.0) |

---

## 加载策略

```
skills/dev/
├── SKILL.md        ← 你在这里（入口 + 流程总览）
├── steps/          ← 每步详情（按需加载）
│   ├── 01-prd.md
│   ├── 02-detect.md
│   ├── 02.5-parallel-detect.md  ← 并行开发检测
│   ├── 03-branch.md
│   ├── 04-dod.md       ← QA Decision Node
│   ├── 05-code.md
│   ├── 06-test.md
│   ├── 07-quality.md   ← Audit Node
│   ├── 08-pr.md
│   ├── 09-ci.md
│   ├── 10-learning.md
│   └── 11-cleanup.md
└── scripts/        ← 辅助脚本
    ├── cleanup.sh
    ├── worktree-manage.sh  ← Worktree 管理
    ├── check.sh
    └── ...
```

---

## 产物检查清单

| 产物 | 位置 | 规范来源 | Gate 检查 |
|------|------|----------|-----------|
| PRD | .prd.md | - | ✅ 存在 + 内容有效 |
| QA 决策 | docs/QA-DECISION.md | skills/qa/SKILL.md | ✅ 存在 |
| DoD | .dod.md | - | ✅ 存在 + 引用 QA 决策 |
| 审计报告 | docs/AUDIT-REPORT.md | skills/audit/SKILL.md | ✅ 存在 + PASS |

---

## 状态追踪（Core/Notion 同步）

有头和无头模式共用同一套追踪机制，在关键点调用 `track.sh`：

```bash
# 新任务开始时
bash skills/dev/scripts/track.sh start "$(basename "$(pwd)")" "$(git rev-parse --abbrev-ref HEAD)" ".prd.md"

# 每个步骤
bash skills/dev/scripts/track.sh step 1 "PRD"
bash skills/dev/scripts/track.sh step 2 "Detect"
bash skills/dev/scripts/track.sh step 3 "Branch"
bash skills/dev/scripts/track.sh step 4 "DoD"
bash skills/dev/scripts/track.sh step 5 "Code"
bash skills/dev/scripts/track.sh step 6 "Test"
bash skills/dev/scripts/track.sh step 7 "Quality"
bash skills/dev/scripts/track.sh step 8 "PR"
bash skills/dev/scripts/track.sh step 9 "CI"
bash skills/dev/scripts/track.sh step 10 "Learning"
bash skills/dev/scripts/track.sh step 11 "Cleanup"

# 完成时
bash skills/dev/scripts/track.sh done "$PR_URL"

# 失败时
bash skills/dev/scripts/track.sh fail "Error message"
```

追踪文件 `.cecelia-run-id` 自动管理，Core 是主数据源，Notion 是镜像。

---

## 完成度检查

**Cleanup 后运行**：

```bash
bash skills/dev/scripts/check.sh "$BRANCH_NAME" "$BASE_BRANCH"
```
