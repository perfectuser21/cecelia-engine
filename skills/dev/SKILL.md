---
name: dev
description: |
  统一开发工作流入口。一个对话完成整个开发流程。
  检查状态 → 执行任务 → sleep 等待 CI → cleanup → 完成

  触发条件：
  - 用户说任何开发相关的需求
  - 用户说 /dev
---

# /dev - 统一开发工作流

## 核心逻辑

**一个对话完成整个流程（正常情况）：**

```
对话开始
    │
    ▼
检查项目状态
    │
    ├─ 没有 git？→ Step 0.1: 初始化项目
    ├─ 没有 remote？→ Step 0.1: 初始化项目
    │
    ▼
检查状态文件 (~/.ai-factory/state/current-task.json)
    │
    ├─ 有未完成任务？
    │     │
    │     ├─ PR_CREATED → sleep 等待 → merged? → cleanup → learn → 完成
    │     ├─ EXECUTING → 继续写代码/自测
    │     ├─ CLEANUP_DONE → learn → 删除状态
    │     └─ TASK_CREATED → 生成 PRD/DoD
    │
    └─ 没有未完成任务？
          │
          ▼
      新任务流程（一个对话完成）
          │
          ├─ 检查 Branch/Worktree
          ├─ 创建 cp-* 分支
          ├─ 生成 PRD + DoD → 等用户确认
          ├─ 写代码 + 自测
          ├─ 创建 PR
          ├─ sleep 等待 CI (10s 间隔)
          ├─ PR merged → cleanup
          └─ learn → 完成 🎉
```

---

## Step 0: 检查项目状态（每次对话必做！）

```bash
# 检查是否有 git
if [ ! -d .git ]; then
  echo "❌ 不是 git 仓库，需要初始化"
  PROJECT_STATUS="NO_GIT"
elif ! git remote get-url origin >/dev/null 2>&1; then
  echo "❌ 没有 remote，需要初始化"
  PROJECT_STATUS="NO_REMOTE"
else
  PROJECT_STATUS="OK"
fi
```

**如果 PROJECT_STATUS != OK，跳转到 Step 0.1**

---

## Step 0.1: 初始化项目（仅新项目）

```bash
# 1. 初始化 git（如果需要）
if [ ! -d .git ]; then
  git init
  echo "✅ Git 已初始化"
fi

# 2. 创建 GitHub 仓库
REPO_NAME=$(basename $(pwd))
gh repo create "$REPO_NAME" --private --source=. --remote=origin
echo "✅ GitHub 仓库已创建"

# 3. 创建基础文件
cat > README.md << EOF
# $REPO_NAME

项目描述

## 开发

使用 /dev 工作流开发。
EOF

# 4. 初始提交
git add -A
git commit -m "chore: initial commit"
git push -u origin main

# 5. 创建 feature 分支
read -p "Feature 分支名称: feature/" FEATURE_NAME
git checkout -b "feature/$FEATURE_NAME"
git push -u origin "feature/$FEATURE_NAME"

echo "✅ 项目初始化完成"
echo "   仓库: https://github.com/$(gh api user --jq .login)/$REPO_NAME"
echo "   分支: feature/$FEATURE_NAME"
```

---

## Step 0.2: 检查任务状态

```bash
STATE_FILE=~/.ai-factory/state/current-task.json

if [ -f "$STATE_FILE" ]; then
  PHASE=$(jq -r '.phase' "$STATE_FILE")
  TASK_ID=$(jq -r '.task_id' "$STATE_FILE")
  PR_URL=$(jq -r '.pr_url // empty' "$STATE_FILE")
  FEATURE_BRANCH=$(jq -r '.feature_branch // empty' "$STATE_FILE")

  echo "📋 发现未完成任务："
  echo "   任务: $TASK_ID"
  echo "   阶段: $PHASE"
  echo "   Feature: $FEATURE_BRANCH"
  [ -n "$PR_URL" ] && echo "   PR: $PR_URL"
else
  echo "✅ 没有未完成任务，可以开始新任务"
  PHASE="NONE"
fi
```

**根据 PHASE 跳转：**

| PHASE | 跳转到 |
|-------|--------|
| `NONE` | Step 1: 检查分支 |
| `TASK_CREATED` | Step 3: 生成 PRD/DoD |
| `EXECUTING` | Step 4: 继续写代码 |
| `PR_CREATED` | Step 6: 检查 CI |
| `CLEANUP_DONE` | Step 8: Learn |

---

## Step 1: 检查 Branch/Worktree

**只有 PHASE=NONE 时执行**

