#!/bin/bash
# init-worktree.sh - 创建 Exploratory worktree

set -e

TASK_DESC="${1:-探索性任务}"
TIMESTAMP=$(date +%s)
WORKTREE_NAME="exploratory-$TIMESTAMP"
WORKTREE_PATH="../$WORKTREE_NAME"
BRANCH_NAME="exp-$TIMESTAMP"

echo "🌿 创建 Exploratory Worktree..."
echo "   路径: $WORKTREE_PATH"
echo "   分支: $BRANCH_NAME"

# 创建 worktree
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"

echo "$WORKTREE_PATH"
