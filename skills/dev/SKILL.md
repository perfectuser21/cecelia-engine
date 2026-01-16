---
name: dev
description: |
  统一开发工作流入口。一个对话完成整个开发流程。
  纯 git 检测，不需要状态文件。

  触发条件：
  - 用户说任何开发相关的需求
  - 用户说 /dev
---

# /dev - 统一开发工作流

## 核心规则

1. **永远不在 main 上开发** - Hook 会阻止
2. **一个对话完成整个流程** - 不需要跨对话状态
3. **纯 git 检测** - 不需要状态文件

---

## 核心逻辑

```
/dev 开始
    │
    ▼
检查当前分支 (git rev-parse --abbrev-ref HEAD)
    │
    ├─ main？→ ❌ 不允许，选择/创建 feature 分支
    │
    ├─ feature/*？→ ✅ 可以开始新任务
    │     │
    │     ├─ 用户想做当前 feature → 创建 cp-* 分支
    │     └─ 用户想做其他 feature → worktree
    │
    └─ cp-*？→ ✅ 继续当前任务
          │
          └─ 从 cp-* 分支名提取 feature 分支
```

---

## Step 1: 检查分支

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO=$(basename $(git rev-parse --show-toplevel))

echo "📍 当前位置："
echo "   Repo: $REPO"
echo "   分支: $BRANCH"

if [[ "$BRANCH" == "main" ]]; then
  echo "❌ 不能在 main 上开发"
  echo ""
  echo "可用的 feature 分支："
  git branch -r | grep 'feature/' | sed 's|origin/||'
  echo ""
  echo "请选择或创建 feature 分支"
  # 询问用户选择

