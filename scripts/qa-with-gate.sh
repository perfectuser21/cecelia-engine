#!/usr/bin/env bash
# ============================================================================
# QA with Quality Gate
# ============================================================================
# 运行完整质检，成功时生成质检门控文件
# ============================================================================

set -euo pipefail

PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
QUALITY_GATE_FILE="$PROJECT_ROOT/.quality-gate-passed"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  QA 质检开始"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 删除旧的质检门控文件
rm -f "$QUALITY_GATE_FILE"

# 运行质检
echo "  [1/3] Typecheck..."
npm run typecheck || {
    echo ""
    echo "❌ Typecheck 失败"
    exit 1
}

echo ""
echo "  [2/3] Test..."
npm run test || {
    echo ""
    echo "❌ 测试失败"
    exit 1
}

echo ""
echo "  [3/3] Build..."
npm run build || {
    echo ""
    echo "❌ 构建失败"
    exit 1
}

# 全部通过，生成质检门控文件
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ QA 质检全部通过！"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 生成质检门控文件（带时间戳）
cat > "$QUALITY_GATE_FILE" << EOF
# Quality Gate Passed
# Generated: $(date -Iseconds 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S')
# Branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
# Commit: $(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

typecheck: PASS
test: PASS
build: PASS
EOF

echo "  质检门控文件已生成: .quality-gate-passed"
echo ""
echo "  Stop Hook 现在允许会话结束"
echo "  下一步: 创建 PR"
echo ""
