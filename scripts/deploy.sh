#!/usr/bin/env bash
# ============================================================================
# deploy.sh - 部署稳定版本到 ~/.claude/
# ============================================================================
#
# 用法: bash scripts/deploy.sh [--from-main]
#
# 默认：部署当前目录的文件
# --from-main：从 main 分支部署（推荐用于生产环境）
#
# 同步内容:
#   - hooks/    → ~/.claude/hooks/
#   - skills/   → ~/.claude/skills/
#
# 注意：这是手动操作，不会自动执行
# ============================================================================

set -euo pipefail

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_ROOT="$(dirname "$SCRIPT_DIR")"

# 目标目录
TARGET_DIR="$HOME/.claude"

# 检查参数
FROM_MAIN=false
if [[ "${1:-}" == "--from-main" ]]; then
    FROM_MAIN=true
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 部署 ZenithJoy Engine"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ========================================
# 如果指定 --from-main，先切换到 main
# ========================================
CURRENT_BRANCH=""
if [[ "$FROM_MAIN" == "true" ]]; then
    cd "$ENGINE_ROOT"
    CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

    echo -e "${BLUE}从 main 分支部署...${NC}"
    echo ""

    # 检查是否有未提交的改动
    if ! git diff --quiet 2>/dev/null; then
        echo -e "${RED}错误: 有未提交的改动，请先提交或 stash${NC}"
        exit 1
    fi

    # 切换到 main
    git fetch origin main 2>/dev/null || true
    git checkout main 2>/dev/null || {
        echo -e "${RED}错误: 无法切换到 main 分支${NC}"
        exit 1
    }
    git pull origin main 2>/dev/null || true

    echo "  当前: main 分支"
    echo "  版本: $(grep '"version"' package.json | head -1 | cut -d'"' -f4)"
    echo ""
fi

echo "  源目录: $ENGINE_ROOT"
echo "  目标:   $TARGET_DIR"
echo ""

# ========================================
# 1. 同步 hooks/
# ========================================
echo -e "${BLUE}1️⃣  同步 hooks/${NC}"

if [[ -d "$ENGINE_ROOT/hooks" ]]; then
    mkdir -p "$TARGET_DIR/hooks"

    for f in "$ENGINE_ROOT/hooks/"*.sh; do
        if [[ -f "$f" ]]; then
            filename=$(basename "$f")

            if [[ -f "$TARGET_DIR/hooks/$filename" ]]; then
                if diff -q "$f" "$TARGET_DIR/hooks/$filename" > /dev/null 2>&1; then
                    echo -e "   ${GREEN}✓${NC} $filename (无变化)"
                else
                    cp "$f" "$TARGET_DIR/hooks/$filename"
                    chmod +x "$TARGET_DIR/hooks/$filename"
                    echo -e "   ${YELLOW}↑${NC} $filename (已更新)"
                fi
            else
                cp "$f" "$TARGET_DIR/hooks/$filename"
                chmod +x "$TARGET_DIR/hooks/$filename"
                echo -e "   ${GREEN}+${NC} $filename (新增)"
            fi
        fi
    done
else
    echo "   ⚠️  hooks/ 目录不存在"
fi

echo ""

# ========================================
# 2. 同步 skills/
# ========================================
echo -e "${BLUE}2️⃣  同步 skills/${NC}"

if [[ -d "$ENGINE_ROOT/skills" ]]; then
    mkdir -p "$TARGET_DIR/skills"

    for skill_dir in "$ENGINE_ROOT/skills/"*/; do
        if [[ -d "$skill_dir" ]]; then
            skill_name=$(basename "$skill_dir")
            target_skill="$TARGET_DIR/skills/$skill_name"

            if command -v rsync &> /dev/null; then
                rsync -a --delete "$skill_dir" "$target_skill/" 2>/dev/null
                echo -e "   ${GREEN}✓${NC} $skill_name/"
            else
                rm -rf "$target_skill"
                cp -r "$skill_dir" "$target_skill"
                echo -e "   ${GREEN}✓${NC} $skill_name/ (cp)"
            fi
        fi
    done
else
    echo "   ⚠️  skills/ 目录不存在"
fi

echo ""

# ========================================
# 3. 验证
# ========================================
echo -e "${BLUE}3️⃣  验证部署${NC}"

HOOKS_COUNT=$(ls -1 "$TARGET_DIR/hooks/"*.sh 2>/dev/null | wc -l)
SKILLS_COUNT=$(ls -1d "$TARGET_DIR/skills/"*/ 2>/dev/null | wc -l)

echo "   Hooks:  $HOOKS_COUNT 个"
echo "   Skills: $SKILLS_COUNT 个"

# ========================================
# 4. 如果之前切换了分支，切回去
# ========================================
if [[ -n "$CURRENT_BRANCH" && "$CURRENT_BRANCH" != "main" ]]; then
    echo ""
    echo -e "${BLUE}4️⃣  切回原分支${NC}"
    git checkout "$CURRENT_BRANCH" 2>/dev/null
    echo "   已切回 $CURRENT_BRANCH"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✅ 部署完成${NC}"
if [[ "$FROM_MAIN" == "true" ]]; then
    echo -e "  ${GREEN}   (从 main 分支部署)${NC}"
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
