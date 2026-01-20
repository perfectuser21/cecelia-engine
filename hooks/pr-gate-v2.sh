#!/usr/bin/env bash
# ============================================================================
# PreToolUse Hook: PR Gate v2（证据链质检门）
# ============================================================================
#
# 触发：拦截 gh pr create
# 作用：提交 PR 前质检，支持双模式
#
# 双模式设计：
#   --mode=pr (默认)：
#     - 只检查 L1 自动化测试
#     - .dod.md 存在即可（允许未全勾）
#     - 适用于日常 PR → develop
#
#   --mode=release：
#     - 完整检查 L1 + L2 + L3
#     - 要求证据链完整
#     - 适用于 develop → main 发版
#
# 使用方式：
#   PR_GATE_MODE=pr gh pr create ...     # 默认，轻量检查
#   PR_GATE_MODE=release gh pr create ... # 发版，完整检查
#
# ============================================================================

set -euo pipefail

# ===== 模式解析 =====
MODE="${PR_GATE_MODE:-pr}"
if [[ "$MODE" != "pr" && "$MODE" != "release" ]]; then
    echo "⚠️ 未知模式: $MODE，使用默认模式 pr" >&2
    MODE="pr"
fi

INPUT=$(cat)

# 安全提取 tool_name
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""' 2>/dev/null || echo "")

# 只处理 Bash 工具
if [[ "$TOOL_NAME" != "Bash" ]]; then
    exit 0
fi

# 安全提取 command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // ""' 2>/dev/null || echo "")

# 只拦截 gh pr create
if [[ "$COMMAND" != *"gh pr create"* ]]; then
    exit 0
fi

# 获取项目根目录
PROJECT_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)

cd "$PROJECT_ROOT"

echo "" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
if [[ "$MODE" == "release" ]]; then
    echo "  PR GATE v2: 发版检查 (L1+L2+L3)" >&2
else
    echo "  PR GATE v2: 快速检查 (L1 only)" >&2
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "" >&2

FAILED=0
CHECKED=0
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")

# ============================================================================
# Part 0: 基础检查
# ============================================================================
echo "  [基础检查]" >&2

# 检查分支（必须是 cp-* 或 feature/*）
echo -n "  分支... " >&2
CHECKED=$((CHECKED + 1))
if [[ "${CURRENT_BRANCH:-}" =~ ^(cp-[a-zA-Z0-9]|feature/) ]]; then
    echo "✅ ($CURRENT_BRANCH)" >&2
else
    echo "❌ ($CURRENT_BRANCH)" >&2
    echo "    → 必须在 cp-* 或 feature/* 分支提交 PR" >&2
    FAILED=1
fi

# ============================================================================
# Part 1: Layer 1 - 自动化测试（Hook 自己跑，不信任 Agent）
# ============================================================================
echo "" >&2
echo "  [Layer 1: 自动化测试]" >&2

# 检测项目类型
HAS_PACKAGE_JSON=false
HAS_PYTHON=false
HAS_GO=false

[[ -f "$PROJECT_ROOT/package.json" ]] && HAS_PACKAGE_JSON=true
[[ -f "$PROJECT_ROOT/requirements.txt" || -f "$PROJECT_ROOT/pyproject.toml" ]] && HAS_PYTHON=true
[[ -f "$PROJECT_ROOT/go.mod" ]] && HAS_GO=true

# Node.js 项目
if [[ "$HAS_PACKAGE_JSON" == "true" ]]; then
    # Typecheck
    if grep -q '"typecheck"' package.json 2>/dev/null; then
        echo -n "  typecheck... " >&2
        CHECKED=$((CHECKED + 1))
        if npm run typecheck >/dev/null 2>&1; then
            echo "✅" >&2
        else
            echo "❌" >&2
            FAILED=1
        fi
    fi

    # Lint
    if grep -q '"lint"' package.json 2>/dev/null; then
        echo -n "  lint... " >&2
        CHECKED=$((CHECKED + 1))
        if npm run lint >/dev/null 2>&1; then
            echo "✅" >&2
        else
            echo "❌" >&2
            FAILED=1
        fi
    fi

    # Test
    if grep -q '"test"' package.json 2>/dev/null; then
        echo -n "  test... " >&2
        CHECKED=$((CHECKED + 1))
        if npm test >/dev/null 2>&1; then
            echo "✅" >&2
        else
            echo "❌" >&2
            FAILED=1
        fi
    fi

    # Build
    if grep -q '"build"' package.json 2>/dev/null; then
        echo -n "  build... " >&2
        CHECKED=$((CHECKED + 1))
        if npm run build >/dev/null 2>&1; then
            echo "✅" >&2
        else
            echo "❌" >&2
            FAILED=1
        fi
    fi
