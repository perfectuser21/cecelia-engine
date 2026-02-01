# QA Decision

Decision: MUST_ADD_RCI
Priority: P0
RepoType: Engine

## Tests

### P0 Bug Fixes (阻塞工作流)
- dod_item: "Bug #1: Stop Hook 条件 3 永远失败 - PR 合并后的行为"
  method: manual
  location: manual:测试 Stop Hook 在不同 PR 状态下的行为（未合并/已合并/Step 11 完成）

- dod_item: "Bug #6: .dev-mode 竞态条件 - Step 3 执行期间的 Write 操作"
  method: manual
  location: manual:测试 Step 3 执行期间的 Hook 行为

- dod_item: "Bug #7: PR Gate QA/Audit 软阻塞 - 缺少文件时的阻塞行为"
  method: auto
  location: tests/hooks/pr-gate.test.ts

### P1 Bug Fixes (影响质量)
- dod_item: "Bug #2: HEAD~10 fallback - 新仓库兼容性"
  method: manual
  location: manual:在新仓库（<10 commits）测试 branch-protect.sh

- dod_item: "Bug #3: retry_count 竞态条件 - 并发安全性"
  method: manual
  location: manual:并发测试 Stop Hook retry_count 更新

- dod_item: "Bug #4: gate:dod & gate:qa 并行执行模型 - 文档完整性"
  method: manual
  location: manual:检查 skills/dev/steps/04-dod.md 文档

- dod_item: "Bug #5: 分支保护规范矛盾 - Feature ID 验证"
  method: auto
  location: tests/hooks/branch-protect.test.ts

- dod_item: "Bug #11: deploy.sh 错误恢复 - 错误处理逻辑"
  method: manual
  location: manual:测试 deploy.sh 的各种失败场景

### P2 Bug Fixes (安全和稳定性)
- dod_item: "Bug #13: 命令注入漏洞 - 安全验证"
  method: auto
  location: tests/security/command-injection.test.ts

- dod_item: "Bug #12: API 错误抑制 - 错误传播"
  method: manual
  location: manual:测试 setup-branch-protection.sh API 错误处理

- dod_item: "Bug #14: 符号链接漏洞 - 安全验证"
  method: auto
  location: tests/security/symlink.test.ts

### P3 Bug Fixes (完善性)
- dod_item: "Bug #8-10, #15-16: 文档矛盾、精度检查、CI 优化"
  method: manual
  location: manual:文档检查 + CI 验证

### 回归测试
- dod_item: "确保修复没有破坏现有功能"
  method: auto
  location: contract:C2-001

## RCI

### new:
- H7-004: Stop Hook PR 合并后正确退出（P0）
  - trigger: [PR, Release]
  - evidence: manual:测试 Stop Hook 条件 3 逻辑

- H1-004: 分支保护 Feature ID 验证（P1）
  - trigger: [PR, Release]
  - evidence: tests/hooks/branch-protect.test.ts

- H2-004: PR Gate 硬阻塞检查（P0）
  - trigger: [PR, Release]
  - evidence: tests/hooks/pr-gate.test.ts

- S1-001: 命令注入防护（P0）
  - trigger: [PR, Release]
  - evidence: tests/security/command-injection.test.ts

- S1-002: 符号链接安全验证（P1）
  - trigger: [PR, Release]
  - evidence: tests/security/symlink.test.ts

### update:
- C2-001: 现有测试必须通过（确保无回归）

## Reason

16 个 CRITICAL bug 修复涉及核心工作流（Stop Hook、PR Gate、分支保护）和安全漏洞（命令注入、符号链接），必须纳入回归契约防止再次出现。优先级 P0 因为这些 bug 会阻塞日常开发流程或造成安全风险。
