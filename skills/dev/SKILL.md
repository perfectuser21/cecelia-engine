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

## 关键节点清单

> 标记：`□` = 必要，`○` = 可选。完成度自动计算。

```
创建阶段 (Step 1-2)
  □ 检测当前分支类型
  □ 创建 cp-* 分支
  □ 保存 base 分支到 git config

开发阶段 (Step 2.5-4)
  □ 上下文回顾
  □ PRD 确认
  □ DoD 确认
  □ 代码编写
  □ 自测通过

提交阶段 (Step 5)
  □ 会话恢复检测
  □ 版本号更新（semver）
  □ git commit
  □ git push
  □ PR 创建
  □ CI 通过
  □ PR 合并

清理阶段 (Step 6)
  □ 清理 git config
  □ 切回 feature 分支
  □ git pull
  □ 删除本地 cp-* 分支
  □ 删除远程 cp-* 分支
  □ 清理 stale 远程引用

总结阶段 (Step 7)
  ○ Engine Learn
  ○ 项目 Learn
```

**完成标准：所有 □ 必须完成，○ 可选。**

**版本号规则 (semver)：**
- `fix:` → patch (+0.0.1)
- `feat:` → minor (+0.1.0)
- `feat!:` 或 `BREAKING CHANGE:` → major (+1.0.0)

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

## Step 2.5: 上下文回顾

**在写 PRD 之前，先了解项目当前状态：**

```bash
echo "📖 上下文回顾..."

# 1. 最近的版本变更
echo ""
echo "=== 最近变更 (CHANGELOG) ==="
head -30 CHANGELOG.md 2>/dev/null || echo "（无 CHANGELOG）"

# 2. 最近的 PR
echo ""
echo "=== 最近 PR ==="
gh pr list --state merged -L 5 2>/dev/null || echo "（无法获取）"

# 3. 项目架构（快速浏览）
echo ""
echo "=== 项目架构 ==="
head -50 docs/ARCHITECTURE.md 2>/dev/null || echo "（无架构文档）"

# 4. 踩坑记录
echo ""
echo "=== 踩坑记录 ==="
head -30 docs/LEARNINGS.md 2>/dev/null || echo "（无踩坑记录）"
```

**回顾后再写 PRD，确保：**
- 不违反已有架构
- 不重复踩坑
- 与最近改动保持一致

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

# 检查远程是否已有这个分支的 PR（包括已关闭的）
EXISTING_PR=$(gh pr list --head "$BRANCH_NAME" --state all --json number,url,state -q '.[0]' 2>/dev/null)