elif [[ "$BRANCH" == feature/* ]]; then
  FEATURE_BRANCH="$BRANCH"
  echo "✅ 在 feature 分支，可以开始"

elif [[ "$BRANCH" == cp-* ]]; then
  echo "✅ 在 cp-* 分支，继续当前任务"
  # 从 git config 读取 base 分支（创建时保存的）
  FEATURE_BRANCH=$(git config branch.$BRANCH.base 2>/dev/null)
  if [[ -z "$FEATURE_BRANCH" ]]; then
    # 兜底：从远程分支推断
    FEATURE_BRANCH=$(git branch -r --contains HEAD 2>/dev/null | grep 'origin/feature/' | head -1 | sed 's|origin/||' | xargs)
  fi
  echo "   Base: $FEATURE_BRANCH"

else
  echo "⚠️ 当前分支: $BRANCH"
  echo "   不是 main/feature/cp-* 分支"
  echo ""
  echo "建议："
  echo "  1. 切换到 feature/* 分支开始新任务"
  echo "  2. 或从当前分支创建 feature 分支"
fi

# 检查 worktree（并行开发）
echo ""
echo "📂 Worktree："
git worktree list
```

**询问用户（如果在 feature 分支）：**

```
当前在 feature/zenith-engine

1. 在这个 feature 上开新任务
2. 切换到其他 feature（需要 worktree）
3. 创建新的 feature 分支
```

---

## Step 2: 创建 cp-* 分支

```bash
TIMESTAMP=$(date +%Y%m%d-%H%M)
TASK_NAME="<根据用户需求生成>"
BRANCH_NAME="cp-${TIMESTAMP}-${TASK_NAME}"

# 记住当前 feature 分支
FEATURE_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 创建分支
git checkout -b "$BRANCH_NAME"

# 保存 base 分支到 git config（用于恢复会话）
git config branch.$BRANCH_NAME.base "$FEATURE_BRANCH"

echo "✅ 分支已创建: $BRANCH_NAME"
echo "   Base: $FEATURE_BRANCH"
```

---

## Step 3: PRD + DoD

**生成 PRD + DoD，等用户确认：**

```markdown
## PRD - <功能名>

**需求来源**: <用户原话>
**功能描述**: <我理解的功能>
**涉及文件**: <需要创建/修改的文件>

## DoD - 验收标准

### 自动测试
- TEST: <测试命令 1>
- TEST: <测试命令 2>

### 人工确认
- CHECK: <需要用户确认的点>
```

**用户确认后继续。**

---

## Step 4: 写代码 + 自测

写完代码后，执行 DoD 中的 TEST：

```bash
echo "=== 自测 ==="
# 执行每个 TEST
# 全部通过才继续
```

---

## Step 5: PR + 等待 CI

```bash
# 提交
git add -A
git commit -m "feat: <功能描述>

Co-Authored-By: Claude <noreply@anthropic.com>"

# 推送
git push -u origin HEAD

# 创建 PR（base 是之前的 feature 分支）
PR_URL=$(gh pr create --base "$FEATURE_BRANCH" --title "feat: <功能描述>" --body "...")

echo "✅ PR 已创建: $PR_URL"
echo "⏳ 等待 CI..."

# 等待 CI 完成
MAX_WAIT=180
WAITED=0

while [ $WAITED -lt $MAX_WAIT ]; do
  sleep 10
  WAITED=$((WAITED + 10))

  # 获取 PR 状态（降级处理：如果 statusCheckRollup 权限不足，只用 state）
  STATE=$(gh pr view "$PR_URL" --json state -q '.state' 2>/dev/null || echo "UNKNOWN")

  # 尝试获取 CI 状态（可能因权限失败）
  CI_STATUS=$(gh pr view "$PR_URL" --json statusCheckRollup -q '.statusCheckRollup[0].conclusion // "PENDING"' 2>/dev/null || echo "UNKNOWN")

  if [ "$STATE" = "MERGED" ]; then
    echo "✅ PR 已合并！(${WAITED}s)"
    break
  elif [ "$STATE" = "CLOSED" ]; then
    echo "❌ PR 被关闭"
    break
  elif [ "$CI_STATUS" = "FAILURE" ]; then
    echo "❌ CI 失败，请检查: $PR_URL"
    echo "修复后重新 push，CI 会自动重跑"
    break
  fi

  # 显示状态（CI_STATUS 可能是 UNKNOWN）
  if [ "$CI_STATUS" = "UNKNOWN" ]; then
    echo "⏳ 等待中... STATE=$STATE (${WAITED}s)"
  else
    echo "⏳ 等待中... STATE=$STATE, CI=$CI_STATUS (${WAITED}s)"
  fi
done
```

---

## Step 6: Cleanup

```bash
echo "🧹 清理..."

# 清理 git config 中保存的 base 分支信息
git config --unset branch.$BRANCH_NAME.base 2>/dev/null || true

# 切回 feature 分支
git checkout "$FEATURE_BRANCH"
git pull

# 删除本地 cp-* 分支
git branch -D "$BRANCH_NAME" 2>/dev/null || true

echo "✅ 清理完成"
```

---

## Step 7: Learn

```
这次开发学到了什么？
1. 踩的坑
2. 学到的
3. 最佳实践

（输入或说"跳过"）
```

```bash
echo "🎉 本轮开发完成！"
```

---

## 完整流程（一个对话）

```
┌─────────────────────────────────────────────────────────────┐
│                    一个对话搞定                              │
├─────────────────────────────────────────────────────────────┤
│ /dev                                                        │
│   → 检查分支 (git)                                          │
│   → 创建 cp-* 分支                                          │
│   → PRD + DoD → 用户确认                                    │
│   → 写代码 + 自测                                           │
│   → PR + sleep 等待 CI                                      │
│   → cleanup + learn                                         │
│   → 完成 🎉                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 并行开发（Worktree）

如果要同时在多个 feature 上工作：

```bash
# 当前在 zenithjoy-core，feature/zenith-engine
# 想同时做 feature/cecilia

git worktree add ../zenithjoy-core-cecilia feature/cecilia
cd ../zenithjoy-core-cecilia

# 在新目录开始 /dev
```

列出所有 worktree：

```bash
git worktree list
```

---

## 变量说明

| 变量 | 来源 | 用途 |
|------|------|------|
| `BRANCH` | `git rev-parse --abbrev-ref HEAD` | 当前分支 |
| `FEATURE_BRANCH` | 创建 cp-* 前记住 | PR base 分支 |
| `BRANCH_NAME` | 生成的 cp-* 名称 | 当前任务分支 |
| `PR_URL` | `gh pr create` 返回 | 检查 CI 状态 |

**不需要状态文件** — 所有信息从 git 实时获取。