```bash
# 检查当前位置
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO_ROOT=$(git rev-parse --show-toplevel)

echo "📍 当前位置："
echo "   目录: $REPO_ROOT"
echo "   分支: $CURRENT_BRANCH"

# 检查是否在 feature 分支
if [[ "$CURRENT_BRANCH" == feature/* ]]; then
  FEATURE_BRANCH="$CURRENT_BRANCH"
  echo "   ✅ 在 feature 分支上"
elif [[ "$CURRENT_BRANCH" == "main" ]]; then
  echo "   ⚠️ 在 main 分支，需要先切到 feature 分支"
  # 列出可用的 feature 分支
  echo ""
  echo "可用的 feature 分支："
  git branch -r | grep 'feature/' | sed 's|origin/||'
  echo ""
  echo "请选择或创建 feature 分支"
  exit 1
elif [[ "$CURRENT_BRANCH" == cp-* ]]; then
  echo "   ⚠️ 已在 cp-* 分支上，检查是否有未完成任务..."
fi

# 检查现有 worktree
echo ""
echo "📂 Worktree 检查："
git worktree list

# 如果用户想在不同 feature 上工作，需要 worktree
```

**询问用户（如果需要）：**

```
检测到当前在 feature/zenith-engine

你想：
1. 在 zenith-engine 上开新任务（创建 cp-* 分支）
2. 切换到其他 feature（可能需要 worktree）
3. 创建新的 feature 分支
```

---

## Step 2: 创建 cp-* 分支 + 状态文件

```bash
# 生成分支名
TIMESTAMP=$(date +%Y%m%d-%H%M)
TASK_NAME="<根据用户需求生成>"
BRANCH_NAME="cp-${TIMESTAMP}-${TASK_NAME}"

# 创建分支
git checkout -b "$BRANCH_NAME"

# 创建状态文件
STATE_FILE=~/.ai-factory/state/current-task.json
mkdir -p ~/.ai-factory/state

cat > "$STATE_FILE" << EOF
{
  "task_id": "$BRANCH_NAME",
  "branch": "$BRANCH_NAME",
  "feature_branch": "$FEATURE_BRANCH",
  "phase": "TASK_CREATED",
  "checkpoints": {
    "prd_confirmed": false,
    "dod_defined": false,
    "self_test_passed": false
  },
  "created_at": "$(date -Iseconds)"
}
EOF

echo "✅ 分支已创建: $BRANCH_NAME"
```

---

## Step 3: 生成 PRD + DoD

**根据用户需求自动生成：**

### 新开发 PRD 模板

```markdown
## PRD - 新功能

**需求来源**: <用户原话>
**功能描述**: <我理解的功能>
**涉及文件**: <需要创建/修改的文件>

## DoD - 验收标准

### 自动测试（必须全过）
- TEST: <测试命令 1>
- TEST: <测试命令 2>

### 人工确认
- CHECK: <需要用户确认的点>
```

### 用户确认后更新状态

```bash
jq '.checkpoints.prd_confirmed = true | .checkpoints.dod_defined = true | .phase = "EXECUTING"' \
  "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
```

---

## Step 4: 写代码 + 自测

**写完代码后，跑 DoD 里的每个 TEST：**

```bash
echo "=== 开始自测 ==="

# 逐个执行 TEST
FAILED=false
for test in "${TESTS[@]}"; do
  echo "运行: $test"
  if eval "$test"; then
    echo "✅ PASS"
  else
    echo "❌ FAIL"
    FAILED=true
  fi
done

if [ "$FAILED" = true ]; then
  echo "❌ 自测未通过，继续修复"
else
  echo "✅ 自测全部通过"
  # 更新状态
  jq '.checkpoints.self_test_passed = true' "$STATE_FILE" > "${STATE_FILE}.tmp" \
    && mv "${STATE_FILE}.tmp" "$STATE_FILE"
fi
```

---

## Step 5: 创建 PR + 等待 CI

```bash
# 提交
git add -A
git commit -m "feat: <功能描述>

Workflow: /dev → PRD → DoD → self-test → PR ✅

Co-Authored-By: Claude <noreply@anthropic.com>"

# 推送
git push -u origin HEAD

# 检测 PR base 分支（从状态文件读取！）
BASE_BRANCH=$(jq -r '.feature_branch' "$STATE_FILE")
echo "📌 PR base 分支: $BASE_BRANCH"

# 创建 PR
PR_URL=$(gh pr create --base "$BASE_BRANCH" --title "feat: <功能描述>" --body "...")

echo "✅ PR 已创建: $PR_URL"
echo "⏳ 等待 CI..."

# 更新状态
jq --arg url "$PR_URL" '.phase = "PR_CREATED" | .pr_url = $url' "$STATE_FILE" > "${STATE_FILE}.tmp" \
  && mv "${STATE_FILE}.tmp" "$STATE_FILE"
```

