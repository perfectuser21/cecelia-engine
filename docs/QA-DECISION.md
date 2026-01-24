# QA Decision - 深度基线验证

Decision: COMPREHENSIVE_BASELINE_VERIFICATION
Priority: P0
RepoType: Engine

## 背景

2026-01-23 发生配置错误导致的 bypass 事件（required_pull_request_reviews: null）。需要深度验证当前 A- (95%) 基线是否真正可靠，确保 /dev 工作流 100% 可用。

## 测试决策

### 测试范围

**Phase 1 - 工作流完整性**: 4 个模式测试
- new 模式
- continue 模式
- fix 模式
- merge 模式

**Phase 2 - 绕过测试**: 14 个测试
- 12 个阻止场景（直接 push、force push、API 绕过等）
- 2 个合法场景（正常 PR、/dev 流程）

**Phase 3 - 三层防御**: 3 层验证
- Layer 1: Local Hook (branch-protect.sh)
- Layer 2: GitHub Branch Protection
- Layer 3: CI (GitHub Actions)

**Phase 4 - 压力测试**: 8 个场景
- 并发场景（3 个）
- 冲突场景（3 个）
- 边界情况（2 个）

**Phase 5 - 对比分析**: 文档分析
- A- vs A+ 对比
- 风险评估
- 最终建议

**总计**: 29 个测试

### 自动化策略

| Phase | 自动化程度 | 方法 |
|-------|-----------|------|
| Phase 1 | 50% | 半自动（脚本辅助 + 手动验证）|
| Phase 2 | 90% | 全自动（脚本执行 + 自动日志收集）|
| Phase 3 | 70% | 半自动（API 查询自动 + 手动验证）|
| Phase 4 | 60% | 半自动（脚本框架 + 手动场景构造）|
| Phase 5 | 0% | 手动分析 + 文档撰写 |

**总体自动化**: ~65%

### 测试方法

**自动化测试** (占 65%):
- Bash 脚本执行 Git/GitHub 操作
- API 调用验证配置
- 自动日志收集和解析
- 脚本化报告生成

**手动测试** (占 35%):
- 工作流模式实际执行
- GitHub UI 交互验证
- 复杂场景构造
- 最终分析和建议

## Tests

Phase 1 - 工作流完整性:
  - dod_item: "new 模式测试"
    method: manual
    location: manual:workflow-execution
  - dod_item: "continue 模式测试"
    method: manual
    location: manual:workflow-execution
  - dod_item: "fix 模式测试"
    method: manual
    location: manual:workflow-execution
  - dod_item: "merge 模式测试"
    method: manual
    location: manual:workflow-execution

Phase 2 - 绕过测试:
  - dod_item: "直接 push main/develop 阻止"
    method: auto
    location: tests/bypass-prevention.test.sh
  - dod_item: "Force push 阻止"
    method: auto
    location: tests/bypass-prevention.test.sh
  - dod_item: "分支删除阻止"
    method: auto
    location: tests/bypass-prevention.test.sh
  - dod_item: "gh CLI 绕过阻止"
    method: auto
    location: tests/bypass-prevention.test.sh
  - dod_item: "API 绕过阻止"
    method: auto
    location: tests/bypass-prevention.test.sh
  - dod_item: "Git 内部绕过阻止"
    method: auto
    location: tests/bypass-prevention.test.sh
  - dod_item: "无 PR 直接 push 阻止"
    method: auto
    location: tests/bypass-prevention.test.sh
  - dod_item: "绕过 CI 合并阻止"
    method: auto
    location: tests/bypass-prevention.test.sh
  - dod_item: "正常 PR 流程通过"
    method: manual
    location: manual:github-pr
  - dod_item: "/dev 完整流程通过"
    method: manual
    location: manual:dev-workflow

Phase 3 - 三层防御:
  - dod_item: "Hook 层验证"
    method: auto
    location: tests/three-layer-defense.test.sh
  - dod_item: "GitHub Protection 层验证"
    method: auto
    location: tests/three-layer-defense.test.sh
  - dod_item: "CI 层验证"
    method: manual
    location: manual:github-ci

Phase 4 - 压力测试:
  - dod_item: "并发场景测试"
    method: manual
    location: manual:stress-test
  - dod_item: "冲突场景测试"
    method: manual
    location: manual:stress-test
  - dod_item: "边界情况测试"
    method: manual
    location: manual:stress-test

Phase 5 - 对比分析:
  - dod_item: "A- vs A+ 对比文档"
    method: manual
    location: docs/A-MINUS-VS-A-PLUS.md
  - dod_item: "风险评估文档"
    method: manual
    location: docs/RISK-ASSESSMENT.md

总控:
  - dod_item: "总控脚本执行"
    method: auto
    location: tests/baseline-verification.sh
  - dod_item: "总报告生成"
    method: manual
    location: docs/BASELINE-VERIFICATION-REPORT.md

## RCI

new:
  - T1-001: 工作流完整性验证
  - T2-001: Branch Protection 绕过测试套件
  - T3-001: 三层防御验证
  - T4-001: 压力测试框架
  - D1-001: A- vs A+ 对比分析
  - D1-002: 风险评估报告

update: []

## 验收标准

### 必要条件

- [ ] 所有 29 个测试执行完成
- [ ] 所有测试脚本创建且可执行
- [ ] 所有测试报告生成且内容完整
- [ ] 所有证据文件收集完整
- [ ] 总控脚本输出符合预期

### 成功指标

```bash
bash tests/baseline-verification.sh

# 预期输出:
Phase 1 - Workflow Integrity:     ✅ 4/4 modes passed
Phase 2 - Bypass Prevention:      ✅ 14/14 tests passed
Phase 3 - Three-Layer Defense:    ✅ 3/3 layers verified
Phase 4 - Stress Testing:         ✅ 8/8 scenarios passed
Total:                            ✅ 29/29 tests passed
Status:                           A- (95%) VERIFIED
Recommendation:                   CURRENT BASELINE IS SUFFICIENT
```

### 最终交付

- [ ] 5 个测试脚本
- [ ] 7 个文档报告
- [ ] 4 个证据目录（包含所有日志/截图/API 响应）
- [ ] 明确回答 4 个核心问题

## Reason

2026-01-23 配置错误导致 Claude Code 绕过 Branch Protection 直接推送到 main。需要全面验证当前 A- (95%) 基线的可靠性，确保：
1. /dev 工作流 100% 可用
2. 所有已知 bypass 手段均被阻止
3. 三层防御全部激活
4. 明确 A- 是否足够，是否需要升级到 A+
