---
id: phase-detection
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: 两阶段 + 开局判定机制
---

# 阶段检测机制

**核心**: 每次启动只问三个问题，决定进入哪个阶段

---

## 开局判定（机器可执行）

```bash
#!/usr/bin/env bash
# 开局判定：决定当前应该执行哪个阶段

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)

# ===== 问题 1: 有没有 PR？=====
PR_NUMBER=$(gh pr list --head "$CURRENT_BRANCH" --state open --json number -q '.[0].number' 2>/dev/null || echo "")

if [[ -z "$PR_NUMBER" ]]; then
    # 没有 PR → p0 (Published 阶段)
    echo "PHASE: p0 (Published)"
    echo "ACTION: 发 PR（质检循环 → 创建 PR → 结束）"
    exit 0
fi

# 有 PR，继续判断

# ===== 问题 2: CI 有结果吗？=====
CI_STATUS=$(gh pr checks "$PR_NUMBER" --json state -q '.[].state' 2>/dev/null | head -1)

if [[ -z "$CI_STATUS" ]] || [[ "$CI_STATUS" == "PENDING" ]] || [[ "$CI_STATUS" == "QUEUED" ]]; then
    # pending/queued → 不是阶段，只是中间态
    echo "PHASE: pending (中间态)"
    echo "ACTION: 直接退出（不挂着，稍后再查）"
    exit 0
fi

# CI 有结果，继续判断

# ===== 问题 3: 结果是啥？=====
if echo "$CI_STATUS" | grep -qi "FAILURE\|ERROR"; then
    # fail → p1 (CI 阶段 - fail)
    echo "PHASE: p1 (CI fail)"
    echo "ACTION: 无限循环修到绿（拉失败 → 修 → push → 查 CI）"
    exit 0
fi

if echo "$CI_STATUS" | grep -qi "SUCCESS\|PASS"; then
    # pass → p2 (CI 阶段 - pass)
    echo "PHASE: p2 (CI pass)"
    echo "ACTION: Done（直接退出，GitHub 自动 merge）"
    exit 0
fi

# 未知状态
echo "PHASE: unknown"
echo "CI_STATUS: $CI_STATUS"
exit 1
```

---

## 阶段定义

### p0: Published 阶段（发 PR 之前）

**判定**:
```bash
gh pr list --head "$BRANCH" → 空
# 没有 PR
```

**目标**: 把 PR 发出去

**策略**: 本地 while-loop（质检不过就继续修）

**执行流程**:
```
1. 写代码
2. 尝试结束 → Stop Hook 检查
   ❌ 质检未通过 → exit 2 → 继续修复
   ✅ 质检通过，PR 未创建 → exit 2 → 继续
3. 创建 PR
4. 尝试结束 → Stop Hook 检查
   ✅ 质检通过，PR 已创建 → exit 0
5. 结束对话 ✅
```

**结束标志**: PR 创建成功 + StopHook 放行

**不等待**: ❌ 不等待 CI（发完 PR 就结束）

---

### p1: CI 阶段 - fail（修到绿）

**判定**:
```bash
gh pr list --head "$BRANCH" → PR #123
gh pr checks 123 → FAILURE
```

**目标**: 修到 CI 全绿

**策略**: 无限循环

**执行流程**:
```
1. 拉取 CI 失败信息
   gh pr checks 123 --json name,conclusion,detailsUrl

2. 分析失败原因
   - typecheck 失败 → 修复类型错误
   - test 失败 → 修复测试
   - build 失败 → 修复构建

3. 修复 + push
   git add .
   git commit -m "fix: CI 失败修复"
   git push

4. 查询下一轮 CI
   gh pr checks 123 → 等待结果

5. 如果还是 fail → 回到步骤 2
   如果 pass → 结束 ✅
```

**结束标志**: CI 全绿

**不等待**: ❌ 不等待 merge（GitHub 自动 merge）

---

### p2: CI 阶段 - pass（已完成）

**判定**:
```bash
gh pr list --head "$BRANCH" → PR #123
gh pr checks 123 → SUCCESS
```

**目标**: 不用介入

**动作**:
```
1. 输出 "CI 已绿，GitHub 将自动 merge"
2. 直接退出 ✅
```

**merge 机制**:
- ✅ GitHub Actions auto-merge（v9.4.0）
- CI 绿 + 审核通过 → 自动 merge
- 无需 AI 介入

---

### pending: 中间态（不是阶段）

**判定**:
```bash
gh pr list --head "$BRANCH" → PR #123
gh pr checks 123 → PENDING / QUEUED
```

**性质**:
- ❌ 不是阶段
- 只是查询时的中间态
- 只会出现在"手动查询"场景

