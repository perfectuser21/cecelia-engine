---
id: complete-workflow-with-ralph
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: 完整工作流 - 结合 Ralph Loop + Stop Hook
---

# 完整工作流：Ralph Loop + Stop Hook

**两种循环机制**：
1. **Ralph Loop**: `/ralph-loop` 命令（官方插件）
2. **Stop Hook**: 自动质检循环（我们实现的）

---

## 方案对比

### 方案 A: 只用 Stop Hook（当前）

```
用户: /dev "实现功能 X"
    ↓
AI: Step 1-6 写代码
    ↓
AI: Step 7.1 调用 /audit → AUDIT-REPORT.md
    ↓
AI: Step 7.2 检查 Decision
    ├─ FAIL → AI 修复 → 重新 /audit
    └─ PASS → 继续
    ↓
AI: Step 7.3 运行 npm run qa:gate
    ├─ 失败 → AI 修复 → 重跑
    └─ 成功 → .quality-gate-passed 生成
    ↓
AI: 尝试结束会话
    ↓
Stop Hook 触发:
    ├─ Step 7.1: AUDIT-REPORT.md 存在？
    ├─ Step 7.2: Decision: PASS？
    ├─ Step 7.3: .quality-gate-passed 存在？
    └─ 时效性检查？
    ↓
    ├─ 任何一步失败 → exit 2 → AI 继续循环
    └─ 全部通过 → exit 0 → 允许结束 ✅
```

**问题**：
- AI 可能在 Step 7 之前就尝试结束
- Stop Hook 只在"尝试结束"时触发
- 如果 AI 不主动尝试结束，Stop Hook 不会触发

---

### 方案 B: 用 Ralph Loop（推荐）

```
用户: /ralph-loop "实现功能 X，完成时输出 <promise>QUALITY_GATE_PASSED</promise>" \
        --max-iterations 20 \
        --completion-promise "QUALITY_GATE_PASSED"
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ralph Loop 第 1 次迭代
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI: Step 1-6 写代码
    ↓
AI: Step 7.1 调用 /audit → AUDIT-REPORT.md (Decision: FAIL)
    ↓
AI: 尝试结束会话
    ↓
Stop Hook: Step 7.2 检查 → Decision: FAIL → exit 2
    ↓
Ralph: Stop hook blocked → 将同一个提示语重新注入
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ralph Loop 第 2 次迭代
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI: 看到之前的 AUDIT-REPORT.md 和代码
    ↓
AI: 修复 L1/L2 问题
    ↓
AI: 重新 /audit → AUDIT-REPORT.md (Decision: PASS)
    ↓
AI: 运行 npm run qa:gate → 失败（某个测试失败）
    ↓
AI: 尝试结束会话
    ↓
Stop Hook: Step 7.3 检查 → .quality-gate-passed 不存在 → exit 2
    ↓
Ralph: Stop hook blocked → 重新注入
    ↓
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ralph Loop 第 3 次迭代
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI: 看到测试失败的输出
    ↓
AI: 修复失败的测试
    ↓
AI: 运行 npm run qa:gate → 成功 ✅
    ↓
AI: .quality-gate-passed 生成
    ↓
AI: 输出完成信号: "<promise>QUALITY_GATE_PASSED</promise>"
    ↓
Ralph: 检测到 completion-promise → 结束循环 ✅
```

---

## Ralph Loop + Stop Hook 协作机制

```
┌──────────────────────────────────────────────────────────┐
│  Ralph Loop (外层循环)                                    │
│  - 负责：重复注入同一个任务提示语                          │
│  - 触发：Stop hook 返回 exit 2 时                         │
│  - 结束：检测到 completion-promise 或达到 max-iterations  │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  Stop Hook (质检门控)                                     │
│  - 负责：检查 Step 7 是否完成                             │
│  - 触发：AI 尝试结束会话时                                │
│  - 决策：                                                 │
│    ├─ Step 7 未完成 → exit 2 → Ralph 继续循环            │
│    └─ Step 7 完成 → exit 0 → Ralph 检测 completion       │
└──────────────────────────────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│  AI 工作循环                                              │
│  - 每次迭代都能看到之前的修改                             │
│  - 根据 Stop Hook 的提示进行修复                         │
│  - 自主决定何时输出 completion-promise                   │
└──────────────────────────────────────────────────────────┘
```

