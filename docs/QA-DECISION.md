# QA Decision

Decision: UPDATE_RCI
Priority: P0
RepoType: Engine

## Scope

允许修改的范围：

- scripts/qa/*
- scripts/audit/*
- templates/*
- skills/qa/SKILL.md
- skills/audit/SKILL.md
- package.json
- CHANGELOG.md
- FEATURES.md
- docs/QA-DECISION.md
- docs/AUDIT-REPORT.md
- .dod.md
- .prd-qa-audit-refactor.md
- .prd.md
- hook-core/VERSION

## Forbidden

禁止修改的区域：

- node_modules/*
- .git/*
- dist/*

Tests:
  - dod_item: "scripts/qa/risk-score.cjs 实现并可运行"
    method: manual
    location: manual:执行_risk-score_输出JSON
  - dod_item: "scripts/qa/detect-scope.cjs 实现并可运行"
    method: manual
    location: manual:执行_detect-scope_输出范围
  - dod_item: "scripts/qa/detect-forbidden.cjs 实现并可运行"
    method: manual
    location: manual:执行_detect-forbidden_输出禁区
  - dod_item: "scripts/audit/compare-scope.cjs 实现并可运行"
    method: manual
    location: manual:执行_compare-scope_对比结果
  - dod_item: "scripts/audit/check-forbidden.cjs 实现并可运行"
    method: manual
    location: manual:执行_check-forbidden_检查结果
  - dod_item: "scripts/audit/check-proof.cjs 实现并可运行"
    method: manual
    location: manual:执行_check-proof_验证结果
  - dod_item: "scripts/audit/generate-report.cjs 实现并可运行"
    method: manual
    location: manual:执行_generate-report_生成报告
  - dod_item: "templates/QA-DECISION.md 创建结构化模板"
    method: manual
    location: manual:检查模板格式
  - dod_item: "templates/AUDIT-REPORT.md 创建结构化模板"
    method: manual
    location: manual:检查模板格式
  - dod_item: "skills/qa/SKILL.md 更新为包含 RISK SCORE"
    method: manual
    location: manual:检查_RISK_SCORE_章节
  - dod_item: "skills/audit/SKILL.md 更新为结构化验证"
    method: manual
    location: manual:检查_验证流程_章节

RCI:
  new:
    - Q5-001  # QA Decision Node RISK SCORE 机制
    - Q6-001  # Audit Node 结构化验证
  update: []

Reason: 重构 QA/Audit 系统为三层架构，引入 RISK SCORE 触发机制，实现结构化合同验证。影响 /dev 流程的 Step 4 和 Step 7，需要更新相关 RCI。
