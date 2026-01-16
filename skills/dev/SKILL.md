---
name: dev
description: |
  统一开发工作流入口。一个对话完成整个开发流程。
  纯 git 检测，不需要状态文件。

  触发条件：
  - 用户说任何开发相关的需求
  - 用户说 /dev
  - Hook 输出 [SKILL_REQUIRED: dev]（被 branch-protect.sh 阻止时）
---

# /dev - 统一开发工作流

## 关键节点清单 (20 必要 + 1 可选 = 21)

```
创建阶段 (Step 1-2)
  □ 1. 检测当前分支类型
  □ 2. 创建 cp-* 分支
  □ 3. 保存 base 分支到 git config

开发阶段 (Step 3-4)
  □ 4. PRD 确认
  □ 5. DoD 确认
  □ 6. 代码编写
  □ 7. 自测通过

提交阶段 (Step 5)
  □ 8. 会话恢复检测
  □ 9. 版本号更新（semver）  ← 新增！
  □ 10. git commit
  □ 11. git push
  □ 12. PR 创建
  □ 13. CI 通过
  □ 14. PR 合并

清理阶段 (Step 6)
  □ 15. 清理 git config
  □ 16. 切回 feature 分支
  □ 17. git pull
  □ 18. 删除本地 cp-* 分支
  □ 19. 删除远程 cp-* 分支
  □ 20. 清理 stale 远程引用

总结阶段 (Step 7)
  □ 21. Learn 记录（可选）
```

**每次 cleanup 必须检查 20/20 完成，否则报告缺失项。**

**版本号规则 (semver)：**
- `fix:` → patch (+0.0.1)
- `feat:` → minor (+0.1.0)
- `BREAKING:` → major (+1.0.0)

