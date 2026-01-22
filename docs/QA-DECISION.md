# QA Decision

> 全链路流程验证

## 基本信息

| 字段 | 值 |
|------|-----|
| Branch | `cp-test-full-flow` |
| Date | 2026-01-22 |
| PRD | .prd.md |
| 改动类型 | feature（小功能增强） |

## 测试策略

### 必须跑的测试

| 层级 | 命令 | 说明 |
|------|------|------|
| Unit | `npm run test` | 单元测试 |
| Regression | `npm run qa` | typecheck + test + build |

### RCI 决策

| 决策 | 内容 |
|------|------|
| 新增 RCI | 否 |
| 理由 | 小功能增强，不影响核心逻辑，无需纳入回归契约 |

### DoD 条目测试方式

| DoD 条目 | 测试方式 | 说明 |
|----------|----------|------|
| metrics.cjs 增加 generated_at | auto | tests/hooks/metrics.test.ts |
| 测试验证字段存在 | auto | tests/hooks/metrics.test.ts |
| npm run qa 通过 | auto | CI |

## 约束

- P2 优先级：小功能，全部 auto 测试
- 不需要 manual 测试

## 结论

Decision: **READY**