---

## 完整流程图

```
用户启动
    ↓
┌─────────────────────────────────────────────────────────┐
│  用户命令                                                │
├─────────────────────────────────────────────────────────┤
│  /ralph-loop "实现功能 X，完整质检后输出完成信号"        │
│    --max-iterations 20                                  │
│    --completion-promise "QUALITY_GATE_PASSED"           │
└─────────────────────────────────────────────────────────┘
    ↓
┌═════════════════════════════════════════════════════════┐
║  Ralph Loop 迭代 1                                      ║
╠═════════════════════════════════════════════════════════╣
║  AI 接收提示语:                                         ║
║    "实现功能 X，完整质检后输出完成信号"                  ║
╠═════════════════════════════════════════════════════════╣
║  Step 1: PRD 确定                                       ║
║    └─ PreToolUse:Write → branch-protect.sh             ║
║       └─ ✅ 检查分支 + PRD/DoD                          ║
║                                                         ║
║  Step 2-6: 写代码 + 写测试                              ║
║    └─ PreToolUse:Write → branch-protect.sh             ║
║       └─ ✅ 每次写文件都检查                            ║
║                                                         ║
║  Step 7.1: Audit 审计                                   ║
║    ├─ AI: 调用 /audit Skill                            ║
║    └─ 生成: docs/AUDIT-REPORT.md                        ║
║       └─ Decision: FAIL (有 L1/L2 问题)                ║
║                                                         ║
║  AI: "完成了，尝试结束会话"                             ║
║    ↓                                                    ║
║  Stop Hook 触发:                                        ║
║    ├─ Step 7.1: AUDIT-REPORT.md ✅ 存在                ║
║    ├─ Step 7.2: Decision: FAIL ❌                      ║
║    └─ exit 2 (阻止结束)                                ║
║                                                         ║
║  Stop Hook 输出给 AI:                                   ║
║    "❌ Step 7.2: Audit 未通过！"                        ║
║    "当前 Decision: FAIL"                                ║
║    "请修复 L1/L2 问题后重新审计"                         ║
╚═════════════════════════════════════════════════════════╝
    ↓
Ralph: 检测到 Stop hook exit 2
    ↓
Ralph: 重新注入同一个提示语
    ↓
┌═════════════════════════════════════════════════════════┐
║  Ralph Loop 迭代 2                                      ║
╠═════════════════════════════════════════════════════════╣
║  AI 接收相同提示语（但看到了之前的改动）:               ║
║    "实现功能 X，完整质检后输出完成信号"                  ║
║                                                         ║
║  AI 分析:                                               ║
║    "我看到 AUDIT-REPORT.md 显示 Decision: FAIL"        ║
║    "有 L1 问题：xxx"                                    ║
║    "需要修复这些问题"                                   ║
║                                                         ║
║  AI 行动:                                               ║
║    ├─ 修复 L1/L2 问题                                   ║
║    ├─ 重新调用 /audit                                  ║
║    └─ 生成新的 AUDIT-REPORT.md                         ║
║       └─ Decision: PASS ✅                              ║
║                                                         ║
║  Step 7.3: 自动化测试                                   ║
║    ├─ AI: 运行 npm run qa:gate                         ║
║    └─ 结果: 失败 (某个测试失败)                         ║
║                                                         ║
║  AI: "测试失败了，尝试结束会话"                         ║
║    ↓                                                    ║
║  Stop Hook 触发:                                        ║
║    ├─ Step 7.1: AUDIT-REPORT.md ✅ 存在                ║
║    ├─ Step 7.2: Decision: PASS ✅                      ║
║    ├─ Step 7.3: .quality-gate-passed ❌ 不存在         ║
║    └─ exit 2 (阻止结束)                                ║
║                                                         ║
║  Stop Hook 输出给 AI:                                   ║
║    "❌ Step 7.3: 自动化测试未通过！"                    ║
║    "请运行: npm run qa:gate"                            ║
║    "如果测试失败，请修复后重新运行"                      ║
╚═════════════════════════════════════════════════════════╝
    ↓
Ralph: 检测到 Stop hook exit 2
    ↓
Ralph: 重新注入同一个提示语
    ↓
┌═════════════════════════════════════════════════════════┐
║  Ralph Loop 迭代 3                                      ║
╠═════════════════════════════════════════════════════════╣
║  AI 接收相同提示语（看到测试失败的输出）:               ║
║    "实现功能 X，完整质检后输出完成信号"                  ║
║                                                         ║
║  AI 分析:                                               ║
║    "我看到测试失败: xxx"                                ║
║    "原因是: yyy"                                        ║
║    "需要修复测试"                                       ║
║                                                         ║
║  AI 行动:                                               ║
║    ├─ 修复失败的测试                                    ║
║    ├─ 运行 npm run qa:gate                             ║
║    └─ 结果: 成功 ✅                                     ║
║       └─ .quality-gate-passed 生成 ✅                   ║
║                                                         ║
║  AI: "质检全部通过，输出完成信号"                       ║
║    └─ 输出: "<promise>QUALITY_GATE_PASSED</promise>"   ║
║    ↓                                                    ║
║  Stop Hook 触发:                                        ║
║    ├─ Step 7.1: AUDIT-REPORT.md ✅                     ║
║    ├─ Step 7.2: Decision: PASS ✅                      ║
║    ├─ Step 7.3: .quality-gate-passed ✅                ║
║    ├─ 时效性检查: ✅ 有效                               ║
║    └─ exit 0 (允许结束)                                ║
╚═════════════════════════════════════════════════════════╝
    ↓
Ralph: 检测到 completion-promise "QUALITY_GATE_PASSED"
    ↓
Ralph: 结束循环 ✅
    ↓
┌─────────────────────────────────────────────────────────┐
│  阶段 1 完成：本地质检通过                               │
├─────────────────────────────────────────────────────────┤
│  产物:                                                   │
│    ✅ .prd.md                                            │
│    ✅ .dod.md                                            │
│    ✅ docs/QA-DECISION.md                                │
│    ✅ docs/AUDIT-REPORT.md (Decision: PASS)             │
│    ✅ .quality-gate-passed                               │
│    ✅ 代码 + 测试                                        │
└─────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────┐
│  阶段 2: 用户手动创建 PR（或另一个 Ralph Loop）         │
├─────────────────────────────────────────────────────────┤
│  用户或 AI: gh pr create                                │
│    ↓                                                    │
│  PreToolUse:Bash → pr-gate-v2.sh (快速模式)             │
│    ├─ 检查产物存在 ✅                                    │
│    └─ 不运行测试（已在阶段 1 完成）                      │
│    ↓                                                    │
│  PR 创建成功 ✅                                          │
│    ↓                                                    │
│  CI 运行（GitHub Actions）                              │
│    └─ 100% 服务器端验证                                 │
│    ↓                                                    │
│  A+ Protection                                          │
│    └─ 人工审核 + 合并                                   │
└─────────────────────────────────────────────────────────┘
```

