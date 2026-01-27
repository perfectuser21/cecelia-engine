#!/usr/bin/env bash
# SessionStart Hook - 识别阶段并提示走 /dev

# 只在 zenithjoy-engine 项目检测
if [[ ! -f "scripts/detect-phase.sh" ]]; then
  exit 0
fi

# 检测当前阶段
PHASE=$(bash scripts/detect-phase.sh 2>/dev/null | grep "^PHASE:" | cut -d: -f2 | xargs)
PR_NUMBER=$(gh pr list --head "$(git branch --show-current)" --state open --json number -q '.[0].number' 2>/dev/null || echo "")

# 只在交互式会话中显示提示
if [[ -t 2 ]] || [[ -n "${CLAUDE_CODE:-}" ]]; then
  if [[ "$PHASE" == "p1" ]] || [[ "$PHASE" == "pending" ]]; then
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  📍 当前有 PR 待处理" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2
    echo "  PR: #${PR_NUMBER}" >&2
    echo "  阶段: ${PHASE}" >&2
    echo "" >&2
    echo "  💡 建议调用 /dev 处理 CI" >&2
    echo "     /dev 将持续运行直到 PR 合并" >&2
    echo "" >&2
  elif [[ "$PHASE" == "p2" ]]; then
    echo "" >&2
    echo "  ✅ PR #${PR_NUMBER} CI 已通过" >&2
    echo "     GitHub 将自动合并" >&2
    echo "" >&2
  elif [[ "$PHASE" == "p0" ]] || [[ -z "$PHASE" ]]; then
    echo "[SKILL_REQUIRED: dev]" >&2
    echo "请运行 /dev skill 开始开发流程。/dev 会自动检测状态并引导你。" >&2
  fi
fi

exit 0
