#!/usr/bin/env bash
# ============================================================================
# snapshot-prd-dod.sh
# ============================================================================
#
# PR 创建时自动保存 PRD/DoD 快照。
#
# 用法：
#   bash scripts/devgate/snapshot-prd-dod.sh <PR_NUMBER>
#
# 示例：
#   bash scripts/devgate/snapshot-prd-dod.sh 204
#
# 输出：
#   .history/PR-204-20260122-1048.prd.md
#   .history/PR-204-20260122-1048.dod.md
#
# 返回码：
#   0 - 快照成功
#   1 - 参数错误或文件不存在
#
# ============================================================================

set -euo pipefail

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

# 参数检查
if [[ $# -lt 1 ]]; then
    echo "用法: bash scripts/devgate/snapshot-prd-dod.sh <PR_NUMBER>" >&2
    exit 1
fi

PR_NUMBER="$1"

# 验证 PR 号是数字
if ! [[ "$PR_NUMBER" =~ ^[0-9]+$ ]]; then
    echo "错误: PR 号必须是数字" >&2
    exit 1
fi

# 找项目根目录
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$PROJECT_ROOT"

# 检查文件存在
PRD_FILE="$PROJECT_ROOT/.prd.md"
DOD_FILE="$PROJECT_ROOT/.dod.md"
HISTORY_DIR="$PROJECT_ROOT/.history"

if [[ ! -f "$PRD_FILE" ]]; then
    echo -e "${YELLOW}⚠️  .prd.md 不存在，跳过快照${NC}" >&2
    exit 0
fi

if [[ ! -f "$DOD_FILE" ]]; then
    echo -e "${YELLOW}⚠️  .dod.md 不存在，跳过快照${NC}" >&2
    exit 0
fi

# 创建 history 目录
mkdir -p "$HISTORY_DIR"

# 生成时间戳
TIMESTAMP=$(date +%Y%m%d-%H%M)

# 生成文件名
PRD_SNAPSHOT="$HISTORY_DIR/PR-${PR_NUMBER}-${TIMESTAMP}.prd.md"
DOD_SNAPSHOT="$HISTORY_DIR/PR-${PR_NUMBER}-${TIMESTAMP}.dod.md"

# 复制文件
cp "$PRD_FILE" "$PRD_SNAPSHOT"
cp "$DOD_FILE" "$DOD_SNAPSHOT"

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  PRD/DoD 快照已保存" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
echo -e "  ${GREEN}✅${NC} $(basename "$PRD_SNAPSHOT")" >&2
echo -e "  ${GREEN}✅${NC} $(basename "$DOD_SNAPSHOT")" >&2
echo "" >&2
echo "  存储位置: .history/" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

exit 0
