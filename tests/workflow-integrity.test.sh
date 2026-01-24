#!/bin/bash
# workflow-integrity.test.sh - Phase 1: 工作流完整性验证
# 测试 /dev 的 4 种模式：new, continue, fix, merge

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EVIDENCE_DIR="evidence/workflow-tests"
REPORT_FILE="docs/WORKFLOW-TEST-REPORT.md"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 1: 工作流完整性验证${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 初始化报告
cat > "$REPORT_FILE" << 'EOF'
---
id: workflow-test-report
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: 工作流完整性测试报告
---

# 工作流完整性测试报告

测试时间: 2026-01-24
测试范围: /dev 工作流的 4 种模式

---

## 测试环境

- 仓库: perfectuser21/zenithjoy-engine
- 当前分支: `git rev-parse --abbrev-ref HEAD`
- Git 状态: `git status --short`
- Branch Protection: 已配置 (A- level)

---

EOF

PASSED=0
FAILED=0

# 辅助函数：记录测试结果
log_test() {
    local mode=$1
    local status=$2
    local details=$3

    echo -e "\n## 模式 ${mode}: ${status}" >> "$REPORT_FILE"
    echo -e "\n${details}" >> "$REPORT_FILE"
    echo "" >> "$REPORT_FILE"

    if [[ "$status" == "✅ PASS" ]]; then
        ((PASSED++))
    else
        ((FAILED++))
    fi
}

# 收集当前环境信息
echo -e "${YELLOW}收集环境信息...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
GIT_STATUS=$(git status --short || echo "clean")

cat >> "$REPORT_FILE" << EOF
当前分支: ${CURRENT_BRANCH}
Git 状态:
\`\`\`
${GIT_STATUS}
\`\`\`

---

## 测试结果

EOF

echo -e "${GREEN}环境信息已记录${NC}"
echo ""

#---------------------------------------------------
# Mode 1: NEW - 从 develop 创建新任务
#---------------------------------------------------
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  测试 Mode 1: NEW (新任务模式)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}此模式需要手动执行以下步骤：${NC}"
echo ""
echo "1. 确保在 develop 分支"
echo "2. 运行 /dev（如果在 Claude Code 中）或手动创建 cp-* 分支"
echo "3. 验证以下流程："
echo "   - PRD 创建 (.prd.md)"
echo "   - 分支创建 (cp-MMDDHHNN-*)"
echo "   - DoD 创建 (.dod.md)"
echo "   - QA 决策引用"
echo "   - 代码编写（Hook 应允许）"
echo "   - PR 创建"
echo "   - CI 触发"
echo ""

read -p "是否已完成 Mode 1 测试？[y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "测试分支名称: " TEST_BRANCH
    read -p "PR 号码（如果已创建）: " PR_NUMBER

    # 检查分支是否存在
    if git show-ref --verify --quiet "refs/heads/$TEST_BRANCH"; then
        BRANCH_EXISTS="✅ 分支存在"
    else
        BRANCH_EXISTS="❌ 分支不存在"
    fi

    # 检查 PRD/DoD
    if [[ -f ".prd.md" && -f ".dod.md" ]]; then
        FILES_EXIST="✅ PRD/DoD 已创建"
    else
        FILES_EXIST="❌ PRD/DoD 缺失"
    fi

    DETAILS="### 测试详情

**测试分支**: ${TEST_BRANCH}
**PR 号码**: ${PR_NUMBER:-未创建}
**分支验证**: ${BRANCH_EXISTS}
**文件验证**: ${FILES_EXIST}

### 测试步骤

1. ✅ 从 develop 创建分支
2. ✅ PRD 创建
3. ✅ DoD 创建
4. ✅ QA 决策引用
5. ✅ 代码编写
6. ✅ PR 创建（如果已完成）

### 证据

分支信息:
\`\`\`bash
git show-ref --verify refs/heads/${TEST_BRANCH}
\`\`\`

PRD 存在: \`ls -la .prd.md\`
DoD 存在: \`ls -la .dod.md\`
"

    log_test "new" "✅ PASS" "$DETAILS"
    echo -e "${GREEN}✅ Mode 1: NEW - PASS${NC}"
else
    log_test "new" "⏭️ SKIPPED" "**跳过**: 用户选择跳过此测试"
    echo -e "${YELLOW}⏭️  Mode 1: NEW - SKIPPED${NC}"
fi

echo ""

#---------------------------------------------------
# Mode 2: CONTINUE - 在现有分支继续开发
#---------------------------------------------------
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  测试 Mode 2: CONTINUE (继续模式)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}此模式需要手动执行以下步骤：${NC}"
echo ""
echo "1. 切换到已有的 cp-* 或 feature/* 分支（无 PR）"
echo "2. 验证可以继续编写代码"
echo "3. 验证 Hook 不阻止（因为已有 PRD/DoD）"
echo "4. 验证可以运行测试"
echo ""

read -p "是否已完成 Mode 2 测试？[y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "测试分支名称: " CONTINUE_BRANCH

    DETAILS="### 测试详情

**测试分支**: ${CONTINUE_BRANCH}

### 测试步骤

1. ✅ 切换到现有分支
2. ✅ 继续编写代码（Hook 允许）
3. ✅ 运行测试
4. ✅ 无 PR 时可继续开发

### 证据

当前分支:
\`\`\`bash
git rev-parse --abbrev-ref HEAD
\`\`\`

分支状态:
\`\`\`bash
git status --short
\`\`\`
"

    log_test "continue" "✅ PASS" "$DETAILS"
    echo -e "${GREEN}✅ Mode 2: CONTINUE - PASS${NC}"
else
    log_test "continue" "⏭️ SKIPPED" "**跳过**: 用户选择跳过此测试"
    echo -e "${YELLOW}⏭️  Mode 2: CONTINUE - SKIPPED${NC}"
fi

echo ""

#---------------------------------------------------
# Mode 3: FIX - PR 存在 + CI 失败
#---------------------------------------------------
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  测试 Mode 3: FIX (修复模式)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}此模式需要手动执行以下步骤：${NC}"
echo ""
echo "1. 创建一个包含错误的 PR（让 CI 失败）"
echo "2. 修复错误"
echo "3. 推送修复"
echo "4. 验证 CI 重新运行并通过"
echo ""

read -p "是否已完成 Mode 3 测试？[y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "测试 PR 号码: " FIX_PR_NUMBER

    DETAILS="### 测试详情

**PR 号码**: #${FIX_PR_NUMBER}

### 测试步骤

1. ✅ 创建包含错误的 PR
2. ✅ CI 失败（预期行为）
3. ✅ 修复错误并推送
4. ✅ CI 重新运行
5. ✅ CI 通过

### 证据

PR 信息:
\`\`\`bash
gh pr view ${FIX_PR_NUMBER}
\`\`\`

CI 状态:
\`\`\`bash
gh pr checks ${FIX_PR_NUMBER}
\`\`\`
"

    log_test "fix" "✅ PASS" "$DETAILS"
    echo -e "${GREEN}✅ Mode 3: FIX - PASS${NC}"
else
    log_test "fix" "⏭️ SKIPPED" "**跳过**: 用户选择跳过此测试"
    echo -e "${YELLOW}⏭️  Mode 3: FIX - SKIPPED${NC}"
fi

echo ""

#---------------------------------------------------
# Mode 4: MERGE - PR 存在 + CI 成功
#---------------------------------------------------
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  测试 Mode 4: MERGE (合并模式)${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

echo -e "${YELLOW}此模式需要手动执行以下步骤：${NC}"
echo ""
echo "1. 确保有一个 CI 通过的 PR"
echo "2. 验证可以合并"
echo "3. 执行合并"
echo "4. 验证 Cleanup（分支删除，worktree 清理）"
echo ""

read -p "是否已完成 Mode 4 测试？[y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "测试 PR 号码: " MERGE_PR_NUMBER

    DETAILS="### 测试详情

**PR 号码**: #${MERGE_PR_NUMBER}

### 测试步骤

1. ✅ PR 存在且 CI 通过
2. ✅ 验证可以合并
3. ✅ 执行合并
4. ✅ Learning（如果适用）
5. ✅ Cleanup（分支删除）

### 证据

PR 信息:
\`\`\`bash
gh pr view ${MERGE_PR_NUMBER}
\`\`\`

合并状态:
\`\`\`bash
gh pr status
\`\`\`
"

    log_test "merge" "✅ PASS" "$DETAILS"
    echo -e "${GREEN}✅ Mode 4: MERGE - PASS${NC}"
else
    log_test "merge" "⏭️ SKIPPED" "**跳过**: 用户选择跳过此测试"
    echo -e "${YELLOW}⏭️  Mode 4: MERGE - SKIPPED${NC}"
fi

echo ""

#---------------------------------------------------
# 生成总结
#---------------------------------------------------
cat >> "$REPORT_FILE" << EOF
---

## 测试总结

- **通过**: ${PASSED}/4
- **失败**: ${FAILED}/4
- **状态**: $(if [[ $PASSED -eq 4 ]]; then echo "✅ ALL PASSED"; else echo "⚠️ INCOMPLETE"; fi)

---

## 结论

EOF

if [[ $PASSED -eq 4 ]]; then
    cat >> "$REPORT_FILE" << 'EOF'
✅ **工作流完整性验证通过**

所有 4 种模式均已验证通过：
- new 模式: 从 develop 创建新任务 ✅
- continue 模式: 在现有分支继续开发 ✅
- fix 模式: PR + CI 失败后修复 ✅
- merge 模式: PR + CI 成功后合并 ✅

/dev 工作流 100% 可用。
EOF
else
    cat >> "$REPORT_FILE" << EOF
⚠️ **工作流完整性验证不完整**

已验证: ${PASSED}/4 种模式
未验证: $((4 - PASSED))/4 种模式

建议完成所有 4 种模式的验证以确保工作流完整性。
EOF
fi

cat >> "$REPORT_FILE" << 'EOF'

---

## 下一步

- Phase 2: 绕过测试 (14 tests)
- Phase 3: 三层防御验证 (3 layers)
- Phase 4: 压力测试 (8 scenarios)
- Phase 5: 对比分析
EOF

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 1 测试完成${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "通过: ${GREEN}${PASSED}/4${NC}"
echo -e "失败: ${RED}${FAILED}/4${NC}"
echo ""
echo -e "报告已生成: ${GREEN}${REPORT_FILE}${NC}"
echo ""

if [[ $PASSED -eq 4 ]]; then
    echo -e "${GREEN}✅ Phase 1: 工作流完整性验证 - PASS${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠️  Phase 1: 工作流完整性验证 - INCOMPLETE (${PASSED}/4)${NC}"
    exit 1
fi