fi

# Python 项目
if [[ "$HAS_PYTHON" == "true" ]]; then
    if [[ -d "$PROJECT_ROOT/tests" || -d "$PROJECT_ROOT/test" || -f "$PROJECT_ROOT/pytest.ini" ]]; then
        echo -n "  pytest... " >&2
        CHECKED=$((CHECKED + 1))
        if pytest -q >/dev/null 2>&1; then
            echo "✅" >&2
        else
            echo "❌" >&2
            FAILED=1
        fi
    fi
fi

# Go 项目
if [[ "$HAS_GO" == "true" ]]; then
    echo -n "  go test... " >&2
    CHECKED=$((CHECKED + 1))
    if go test ./... >/dev/null 2>&1; then
        echo "✅" >&2
    else
        echo "❌" >&2
        FAILED=1
    fi
fi

# Shell 脚本语法检查
SHELL_FAILED=0
SHELL_COUNT=0
SHELL_ERRORS=""
while IFS= read -r -d '' f; do
    SHELL_COUNT=$((SHELL_COUNT + 1))
    ERROR_OUTPUT=$(bash -n "$f" 2>&1) || {
        SHELL_FAILED=1
        SHELL_ERRORS+="    $f: $ERROR_OUTPUT"$'\n'
    }
done < <(find "$PROJECT_ROOT" -name "*.sh" -type f -not -path "*/node_modules/*" -print0 2>/dev/null)

if [[ $SHELL_COUNT -gt 0 ]]; then
    echo -n "  shell syntax... " >&2
    CHECKED=$((CHECKED + 1))
    if [[ $SHELL_FAILED -eq 0 ]]; then
        echo "✅" >&2
    else
        echo "❌" >&2
        if [[ -n "$SHELL_ERRORS" ]]; then
            echo "$SHELL_ERRORS" >&2
        fi
        FAILED=1
    fi
fi

# ============================================================================
# Part 2: Layer 2 - 效果验证（检查证据文件）
# ============================================================================

# pr 模式跳过 L2
if [[ "$MODE" == "pr" ]]; then
    echo "" >&2
    echo "  [Layer 2: 效果验证] ⏭️  跳过 (pr 模式)" >&2
else
    echo "" >&2
    echo "  [Layer 2: 效果验证]" >&2

L2_EVIDENCE_FILE="$PROJECT_ROOT/.layer2-evidence.md"

# 检查 .layer2-evidence.md 是否存在
echo -n "  证据文件... " >&2
CHECKED=$((CHECKED + 1))
if [[ -f "$L2_EVIDENCE_FILE" ]]; then
    echo "✅" >&2
else
    echo "❌ (.layer2-evidence.md 不存在)" >&2
    echo "    → 请创建 .layer2-evidence.md 记录截图和 curl 验证" >&2
    FAILED=1
fi

