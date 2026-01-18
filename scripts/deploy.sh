#!/usr/bin/env bash
# ============================================================================
# deploy.sh - 部署 Engine 到 ~/.claude/
# ============================================================================
#
# 用法: bash scripts/deploy.sh
#
# 同步内容:
#   - hooks/    → ~/.claude/hooks/
#   - skills/   → ~/.claude/skills/
#
# ============================================================================

set -euo pipefail

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取脚本所在目录（即 scripts/）
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENGINE_ROOT="$(dirname "$SCRIPT_DIR")"

# 目标目录
TARGET_DIR="$HOME/.claude"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🚀 部署 ZenithJoy Engine"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
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

            # 比较是否有变化
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

    # 遍历每个 skill 目录
    for skill_dir in "$ENGINE_ROOT/skills/"*/; do
        if [[ -d "$skill_dir" ]]; then
            skill_name=$(basename "$skill_dir")
            target_skill="$TARGET_DIR/skills/$skill_name"

            # 使用 rsync 同步（保留目录结构）
            if command -v rsync &> /dev/null; then
                rsync -a --delete "$skill_dir" "$target_skill/" 2>/dev/null
                echo -e "   ${GREEN}✓${NC} $skill_name/"
            else
                # 没有 rsync，用 cp
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

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}✅ 部署完成${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