---

## 两种循环的职责划分

| 循环类型 | 触发方式 | 循环范围 | 结束条件 | 职责 |
|---------|---------|---------|---------|------|
| **Ralph Loop** | `/ralph-loop` | 整个任务 | completion-promise 或 max-iterations | 外层循环：重复注入提示语 |
| **Stop Hook** | AI 尝试结束 | Step 7 质检 | Step 7 全部通过 | 内层门控：检查质检完成度 |

---

## 使用示例

### 示例 1: 简单功能开发

```bash
/ralph-loop "实现用户登录功能。要求：
1. 编写登录 API
2. 添加测试
3. 通过完整质检（Audit + npm qa）
4. 完成时输出 <promise>DONE</promise>" \
  --max-iterations 15 \
  --completion-promise "DONE"
```

**预期**:
- 迭代 1-3: 写代码
- 迭代 4-6: 修复 Audit 问题
- 迭代 7-10: 修复测试失败
- 迭代 11: 全部通过 → 输出 DONE → 结束

### 示例 2: Bug 修复

```bash
/ralph-loop "修复 Bug #123。要求：
1. 重现 Bug
2. 修复问题
3. 添加回归测试
4. 通过 Audit 审计
5. 通过所有测试
6. 完成时输出 <promise>BUG_FIXED</promise>" \
  --max-iterations 10 \
  --completion-promise "BUG_FIXED"
```

