# QA Decision: pr-gate 支持 release-* 分支

## Decision: L1 - 单元测试

## 测试策略
Hook 逻辑修改，依赖现有单元测试覆盖。

## 理由
- 修改 hooks/pr-gate-v2.sh 分支检查逻辑
- 现有测试套件已覆盖 pr-gate 行为（186 tests）
- 修改点小（1 行条件判断）
- 向后兼容（只扩展允许的分支）

## 验收方式
- npm run typecheck ✅
- npm test ✅ (186/186)
- CI 全绿
