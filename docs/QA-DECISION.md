# QA Decision: Ralph Loop 迭代追踪机制

**Feature**: Ralph Loop iteration tracking
**Priority**: P2 (Enhancement)
**Date**: 2026-01-24

---

## Feature 归类

**Category**: Enhancement (增强) - CLI/Tooling

这是对现有 /ralph-loop 工作流的增强，添加自动追踪和报告功能。

---

## 测试决策

### 结论

**不需要新增自动化测试**

采用 **手动测试 + 文档** 策略。

### 决策依据

1. **Hook 脚本特性**：
   - `scripts/ralph-tracker.sh` 是 Hook 辅助脚本
   - `hooks/stop.sh` 是 Claude Code Hook，难以自动化测试
   - 主要逻辑是文件 I/O 和文本输出，非核心业务逻辑

2. **测试性价比低**：
   - Hook 脚本需要 Mock Claude Code 环境才能测试
   - JSON 文件操作逻辑简单（jq 命令组合）
   - 输出格式主要是用户界面展示，视觉验证更有效

3. **回归风险评估**：
   - 修改的是 Stop Hook，但新增代码是独立的追踪逻辑
   - 使用 `|| true` 容错，失败不影响主流程
   - 现有质检流程不受影响

4. **参考 skills/qa/SKILL.md 决策树**：
   ```
   Hook 脚本？→ 是
   ↓
   核心业务逻辑？→ 否（只是追踪和显示）
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
| manual:tracker-init | 初始化追踪文件 | JSON 格式正确，包含必需字段 | 截图 |
| manual:tracker-record | 记录迭代（blocked） | iterations 数组增加，total_iterations 递增 | JSON 内容 |
| manual:tracker-report | 生成报告 | 格式清晰，包含所有迭代历史 | 终端输出 |
| manual:stop-hook-integration | Stop Hook 集成 | 每次 exit 2 自动调用 ralph-tracker | Hook 输出 |
| manual:stop-hook-iteration-display | 迭代编号显示 | 输出"📊 Ralph Loop 迭代: #N" | Hook 输出 |
| manual:stop-hook-final-report | 最终报告 | Exit 0 生成完整报告并归档 | 终端输出 + 归档文件 |
| manual:ci-workflow-step | CI 集成 | GitHub Actions summary 显示统计 | CI 日志截图 |

### 手动测试流程

```bash
# 测试 1: 初始化
bash scripts/ralph-tracker.sh init
cat .ralph-loop-tracking.json  # 验证格式

# 测试 2: 记录迭代
bash scripts/ralph-tracker.sh record --iteration 1 --phase p0 --result blocked --blocked-at "Step 7.2" --reason "Audit fail"
cat .ralph-loop-tracking.json  # 验证追加成功

# 测试 3: 生成报告
bash scripts/ralph-tracker.sh report

# 测试 4: Stop Hook 集成
# 触发 ralph-loop 多次迭代，验证 Stop Hook 输出

# 测试 5: CI 集成
# 推送代码，检查 GitHub Actions summary
```

### 回归测试

- ✅ 运行 `npm run qa:gate` 确保现有测试仍然通过
- ✅ 手动测试 Stop Hook 在无 ralph-loop 环境下仍正常工作
- ✅ 验证追踪失败（`|| true`）不影响 Stop Hook 主流程

---

## Golden Paths

### GP-RALPH-01: 正常迭代追踪

```
用户运行 /ralph-loop
  ↓
第 1 次迭代失败（Audit fail）
  → Stop Hook exit 2
  → ralph-tracker record (blocked, Step 7.2)
  ↓
第 2 次迭代失败（Test fail）
  → Stop Hook exit 2
  → ralph-tracker record (blocked, Step 7.3)
  ↓
第 3 次迭代成功
  → Stop Hook exit 0
  → ralph-tracker record (success)
  → ralph-tracker report（生成最终报告）
  → ralph-tracker archive（归档）
```

**期望**：
- `.ralph-loop-tracking.json` 包含 3 次迭代记录
- 最终报告显示"总迭代: 3 次"
- 归档文件生成在 `.archive/ralph-loops/`

### GP-RALPH-02: Stop Hook 容错

```
Stop Hook 触发
  ↓
ralph-tracker.sh 不存在或失败
  ↓
|| true 容错，继续执行
  ↓
Stop Hook 正常检查质检结果
```

**期望**：
- 追踪失败不影响 Stop Hook 主流程
- Stop Hook 仍然正确判断 exit 0 或 exit 2

---

## 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| ralph-tracker 脚本错误导致 Stop Hook 失败 | 低 | 高 | 使用 `\|\| true` 容错 |
| JSON 格式错误 | 低 | 低 | 手动测试验证 |
| 归档文件太多占用空间 | 低 | 低 | 文档说明定期清理 |

---

## 决策总结

Decision: PASS (不需要新增自动化测试)

**原因**：
1. Hook 脚本，测试成本高
2. 逻辑简单，手动测试充分
3. 容错设计，失败不影响主流程

**覆盖方式**：
- **手动测试**：7 个测试场景
- **Golden Paths**：2 条关键路径
- **回归测试**：现有 qa:gate 确保无副作用
