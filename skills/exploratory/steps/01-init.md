# Step 1: 初始化 Worktree

> 创建临时 worktree，隔离 Exploratory 代码

---

## 任务参数

从用户输入提取任务描述：
```bash
# 用户输入：/exploratory "添加 GET /api/hello endpoint"
TASK_DESC="添加 GET /api/hello endpoint"
```

---

## 环境检查

```bash
# 检查当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [[ "$CURRENT_BRANCH" != "develop" && "$CURRENT_BRANCH" != "main" ]]; then
    echo "⚠️  警告：不在 develop 或 main 分支"
    echo "   当前分支: $CURRENT_BRANCH"
    echo "   建议切换到 develop 后再执行"
    exit 1
fi

echo "✅ 当前分支: $CURRENT_BRANCH"
```

---

## 创建 Worktree

```bash
# 生成 worktree 路径和分支名
TIMESTAMP=$(date +%s)
WORKTREE_NAME="exploratory-$TIMESTAMP"
WORKTREE_PATH="../$WORKTREE_NAME"
BRANCH_NAME="exp-$TIMESTAMP"

echo "🌿 创建 Exploratory Worktree..."
echo "   路径: $WORKTREE_PATH"
echo "   分支: $BRANCH_NAME"

# 创建 worktree
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"

if [[ ! -d "$WORKTREE_PATH" ]]; then
    echo "❌ Worktree 创建失败"
    exit 1
fi

echo "✅ Worktree 创建成功"
```

---

## 切换到 Worktree

```bash
cd "$WORKTREE_PATH"
echo "✅ 已切换到 Worktree: $(pwd)"
```

---

## 创建 .exploratory-mode 文件

```bash
cat > .exploratory-mode << INNER_EOF
exploratory
task: $TASK_DESC
worktree: $WORKTREE_PATH
branch: $BRANCH_NAME
started: $(date -Iseconds)
step_1_init: done
step_2_explore: pending
step_3_validate: pending
step_4_document: pending
INNER_EOF

echo "✅ .exploratory-mode 创建成功"
```

---

## 安装依赖（如果需要）

```bash
if [[ -f "package.json" ]]; then
    echo "📦 安装依赖..."
    npm install --prefer-offline 2>/dev/null || npm install
    echo "✅ 依赖安装完成"
fi
```

---

## 完成

```bash
echo "✅ Step 1 完成 - Worktree 初始化"
echo ""
echo "📍 Exploratory 环境："
echo "   Worktree: $WORKTREE_PATH"
echo "   分支: $BRANCH_NAME"
echo "   任务: $TASK_DESC"
echo ""
echo "💡 提示：所有代码修改在 worktree 中进行，不会污染主仓库"
```

**立即执行下一步**：读取 `02-explore.md` 并开始实现
