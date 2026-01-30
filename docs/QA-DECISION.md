# QA Decision: H1 Monorepo Path Support

Decision: UPDATE_RCI
Priority: P1
RepoType: Engine

## 变更范围

| 文件 | 类型 | 影响 |
|------|------|------|
| hooks/branch-protect.sh | Hook | PRD/DoD 路径匹配正则修复 |

## 分析

### 问题描述
- 当前正则 `^$PRD_BASENAME$` 只匹配根目录的 `.prd.md`
- Monorepo 项目的 PRD 可能在子目录（如 `apps/core/.prd.md`）
- 导致 Hook 误报"PRD 文件未更新"

### 修复方案
- 将 `^$PRD_BASENAME$` 改为 `(^|/)$PRD_BASENAME$`
- 共 8 处正则需修复（293-296 行 PRD + 312-315 行 DoD）

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| PRD 支持子目录路径 | auto | tests/hooks/branch-protect.test.ts |
| DoD 支持子目录路径 | auto | tests/hooks/branch-protect.test.ts |
| 根目录 PRD/DoD 仍正常 | auto | tests/hooks/branch-protect.test.ts |

RCI:
  new: []
  update: [H1-001]

Reason: H1 Branch Protection 核心功能的 bug 修复，影响 monorepo 项目的开发体验。需要更新现有 RCI H1-001 的测试用例以覆盖子目录场景。
