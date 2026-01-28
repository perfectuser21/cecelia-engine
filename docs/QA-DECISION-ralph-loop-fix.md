---
id: qa-decision-ralph-loop-fix
version: 1.0.0
created: 2026-01-27
prd: ../.prd-ralph-loop-fix.md
dod: ../.dod-ralph-loop-fix.md
---

# QA Decision - Ralph Loop 自动调用修复

## Decision Summary

```yaml
Decision: NO_RCI
Priority: P0
RepoType: Engine
```

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| SKILL.md 开头添加 Ralph Loop 强制调用规则 | manual | manual:检查 skills/dev/SKILL.md L34 之前添加内容 |
| SKILL.md 删除"结束对话"、"允许结束"描述 | manual | manual:全文搜索关键词确认删除 |
| SKILL.md 修改流程图 | manual | manual:检查流程图无"结束对话"节点 |
| Step 8 删除"立即结束对话"描述 | manual | manual:检查 skills/dev/steps/08-pr.md |
| Step 8 修改为 Ralph Loop 完成条件检查 | manual | manual:检查文件包含完成条件说明 |
| Step 9 完全重写为 Ralph Loop 启动指令 | manual | manual:检查 skills/dev/steps/09-ci.md |
| Step 9 删除 while true 循环示例 | manual | manual:搜索无 "while true" 代码块 |
| Step 7 添加 Ralph Loop 循环提示 | manual | manual:检查 skills/dev/steps/07-quality.md |
| 删除或归档 09.5-pending-wait.md | manual | manual:确认文件不存在或在 .archive |
| CLAUDE.md 添加 Ralph Loop 全局规则 | manual | manual:检查 ~/.claude/CLAUDE.md |
| hooks/stop.sh 修复注释 | manual | manual:检查注释无"exit 0 退出等唤醒" |
| hooks/stop.sh 修改 p0 阶段输出 | manual | manual:检查输出信息 |
| 端到端测试：完整流程 | manual | manual:实际运行测试验证 |
| p1 阶段测试：CI 修复循环 | manual | manual:实际运行测试验证 |
| 中途接管测试 | manual | manual:实际运行测试验证 |
| 更新 CHANGELOG.md | manual | manual:检查变更记录 |
| 更新 package.json 版本号 | auto | tests:semver 自动检查 |
| npm run qa 通过 | auto | contract:全局质检 |
| Audit Decision: PASS | manual | manual:检查 docs/AUDIT-REPORT.md |

## RCI

```yaml
new: []      # 无需新增 RCI
update: []   # 无需更新现有 RCI
```

## Reason

这是文档改进任务，主要修复 skills/dev/ 文档中的 Ralph Loop 描述混乱问题。不涉及新功能或核心路径变更，因此**无需纳入回归契约**。

### 为什么是 NO_RCI？

1. **文档改进，非功能变更**：修复的是 AI 指令文档，不改变 Hook/Skill 的代码逻辑
2. **不影响已有回归路径**：现有的 H1/H2/C2 等 RCI 不受影响
3. **验证方式为手动检查**：大部分验收是检查文档内容是否正确更新
4. **P0 优先级来自紧急性**：文档混乱导致 AI 行为错误，需立即修复，但不代表需要进入回归契约

### 测试策略

- **L1 自动测试**：npm run qa（现有测试覆盖）
- **L2A 审计**：/audit 检查文档一致性
- **L2B 证据**：不需要（PR 模式）
- **L3 验收**：手动检查每个文档修改点

### 影响范围

- 影响文件：skills/dev/SKILL.md, skills/dev/steps/*.md, hooks/stop.sh, ~/.claude/CLAUDE.md
- 影响对象：AI 开发流程的行为和指令
- 用户可见：无直接用户可见变更，但会改善 AI 的自动化流程体验

## Next Actions

1. 按 PRD 修复方案逐项修改文档
2. 运行 npm run qa 确保现有测试通过
3. 调用 /audit 进行代码审计
4. 手动验证每个修改点
5. 创建 PR 并通过 CI
