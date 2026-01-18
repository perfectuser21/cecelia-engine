#!/usr/bin/env bash
# ============================================================================
# Stop Hook: 任务完成检查
# ============================================================================
#
# 触发：Claude 要退出/完成任务时
# 作用：验证任务是否真的完成了
#
# 检查项（cp-* 分支）：
#   - step >= 10（Learning 完成）或不在 cp-* 分支
#   - 如果 step < 10，提示还有工作没完成
#
# ============================================================================

set -euo pipefail

# 读取输入（丢弃，stop hook 不需要）
cat > /dev/null

# 获取项目根目录
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$PROJECT_ROOT"

# 获取当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# 只检查 cp-* 分支
if [[ ! "${CURRENT_BRANCH:-}" =~ ^cp-[a-zA-Z0-9] ]]; then
    # 不在 cp-* 分支，直接放行
    exit 0
fi

# 获取当前步骤
CURRENT_STEP=$(git config --get branch."$CURRENT_BRANCH".step 2>/dev/null || echo "0")

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  STOP GATE: 任务完成检查" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
echo "  分支: $CURRENT_BRANCH" >&2
echo "  步骤: $CURRENT_STEP" >&2
echo "" >&2

# 步骤含义（11 步流程）：
# 1: PRD 确定
# 2: 项目环境检测完成
# 3: 分支已创建
# 4: DoD 完成（可以写代码）
# 5: 代码完成
# 6: 测试完成
# 7: 质检通过（可以提交）
# 8: PR 已创建
# 9: CI 通过
# 10: Learning 完成
# 11: 已清理

# 使用统一的 case 语句处理所有步骤
case $CURRENT_STEP in
    0)
        echo "  ⚠️  准备阶段 (step=0)" >&2
        echo "  建议: 运行 /dev 开始任务" >&2
        ;;
    1)
        echo "  ⚠️  PRD 确定 (step=1)" >&2
        echo "  建议: 继续完成任务" >&2
        ;;
    2)
        echo "  ⚠️  项目环境检测完成 (step=2)" >&2
        echo "  建议: 继续完成任务" >&2
        ;;
    3)
        echo "  ⚠️  分支已创建 (step=3)" >&2
        echo "  建议: 继续完成任务" >&2
        ;;
    4)
        echo "  ⚠️  DoD 完成，可以写代码 (step=4)" >&2
        echo "  建议: 继续完成任务" >&2
        ;;
    5)
        echo "  ⚠️  代码完成 (step=5)" >&2
        echo "  建议: 继续完成任务" >&2
        ;;
    6)
        echo "  ⚠️  测试完成 (step=6)" >&2
        echo "  建议: 继续完成任务" >&2
        ;;
    7)
        echo "  ⚠️  质检通过，可以提交 (step=7)" >&2
        echo "  建议: 继续完成任务" >&2
        ;;
    8)
        echo "  ⚠️  PR 已创建，等待 CI (step=8)" >&2
        echo "  建议: 等 CI 通过" >&2
        ;;
    9)
        echo "  ⚠️  CI 通过，等待 Learning (step=9)" >&2
        echo "  建议: 完成 Learning 总结" >&2
        ;;
    10)
        echo "  ✅ Learning 完成 (step=10)" >&2
        echo "  建议: 运行 cleanup 清理分支" >&2
        ;;
    *)
        echo "  ✅ 任务已完成 (step=$CURRENT_STEP)" >&2
        ;;
esac
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

exit 0
