#!/usr/bin/env bash
# ============================================================================
# 阶段检测脚本
# ============================================================================
# 每次启动只问三个问题，决定进入哪个阶段
#
# 错误处理：
# - gh 临时错误（rate limit / 网络错误）→ PHASE: unknown → exit 0
# - 不允许因为 API 波动误判阶段
# ============================================================================

set -euo pipefail

# ===== PHASE_OVERRIDE 支持 =====
# 允许强制指定阶段（仅用于 p1，CI fail 通知触发时）
if [[ -n "${PHASE_OVERRIDE:-}" ]]; then
    if [[ "$PHASE_OVERRIDE" == "p1" ]]; then
        echo "PHASE: p1"
        echo "DESCRIPTION: CI fail 修复阶段（强制模式）"
        echo "ACTION: 修复 CI → push → 退出"
        echo ""
        echo "说明: PHASE_OVERRIDE=p1 强制进入 p1 阶段"
        exit 0
    fi
fi

# 获取当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

if [[ -z "$CURRENT_BRANCH" ]]; then
    echo "ERROR: 无法获取当前分支"
    exit 1
fi

# ===== 问题 1: 有没有 PR？=====
PR_NUMBER=""
GH_ERROR=false

if ! command -v gh &>/dev/null; then
    # gh 命令不可用 → unknown（安全退出）
    echo "PHASE: unknown"
    echo "DESCRIPTION: gh 命令不可用"
    echo "ACTION: 直接退出（无法检测阶段）"
    echo ""
    echo "说明: 请安装 gh CLI 或手动检查 PR/CI 状态"
    exit 0
fi

# 尝试获取 PR，捕获错误
PR_NUMBER=$(gh pr list --head "$CURRENT_BRANCH" --state open --json number -q '.[0].number' 2>/dev/null || echo "")
GH_EXIT_CODE=$?

# 检查 gh 命令是否失败（rate limit / 网络错误）
if [[ $GH_EXIT_CODE -ne 0 ]] && [[ -z "$PR_NUMBER" ]]; then
    # gh 命令失败，可能是 API 错误
    GH_ERROR_MSG=$(gh pr list --head "$CURRENT_BRANCH" --state open 2>&1 || echo "")

    if echo "$GH_ERROR_MSG" | grep -qi "rate limit\|API rate limit\|network\|timeout"; then
        # API 临时错误 → unknown（安全退出，不误判）
        echo "PHASE: unknown"
        echo "DESCRIPTION: gh API 临时错误"
        echo "ACTION: 直接退出（不误判阶段）"
        echo ""
        echo "错误信息: $GH_ERROR_MSG"
        echo ""
        echo "说明: API 波动，稍后重试"
        exit 0
    fi
fi

if [[ -z "$PR_NUMBER" ]]; then
    # 没有 PR → p0 (Published 阶段)
    echo "PHASE: p0"
    echo "DESCRIPTION: Published 阶段（发 PR 之前）"
    echo "ACTION: 质检循环 → 创建 PR → 结束"
    echo ""
    echo "执行流程:"
    echo "  1. 写代码 + 写测试"
    echo "  2. 调用 /audit（Decision: PASS）"
    echo "  3. 运行 npm run qa:gate（全部通过）"
    echo "  4. 创建 PR"
    echo "  5. 结束对话（不等待 CI）"
    exit 0
fi

# 有 PR，继续判断
echo "PR: #$PR_NUMBER"
echo ""

# ===== 问题 2: CI 有结果吗？=====
CI_STATUS=""

# 尝试获取 CI 状态，捕获错误
CI_STATUS=$(gh pr checks "$PR_NUMBER" --json state -q '.[].state' 2>/dev/null | head -1 || echo "")
GH_EXIT_CODE=$?