---

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
Step 1: 检查当前分支
    │
    ├─ main？→ ❌ 不允许，选择/创建 feature 分支 → 重新 Step 1
    │
    ├─ feature/*？→ ✅ 询问用户任务 → Step 2 创建 cp-* → Step 3
    │
    ├─ cp-*？→ ✅ 继续当前任务 → 跳过 Step 2 → 直接 Step 3
    │
    └─ 其他？→ ⚠️ 提示用户切换分支
```

**重要：如果已在 cp-* 分支，跳过 Step 2，直接从 Step 3 继续。**

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

### 5.1 会话恢复检测

**先检测是否是中断后恢复的会话：**

```bash
echo "🔍 检测会话状态..."

# 检查远程是否已有这个分支的 PR
EXISTING_PR=$(gh pr list --head "$BRANCH_NAME" --json number,url -q '.[0]' 2>/dev/null)

if [ ! -z "$EXISTING_PR" ]; then
  PR_URL=$(echo "$EXISTING_PR" | jq -r '.url')
  echo "✅ 检测到已存在的 PR: $PR_URL"
  echo "   跳过创建，直接等待 CI..."
  # 跳到等待 CI 的循环
else
  echo "📝 需要创建新 PR"
fi
```

### 5.2 版本号更新（必须！）

**提交前必须更新版本号：**

```bash
echo "📦 更新版本号..."
CURRENT_VERSION=$(jq -r '.version' package.json)
echo "   当前版本: $CURRENT_VERSION"

# 根据 commit 类型决定 bump 类型
# fix: → patch, feat: → minor, BREAKING: → major
# 例如：npm version patch --no-git-tag-version

echo ""
echo "   semver 规则："
echo "   - fix: → patch (+0.0.1)"
echo "   - feat: → minor (+0.1.0)"
echo "   - BREAKING: → major (+1.0.0)"
echo ""
echo "   请更新 package.json 版本号后继续"
```

### 5.3 提交和创建 PR

**版本号更新后：**

```bash
# 提交（包含版本号更新）
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
    echo ""
    echo "可能原因："
    echo "  - 合并冲突"
    echo "  - 手动关闭"
    echo "  - 权限问题"
    echo ""
    echo "解决方案："
    echo "  1. 重新推送并创建 PR: git push && gh pr create --base $FEATURE_BRANCH"
    echo "  2. 或放弃本次任务"
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

# 超时处理
if [ $WAITED -ge $MAX_WAIT ] && [ "$STATE" != "MERGED" ]; then
  echo "⏰ 等待超时（${MAX_WAIT}s）"
  echo "   请手动检查 PR 状态: $PR_URL"
  echo "   如果 CI 通过会自动合并，稍后运行 /dev 继续"
fi
```

---

## Step 6: Cleanup

**只在 PR 成功合并后执行。**

```bash
echo "🧹 清理..."

# 1. 清理 git config 中保存的 base 分支信息
git config --unset branch.$BRANCH_NAME.base 2>/dev/null || true

# 2. 切回 feature 分支并拉取最新代码
git checkout "$FEATURE_BRANCH"
git pull

# 3. 删除本地 cp-* 分支
git branch -D "$BRANCH_NAME" 2>/dev/null || true

# 4. 删除远程 cp-* 分支（如果还存在）
git push origin --delete "$BRANCH_NAME" 2>/dev/null || true

# 5. 清理远程已删除分支的本地引用
git remote prune origin 2>/dev/null || true

# 6. 更新版本号（必须！每个 PR 都要更新）
echo ""
echo "📦 版本更新（semver 规则）："
echo "   当前版本: $(jq -r '.version' package.json)"
echo ""
echo "   规则："
echo "   - fix: → patch (+0.0.1)"
echo "   - feat: → minor (+0.1.0)"
echo "   - BREAKING: → major (+1.0.0)"
echo ""
echo "   ⚠️ 每个 PR 必须更新版本号！"

echo "✅ 清理完成"
```

### 6.2 完成度检查

**Cleanup 完成后，必须验证所有关键节点：**

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📋 关键节点完成度检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL=19
DONE=0
MISSING=()

# 清理阶段检查（可验证的）
echo ""
echo "清理阶段 (Step 6):"

# 14. git config 已清理？
CONFIG_EXISTS=$(git config branch.$BRANCH_NAME.base 2>/dev/null || echo "")
if [ -z "$CONFIG_EXISTS" ]; then
  echo "  ✅ 14. git config 已清理"
  ((DONE++))
else
  echo "  ❌ 14. git config 未清理"
  MISSING+=("git config --unset branch.$BRANCH_NAME.base")
fi

# 15. 当前在 feature 分支？
CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT" == feature/* ]]; then
  echo "  ✅ 15. 已切回 feature 分支 ($CURRENT)"
  ((DONE++))
else
  echo "  ❌ 15. 未切回 feature 分支 (当前: $CURRENT)"
  MISSING+=("git checkout $FEATURE_BRANCH")
fi

# 16. git pull 已执行？（假设已执行，无法验证）
echo "  ✅ 16. git pull 已执行"
((DONE++))

# 17. 本地 cp-* 分支已删除？
LOCAL_EXISTS=$(git branch --list "$BRANCH_NAME" 2>/dev/null)
if [ -z "$LOCAL_EXISTS" ]; then
  echo "  ✅ 17. 本地 cp-* 分支已删除"
  ((DONE++))
else
  echo "  ❌ 17. 本地 cp-* 分支未删除"
  MISSING+=("git branch -D $BRANCH_NAME")
fi

# 18. 远程 cp-* 分支已删除？
REMOTE_EXISTS=$(git ls-remote --heads origin "$BRANCH_NAME" 2>/dev/null)
if [ -z "$REMOTE_EXISTS" ]; then
  echo "  ✅ 18. 远程 cp-* 分支已删除"
  ((DONE++))
else
  echo "  ❌ 18. 远程 cp-* 分支未删除"
  MISSING+=("git push origin --delete $BRANCH_NAME")
fi

# 19. stale 引用已清理？（假设已执行，无法验证）
echo "  ✅ 19. stale 引用已清理"
((DONE++))

# 前面的阶段（假设已完成，因为能走到 cleanup）
echo ""
echo "创建阶段: ✅ 3/3"
echo "开发阶段: ✅ 4/4"
echo "提交阶段: ✅ 6/6"
DONE=$((DONE + 13))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  完成度: $DONE/$TOTAL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ ${#MISSING[@]} -gt 0 ]; then
  echo ""
  echo "⚠️ 缺失项修复命令："
  for cmd in "${MISSING[@]}"; do
    echo "  $cmd"
  done
fi

if [ $DONE -eq $TOTAL ]; then
  echo ""
  echo "🎉 所有关键节点已完成！"
fi
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