**动作**:
```
1. 输出 "CI 运行中，稍后再查"
2. 直接退出（不挂着，不循环）
```

**未来走向**:
- pending → failure → 进入 p1
- pending → success → 进入 p2

---

## 完整状态机

```
开始
  ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  问题 1: 有 PR 吗？
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ↓                    ↓
  没有                 有
  ↓                    ↓
━━━━━━━━━━━         ━━━━━━━━━━━━━━━━━━━━━━━━━━
│ p0: Published │         问题 2: CI 有结果吗？
│ 质检 → PR     │       ━━━━━━━━━━━━━━━━━━━━━━━━━━
│ → 结束        │         ↓                  ↓
━━━━━━━━━━━         pending            有结果
                          ↓                  ↓
                    ━━━━━━━━━━━       ━━━━━━━━━━━━━━━━━━━━
                    │ pending   │         问题 3: 结果？
                    │ 退出      │       ━━━━━━━━━━━━━━━━━━━━
                    ━━━━━━━━━━━         ↓              ↓
                                          fail           pass
                                          ↓              ↓
                                    ━━━━━━━━━━━   ━━━━━━━━━━━
                                    │ p1: Fix  │   │ p2: Done │
                                    │ 修到绿   │   │ 退出     │
                                    │ → 结束   │   ━━━━━━━━━━━
                                    ━━━━━━━━━━━
```

---

## p2 分叉决策：要不要自动 merge？

### 选项 1: 不自动 merge（最极简）✅ **采用**

```
p2 动作：直接退出
merge 机制：GitHub Actions auto-merge
优势：
  - 最简单
  - AI 不介入 merge
  - 符合"发完 PR 就结束"原则
```

### 选项 2: 自动 merge（更无头）

```
p2 动作：执行 merge 然后退出
merge 机制：gh pr merge --auto --squash
优势：
  - 完全无需人工
  - 适合完全无头场景
问题：
  - 需要处理 merge 失败情况
  - 增加复杂度
```

**结论**: 采用选项 1（最极简）

- 现在已有 GitHub Actions auto-merge（v9.4.0）
- p2 = 直接退出
- merge 由 GitHub 自动完成

---

## 使用方法

### 有头模式（用户手动启动）

```bash
# 用户在项目中
git branch  # → cp-xxx 或 develop

# Claude Code 自动判定阶段
bash scripts/detect-phase.sh
# → 输出：PHASE: p0 / p1 / p2 / pending
# → 输出：ACTION: ...

# 根据阶段执行对应流程
```

### 无头模式（Cecelia）

```bash
# Cecelia 启动时
PHASE=$(bash scripts/detect-phase.sh | grep "PHASE:" | awk '{print $2}')

case "$PHASE" in
  p0)
    # Published 阶段
    /ralph-loop "完成质检 → 创建 PR → 结束"
    ;;
  p1)
    # CI fail 阶段
    /ralph-loop "修复 CI 失败 → push → 结束"
    ;;
  p2)
    # CI pass
    echo "CI 已绿，GitHub 将自动 merge"
    exit 0
    ;;
  pending)
    # 中间态
    echo "CI 运行中，稍后再查"
    exit 0
    ;;
esac
```

---

## 关键设计原则

### 1. 不挂着等待 ✅
```
❌ 不要：while CI pending; do sleep; done
✅ 要：  pending → 直接退出
```

### 2. 结束即退出 ✅
```
p0 结束：PR 创建 → 退出（不等 CI）
p1 结束：CI 绿 → 退出（不等 merge）
p2 结束：已经绿了 → 直接退出
```

### 3. merge 交给 GitHub ✅
```
❌ 不要：AI 执行 gh pr merge
✅ 要：  GitHub Actions auto-merge
```

### 4. pending 不是阶段 ✅
```
pending 只是"查询时的中间态"
动作：退出（不修，不循环）
```

---

## 总结

| 阶段 | 判定条件 | 目标 | 策略 | 结束标志 |
|------|---------|------|------|---------|
| p0 | 无 PR | 发 PR | 质检循环 | PR 创建 + StopHook 放行 |
| p1 | PR + CI fail | 修到绿 | 无限循环修复 | CI 全绿 |
| p2 | PR + CI pass | 不介入 | 直接退出 | 立即退出 |
| pending | PR + CI pending | - | 直接退出 | 稍后再查 |

**两阶段 + 一个瞬时结果**:
- 阶段 A: p0 (Published)
- 阶段 B: p1 (CI fail) + p2 (CI pass)
- pending: 不是阶段，只是中间态

**最简原则**:
- 不挂着 ✅
- 不等待 ✅
- 交给 GitHub ✅

---

*生成时间: 2026-01-24*
