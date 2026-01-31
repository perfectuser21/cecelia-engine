---
id: qa-decision-gate-enforce
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.0.0: 初始版本
---

# QA Decision

Decision: MUST_ADD_RCI
Priority: P0
RepoType: Engine

Tests:
  - dod_item: "PostToolUse hook 写令牌"
    method: auto
    location: tests/hooks/gate-token.test.ts
  - dod_item: "PreToolUse hook 拦截无令牌调用"
    method: auto
    location: tests/hooks/gate-token.test.ts
  - dod_item: "防伪造令牌"
    method: auto
    location: tests/hooks/gate-token.test.ts
  - dod_item: "令牌一次性消费"
    method: auto
    location: tests/hooks/gate-token.test.ts
  - dod_item: "pr-gate-v2.sh gate 验签 bug 修复"
    method: auto
    location: tests/hooks/pr-gate.test.ts
  - dod_item: "Branch Protection ci-passed"
    method: manual
    location: manual:检查脚本输出 JSON 包含 ci-passed

RCI:
  new: [G1-001, G1-002]
  update: [H2-001]

Reason: Gate 令牌机制是核心安全功能（P0），涉及 Hook 和 Gate 验签，必须新增 RCI 并更新 pr-gate 相关 RCI。
