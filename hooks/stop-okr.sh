#!/usr/bin/env bash
# ============================================================================
# Stop Hook: /okr 完成条件检查
# ============================================================================
# 检查秋米 KR 拆解完成条件：
#   1. Feature 创建了吗？
#   2. Task 创建了吗？
#   3. PRD 写了吗？
#   4. DoD 草稿写了吗？
#   5. KR 状态更新了吗？
# ============================================================================

set -euo pipefail

# ===== 获取项目根目录 =====
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
OKR_MODE_FILE="$PROJECT_ROOT/.okr-mode"

# ===== 检查 .okr-mode 文件 =====
if [[ ! -f "$OKR_MODE_FILE" ]]; then
    # 没有 .okr-mode，允许结束
    exit 0
fi

# ===== 读取 .okr-mode 内容 =====
MODE=$(head -1 "$OKR_MODE_FILE" 2>/dev/null || echo "")

if [[ "$MODE" != "okr" ]]; then
    # 不是 okr 模式，允许结束
    exit 0
fi

# ===== 读取各个字段 =====
KR_ID=$(grep "^kr_id:" "$OKR_MODE_FILE" | cut -d' ' -f2 || echo "")
FEATURE_ID=$(grep "^feature_id:" "$OKR_MODE_FILE" | cut -d' ' -f2 || echo "")
TASK_IDS=$(grep "^task_ids:" "$OKR_MODE_FILE" | cut -d' ' -f2- || echo "")
PRD_IDS=$(grep "^prd_ids:" "$OKR_MODE_FILE" | cut -d' ' -f2- || echo "")
DOD_IDS=$(grep "^dod_ids:" "$OKR_MODE_FILE" | cut -d' ' -f2- || echo "")
KR_UPDATED=$(grep "^kr_updated:" "$OKR_MODE_FILE" | cut -d' ' -f2 || echo "false")

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  [Stop Hook: 秋米完成条件检查]" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
echo "  KR: $KR_ID" >&2
echo "" >&2

# ===== 条件 1: Feature 创建了吗？ =====
if [[ -z "$FEATURE_ID" || "$FEATURE_ID" == "(待填)" ]]; then
    echo "  ❌ 条件 1: Feature 未创建" >&2
    echo "" >&2
    echo "  下一步: 调用 POST /api/brain/action/create-feature" >&2
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi
echo "  ✅ 条件 1: Feature 已创建 ($FEATURE_ID)" >&2

# ===== 条件 2: Task 创建了吗？ =====
if [[ -z "$TASK_IDS" || "$TASK_IDS" == "(待填)" ]]; then
    echo "  ❌ 条件 2: Task 未创建" >&2
    echo "" >&2
    echo "  下一步: 调用 POST /api/brain/action/create-task" >&2
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi
echo "  ✅ 条件 2: Task 已创建 ($TASK_IDS)" >&2

# ===== 条件 3: PRD 写了吗？ =====
if [[ -z "$PRD_IDS" || "$PRD_IDS" == "(待填)" ]]; then
    echo "  ❌ 条件 3: PRD 未写入" >&2
    echo "" >&2
    echo "  下一步: 为每个 Task 写 PRD" >&2
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi
echo "  ✅ 条件 3: PRD 已写入 ($PRD_IDS)" >&2

# ===== 条件 4: DoD 草稿写了吗？ =====
if [[ -z "$DOD_IDS" || "$DOD_IDS" == "(待填)" ]]; then
    echo "  ❌ 条件 4: DoD 草稿未写入" >&2
    echo "" >&2
    echo "  下一步: 为每个 Task 写 DoD 草稿（TODO 占位）" >&2
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi
echo "  ✅ 条件 4: DoD 草稿已写入 ($DOD_IDS)" >&2

# ===== 条件 5: KR 状态更新了吗？ =====
if [[ "$KR_UPDATED" != "true" ]]; then
    echo "  ❌ 条件 5: KR 状态未更新" >&2
    echo "" >&2
    echo "  下一步: PUT /api/tasks/goals/$KR_ID {status: 'in_progress'}" >&2
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi
echo "  ✅ 条件 5: KR 状态已更新" >&2

# ===== 全部完成 =====
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  🎉 秋米拆解完成！" >&2
echo "" >&2
echo "  Feature: $FEATURE_ID" >&2
echo "  Tasks: $TASK_IDS" >&2
echo "  PRDs: $PRD_IDS" >&2
echo "  DoDs: $DOD_IDS" >&2
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

# 删除 .okr-mode 文件
rm -f "$OKR_MODE_FILE"

# 允许会话结束
exit 0