# 检查 gh 命令是否失败
if [[ $GH_EXIT_CODE -ne 0 ]] && [[ -z "$CI_STATUS" ]]; then
    # gh 命令失败，可能是 API 错误
    GH_ERROR_MSG=$(gh pr checks "$PR_NUMBER" 2>&1 || echo "")

    if echo "$GH_ERROR_MSG" | grep -qi "rate limit\|API rate limit\|network\|timeout"; then
        # API 临时错误 → unknown（安全退出）
        echo "PHASE: unknown"
        echo "DESCRIPTION: gh API 临时错误（CI 检查失败）"
        echo "ACTION: 直接退出（不误判阶段）"
        echo ""
        echo "错误信息: $GH_ERROR_MSG"
        echo ""
        echo "说明: API 波动，稍后重试"
        exit 0
    fi
fi

if [[ -z "$CI_STATUS" ]] || [[ "$CI_STATUS" == "PENDING" ]] || [[ "$CI_STATUS" == "QUEUED" ]]; then
    # pending/queued → 等待 CI 结果
    echo "PHASE: pending"
    echo "DESCRIPTION: 等待 CI 结果"
    echo "ACTION: 等待循环（挂着等 CI 出结果）"
    echo ""
    echo "CI 状态: $CI_STATUS"
    echo ""
    echo "说明:"
    echo "  - CI 正在运行中"
    echo "  - 应该挂着等待 CI 结果"
    echo "  - 进入等待循环直到 CI 有结果（fail/pass）"
    echo ""
    echo "执行流程:"
    echo "  1. 进入等待循环"
    echo "  2. 每 30 秒检查一次 CI 状态"
    echo "  3. pending → 继续等待"
    echo "  4. failure → 转入 p1 修复流程"
    echo "  5. success → 转入 p2 结束流程"
    exit 0
fi

# CI 有结果，继续判断

# ===== 问题 3: 结果是啥？=====
if echo "$CI_STATUS" | grep -qi "FAILURE\|ERROR"; then
    # fail → p1 (CI 阶段 - fail)
    echo "PHASE: p1"
    echo "DESCRIPTION: CI 阶段 - fail（修到绿）"
    echo "ACTION: 无限循环修到绿（拉失败 → 修 → push → 查 CI）"
    echo ""
    echo "CI 状态: $CI_STATUS"
    echo ""
    echo "执行流程:"
    echo "  1. 拉取 CI 失败信息"
    echo "     gh pr checks $PR_NUMBER --json name,conclusion,detailsUrl"
    echo ""
    echo "  2. 分析失败原因并修复"
    echo "     - typecheck 失败 → 修复类型错误"
    echo "     - test 失败 → 修复测试"
    echo "     - build 失败 → 修复构建"
    echo ""
    echo "  3. 修复 + push"
    echo "     git add . && git commit -m 'fix: CI 失败修复' && git push"
    echo ""
    echo "  4. 查询下一轮 CI"
    echo "     bash scripts/detect-phase.sh"
    echo ""
    echo "  5. 如果还是 fail → 回到步骤 2"
    echo "     如果 pass → 结束"
    exit 0
fi

if echo "$CI_STATUS" | grep -qi "SUCCESS\|PASS"; then
    # pass → p2 (CI 阶段 - pass)
    echo "PHASE: p2"
    echo "DESCRIPTION: CI 阶段 - pass（已完成）"
    echo "ACTION: Done（直接退出，GitHub 自动 merge）"
    echo ""
    echo "CI 状态: $CI_STATUS"
    echo ""
    echo "说明:"
    echo "  ✅ CI 全绿"
    echo "  ✅ GitHub Actions 将自动 merge（CI 绿 + 审核通过）"
    echo "  ✅ 无需 AI 介入"
    echo ""
    echo "直接退出 ✅"
    exit 0
fi

# 未知状态
echo "PHASE: unknown"
echo "DESCRIPTION: 未知状态"
echo "CI_STATUS: $CI_STATUS"
echo ""
echo "请检查 CI 状态："
echo "  gh pr checks $PR_NUMBER"
exit 1
