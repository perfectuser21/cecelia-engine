#!/usr/bin/env bash
# ZenithJoy Engine - 分支保护 Hook（版本见 package.json）
# 检查：必须在 cp-* 分支
# 保护：代码文件 + 重要目录（skills/, hooks/, .github/）
# 不需要状态文件 — 纯 git 检测

set -euo pipefail

# 检查 jq 是否存在
if ! command -v jq &>/dev/null; then
  echo "⚠️ jq 未安装，分支保护 Hook 无法正常工作" >&2
  echo "   请安装: apt install jq 或 brew install jq" >&2
  exit 0  # 不阻止操作，但警告用户
fi

# Read JSON input from stdin
INPUT=$(cat)

# Extract tool name (with error handling for malformed JSON)
if ! TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // .operation // empty' 2>/dev/null); then
    echo "⚠️ branch-protect: 无法解析输入 JSON" >&2
    exit 0  # 无法解析时放行，避免误阻
fi

# Only check Write/Edit operations
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
    exit 0
fi

# Extract file path (with error handling)
if ! FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .file_path // empty' 2>/dev/null); then
    exit 0
fi

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
    ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|hpp|rb|php|swift|kt|sh)
        NEEDS_PROTECTION=true
        ;;
esac

# 不需要保护的文件直接放行
if [[ "$NEEDS_PROTECTION" == "false" ]]; then
    exit 0
fi

# ===== 以下是需要保护的文件，执行检查 =====

# Get current git branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# No git = allow
if [[ -z "$CURRENT_BRANCH" ]]; then
    exit 0
fi

# 验证文件是否属于当前 git 仓库（防止多项目环境误保护）
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ -n "$PROJECT_ROOT" && "$FILE_PATH" != "$PROJECT_ROOT"* ]]; then
    # 文件不在当前 git 仓库中，不需要保护
    exit 0
fi

# ===== 检查: 必须在 cp-* 或 feature/* 分支 =====
# 允许: cp-xxx, feature/xxx
# 禁止: main, develop, 其他

# feature/* 分支直接放行（不需要 PRD）
if [[ "$CURRENT_BRANCH" =~ ^feature/ ]]; then
    exit 0
fi

# cp-* 分支需要额外检查 PRD 是否已确认
if [[ "$CURRENT_BRANCH" =~ ^cp-[a-zA-Z0-9] ]]; then
    PRD_CONFIRMED=$(git config --get branch."$CURRENT_BRANCH".prd-confirmed 2>/dev/null || echo "")
    if [[ "$PRD_CONFIRMED" != "true" ]]; then
        echo "" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "  ❌ PRD 未确认，请先运行 /dev 完成流程" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "" >&2
        echo "当前分支: $CURRENT_BRANCH" >&2
        echo "要修改的文件: $FILE_PATH" >&2
        echo "" >&2
        echo "正确流程:" >&2
        echo "  1. 运行 /dev 开始开发工作流" >&2
        echo "  2. 确认 PRD 后才能写代码" >&2
        echo "" >&2
        echo "[SKILL_REQUIRED: dev]" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        exit 2
    fi
    # PRD 已确认，放行
    exit 0
fi

# 禁止的分支
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  ❌ 只能在 cp-* 或 feature/* 分支修改代码" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
echo "当前分支: $CURRENT_BRANCH" >&2
echo "要修改的文件: $FILE_PATH" >&2
echo "" >&2
echo "正确流程:" >&2
echo "  1. 运行 /dev 开始开发工作流" >&2
echo "  2. 在 cp-* 或 feature/* 分支上开发" >&2
echo "" >&2
echo "[SKILL_REQUIRED: dev]" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
exit 2