# 如果证据文件存在，检查内容
if [[ -f "$L2_EVIDENCE_FILE" ]]; then
    # 提取所有截图 ID（S1, S2, ...）和对应文件路径
    # 格式：### S1: 描述 ... 文件: `./artifacts/screenshots/S1-xxx.png`
    SCREENSHOT_IDS=$(grep -oP '###\s+S\d+' "$L2_EVIDENCE_FILE" 2>/dev/null | grep -oP 'S\d+' || echo "")

    if [[ -n "$SCREENSHOT_IDS" ]]; then
        SCREENSHOT_MISSING=0
        for SID in $SCREENSHOT_IDS; do
            # 查找对应的文件路径
            FILE_PATH=$(grep -A5 "### $SID:" "$L2_EVIDENCE_FILE" 2>/dev/null | grep -oP '文件:\s*`\K[^`]+' || echo "")

            if [[ -n "$FILE_PATH" ]]; then
                # 转换相对路径为绝对路径
                if [[ "$FILE_PATH" == ./* ]]; then
                    FULL_PATH="$PROJECT_ROOT/${FILE_PATH#./}"
                else
                    FULL_PATH="$PROJECT_ROOT/$FILE_PATH"
                fi

                echo -n "  截图 $SID... " >&2
                CHECKED=$((CHECKED + 1))
                if [[ -f "$FULL_PATH" ]]; then
                    echo "✅" >&2
                else
                    echo "❌ (文件不存在: $FILE_PATH)" >&2
                    SCREENSHOT_MISSING=1
                    FAILED=1
                fi
            fi
        done
    fi

    # 检查 curl 证据（必须包含 HTTP_STATUS）
    CURL_IDS=$(grep -oP '###\s+C\d+' "$L2_EVIDENCE_FILE" 2>/dev/null | grep -oP 'C\d+' || echo "")

    if [[ -n "$CURL_IDS" ]]; then
        for CID in $CURL_IDS; do
            # 检查该 curl 块是否包含 HTTP_STATUS
            # 查找 ### C1: 到下一个 ### 或文件结尾之间的内容
            CURL_BLOCK=$(sed -n "/### $CID:/,/^###/p" "$L2_EVIDENCE_FILE" 2>/dev/null | head -n -1)

            echo -n "  curl $CID... " >&2
            CHECKED=$((CHECKED + 1))
            # 匹配 "HTTP_STATUS: 数字" 格式，避免匹配标题中的单词
            if echo "$CURL_BLOCK" | grep -qE "HTTP_STATUS:\s*[0-9]+" 2>/dev/null; then
                echo "✅" >&2
            else
                echo "❌ (缺少 HTTP_STATUS: xxx)" >&2
                echo "    → curl 输出必须包含 HTTP_STATUS: 200 格式" >&2
                FAILED=1
            fi
        done
    fi

    # 如果没有任何截图和 curl 证据
    if [[ -z "$SCREENSHOT_IDS" && -z "$CURL_IDS" ]]; then
        echo "  ⚠️  证据文件为空（没有 S* 或 C* 条目）" >&2
        echo "    → 请添加截图或 curl 验证证据" >&2
        FAILED=1
    fi
fi
fi  # 结束 MODE == release 条件

# ============================================================================
# Part 3: Layer 3 - 需求验收（检查 DoD）
# ============================================================================

# pr 模式只检查 .dod.md 存在，不要求全勾
if [[ "$MODE" == "pr" ]]; then
    echo "" >&2
    echo "  [Layer 3: 需求验收] (简化)" >&2

    DOD_FILE="$PROJECT_ROOT/.dod.md"
    echo -n "  DoD 文件... " >&2
    CHECKED=$((CHECKED + 1))
    if [[ -f "$DOD_FILE" ]]; then
        echo "✅ (存在即可)" >&2
    else
        echo "❌ (.dod.md 不存在)" >&2
        echo "    → 请创建 .dod.md 记录 DoD 清单" >&2
        FAILED=1
    fi
else
    echo "" >&2
    echo "  [Layer 3: 需求验收]" >&2

DOD_FILE="$PROJECT_ROOT/.dod.md"

# 检查 .dod.md 是否存在
echo -n "  DoD 文件... " >&2
CHECKED=$((CHECKED + 1))
if [[ -f "$DOD_FILE" ]]; then
    echo "✅" >&2
else
    echo "❌ (.dod.md 不存在)" >&2
    echo "    → 请创建 .dod.md 记录 DoD 清单" >&2
    FAILED=1
fi

# 如果 DoD 文件存在，检查内容
if [[ -f "$DOD_FILE" ]]; then
    # 检查是否所有 checkbox 都打勾
    # 注意：grep -c 无匹配时输出 0 但退出码是 1，不能用 || echo "0"
    UNCHECKED=$(grep -c '\- \[ \]' "$DOD_FILE" 2>/dev/null) || true
    CHECKED_BOXES=$(grep -c '\- \[x\]' "$DOD_FILE" 2>/dev/null) || true

    echo -n "  验收项... " >&2
    CHECKED=$((CHECKED + 1))
    if [[ "$UNCHECKED" -eq 0 && "$CHECKED_BOXES" -gt 0 ]]; then
        echo "✅ ($CHECKED_BOXES 项全部完成)" >&2
    elif [[ "$CHECKED_BOXES" -eq 0 ]]; then
        echo "❌ (没有验收项)" >&2
        echo "    → 请在 .dod.md 添加 - [x] 验收项" >&2
        FAILED=1
    else
        echo "❌ ($UNCHECKED 项未完成)" >&2
        echo "    → 请完成所有验收项后再提交 PR" >&2
        FAILED=1
    fi

    # 检查每个验收项是否有 Evidence 引用
    # 格式：Evidence: `S1` 或 Evidence: `C1`
    echo -n "  Evidence 引用... " >&2
    CHECKED=$((CHECKED + 1))

    # 获取所有验收项（- [x] 行）
    MISSING_EVIDENCE=0
    INVALID_EVIDENCE=0

    while IFS= read -r line; do
        # 检查这一项是否有 Evidence 引用（可能在同一行或下一行）
        # 简化检查：只要 DoD 文件中存在 Evidence 引用就行
        :
    done < <(grep '\- \[x\]' "$DOD_FILE" 2>/dev/null)

    # 提取所有 Evidence 引用
    EVIDENCE_REFS=$(grep -oP 'Evidence:\s*`\K[^`]+' "$DOD_FILE" 2>/dev/null || echo "")

    if [[ -z "$EVIDENCE_REFS" ]]; then
        echo "❌ (没有 Evidence 引用)" >&2
        echo "    → 每个 DoD 项必须有 Evidence: \`S1\` 或 \`C1\` 引用" >&2
        FAILED=1
    else
        # 验证每个引用在 .layer2-evidence.md 中存在
        if [[ -f "$L2_EVIDENCE_FILE" ]]; then
            for REF in $EVIDENCE_REFS; do
                if ! grep -q "### $REF:" "$L2_EVIDENCE_FILE" 2>/dev/null; then
                    echo "❌ (引用 $REF 在证据文件中不存在)" >&2
                    INVALID_EVIDENCE=1
                    FAILED=1
                fi
            done

            if [[ $INVALID_EVIDENCE -eq 0 ]]; then
                REF_COUNT=$(echo "$EVIDENCE_REFS" | wc -w)
                echo "✅ ($REF_COUNT 个引用有效)" >&2
            fi
        else
            echo "❌ (无法验证，.layer2-evidence.md 不存在)" >&2
            FAILED=1
        fi
    fi
fi
fi  # 结束 MODE == release 的 L3 完整检查

# ============================================================================
# 结果输出
# ============================================================================
echo "" >&2

if [[ $FAILED -eq 1 ]]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    echo "  ❌ 证据链质检未通过，不能提交 PR" >&2
    echo "" >&2

    # 回退到 step 4
    if [[ -n "${CURRENT_BRANCH:-}" && "${CURRENT_BRANCH:-}" =~ ^(cp-[a-zA-Z0-9]|feature/) ]]; then
        CURRENT_STEP=$(git config --get branch."$CURRENT_BRANCH".step 2>/dev/null || echo "0")
        if [[ "$CURRENT_STEP" -ge 4 ]]; then
            git config branch."$CURRENT_BRANCH".step 4
            echo "  ⟲ step 回退到 4，从 Step 5 重新循环" >&2
            echo "" >&2
            echo "  请补充证据：" >&2
            echo "    1. 修复 L1 测试（如有失败）" >&2
            echo "    2. 补充 .layer2-evidence.md 截图/curl 证据" >&2
            echo "    3. 更新 .dod.md 添加 Evidence 引用" >&2
            echo "    4. 确保所有 DoD 项都勾选" >&2
        else
            echo "  请先运行 /dev 完成 PRD 和 DoD（Step 1-4）" >&2
            echo "" >&2
            echo "  [SKILL_REQUIRED: dev]" >&2
        fi
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
    exit 2
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2
echo "  ✅ 证据链质检通过 ($CHECKED 项)，允许提交 PR" >&2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >&2

exit 0
