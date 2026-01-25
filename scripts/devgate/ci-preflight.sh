#!/usr/bin/env bash
set -euo pipefail

# CI Preflight Check
# 本地快速预检：L1-fast + L3-fast + L2A-min
# 目标：推之前尽量发现会挂 CI 的问题，但必须快（< 120s）

echo "======================================"
echo "CI Preflight Check"
echo "======================================"

START_TIME=$(date +%s)

# L1-fast: typecheck + test（不 build）
echo ""
echo "==> L1 Fast: typecheck + test"
npm run typecheck
npm run test

# L3-fast: lint/format
echo ""
bash scripts/devgate/l3-fast.sh

# L2A-min（可选，快速检查）
echo ""
echo "==> L2A-min: 快速产物检查"
if [[ -f ".prd.md" ]]; then
  echo "✅ .prd.md 存在"
else
  echo "⚠️  .prd.md 不存在（开发分支需要）"
fi

if [[ -f ".dod.md" ]]; then
  echo "✅ .dod.md 存在"
else
  echo "⚠️  .dod.md 不存在（开发分支需要）"
fi

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo ""
echo "======================================"
echo "✅ Preflight 检查通过"
echo "⏱️  耗时: ${DURATION}s"
echo "======================================"

exit 0
