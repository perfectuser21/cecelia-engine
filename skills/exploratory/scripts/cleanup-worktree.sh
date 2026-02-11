#!/bin/bash
# cleanup-worktree.sh - 清理 Exploratory worktree

set -e

WORKTREE_PATH="${1:?需要提供 worktree 路径}"
BRANCH_NAME="${2:?需要提供分支名}"

echo "🧹 清理 Exploratory Worktree..."

# 删除 worktree
git worktree remove "$WORKTREE_PATH" --force

# 删除临时分支
git branch -D "$BRANCH_NAME"

echo "✅ Worktree 已清理"
echo "✅ 临时分支已删除"