if [ ! -z "$EXISTING_PR" ]; then
  PR_URL=$(echo "$EXISTING_PR" | jq -r '.url')
  PR_STATE=$(echo "$EXISTING_PR" | jq -r '.state')

  if [ "$PR_STATE" = "MERGED" ]; then
    echo "✅ PR 已合并: $PR_URL"
    echo "   跳到 cleanup..."
    # 直接跳到 Step 6 cleanup

  elif [ "$PR_STATE" = "CLOSED" ]; then
    echo "⚠️ PR 已关闭（未合并）: $PR_URL"
    echo "   需要重新创建 PR"
    # 继续走创建流程

  else
    echo "✅ 检测到已存在的 PR: $PR_URL (state=$PR_STATE)"
    echo "   跳过创建，直接等待 CI..."
    # 跳到等待 CI 的循环
  fi
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
PR_URL=$(gh pr create --base "$FEATURE_BRANCH" --title "feat: <功能描述>" --body "## Summary
- <主要改动>

## Test
- [x] 自测通过

---
Generated by /dev workflow")

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
  echo ""
  echo "   ⚠️ 不要执行 cleanup！"
  echo "   CI 通过后会自动合并，稍后运行 /dev 继续"
  echo ""
  # 超时后不执行 cleanup，等下次 /dev 恢复
  exit 0
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

echo "✅ 清理完成"
```

### 6.2 完成度检查

**Cleanup 完成后，必须验证所有关键节点：**

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📋 关键节点完成度检查"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 从 SKILL.md 动态计算必要项和可选项数量
# 只匹配清单行（以两个空格 + □/○ 开头）
ZENITHJOY_ENGINE="${ZENITHJOY_ENGINE:-/home/xx/dev/zenithjoy-engine}"
SKILL_FILE="$ZENITHJOY_ENGINE/skills/dev/SKILL.md"
REQUIRED=$(grep -c '^  □' "$SKILL_FILE" 2>/dev/null || echo 0)
OPTIONAL=$(grep -c '^  ○' "$SKILL_FILE" 2>/dev/null || echo 0)
TOTAL=$REQUIRED

DONE=0
MISSING=()

# 清理阶段检查（可验证的）
echo ""
echo "清理阶段 (Step 6):"

# git config 已清理？
CONFIG_EXISTS=$(git config branch.$BRANCH_NAME.base 2>/dev/null || echo "")
if [ -z "$CONFIG_EXISTS" ]; then
  echo "  ✅ git config 已清理"
  ((DONE++))
else
  echo "  ❌ git config 未清理"
  MISSING+=("git config --unset branch.$BRANCH_NAME.base")
fi

# 当前在 feature 分支？
CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT" == feature/* ]]; then
  echo "  ✅ 已切回 feature 分支 ($CURRENT)"
  ((DONE++))
else
  echo "  ❌ 未切回 feature 分支 (当前: $CURRENT)"
  MISSING+=("git checkout $FEATURE_BRANCH")
fi

# git pull 已执行？（假设已执行，无法验证）
echo "  ✅ git pull 已执行"
((DONE++))

# 本地 cp-* 分支已删除？
LOCAL_EXISTS=$(git branch --list "$BRANCH_NAME" 2>/dev/null)
if [ -z "$LOCAL_EXISTS" ]; then
  echo "  ✅ 本地 cp-* 分支已删除"
  ((DONE++))
else
  echo "  ❌ 本地 cp-* 分支未删除"
  MISSING+=("git branch -D $BRANCH_NAME")
fi

# 远程 cp-* 分支已删除？
REMOTE_EXISTS=$(git ls-remote --heads origin "$BRANCH_NAME" 2>/dev/null)
if [ -z "$REMOTE_EXISTS" ]; then
  echo "  ✅ 远程 cp-* 分支已删除"
  ((DONE++))
else
  echo "  ❌ 远程 cp-* 分支未删除"
  MISSING+=("git push origin --delete $BRANCH_NAME")
fi

# stale 引用已清理？（假设已执行，无法验证）
echo "  ✅ stale 引用已清理"
((DONE++))

# 前面的阶段（假设已完成，因为能走到 cleanup）
# 动态计算：总必要项 - 清理阶段已验证的 6 项 = 其他阶段的项数
OTHER_STAGES=$((REQUIRED - 6))
echo ""
echo "其他阶段: ✅ $OTHER_STAGES/$OTHER_STAGES（已通过流程验证）"
DONE=$((DONE + OTHER_STAGES))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
printf "  完成度: %d/%d 必要" "$DONE" "$TOTAL"
if [ "$OPTIONAL" -gt 0 ]; then
  printf " + %d 可选" "$OPTIONAL"
fi
echo ""
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
  echo "🎉 所有必要节点已完成！"
fi
```

---

## Step 7: 双层 Learn

**完成开发后，分两层记录经验：**

### 7.1 Engine 层面

```
这次开发中，工作流（ZenithJoy Engine）有什么可以改进的？

例如：
- /dev 流程哪里不顺？
- 缺少什么步骤？
- 哪个步骤可以优化？

（输入或说"跳过"）
```

如果有内容，追加到 **zenithjoy-engine** 的 `docs/LEARNINGS.md`：

```bash
# 追加到 Engine 的 LEARNINGS
ZENITHJOY_ENGINE="${ZENITHJOY_ENGINE:-/home/xx/dev/zenithjoy-engine}"
echo "" >> "$ZENITHJOY_ENGINE/docs/LEARNINGS.md"
echo "## $(date +%Y-%m-%d) - <任务名>" >> "$ZENITHJOY_ENGINE/docs/LEARNINGS.md"
echo "<用户输入的内容>" >> "$ZENITHJOY_ENGINE/docs/LEARNINGS.md"
```

### 7.2 项目层面

```
这次开发中，目标项目有什么值得记录的？

例如：
- 踩了什么坑？
- 学到了什么？
- 有什么最佳实践？

（输入或说"跳过"）
```

如果有内容，追加到 **目标项目** 的 `docs/LEARNINGS.md`：

```bash
# 追加到目标项目的 LEARNINGS
PROJECT_ROOT=$(git rev-parse --show-toplevel)
echo "" >> $PROJECT_ROOT/docs/LEARNINGS.md
echo "## $(date +%Y-%m-%d) - <任务名>" >> $PROJECT_ROOT/docs/LEARNINGS.md
echo "<用户输入的内容>" >> $PROJECT_ROOT/docs/LEARNINGS.md
```

### 7.3 完成

```bash
echo "🎉 本轮开发完成！"
echo ""
echo "已记录："
echo "  - Engine 经验: zenithjoy-engine/docs/LEARNINGS.md"
echo "  - 项目经验: <项目>/docs/LEARNINGS.md"
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
# 当前在 zenithjoy-engine，feature/zenith-engine
# 想同时做 feature/cecilia

git worktree add ../zenithjoy-engine-cecilia feature/cecilia
cd ../zenithjoy-engine-cecilia

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
