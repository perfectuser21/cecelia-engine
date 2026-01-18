#!/bin/bash
# ============================================================================
# PreToolUse Hook: PR Gate（本地质检门）
# ============================================================================
#
# 触发：拦截 gh pr create
# 作用：提交 PR 前自己跑验证，不过不让提
#
# 验证项：
#   1. npm test
#   2. npm run lint（如果有）
#   3. npm run typecheck（如果有）
#
# ============================================================================

set -e

INPUT=$(cat)

TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty' 2>/dev/null)

# 只处理 Bash 工具
if [[ "$TOOL_NAME" != "Bash" ]]; then
    exit 0
fi

COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

# 只拦截 gh pr create
if [[ "$COMMAND" != *"gh pr create"* ]] && [[ "$COMMAND" != *"gh pr create"* ]]; then
    exit 0
fi

# 获取项目根目录
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

if [[ ! -f "$PROJECT_ROOT/package.json" ]]; then
    exit 0  # 没有 package.json，跳过验证
fi

cd "$PROJECT_ROOT"

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  PR GATE: 本地质检" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

FAILED=0

# 1. Typecheck
if grep -q '"typecheck"' package.json; then
    echo -n "  Typecheck... " >&2
    if npm run typecheck >/dev/null 2>&1; then
        echo "✅" >&2
    else
        echo "❌" >&2
        FAILED=1
    fi
fi

# 2. Test
if grep -q '"test"' package.json; then
    echo -n "  Test... " >&2
    if npm test >/dev/null 2>&1; then
        echo "✅" >&2
    else
        echo "❌" >&2
        FAILED=1
    fi
fi

# 3. Lint
if grep -q '"lint"' package.json; then
    echo -n "  Lint... " >&2
    if npm run lint >/dev/null 2>&1; then
        echo "✅" >&2
    else
        echo "❌" >&2
        FAILED=1
    fi
fi

echo "" >&2

if [[ $FAILED -eq 1 ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  ❌ 质检未通过，不能提交 PR" >&2
    echo "" >&2
    echo "  请先修复问题再提交。" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  ✅ 质检通过，允许提交 PR" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

exit 0
