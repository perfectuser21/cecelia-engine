# Step 5: 写代码

> 根据 PRD 实现功能代码

**Task Checkpoint**: `TaskUpdate({ taskId: "5", status: "in_progress" })`

---

## 原则

1. **只做 PRD 里说的** - 不要过度设计
2. **保持简单** - 能用简单方案就不用复杂方案
3. **遵循项目规范** - 看看已有代码怎么写的

---

## 检查清单

写代码时注意：

- [ ] 文件放对位置了吗？
- [ ] 命名符合项目规范吗？
- [ ] 有没有引入安全漏洞？
- [ ] 有没有硬编码的配置？

---

## 常见问题

**Q: 发现 PRD 有问题怎么办？**
A: 更新 PRD，调整实现方案，继续。

**Q: 需要改已有代码怎么办？**
A: 改之前先理解原代码逻辑，改完确保不破坏原有功能。

**Q: 代码写到一半发现方案不对？**
A: 调整方案，重新实现。

---

## 完成后：Audit Loop（必须）

代码写完后，**必须**进入 Audit 循环：

```javascript
// Audit 循环（阻止型：L1/L2 问题清零才能继续）
while (true) {
  const result = await Task({
    subagent_type: "general-purpose",
    prompt: `你是代码审计员。审计以下改动文件：
      - 改动文件：${changed_files}
      - 目标层级：L2（默认）

      参考 skills/audit/SKILL.md 规则：
      - L1 阻塞性：功能不工作、崩溃、数据丢失（必须修）
      - L2 功能性：边界条件、错误处理、edge case（建议修）
      - L3 最佳实践：代码风格、一致性（可选）
      - L4 过度优化：理论边界（不修）

      输出 docs/AUDIT-REPORT.md：
      - Decision: PASS | FAIL
      - Summary: L1/L2/L3/L4 各多少
      - Findings: [问题列表]
      - Blockers: [L1+L2 问题 ID]`,
    description: "Audit: 代码审计"
  });

  if (result.decision === "PASS") {
    // 生成 gate 文件
    await Bash({ command: `bash scripts/gate/generate-gate-file.sh audit PASS` });
    break;  // 继续 Step 6
  }

  // FAIL: 修复 L1/L2 问题
  // ...根据 Findings 修复代码...
  // 再次循环审计
}
```

**审核标准**：参考 `skills/audit/SKILL.md`

**关键原则**：
- Audit 在 Test 之前执行
- 改完代码再跑 Test，避免测试白跑

**Task Checkpoint**: `TaskUpdate({ taskId: "5", status: "completed" })`

**立即执行下一步**：

1. 读取 `skills/dev/steps/06-test.md`
2. 立即写测试
3. **不要**输出总结或等待确认
4. **不要**停顿

---

**Step 6：写测试**