### 等待 CI 并检查结果

```bash
# 循环等待 CI 完成（最多等 2 分钟）
MAX_WAIT=120
WAITED=0
INTERVAL=10

while [ $WAITED -lt $MAX_WAIT ]; do
  sleep $INTERVAL
  WAITED=$((WAITED + INTERVAL))

  # 检查 PR 状态
  PR_STATE=$(gh pr view "$PR_URL" --json state)
  STATE=$(echo "$PR_STATE" | jq -r '.state')

  if [ "$STATE" = "MERGED" ]; then
    echo "✅ PR 已合并！(等待了 ${WAITED}s)"
    break
  fi

  echo "⏳ CI 进行中... (${WAITED}s)"
done

# 最终检查
if [ "$STATE" != "MERGED" ]; then
  echo "⚠️ CI 超时或未通过，下次对话继续检查"
  # 状态保持 PR_CREATED，下次对话会从 Step 6 继续
fi
```

**通常 CI 会在 30s 内完成，一个对话就能搞定整个流程。**

---

## Step 6: 检查 CI（仅超时/失败时）

**如果 Step 5 等待超时，下次对话从这里继续：**

```bash
PR_URL=$(jq -r '.pr_url' "$STATE_FILE")

# 检查 PR 状态
PR_STATE=$(gh pr view "$PR_URL" --json state)
STATE=$(echo "$PR_STATE" | jq -r '.state')

if [ "$STATE" = "MERGED" ]; then
  echo "✅ PR 已合并！"
  # 继续 cleanup
elif [ "$STATE" = "CLOSED" ]; then
  echo "❌ PR 被关闭，需要检查原因"
else
  echo "⏳ PR 仍在等待，继续等待..."
  # 可以再次 sleep 等待
fi
```

---

## Step 7: Cleanup

**PR 合并后执行：**

```bash
echo "🧹 清理分支..."

# 切回 feature 分支
FEATURE_BRANCH=$(jq -r '.feature_branch' "$STATE_FILE")
git checkout "$FEATURE_BRANCH"
git pull

# 删除本地 cp-* 分支
TASK_BRANCH=$(jq -r '.branch' "$STATE_FILE")
git branch -D "$TASK_BRANCH" 2>/dev/null || true

# 更新状态
jq '.phase = "CLEANUP_DONE"' "$STATE_FILE" > "${STATE_FILE}.tmp" \
  && mv "${STATE_FILE}.tmp" "$STATE_FILE"

echo "✅ 清理完成"
```

---

## Step 8: Learn + 完成

**PHASE=CLEANUP_DONE 时执行：**

```
这次开发学到了什么？

1. 踩的坑
2. 学到的
3. 最佳实践

（输入内容，或说"跳过"）
```

**记录到 LEARNINGS.md 后：**

```bash
# 删除状态文件，本轮完成
rm "$STATE_FILE"

echo "🎉 本轮开发完成！"
echo "下次对话可以开始新任务。"
```

---

## 完整流程图

### 正常情况：一个对话完成

```
┌─────────────────────────────────────────────────────────────┐
│                    一个对话搞定                              │
├─────────────────────────────────────────────────────────────┤
│ /dev → 检查状态(无) → 新任务 → cp-* 分支 → PRD → DoD       │
│      → 写代码 → 自测 → PR                                   │
│      → sleep 等待 CI (10s 间隔，最多 2 分钟)                │
│      → PR merged → cleanup → learn → 完成 🎉               │
└─────────────────────────────────────────────────────────────┘
```

### 异常情况：CI 超时/失败

```
┌─────────────────────────────────────────────────────────────┐
│                    对话 1                                   │
├─────────────────────────────────────────────────────────────┤
│ /dev → ... → PR → 等待 CI → 超时（2分钟没合并）            │
│      → 状态=PR_CREATED，对话结束                            │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                    对话 2                                   │
├─────────────────────────────────────────────────────────────┤
│ /dev → 检查状态(PR_CREATED) → 检查 PR state                │
│      → merged? → cleanup → learn → 完成                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 暂停点总结

| 情况 | 状态 | 说明 |
|------|------|------|
| 正常 | - | 一个对话完成，无暂停 |
| CI 超时 | PR_CREATED | 下次对话继续检查 |
| CI 失败 | EXECUTING | 切回分支修复 |

---

## 唯一入口

**/dev 是唯一的开发工作流入口。**

不需要单独的 `/new-task`、`/finish`、`/init-project` 命令 — 全部统一到 `/dev`。
