# QA Decision: P0 质检强制三件套

**Feature**: Quality Enforcement Infrastructure (Impact Check + Evidence Gate + Anti-Bypass)
**Priority**: P0
**Date**: 2026-01-24

---

## Feature 归类

**Category**: Infrastructure - CI/QA Enforcement

这是质检基础设施改进，不是业务功能。涉及：
- CI jobs（impact-check, evidence-gate）
- 质检产物（.quality-evidence.json）
- 契约文档（QUALITY-CONTRACT.md）

---

## 测试决策

### 结论

Decision: NO_NEW_AUTOMATED_TESTS

采用 **手动测试 + CI 验证** 策略。

### 决策依据

1. **基础设施特性**：
   - 这是 CI/质检基础设施，不是业务逻辑
   - 核心验证在 CI 环境，本地单元测试意义不大
   - 最终验证需要真实的 PR + CI 环境

2. **测试性价比**：
   - 需要 Mock GitHub API、Git 状态、CI 环境
   - 实际验证必须在真实 PR 中测试
   - 手动测试更直接、更可靠

3. **回归风险评估**：
   - 新增的 CI jobs 独立运行，失败不影响现有流程
   - Impact Check 只读取文件列表，逻辑简单
   - Evidence Gate 只验证 JSON 格式，风险低

4. **参考 skills/qa/SKILL.md 决策树**：
   ```
   基础设施改进？→ 是
   ↓
   需要 Mock 复杂环境？→ 是（GitHub API + CI）
   ↓
   手动测试充分？→ 是
   ↓
   结论：不需要自动化测试
   ```

---

## 测试策略

### 手动测试覆盖

| Test ID | 场景 | 验证点 | 证据 |
|---------|------|--------|------|
| manual:p0-1-trigger | Impact Check 触发条件 | 改 hooks/ 触发检查 | CI 日志 |
| manual:p0-1-pass | Impact Check 通过 | 改 hooks/ + registry → PASS | CI 绿 |
| manual:p0-1-fail | Impact Check 失败 | 只改 hooks/ → FAIL | CI 红 |
| manual:p0-1-doc-only | Impact Check 文档更新 | 只改 registry → PASS | CI 绿 |
| manual:p0-2-generate | Evidence 生成 | qa:gate 生成 .quality-evidence.json | 文件内容 |
| manual:p0-2-sha | Evidence SHA 校验 | 修改 SHA → CI FAIL | CI 日志 |
| manual:p0-2-missing | Evidence 缺失 | 无证据文件 → CI FAIL | CI 日志 |
| manual:p0-3-doc | Anti-Bypass 文档 | 文档完整性检查 | 人工审查 |

### 手动测试流程

```bash
# 测试 1: Impact Check - 触发和验证
1. 创建测试 PR，只改 hooks/branch-protect.sh
2. 验证：CI impact-check 失败
3. 添加 features/feature-registry.yml 改动
4. 验证：CI impact-check 通过

# 测试 2: Evidence Gate - 生成和验证
1. 本地运行 npm run qa:gate
2. 验证：生成 .quality-evidence.json
3. 验证：SHA 字段 == git rev-parse HEAD
4. 提交 PR，验证 CI evidence-gate 通过

# 测试 3: Evidence Gate - SHA 校验
1. 手动修改 .quality-evidence.json 的 SHA 字段
2. 提交 PR
3. 验证：CI evidence-gate 失败（SHA mismatch）

# 测试 4: Anti-Bypass 文档
1. 审查 QUALITY-CONTRACT.md 内容
2. 验证：包含本地 vs 远端职责映射表
3. 验证：说明清楚"本地加速，远端强制"
```

### 回归测试

- ✅ 运行 `npm run qa:gate` 确保现有测试仍然通过
- ✅ 验证新的 CI jobs 不影响现有 CI 流程
- ✅ 验证 Branch Protection 配置正确

---

## RCI 决策

### 结论

**不需要新增 RCI**（NO_RCI）

### 理由

1. **不是用户可见功能**：
   - 这是开发基础设施，不是业务能力
   - 用户感知不到这些 CI jobs

2. **CI 本身就是验证**：
   - Impact Check 的回归测试 = CI job 本身
   - Evidence Gate 的回归测试 = CI job 本身
   - 不需要额外的 RCI 条目

3. **已有 CI 验证**：
   - CI: test (C2) - 验证测试通过
   - CI: typecheck (C1) - 验证类型检查
   - 新增的 impact-check 和 evidence-gate 是补充，不是替代

---

## Golden Paths

### 结论

**不需要新增 Golden Path**

### 理由

1. **不是端到端用户流程**：
   - Golden Path 用于验证完整的用户工作流
   - 这是基础设施，不涉及用户操作链路

2. **已有 GP 覆盖**：
   - GP-001: /dev 完整流程 - 会触发新的 CI jobs
   - GP-002: PR 创建流程 - 会验证 Impact Check 和 Evidence Gate

---

## Priority 映射

| 审计严重性 | 业务优先级 | 说明 |
|-----------|-----------|------|
| P0 | P0 | 质检基础设施，防止能力漂移 |

**RCI 影响**：
- 虽然是 P0，但不需要 RCI（因为是基础设施，不是业务功能）
- CI jobs 本身就是最终验证

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| Impact Check 误报 | 低 | 中 | 路径配置可调整，手动测试验证 |
| Evidence SHA 校验过严 | 低 | 低 | 只在 CI 验证，本地不强制 |
| CI jobs 失败影响 PR 合并 | 中 | 高 | 手动测试充分，Branch Protection 配置正确 |

---

## 决策总结

Decision: NO_NEW_AUTOMATED_TESTS

**理由**：
1. 基础设施改进，不是业务逻辑
2. 最终验证必须在真实 CI 环境
3. 手动测试充分，性价比高

**覆盖方式**：
- **手动测试**：8 个测试场景
- **CI 验证**：新增 2 个 CI jobs（impact-check, evidence-gate）
- **回归测试**：现有 qa:gate 确保无副作用

**RCI/GP**：
- 不需要新增 RCI（基础设施，CI 本身就是验证）
- 不需要新增 GP（已有 GP 会触发新 CI jobs）
