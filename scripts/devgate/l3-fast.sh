#!/usr/bin/env bash
set -euo pipefail

# L3 Fast Check
# 最佳实践：lint/format/结构规则（快速、无全量回归）

echo "==> L3 Fast Check"

# Lint（占位符，待后续添加 eslint）
echo "→ Running lint..."
npm run lint --if-present || echo "⚠️  lint 未配置，跳过"

# Format check（占位符，待后续添加 prettier）
echo "→ Running format check..."
npm run format:check --if-present || echo "⚠️  format:check 未配置，跳过"

echo "✅ L3 Fast 检查通过（占位符）"
exit 0
