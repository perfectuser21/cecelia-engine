# /dev 详细步骤参考

> 此文档包含 /dev 工作流的完整实现细节。
> 仅在需要时按步骤加载，减少上下文开销。
>
> 最后更新: 2026-01-17 v7.17.0

---

## Step 0: 依赖检查

**始终执行，无论当前在什么分支。**

```bash
echo "🔍 检查依赖..."

# gh CLI
if ! command -v gh &> /dev/null; then
  echo "❌ 需要安装 gh CLI: https://cli.github.com/"
  exit 1
fi

# jq
if ! command -v jq &> /dev/null; then
  echo "❌ 需要安装 jq: apt install jq"
  exit 1
fi

# gh 登录状态
if ! gh auth status &> /dev/null; then
  echo "❌ 需要登录 gh: gh auth login"
  exit 1
fi

echo "✅ 依赖检查通过"
```

---

## Step 1: 检查分支

```bash
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO=$(basename "$(git rev-parse --show-toplevel)")

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

elif [[ "$BRANCH" =~ ^feature/ ]]; then
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
当前在 feature/some-feature

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

**用户确认后，设置 PRD 确认标记：**

```bash
# PRD 确认后立即执行
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
git config branch."$BRANCH_NAME".prd-confirmed true
echo "✅ PRD 已确认，可以开始写代码"
```

**然后继续开发。**

---

## Step 4: 写代码 + 写测试

### 4.1 写功能代码

根据 PRD 和 DoD 实现功能。

### 4.2 写测试代码（必须！）

**每个功能必须有对应的测试。**

```
DoD 里写的验收标准 → 变成测试代码

例如：
  DoD: "用户能登录"
    ↓
  测试: it('用户能登录', () => { ... })

  DoD: "密码错误有提示"
    ↓
  测试: it('密码错误有提示', () => { ... })
```

**测试文件命名**：
- `功能.ts` → `功能.test.ts`
- 例：`login.ts` → `login.test.ts`

**测试要求**：
- 必须有断言（expect）
- 覆盖核心功能路径
- 覆盖主要边界情况

### 4.3 本地跑测试

```bash
echo "=== 本地测试 ==="
npm test

# 必须全绿才能继续
# 红了就修，不能跳过
```

**Hook 强制**：PR 创建前会自动跑 `npm test`，不过不能提交。

---

## Step 5: 提交 PR

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

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

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
```

---

## Step 5.5: 质检闭环

**PR 创建后，进入质检循环。**

### 5.5.1 质检循环逻辑

```
┌─────────────────────────────────────────────────────────────┐
│                      质检闭环                                │
└─────────────────────────────────────────────────────────────┘

PR 创建
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  轮询检查（每 30 秒）：                                       │
│    1. CI 状态                                               │
│    2. Codex review 评论                                     │
└─────────────────────────────────────────────────────────────┘
    │
    ├── PR 已合并 → 完成 ✅
    │
    ├── CI 失败 → 读错误 → 修复 → 重新 push → 继续轮询
    │
    ├── Codex 有问题反馈 → 读评论 → 修复 → 重新 push → 继续轮询
    │
    └── CI 通过 + Codex 没问题 → 等待自动合并
```

### 5.5.2 使用轮询脚本

**推荐使用脚本**：

```bash
bash skills/dev/scripts/wait-for-merge.sh "$PR_URL"
```

**脚本功能**：
- 每 30 秒轮询 PR 状态
- 检查 CI 是否失败
- 检查 Codex 是否发现问题
- 有问题退出码为 1，需要修复
- 合并成功退出码为 0

**退出码**：
- `0` = PR 已合并，进入 cleanup
- `1` = 需要修复（CI 失败或 Codex 有问题）
- `2` = 超时，手动检查

### 5.5.3 修复逻辑

**CI 失败时**：
```bash
# 1. 读取 CI 错误
gh run view --log-failed

# 2. 分析错误，修复代码

# 3. 重新提交
git add -A
git commit -m "fix: 修复 CI 错误"
git push

# 4. 继续轮询，CI 会自动重跑
```

**Codex 有问题时**：
```bash
# 1. 读取 Codex 评论
CODEX_FEEDBACK=$(gh api repos/:owner/:repo/issues/$PR_NUMBER/comments \
  --jq '.[] | select(.user.login == "chatgpt-codex-connector[bot]") | .body' \
  | tail -1)

# 2. 根据反馈修复代码

# 3. 重新提交
git add -A
git commit -m "fix: 根据 Codex review 修复"
git push

# 4. 继续轮询，Codex 会自动重新 review
```

### 5.5.4 完成条件

```
以下条件全部满足才算完成：

✅ CI 全绿
✅ Codex review 没有问题（或说 "no issues" / "LGTM"）
✅ PR 已合并
```

---

## Step 6: Cleanup

**只在 PR 成功合并后执行。**

### 6.1 使用 cleanup 脚本（推荐）

```bash
bash skills/dev/scripts/cleanup.sh "$BRANCH_NAME" "$FEATURE_BRANCH"
```

**脚本会检查并清理**：
1. 切换到 base 分支
2. 拉取最新代码
3. 删除本地 cp-* 分支
4. 删除远程 cp-* 分支
5. 清理 git config
6. 清理 stale remote refs
7. 检查未提交文件
8. 检查其他遗留 cp-* 分支

### 6.2 手动清理（备用）

```bash
echo "🧹 清理..."

# 1. 清理 git config 中保存的分支信息
git config --unset branch.$BRANCH_NAME.base 2>/dev/null || true
git config --unset branch.$BRANCH_NAME.prd-confirmed 2>/dev/null || true

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
echo "" >> "$PROJECT_ROOT/docs/LEARNINGS.md"
echo "## $(date +%Y-%m-%d) - <任务名>" >> "$PROJECT_ROOT/docs/LEARNINGS.md"
echo "<用户输入的内容>" >> "$PROJECT_ROOT/docs/LEARNINGS.md"
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

## 并行开发（Worktree）

如果要同时在多个 feature 上工作：

```bash
# 当前在 zenithjoy-engine 目录，develop 分支
# 想同时做 feature/new-feature

git worktree add ../zenithjoy-engine-cecilia feature/cecilia
cd ../zenithjoy-engine-cecilia

# 在新目录开始 /dev
```

列出所有 worktree：

```bash
git worktree list
```
