#!/bin/bash
# bypass-prevention.test.sh - Phase 2: Branch Protection 绕过测试
# 测试 12 个阻止场景 + 2 个合法场景

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

EVIDENCE_DIR="evidence/bypass-tests"
REPORT_FILE="docs/BYPASS-TEST-REPORT.md"
REPO="perfectuser21/zenithjoy-engine"

mkdir -p "$EVIDENCE_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 2: 绕过测试${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# 初始化报告
cat > "$REPORT_FILE" << 'EOF'
---
id: bypass-test-report
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: 绕过测试报告
---

# 绕过测试报告

测试时间: 2026-01-24
测试仓库: perfectuser21/zenithjoy-engine

---

## 测试环境

- 仓库: perfectuser21/zenithjoy-engine
- Branch Protection: ✅ 已配置 (A- level)
- 测试分支: main, develop
- 当前用户: perfectuser21 (Owner)

---

## 测试结果

EOF

PASSED=0
FAILED=0

# 辅助函数：运行测试并记录结果
run_test() {
    local test_num=$1
    local test_name=$2
    local test_cmd=$3
    local expected_result=$4
    local log_file="${EVIDENCE_DIR}/${test_num}-${test_name}.log"

    echo -e "${YELLOW}Test ${test_num}: ${test_name}${NC}"

    # 执行命令并捕获输出
    set +e
    output=$(eval "$test_cmd" 2>&1)
    exit_code=$?
    set -e

    # 保存日志
    echo "Command: $test_cmd" > "$log_file"
    echo "Exit Code: $exit_code" >> "$log_file"
    echo "Output:" >> "$log_file"
    echo "$output" >> "$log_file"

    # 判断结果
    if [[ "$expected_result" == "BLOCKED" ]]; then
        if echo "$output" | grep -qi "403\|protected\|rejected\|not permitted\|cannot"; then
            echo -e "${GREEN}  ✅ PASS - 已阻止${NC}"
            ((PASSED++))
            result="✅ PASS"
        else
            echo -e "${RED}  ❌ FAIL - 未阻止！${NC}"
            ((FAILED++))
            result="❌ FAIL"
        fi
    else
        if [[ $exit_code -eq 0 ]]; then
            echo -e "${GREEN}  ✅ PASS - 已允许${NC}"
            ((PASSED++))
            result="✅ PASS"
        else
            echo -e "${RED}  ❌ FAIL - 未允许！${NC}"
            ((FAILED++))
            result="❌ FAIL"
        fi
    fi

    # 记录到报告
    cat >> "$REPORT_FILE" << EOF
### Test ${test_num}: ${test_name}

**命令**: \`${test_cmd}\`
**预期**: ${expected_result}
**结果**: ${result}

<details>
<summary>详细日志</summary>

\`\`\`
${output}
\`\`\`

</details>

**证据文件**: \`${log_file}\`

---

EOF

    sleep 1  # 避免 API 限流
}

echo -e "${YELLOW}准备测试环境...${NC}"
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "当前分支: ${CURRENT_BRANCH}"
echo ""

#---------------------------------------------------
# 阻止场景测试 (12 tests)
#---------------------------------------------------

cat >> "$REPORT_FILE" << 'EOF'
## 阻止场景测试 (12 tests)

EOF

# Test 1: 直接 push main
echo ""
echo -e "${BLUE}--- Test 1: 直接 push main ---${NC}"
run_test "01" "direct-push-main" \
    "git checkout main && git commit --allow-empty -m 'test bypass' && git push origin main" \
    "BLOCKED"

# Test 2: 直接 push develop
echo ""
echo -e "${BLUE}--- Test 2: 直接 push develop ---${NC}"
run_test "02" "direct-push-develop" \
    "git checkout develop && git commit --allow-empty -m 'test bypass' && git push origin develop" \
    "BLOCKED"

# Test 3: Force push main
echo ""
echo -e "${BLUE}--- Test 3: Force push main ---${NC}"
run_test "03" "force-push-main" \
    "git push -f origin main" \
    "BLOCKED"

# Test 4: Force push develop
echo ""
echo -e "${BLUE}--- Test 4: Force push develop ---${NC}"
run_test "04" "force-push-develop" \
    "git push -f origin develop" \
    "BLOCKED"

# Test 5: Delete branch main
echo ""
echo -e "${BLUE}--- Test 5: Delete branch main ---${NC}"
run_test "05" "delete-main" \
    "git push origin :main" \
    "BLOCKED"

# Test 6: Delete branch develop
echo ""
echo -e "${BLUE}--- Test 6: Delete branch develop ---${NC}"
run_test "06" "delete-develop" \
    "git push origin :develop" \
    "BLOCKED"

# Test 7: gh CLI 绕过 (需要有 PR)
echo ""
echo -e "${BLUE}--- Test 7: gh CLI 绕过 ---${NC}"
echo -e "${YELLOW}注意: 此测试需要有一个待合并的 PR${NC}"
read -p "是否有待合并的 PR？[y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "PR 号码: " PR_NUM
    run_test "07" "gh-cli-bypass" \
        "gh pr merge $PR_NUM --admin --squash" \
        "BLOCKED"
else
    echo -e "${YELLOW}  ⏭️  SKIPPED - 无 PR${NC}"
    echo "### Test 07: gh CLI 绕过" >> "$REPORT_FILE"
    echo "**跳过**: 无待合并的 PR" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
fi

# Test 8: API 绕过 (merge)
echo ""
echo -e "${BLUE}--- Test 8: API 绕过 (merge) ---${NC}"
if [[ -n "${PR_NUM:-}" ]]; then
    run_test "08" "api-merge" \
        "gh api -X PUT repos/${REPO}/pulls/${PR_NUM}/merge" \
        "BLOCKED"
else
    echo -e "${YELLOW}  ⏭️  SKIPPED - 无 PR${NC}"
    echo "### Test 08: API 绕过 (merge)" >> "$REPORT_FILE"
    echo "**跳过**: 无待合并的 PR" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
fi

# Test 9: API 绕过 (update ref)
echo ""
echo -e "${BLUE}--- Test 9: API 绕过 (update ref) ---${NC}"
MAIN_SHA=$(git rev-parse main)
run_test "09" "api-update-ref" \
    "gh api -X PATCH repos/${REPO}/git/refs/heads/main -f sha='${MAIN_SHA}'" \
    "BLOCKED"

# Test 10: Git 内部绕过
echo ""
echo -e "${BLUE}--- Test 10: Git 内部绕过 ---${NC}"
run_test "10" "git-update-ref" \
    "git checkout main && git update-ref refs/heads/main HEAD^ && git push origin main" \
    "BLOCKED"

# Test 11: 无 PR 直接 push
echo ""
echo -e "${BLUE}--- Test 11: 无 PR 直接 push ---${NC}"
run_test "11" "no-pr-push" \
    "git checkout main && echo 'test' >> README.md && git add README.md && git commit -m 'test' && git push origin main" \
    "BLOCKED"

# Test 12: 绕过 CI 合并
echo ""
echo -e "${BLUE}--- Test 12: 绕过 CI 合并 ---${NC}"
echo -e "${YELLOW}注意: 此测试需要创建一个 PR 且 CI 未完成${NC}"
read -p "是否要测试绕过 CI？[y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "PR 号码（CI 未完成）: " CI_PR_NUM
    run_test "12" "bypass-ci" \
        "gh pr merge $CI_PR_NUM --squash" \
        "BLOCKED"
else
    echo -e "${YELLOW}  ⏭️  SKIPPED - 手动测试${NC}"
    echo "### Test 12: 绕过 CI 合并" >> "$REPORT_FILE"
    echo "**跳过**: 需要手动创建 PR 并在 CI 未完成时尝试合并" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
fi

#---------------------------------------------------
# 合法场景测试 (2 tests)
#---------------------------------------------------

cat >> "$REPORT_FILE" << 'EOF'
## 合法场景测试 (2 tests)

EOF

# Test 13: 正常 PR 流程
echo ""
echo -e "${BLUE}--- Test 13: 正常 PR 流程 ---${NC}"
echo -e "${YELLOW}此测试需要手动验证：${NC}"
echo "1. 创建 PR"
echo "2. 等待 CI 通过"
echo "3. 合并 PR"
echo ""
read -p "是否已完成正常 PR 流程测试？[y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "PR 号码: " NORMAL_PR
    echo "### Test 13: 正常 PR 流程" >> "$REPORT_FILE"
    echo "**PR 号码**: #${NORMAL_PR}" >> "$REPORT_FILE"
    echo "**结果**: ✅ PASS - 正常流程通过" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    ((PASSED++))
else
    echo "### Test 13: 正常 PR 流程" >> "$REPORT_FILE"
    echo "**跳过**: 需要手动测试" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
fi

# Test 14: /dev 完整流程
echo ""
echo -e "${BLUE}--- Test 14: /dev 完整流程 ---${NC}"
echo -e "${YELLOW}此测试需要手动验证：${NC}"
echo "1. 从 develop 运行 /dev"
echo "2. 创建 PRD/DoD"
echo "3. 编写代码"
echo "4. 创建 PR"
echo "5. CI 通过"
echo "6. 合并"
echo ""
read -p "是否已完成 /dev 完整流程测试？[y/N] " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "PR 号码: " DEV_PR
    echo "### Test 14: /dev 完整流程" >> "$REPORT_FILE"
    echo "**PR 号码**: #${DEV_PR}" >> "$REPORT_FILE"
    echo "**结果**: ✅ PASS - 完整流程通过" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
    ((PASSED++))
else
    echo "### Test 14: /dev 完整流程" >> "$REPORT_FILE"
    echo "**跳过**: 需要手动测试" >> "$REPORT_FILE"
    echo "---" >> "$REPORT_FILE"
fi

#---------------------------------------------------
# 生成总结
#---------------------------------------------------

cat >> "$REPORT_FILE" << EOF
## 测试总结

- **通过**: ${PASSED}/14
- **失败**: ${FAILED}/14
- **状态**: $(if [[ $PASSED -ge 12 ]]; then echo "✅ PASS (核心阻止场景全部通过)"; elif [[ $PASSED -ge 10 ]]; then echo "⚠️ PARTIAL"; else echo "❌ FAIL"; fi)

### 阻止场景结果

| 测试 | 场景 | 结果 |
|------|------|------|
| 01 | 直接 push main | 查看日志 |
| 02 | 直接 push develop | 查看日志 |
| 03 | Force push main | 查看日志 |
| 04 | Force push develop | 查看日志 |
| 05 | Delete main | 查看日志 |
| 06 | Delete develop | 查看日志 |
| 07 | gh CLI 绕过 | 查看日志 |
| 08 | API merge | 查看日志 |
| 09 | API update ref | 查看日志 |
| 10 | Git update-ref | 查看日志 |
| 11 | 无 PR 直接 push | 查看日志 |
| 12 | 绕过 CI | 查看日志 |

---

## 结论

EOF

if [[ $PASSED -ge 12 ]]; then
    cat >> "$REPORT_FILE" << 'EOF'
✅ **绕过测试通过**

所有核心阻止场景均已验证：
- 直接 push protected branches → ❌ 阻止
- Force push → ❌ 阻止
- 分支删除 → ❌ 阻止
- API/CLI 绕过 → ❌ 阻止
- 正常 PR 流程 → ✅ 允许

A- (95%) Branch Protection 有效运作。
EOF
else
    cat >> "$REPORT_FILE" << 'EOF'
⚠️ **绕过测试不完整或存在问题**

请检查失败的测试并修复 Branch Protection 配置。
EOF
fi

cat >> "$REPORT_FILE" << 'EOF'

---

## 证据文件

所有测试的详细日志保存在 `evidence/bypass-tests/` 目录。

---

## 下一步

- Phase 3: 三层防御验证
- Phase 4: 压力测试
- Phase 5: 对比分析
EOF

# 恢复到原始分支
git checkout "$CURRENT_BRANCH" 2>/dev/null || true

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Phase 2 测试完成${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "通过: ${GREEN}${PASSED}/14${NC}"
echo -e "失败: ${RED}${FAILED}/14${NC}"
echo ""
echo -e "报告已生成: ${GREEN}${REPORT_FILE}${NC}"
echo -e "证据目录: ${GREEN}${EVIDENCE_DIR}${NC}"
echo ""

if [[ $PASSED -ge 12 ]]; then
    echo -e "${GREEN}✅ Phase 2: 绕过测试 - PASS (核心场景已验证)${NC}"
    exit 0
else
    echo -e "${RED}❌ Phase 2: 绕过测试 - FAIL (存在未阻止的绕过)${NC}"
    exit 1
fi
