# Step 3: 创建分支

> 创建功能分支，记录 base-branch

---

## 环境检查

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO=$(basename "$(git rev-parse --show-toplevel)")

# 检测是否在 worktree 中
IS_WORKTREE=false
GIT_DIR=$(git rev-parse --git-dir 2>/dev/null)
if [[ "$GIT_DIR" == *"worktrees"* ]]; then
    IS_WORKTREE=true
    MAIN_WORKTREE=$(git worktree list 2>/dev/null | head -1 | awk '{print $1}')
fi

echo "📍 当前位置："
echo "   Repo: $REPO"
echo "   分支: $CURRENT_BRANCH"
if [[ "$IS_WORKTREE" == "true" ]]; then
    echo "   环境: Worktree"
    echo "   主工作区: $MAIN_WORKTREE"
fi
```

**分支处理逻辑**：

| 当前分支 | 动作 |
|----------|------|
| main | 不能在 main 开发，切到 develop |
| develop | → 创建 cp-* 分支 |
| feature/* | → 创建 cp-* 分支 |
| cp-* | ✅ 继续当前任务，跳到 Step 4 |

**Worktree 注意**：如果在 worktree 中，分支已由 worktree-manage.sh 创建。

---

## 创建功能分支

```bash
# 生成分支名：{Feature ID}-{任务名}
FEATURE_ID="<从 FEATURES.md 获取，如 W6>"
TASK_NAME="<根据用户需求生成>"
BRANCH_NAME="${FEATURE_ID}-${TASK_NAME}"

# 记住当前分支作为 base
BASE_BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "🌿 创建分支..."
echo "   名称: $BRANCH_NAME"
echo "   Base: $BASE_BRANCH"

# 创建分支
git checkout -b "$BRANCH_NAME"

# 保存 base 分支到 git config
git config branch.$BRANCH_NAME.base-branch "$BASE_BRANCH"

echo "✅ 分支已创建: $BRANCH_NAME"
echo "   Base: $BASE_BRANCH"
```

---

## 分支命名规则

**格式**：`{Feature ID}-{任务名}`

| Feature | 任务描述 | 分支名 |
|---------|----------|--------|
| W6 (Worktree) | 并行检测 | `W6-parallel-detect` |
| W6 (Worktree) | 脚本管理 | `W6-worktree-manage` |
| H1 (branch-protect) | 修复 bug | `H1-fix-checkout` |
| C1 (version-check) | 添加验证 | `C1-add-validation` |

**规则**：
- Feature ID 必须在 FEATURES.md 中已注册
- 新功能需先在 FEATURES.md 注册后再创建分支
- 任务名使用英文小写，多个单词用 `-` 连接
- 不需要 `cp-` 前缀（`cp-` 只用于 Checkpoint 编号）

---

## Checkpoint 命名规则

PRD 中的子任务使用 `CP-{序号}-{任务名}` 格式：

```markdown
- [ ] CP-001-parallel-detect | code | none
- [ ] CP-002-worktree-manage | code | CP-001
- [ ] CP-003-cleanup-extend | code | CP-002
```

---

## 恢复现有分支

如果当前已在功能分支（非 main/develop），跳过创建：

```bash
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" != "main" && "$CURRENT_BRANCH" != "develop" ]]; then
    echo "✅ 已在功能分支: $CURRENT_BRANCH"

    # 读取保存的状态
    BASE_BRANCH=$(git config branch.$CURRENT_BRANCH.base-branch)

    echo "   Base: $BASE_BRANCH"
    echo ""
    echo "🔄 继续开发"

    exit 0
fi
```

---

## git config 状态

分支创建后，保存以下状态：

```bash
# 查看分支配置
git config --get branch.$BRANCH_NAME.base-branch
# 输出: develop
```

这些状态用于：
- **base-branch**: PR 时自动设置目标分支

---

## 完成后

```bash
echo "✅ Step 3 完成 (分支创建)"
echo ""
echo "📝 下一步: Step 4 (DoD)"
```

---

## 注意事项

- **分支名格式**：`{Feature ID}-{任务名}`
- **Feature ID 必须已注册** - 在 FEATURES.md 中
- **base-branch 必须保存** - PR 时使用
- **不要用 `cp-` 前缀** - `cp-` 只用于 Checkpoint 编号