### 示例 3: 重构

```bash
/ralph-loop "重构模块 X。要求：
1. 保持功能不变
2. 改善代码结构（通过 Audit L2/L3）
3. 所有测试继续通过
4. 完成时输出 <promise>REFACTOR_DONE</promise>" \
  --max-iterations 20 \
  --completion-promise "REFACTOR_DONE"
```

---

## 无限循环保护（双重保护）

### 保护 1: Ralph 的 max-iterations

```bash
# 永远设置 max-iterations
/ralph-loop "..." --max-iterations 20
```

**作用**: 即使 AI 卡住，也会在 20 次迭代后强制停止

### 保护 2: Stop Hook 的 stop_hook_active

```bash
# Stop Hook 内部检查
if [[ "$STOP_HOOK_ACTIVE" == "true" ]]; then
    echo "已经重试过一次，允许结束（防止无限循环）"
    exit 0  # 强制允许结束
fi
```

**作用**: 如果同一个 Stop Hook 被触发两次，强制允许结束

**双重保护** = Ralph max-iterations + Stop Hook stop_hook_active

---

## 最佳实践

### 1. 提示语要明确

✅ **好的提示语**:
```
实现功能 X。

步骤:
1. 写代码
2. 调用 /audit（必须 Decision: PASS）
3. 运行 npm run qa:gate（必须通过）
4. 完成时输出 <promise>COMPLETE</promise>

如果 Audit 失败: 修复 L1/L2 问题后重新审计
如果测试失败: 修复后重跑 npm run qa:gate
```

### 2. 永远设置 max-iterations

```bash
# 推荐
/ralph-loop "..." --max-iterations 20

# 不推荐（可能无限循环）
/ralph-loop "..."
```

### 3. 使用明确的 completion-promise

```bash
# 好
--completion-promise "QUALITY_GATE_PASSED"

# 不好（容易误触发）
--completion-promise "done"
```

### 4. 在提示语中引用 Stop Hook 逻辑

```
提示语中写明:
"你的工作会被 Stop Hook 检查:
 - Step 7.1: Audit 报告必须存在
 - Step 7.2: Decision 必须是 PASS
 - Step 7.3: 所有测试必须通过

如果 Stop Hook 阻止你结束，请根据错误信息修复问题。"
```

---

## 总结

| 组件 | 作用 | 强制能力 |
|------|------|---------|
| Ralph Loop | 外层循环：重复注入任务 | 100%（官方插件）|
| Stop Hook | 质检门控：检查 Step 7 完成度 | 100%（exit 2 阻止）|
| PreToolUse:Write | 入口门控：分支 + PRD/DoD | 100%（唯一路径）|
| pr-gate | PR 前快速检查 | 60%（多路径）|
| CI + A+ | 最终验证 | 100%（服务器端）|

**完整的质检循环**:
```
Ralph Loop (外层)
    └─ Stop Hook (质检门控)
        └─ Step 7.1: Audit
        └─ Step 7.2: Blocker 检查
        └─ Step 7.3: 自动化测试
```

**所有循环都是强制的（100%）！** 🎉

---

*生成时间: 2026-01-24*
