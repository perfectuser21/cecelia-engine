#!/usr/bin/env bash
# PreToolUse[Bash] hook: 校验 gate 令牌，阻止无令牌调用 generate-gate-file.sh
# 同时阻止通过 Bash 伪造令牌（写 .gate_tokens/ 目录）

set -euo pipefail

# 只处理 Bash tool
TOOL_NAME="${TOOL_NAME:-}"
if [[ "$TOOL_NAME" != "Bash" ]]; then
    exit 0
fi

# 从 stdin 读取 tool_input
TOOL_INPUT=$(cat)
COMMAND=$(printf '%s' "$TOOL_INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

if [[ -z "$COMMAND" ]]; then
    exit 0
fi

TOKEN_DIR=".git/.gate_tokens"

# 检查 1: 阻止通过 Bash 写 .gate_tokens/ 目录（防伪造）
if echo "$COMMAND" | grep -qE '\.gate_tokens' && \
   echo "$COMMAND" | grep -qE '(echo|cat|cp|mv|tee|printf|>>|>|write|touch|rm|dd|install|python|perl|ruby|node|base64|mkdir)'; then
    echo "❌ 禁止通过 Bash 直接操作 .gate_tokens/ 目录（令牌只能由 PostToolUse hook 生成）" >&2
    exit 2
fi

# 检查 2: 拦截 generate-gate-file.sh 调用
if ! echo "$COMMAND" | grep -qE 'generate-gate-file\.sh'; then
    exit 0
fi

# 提取 gate 类型（generate-gate-file.sh 的第一个参数）
GATE_TYPE=$(echo "$COMMAND" | grep -oE 'generate-gate-file\.sh\s+(prd|dod|test|audit|qa|learning)' | awk '{print $2}' || true)
if [[ -z "$GATE_TYPE" ]]; then
    echo "❌ generate-gate-file.sh 缺少 gate 类型参数" >&2
    exit 2
fi

# 获取 session_id
SESSION_ID=""
if [[ -n "${CLAUDE_SESSION_ID:-}" ]]; then
    SESSION_ID="$CLAUDE_SESSION_ID"
elif [[ -f ".dev-mode" ]]; then
    SESSION_ID=$(grep '^session_id:' .dev-mode 2>/dev/null | cut -d' ' -f2 || echo "")
fi
if [[ -z "$SESSION_ID" ]]; then
    SESSION_ID="default"
fi

# 校验令牌存在
TOKEN_FILE="$TOKEN_DIR/subagent-${GATE_TYPE}-${SESSION_ID}.token"
if [[ ! -f "$TOKEN_FILE" ]]; then
    echo "❌ Gate 令牌不存在: $TOKEN_FILE" >&2
    echo "   必须先通过 gate:${GATE_TYPE} subagent 审核（Decision: PASS）才能生成 gate 文件" >&2
    exit 2
fi

# 验证令牌内容
TOKEN_GATE=$(grep '^gate:' "$TOKEN_FILE" 2>/dev/null | cut -d' ' -f2 || echo "")
if [[ "$TOKEN_GATE" != "$GATE_TYPE" ]]; then
    echo "❌ Gate 令牌类型不匹配: 期望 $GATE_TYPE, 实际 $TOKEN_GATE" >&2
    exit 2
fi

# 一次性消费：删除令牌（使用 /bin/rm 避免自定义 rm wrapper 阻止删除 .git/ 内文件）
/bin/rm -f "$TOKEN_FILE"
echo "✅ Gate 令牌已验证并消费: $GATE_TYPE (session: $SESSION_ID)" >&2
exit 0
