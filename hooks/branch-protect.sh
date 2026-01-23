#!/usr/bin/env bash
# ZenithJoy Engine - 分支保护 Hook
# v15: P0 安全修复 - jq 缺失阻止 / realpath 防 symlink / 正则增强
# v14: 验证 BASE_BRANCH 存在性，不存在则回退 develop
# v13: 修复硬编码 develop 分支，改用 git config 读取 base 分支
# v12: 增加全局配置目录保护（~/.claude/hooks/, ~/.claude/skills/）
# v11: 增加 PRD/DoD 内容有效性检查（不能是空文件）
# v10: 增加 PRD/DoD 检查 - 在 cp-*/feature/* 分支也必须有 PRD 和 DoD
# v9: 简化版 - 只检查分支，删除步骤状态机
# 保护：代码文件 + 重要目录（skills/, hooks/, .github/）+ 全局配置目录

set -euo pipefail

# P0-1 修复: jq 缺失必须阻止，否则完全绕过保护
if ! command -v jq &>/dev/null; then
  echo "" >&2
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  echo "  ❌ jq 未安装，分支保护无法工作" >&2
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
  echo "" >&2
  echo "请安装 jq:" >&2
  echo "  Ubuntu/Debian: sudo apt install jq" >&2
  echo "  macOS: brew install jq" >&2
  echo "" >&2
  exit 2
fi

# Read JSON input from stdin
INPUT=$(cat)

# CRITICAL 修复: JSON 预验证，防止格式错误或注入
if ! echo "$INPUT" | jq empty >/dev/null 2>&1; then
    echo "❌ 无效的 JSON 输入" >&2
    exit 2
fi

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

# ===== v12: 全局配置目录保护 =====
# 阻止直接修改 ~/.claude/hooks/ 和 ~/.claude/skills/
# 这些文件应该在 zenithjoy-engine 修改后部署
# CRITICAL 修复: 使用 realpath 解析 symlink，防止通过符号链接绕过
# 使用 -s 选项：不解析符号链接但规范化路径，或检查路径是否包含 ..
HOME_DIR="${HOME:-/home/$(whoami)}"
REAL_FILE_PATH="$FILE_PATH"
# 先检查路径是否包含危险模式
if [[ "$FILE_PATH" == *".."* ]]; then
    echo "❌ 路径包含 '..' 不允许" >&2
    exit 2
fi
if command -v realpath &>/dev/null; then
    # 使用 -s 不解析符号链接，只规范化路径
    REAL_FILE_PATH=$(realpath -s "$FILE_PATH" 2>/dev/null || echo "$FILE_PATH")
fi
if [[ "$REAL_FILE_PATH" == "$HOME_DIR/.claude/hooks/"* ]] || \
   [[ "$REAL_FILE_PATH" == "$HOME_DIR/.claude/skills/"* ]] || \
   [[ "$FILE_PATH" == "$HOME_DIR/.claude/hooks/"* ]] || \
   [[ "$FILE_PATH" == "$HOME_DIR/.claude/skills/"* ]]; then
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  ❌ 禁止直接修改全局配置目录" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "" >&2
    echo "文件: $FILE_PATH" >&2
    echo "" >&2
    echo "请在 zenithjoy-engine 修改后部署到全局：" >&2
    echo "  1. cd /home/xx/dev/zenithjoy-engine" >&2
    echo "  2. 走 /dev 工作流修改 hooks/ 或 skills/" >&2
    echo "  3. PR 合并到 main 后部署" >&2
    echo "" >&2
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
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
# P1 修复: cd 失败时 exit 2（非 exit 0），防止绕过保护
if ! cd "$FILE_DIR" 2>/dev/null; then
    echo "❌ 无法进入目录: $FILE_DIR" >&2
    exit 2
fi

PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
if [[ -z "$PROJECT_ROOT" ]]; then
    exit 0  # 不在 git 仓库中
fi

CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [[ -z "$CURRENT_BRANCH" ]]; then
    exit 0
fi

# ===== 分支检查（v10: 增加 PRD/DoD 检查） =====

