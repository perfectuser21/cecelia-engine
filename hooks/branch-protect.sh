#!/usr/bin/env bash
# ZenithJoy Engine - 分支保护 Hook（版本见 package.json）
# v9: 简化版 - 只检查分支，删除步骤状态机
# 保护：代码文件 + 重要目录（skills/, hooks/, .github/）

set -euo pipefail

# 检查 jq 是否存在
if ! command -v jq &>/dev/null; then
  echo "⚠️ jq 未安装，分支保护 Hook 无法正常工作" >&2
  echo "   请安装: apt install jq 或 brew install jq" >&2
  exit 0
fi

# Read JSON input from stdin
INPUT=$(cat)

# Extract tool name（安全提取，避免 jq empty 问题）
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // .operation // ""' 2>/dev/null || echo "")

# Only check Write/Edit operations
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
    exit 0
fi

# Extract file path（安全提取）
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .file_path // ""' 2>/dev/null || echo "")

if [[ -z "$FILE_PATH" ]]; then
    exit 0
fi

# ===== 判断是否需要保护 =====
NEEDS_PROTECTION=false

# 1. 重要目录
if [[ "$FILE_PATH" == *"/skills/"* ]] || \
   [[ "$FILE_PATH" == *"/hooks/"* ]] || \
   [[ "$FILE_PATH" == *"/.github/"* ]]; then
    NEEDS_PROTECTION=true
fi

# 2. 代码文件
EXT="${FILE_PATH##*.}"
case "$EXT" in
    ts|tsx|js|jsx|py|go|rs|java|c|cpp|h|hpp|rb|php|swift|kt|sh)
        NEEDS_PROTECTION=true
        ;;
esac

if [[ "$NEEDS_PROTECTION" == "false" ]]; then
    exit 0
fi

# ===== 以下是需要保护的文件 =====

# 从文件路径找到所属的 git 仓库
FILE_DIR=$(dirname "$FILE_PATH")
if [[ ! -d "$FILE_DIR" ]]; then
    FILE_DIR=$(dirname "$FILE_DIR")
fi

# 切换到文件所在目录，获取该仓库的信息
if ! cd "$FILE_DIR" 2>/dev/null; then
    exit 0
fi

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ -z "$PROJECT_ROOT" ]]; then
    exit 0  # 不在 git 仓库中
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [[ -z "$CURRENT_BRANCH" ]]; then
    exit 0
fi

# ===== 分支检查（v9: 简化版，只检查分支名） =====

# feature/* 或 cp-* 分支直接放行
if [[ "$CURRENT_BRANCH" =~ ^feature/ ]] || [[ "$CURRENT_BRANCH" =~ ^cp-[a-zA-Z0-9] ]]; then
    exit 0
fi

# 禁止的分支（main, develop, 其他）
echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  ❌ 只能在 cp-* 或 feature/* 分支修改代码" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2
echo "当前分支: $CURRENT_BRANCH" >&2
echo "" >&2
echo "请先运行 /dev 创建 cp-* 分支" >&2
echo "" >&2
echo "[SKILL_REQUIRED: dev]" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
exit 2
