#!/bin/bash
# ZenithJoy Core - 分支保护 Hook v6.0 (全面保护版)
# 检查：1. 必须在 cp-* 分支 2. 必须有状态文件 3. 必须完成 PRD 确认
# 保护：代码文件 + 重要目录（skills/, hooks/, .github/）

set -e

# Read JSON input from stdin
INPUT=$(cat)

# Extract tool name
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // .operation // empty')

# Only check Write/Edit operations
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
    exit 0
fi

# Extract file path
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .file_path // empty')

if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# ===== 判断是否需要保护 =====
NEEDS_PROTECTION=false

# 1. 重要目录：skills/, hooks/, .github/ 下的所有文件都要保护
if [[ "$FILE_PATH" == *"/skills/"* ]] || \
   [[ "$FILE_PATH" == *"/hooks/"* ]] || \
   [[ "$FILE_PATH" == *"/.github/"* ]]; then
    NEEDS_PROTECTION=true
fi

# 2. 代码文件：根据扩展名判断
EXT="${FILE_PATH##*.}"
case "$EXT" in
    ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|hpp|rb|php|swift|kt)
        NEEDS_PROTECTION=true
        ;;
esac

# 不需要保护的文件直接放行
if [[ "$NEEDS_PROTECTION" == "false" ]]; then
    exit 0
fi

# ===== 以下是需要保护的文件，执行完整检查 =====

# Get current git branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# No git = allow
if [[ -z "$CURRENT_BRANCH" ]]; then
    exit 0
fi

# ===== 检查 1: 必须在 cp-* 分支 =====
if [[ ! "$CURRENT_BRANCH" =~ ^cp- ]]; then
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  ❌ 只能在 checkpoint 分支修改重要文件" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2
    echo "当前分支: $CURRENT_BRANCH" >&2
    echo "要修改的文件: $FILE_PATH" >&2
    echo "" >&2
    echo "正确流程:" >&2
    echo "  1. 运行 /dev 开始开发工作流" >&2
    echo "  2. 确认 PRD + DoD" >&2
    echo "  3. 在 cp-xxx 分支上开发" >&2
    echo "" >&2
    echo "[SKILL_REQUIRED: dev]" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi

# ===== 检查 2: 必须有状态文件 =====
STATE_FILE=~/.ai-factory/state/current-task.json

if [[ ! -f "$STATE_FILE" ]]; then
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  ❌ 缺少状态文件" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2
    echo "状态文件不存在: $STATE_FILE" >&2
    echo "" >&2
    echo "请先运行 /dev 开始开发工作流" >&2
    echo "" >&2
    echo "[SKILL_REQUIRED: dev]" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi

# ===== 检查 3: PRD 必须已确认 =====
PRD_CONFIRMED=$(jq -r '.checkpoints.prd_confirmed // false' "$STATE_FILE" 2>/dev/null)

if [[ "$PRD_CONFIRMED" != "true" ]]; then
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  ❌ PRD 未确认" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2
    echo "必须先完成 PRD 确认才能修改文件" >&2
    echo "" >&2
    echo "正确流程:" >&2
    echo "  1. /dev → 生成 PRD + DoD" >&2
    echo "  2. 用户确认 PRD" >&2
    echo "  3. 然后才能修改文件" >&2
    echo "" >&2
    echo "[SKILL_REQUIRED: dev]" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi

# ===== 检查 4: DoD 必须已定义 =====
DOD_DEFINED=$(jq -r '.checkpoints.dod_defined // false' "$STATE_FILE" 2>/dev/null)

if [[ "$DOD_DEFINED" != "true" ]]; then
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  ❌ DoD 未定义" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2
    echo "必须先定义 DoD (验收标准) 才能修改文件" >&2
    echo "" >&2
    echo "[SKILL_REQUIRED: dev]" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi

# All checks passed
exit 0