# feature/* 或 cp-* 分支 - 需要检查 PRD/DoD
# P0-3 修复: 增强正则，要求完整的分支名格式
# cp-* 要求: cp- 后至少2个字符，只允许字母数字和连字符
# feature/* 要求: feature/ 后至少1个字符
if [[ "$CURRENT_BRANCH" =~ ^feature/[a-zA-Z0-9][-a-zA-Z0-9_/]* ]] || \
   [[ "$CURRENT_BRANCH" =~ ^cp-[a-zA-Z0-9][-a-zA-Z0-9_]+$ ]]; then

    # 检查 PRD 文件是否存在
    if [[ ! -f "$PROJECT_ROOT/.prd.md" ]]; then
        echo "" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "  ❌ 缺少 PRD 文件 (.prd.md)" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "" >&2
        echo "当前分支: $CURRENT_BRANCH" >&2
        echo "请先运行 /dev 创建 PRD" >&2
        echo "" >&2
        echo "[SKILL_REQUIRED: dev]" >&2
        exit 2
    fi

    # 检查 PRD 内容有效性（至少 3 行，且包含关键字段）
    PRD_LINES=$(wc -l < "$PROJECT_ROOT/.prd.md" 2>/dev/null || echo 0)
    PRD_LINES=${PRD_LINES//[^0-9]/}; [[ -z "$PRD_LINES" ]] && PRD_LINES=0
    PRD_HAS_CONTENT=$(grep -cE "(功能描述|成功标准|需求来源|描述|标准)" "$PROJECT_ROOT/.prd.md" 2>/dev/null || echo 0)
    PRD_HAS_CONTENT=${PRD_HAS_CONTENT//[^0-9]/}; [[ -z "$PRD_HAS_CONTENT" ]] && PRD_HAS_CONTENT=0

    if [[ "$PRD_LINES" -lt 3 || "$PRD_HAS_CONTENT" -eq 0 ]]; then
        echo "" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "  ❌ PRD 文件内容无效 (.prd.md)" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "" >&2
        echo "当前分支: $CURRENT_BRANCH" >&2
        echo "PRD 需要至少 3 行，且包含关键字段（功能描述/成功标准）" >&2
        echo "" >&2
        echo "[SKILL_REQUIRED: dev]" >&2
        exit 2
    fi

    # 检查 DoD 文件是否存在
    if [[ ! -f "$PROJECT_ROOT/.dod.md" ]]; then
        echo "" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "  ❌ 缺少 DoD 文件 (.dod.md)" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "" >&2
        echo "当前分支: $CURRENT_BRANCH" >&2
        echo "请先运行 /dev 创建 DoD" >&2
        echo "" >&2
        echo "[SKILL_REQUIRED: dev]" >&2
        exit 2
    fi

    # 检查 DoD 内容有效性（至少 3 行，且包含验收标准或 checkbox）
    DOD_LINES=$(wc -l < "$PROJECT_ROOT/.dod.md" 2>/dev/null || echo 0)
    DOD_LINES=${DOD_LINES//[^0-9]/}; [[ -z "$DOD_LINES" ]] && DOD_LINES=0
    DOD_HAS_CHECKBOX=$(grep -cE "^\s*-\s*\[[ x]\]" "$PROJECT_ROOT/.dod.md" 2>/dev/null || echo 0)
    DOD_HAS_CHECKBOX=${DOD_HAS_CHECKBOX//[^0-9]/}; [[ -z "$DOD_HAS_CHECKBOX" ]] && DOD_HAS_CHECKBOX=0

    if [[ "$DOD_LINES" -lt 3 || "$DOD_HAS_CHECKBOX" -eq 0 ]]; then
        echo "" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "  ❌ DoD 文件内容无效 (.dod.md)" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "" >&2
        echo "当前分支: $CURRENT_BRANCH" >&2
        echo "DoD 需要至少 3 行，且包含验收清单 (- [ ] 格式)" >&2
        echo "" >&2
        echo "[SKILL_REQUIRED: dev]" >&2
        exit 2
    fi

    # 检查 PRD 是否为当前分支更新的（防止复用旧的）
    # 方法：检查 .prd.md 是否在当前分支的提交历史中，或者在暂存区/工作区有修改，或者是新文件
    # v13: 使用配置的 base 分支而非硬编码 develop
    BASE_BRANCH=$(git config "branch.$CURRENT_BRANCH.base-branch" 2>/dev/null || echo "develop")
    # v14: 验证 BASE_BRANCH 存在，否则回退到 develop
    if ! git rev-parse "$BASE_BRANCH" >/dev/null 2>&1; then
        BASE_BRANCH="develop"
    fi
    PRD_IN_BRANCH=$(git log "$BASE_BRANCH"..HEAD --name-only 2>/dev/null | grep -c "^\.prd\.md$" || echo 0)
    PRD_STAGED=$(git diff --cached --name-only 2>/dev/null | grep -c "^\.prd\.md$" || echo 0)
    PRD_MODIFIED=$(git diff --name-only 2>/dev/null | grep -c "^\.prd\.md$" || echo 0)
    PRD_UNTRACKED=$(git status --porcelain 2>/dev/null | grep -c "^?? \.prd\.md$" || echo 0)

    # 清理数值
    PRD_IN_BRANCH=${PRD_IN_BRANCH//[^0-9]/}; [[ -z "$PRD_IN_BRANCH" ]] && PRD_IN_BRANCH=0
    PRD_STAGED=${PRD_STAGED//[^0-9]/}; [[ -z "$PRD_STAGED" ]] && PRD_STAGED=0
    PRD_MODIFIED=${PRD_MODIFIED//[^0-9]/}; [[ -z "$PRD_MODIFIED" ]] && PRD_MODIFIED=0
    PRD_UNTRACKED=${PRD_UNTRACKED//[^0-9]/}; [[ -z "$PRD_UNTRACKED" ]] && PRD_UNTRACKED=0

    if [[ "$PRD_IN_BRANCH" -eq 0 && "$PRD_STAGED" -eq 0 && "$PRD_MODIFIED" -eq 0 && "$PRD_UNTRACKED" -eq 0 ]]; then
        echo "" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "  ❌ PRD 文件未更新 (.prd.md)" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "" >&2
        echo "当前分支: $CURRENT_BRANCH" >&2
        echo "当前 .prd.md 是旧任务的，请为本次任务更新 PRD" >&2
        echo "" >&2
        echo "[SKILL_REQUIRED: dev]" >&2
        exit 2
    fi

    # 检查 DoD 是否为当前分支更新的
    # v13: 使用配置的 base 分支（BASE_BRANCH 已在上面定义）
    DOD_IN_BRANCH=$(git log "$BASE_BRANCH"..HEAD --name-only 2>/dev/null | grep -c "^\.dod\.md$" || echo 0)
    DOD_STAGED=$(git diff --cached --name-only 2>/dev/null | grep -c "^\.dod\.md$" || echo 0)
    DOD_MODIFIED=$(git diff --name-only 2>/dev/null | grep -c "^\.dod\.md$" || echo 0)
    DOD_UNTRACKED=$(git status --porcelain 2>/dev/null | grep -c "^?? \.dod\.md$" || echo 0)

    # 清理数值
    DOD_IN_BRANCH=${DOD_IN_BRANCH//[^0-9]/}; [[ -z "$DOD_IN_BRANCH" ]] && DOD_IN_BRANCH=0
    DOD_STAGED=${DOD_STAGED//[^0-9]/}; [[ -z "$DOD_STAGED" ]] && DOD_STAGED=0
    DOD_MODIFIED=${DOD_MODIFIED//[^0-9]/}; [[ -z "$DOD_MODIFIED" ]] && DOD_MODIFIED=0
    DOD_UNTRACKED=${DOD_UNTRACKED//[^0-9]/}; [[ -z "$DOD_UNTRACKED" ]] && DOD_UNTRACKED=0

    if [[ "$DOD_IN_BRANCH" -eq 0 && "$DOD_STAGED" -eq 0 && "$DOD_MODIFIED" -eq 0 && "$DOD_UNTRACKED" -eq 0 ]]; then
        echo "" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "  ❌ DoD 文件未更新 (.dod.md)" >&2
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
        echo "" >&2
        echo "当前分支: $CURRENT_BRANCH" >&2
        echo "当前 .dod.md 是旧任务的，请为本次任务更新 DoD" >&2
        echo "" >&2
        echo "[SKILL_REQUIRED: dev]" >&2
        exit 2
    fi

    # PRD 和 DoD 都存在且已更新，放行
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
