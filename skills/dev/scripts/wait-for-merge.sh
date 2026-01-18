#!/usr/bin/env bash
# ZenithJoy Engine - PR 合并等待脚本
# 持续轮询 PR 状态，直到合并或发现需要修复的问题
#
# 用法: bash skills/dev/scripts/wait-for-merge.sh <PR_URL>
# 例如: bash skills/dev/scripts/wait-for-merge.sh https://github.com/user/repo/pull/123
#
# 退出码:
#   0 = PR 已合并
#   1 = 需要修复（CI 失败或 Codex 有问题）
#   2 = 超时

set -euo pipefail

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 参数
PR_URL="${1:-}"

if [[ -z "$PR_URL" ]]; then
    echo -e "${RED}错误: 请提供 PR URL${NC}"
    echo "用法: bash wait-for-merge.sh <PR_URL>"
    exit 2
fi

# 从 URL 提取 PR 号和仓库
PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
REPO=$(echo "$PR_URL" | sed -E 's|https://github.com/([^/]+/[^/]+)/.*|\1|')

if [[ -z "$PR_NUMBER" ]] || [[ -z "$REPO" ]]; then
    echo -e "${RED}错误: 无法解析 PR URL${NC}"
    exit 2
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⏳ 等待 PR 合并"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  PR: #$PR_NUMBER"
echo "  仓库: $REPO"
echo ""

# 配置
MAX_WAIT=600  # 10 分钟
INTERVAL=30   # 30 秒轮询一次
WAITED=0

# 上次检查的 Codex 评论 ID（避免重复报告）
LAST_CODEX_COMMENT_ID=""

while [ $WAITED -lt $MAX_WAIT ]; do
    # ========================================
    # 1. 检查 PR 状态
    # ========================================
    STATE=$(gh pr view "$PR_URL" --json state -q '.state' 2>/dev/null || echo "UNKNOWN")

    if [ "$STATE" = "MERGED" ]; then
        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}  ✅ PR 已合并！(${WAITED}s)${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 0
    fi

    if [ "$STATE" = "CLOSED" ]; then
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  ❌ PR 被关闭（未合并）${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        exit 1
    fi

    # ========================================
    # 2. 检查 CI 状态
    # ========================================
    # 尝试获取 CI 状态（可能因权限失败）
    CI_CONCLUSION=$(gh api "repos/$REPO/commits/$(gh pr view $PR_URL --json headRefOid -q '.headRefOid')/check-runs" \
        --jq '.check_runs | map(select(.conclusion != null)) | .[0].conclusion // "pending"' 2>/dev/null || echo "unknown")

    if [ "$CI_CONCLUSION" = "failure" ]; then
        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}  ❌ CI 失败，需要修复${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo ""
        echo "CI 错误日志:"
        gh run list --repo "$REPO" --limit 1 --json databaseId,conclusion -q '.[0].databaseId' | xargs -I {} gh run view {} --repo "$REPO" --log-failed 2>/dev/null | tail -50 || echo "(无法获取日志)"
        echo ""

        # 回退到 step 3
        CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
        if [[ "$CURRENT_BRANCH" =~ ^cp-[a-zA-Z0-9] ]]; then
            git config branch."$CURRENT_BRANCH".step 3
            echo -e "${YELLOW}  ⟲ 已回退到 step 3${NC}"
            echo ""
            echo -e "${YELLOW}  循环: 修代码(4) → 改测试(5) → 跑测试(6) → 再提PR(7)${NC}"
        fi

        exit 1
    fi

    # ========================================
    # 3. 检查 Codex 评论
    # ========================================
    CODEX_COMMENT=$(gh api "repos/$REPO/issues/$PR_NUMBER/comments" \
        --jq 'map(select(.user.login == "chatgpt-codex-connector[bot]")) | .[-1] // empty' 2>/dev/null || echo "")

    if [[ -n "$CODEX_COMMENT" ]]; then
        CODEX_COMMENT_ID=$(echo "$CODEX_COMMENT" | jq -r '.id // empty')
        CODEX_BODY=$(echo "$CODEX_COMMENT" | jq -r '.body // empty')

        # 检查是否是新评论且有问题
        if [[ "$CODEX_COMMENT_ID" != "$LAST_CODEX_COMMENT_ID" ]]; then
            LAST_CODEX_COMMENT_ID="$CODEX_COMMENT_ID"

            # 检查是否有问题（不是 "no issues" 或 "LGTM"）
            if [[ "$CODEX_BODY" != *"Didn't find any major issues"* ]] && \
               [[ "$CODEX_BODY" != *"no issues"* ]] && \
               [[ "$CODEX_BODY" != *"LGTM"* ]] && \
               [[ "$CODEX_BODY" == *"issue"* || "$CODEX_BODY" == *"problem"* || "$CODEX_BODY" == *"bug"* || "$CODEX_BODY" == *"error"* ]]; then
                echo ""
                echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                echo -e "${YELLOW}  ⚠️ Codex 发现问题${NC}"
                echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
                echo ""
                echo "Codex 评论:"
                echo "$CODEX_BODY" | head -30
                echo ""

                # 回退到 step 3
                CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
                if [[ "$CURRENT_BRANCH" =~ ^cp-[a-zA-Z0-9] ]]; then
                    git config branch."$CURRENT_BRANCH".step 3
                    echo -e "${YELLOW}  ⟲ 已回退到 step 3${NC}"
                    echo ""
                    echo -e "${YELLOW}  循环: 修代码(4) → 改测试(5) → 跑测试(6) → 再提PR(7)${NC}"
                fi

                exit 1
            fi
        fi
    fi

    # ========================================
    # 4. 显示状态
    # ========================================
    CI_DISPLAY="${CI_CONCLUSION:-pending}"
    echo -e "${BLUE}⏳ 等待中... STATE=$STATE CI=$CI_DISPLAY (${WAITED}s)${NC}"

    # ========================================
    # 5. 等待
    # ========================================
    sleep $INTERVAL
    WAITED=$((WAITED + INTERVAL))
done

# ========================================
# 超时
# ========================================
echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  ⏰ 等待超时（${MAX_WAIT}s）${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "PR 状态: $STATE"
echo "请手动检查: $PR_URL"
echo ""
exit 2
