# QA Decision

Decision: UPDATE_RCI
Priority: P1
RepoType: Engine

Tests:
  - dod_item: "Ralph Loop 使用文档完整"
    method: manual
    location: manual:doc-review
  - dod_item: "运行时文件已从 git 追踪中移除"
    method: manual
    location: manual:git-check
  - dod_item: "detect-priority 测试通过"
    method: auto
    location: tests/hooks/pr-gate-phase1.test.ts
  - dod_item: "所有测试通过"
    method: auto
    location: manual:test-output

RCI:
  new: []
  update: ["H1-001"]  # Hook 基础功能回归

Reason: Ralph Loop 文档补充 + 测试环境修复，影响 Hook 使用体验，需更新 H1-001 回归契约。
