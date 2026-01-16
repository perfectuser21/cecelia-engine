#!/bin/bash
# ZenithJoy Engine - PR 前检查 Hook（版本见 package.json）
# 在 gh pr create 之前，强制运行 test 和 typecheck
# 检查失败则阻止 PR 创建

set -e

# 检查 jq 是否存在
if ! command -v jq &>/dev/null; then
  echo "⚠️ jq 未安装，PR 前检查 Hook 无法正常工作" >&2
  exit 0
fi

# Read JSON input from stdin
INPUT=$(cat)

# Extract command (with error handling)
if ! COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>&1); then
    echo "⚠️ Hook 无法解析输入 JSON: $COMMAND" >&2
    exit 0  # 不阻止操作，但警告用户
fi

# 只检查 gh pr create 命令
if [[ "$COMMAND" != *"gh pr create"* ]]; then
    exit 0
fi

# 获取项目根目录（从 git）
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")

if [[ -z "$PROJECT_ROOT" ]]; then
    exit 0
fi

# 检查是否有 package.json
if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    exit 0
fi

cd "$PROJECT_ROOT"

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  🔍 PR 前检查 (Pre-PR Hook)" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

FAILED=0

# 1. 运行 typecheck（如果有这个 script）
if grep -q '"typecheck"' "$PROJECT_ROOT/package.json"; then
    echo "  → npm run typecheck..." >&2
    if ! npm run typecheck >/dev/null 2>&1; then
        echo "  ❌ typecheck 失败" >&2
        echo "     运行: npm run typecheck 查看详情" >&2
        FAILED=1
    else
        echo "  ✅ typecheck 通过" >&2
    fi
fi

# 2. 运行 test（如果有这个 script）
if grep -q '"test"' "$PROJECT_ROOT/package.json"; then
    echo "  → npm test..." >&2
    if ! npm test >/dev/null 2>&1; then
        echo "  ❌ test 失败" >&2
        echo "     运行: npm test 查看详情" >&2
        FAILED=1
    else
        echo "  ✅ test 通过" >&2
    fi
fi

echo "" >&2

if [[ $FAILED -eq 1 ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  ❌ 检查未通过，PR 创建被阻止" >&2
    echo "  请先修复问题再创建 PR" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2
    exit 2  # 阻止操作
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  ✅ 所有检查通过，允许创建 PR" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

exit 0
