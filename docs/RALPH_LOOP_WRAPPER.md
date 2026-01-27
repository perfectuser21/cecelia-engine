# Ralph Loop Wrapper 方案

**核心思路**：不要让 AI 在 /dev 内部调用 Ralph Loop，而是让用户直接调用 Ralph Loop，在循环内执行 /dev。

---

## 方案对比

### 当前方案（AI 调用 - 不可靠）

```bash
# 用户调用
/dev .prd.md

# AI 应该做的（但总是跳过）
/ralph-loop "/dev .prd.md ..." --completion-promise "QUALITY_GATE_PASSED"

# 结果
❌ AI 跳过 Ralph Loop 调用
❌ 直接执行 Step 1-8
❌ 在 Step 4 和 Step 7 停顿
```

### 新方案（用户调用 - 可靠）

```bash
# 用户直接调用 Ralph Loop
/ralph-loop "/dev .prd.md" --completion-promise "DONE"

# Ralph Loop 启动，在循环内执行 /dev
✅ /dev 按步骤执行
✅ /qa 和 /audit 返回后自动继续（Ralph Loop 驱动）
✅ 完成条件满足 → 输出 <promise>DONE</promise>
✅ Ralph Loop 检测到 promise → 结束
```

---

## 实现方式

### 方式 1：直接包装（最简单）

**用户操作**：

```bash
# p0 阶段（新功能开发）
/ralph-loop "/dev .prd-xxx.md" --completion-promise "DONE" --max-iterations 20

# p1 阶段（CI 修复）
/ralph-loop "/dev" --completion-promise "DONE" --max-iterations 10
```

**AI 职责**（在 Ralph Loop 循环内）：

```markdown
1. 执行 /dev 流程（Step 1-8 或 Step 9）
2. 每次迭代结束时检查完成条件：
   - p0: Audit PASS？质检通过？PR 创建？
   - p1: CI 通过？PR 合并？
3. 条件满足 → 输出 <promise>DONE</promise>
4. 条件未满足 → 不输出 promise → Ralph Loop 继续
```

### 方式 2：创建便捷命令（推荐）

**创建包装脚本**：

`/home/xx/bin/dev-with-loop`

```bash
#!/usr/bin/env bash
# dev-with-loop: /dev 的 Ralph Loop 包装器

set -euo pipefail

# 参数：PRD 文件路径（可选）
PRD_PATH="${1:-.prd.md}"

# 检测阶段
PHASE=$(bash scripts/detect-phase.sh 2>/dev/null | grep "^PHASE:" | awk '{print $2}' || echo "p0")

# 根据阶段决定 max-iterations
if [[ "$PHASE" == "p0" ]]; then
    MAX_ITERATIONS=20
    PROMPT="/dev $PRD_PATH"
elif [[ "$PHASE" == "p1" ]]; then
    MAX_ITERATIONS=10
    PROMPT="/dev"
else
    echo "阶段: $PHASE（无需处理）"
    exit 0
fi

# 调用 Ralph Loop
echo "启动 Ralph Loop (阶段: $PHASE, 最大迭代: $MAX_ITERATIONS)"
/ralph-loop "$PROMPT" \
    --completion-promise "DONE" \
    --max-iterations "$MAX_ITERATIONS"
```

**用户操作**（更简单）：

```bash
# p0 阶段（新功能）
dev-with-loop .prd-xxx.md

# p1 阶段（CI 修复）
dev-with-loop
```

### 方式 3：修改 /dev Skill 入口（最清晰）

**修改 `skills/dev/SKILL.md`**：

在开头添加：

```markdown
---
name: dev
version: 2.1.0
updated: 2026-01-27
description: |
  统一开发工作流（必须在 Ralph Loop 内调用）

  **CRITICAL**: 不要直接调用 /dev，使用 dev-with-loop 或手动包装
---

# /dev - 统一开发工作流（v2.1）

## ⚠️ 使用警告

**不要直接调用 /dev**，因为缺少自动循环机制会导致 Step 4/7 停顿。

### 正确用法

```bash
# 方式 1：使用便捷命令（推荐）
dev-with-loop .prd-xxx.md

# 方式 2：手动包装
/ralph-loop "/dev .prd-xxx.md" --completion-promise "DONE" --max-iterations 20
```

### 为什么需要 Ralph Loop？

```
/dev 执行步骤：
  Step 4: 调用 /qa → 返回
  Step 7: 调用 /audit → 返回

问题：
  /qa 和 /audit 按规范不输出总结就返回
  AI 自然停下来，需要外层循环驱动继续

解决：
  Ralph Loop 提供外层循环
  检测到没有 <promise> → 自动继续
```

---

## 核心定位

**流程编排者**（不负责循环重试）：
- 质检强制 → `hooks/stop.sh` (Stop Hook)
- 放行判断 → `hooks/pr-gate-v2.sh` (PreToolUse:Bash)
- 循环驱动 → Ralph Loop（外部调用）

**Ralph Loop 负责**：
- 自动循环重试
- 检测完成条件
- 输出 promise 时结束

**职责分离**：
```
用户 → Ralph Loop（循环框架）
         ↓
       /dev（流程编排）
         ↓
       Step 1-8（具体步骤）
```
```

---

## 修改清单

### 1. 修改 `skills/dev/SKILL.md`

**在开头添加使用警告**：

```markdown
## ⚠️ 使用警告

**不要直接调用 /dev**，必须包装在 Ralph Loop 内。

### 正确用法

```bash
# 方式 1：使用便捷命令（推荐）
dev-with-loop .prd-xxx.md

# 方式 2：手动包装
/ralph-loop "/dev .prd-xxx.md" --completion-promise "DONE" --max-iterations 20
```

### 为什么？

/dev 调用的 /qa 和 /audit Skills 会正常返回，但 AI 没有明确指令继续，会自然停下来。Ralph Loop 提供外层循环驱动，检测到没有 `<promise>` 时自动继续。
```

**删除内部 Ralph Loop 调用逻辑**：

- 删除 "⚡⚡⚡ Ralph Loop 强制调用" 章节
- 删除阶段检测后的 `/ralph-loop` 调用代码
- 保留完成条件检查逻辑（AI 仍需检查并输出 promise）

### 2. 创建便捷命令

**文件**：`/home/xx/bin/dev-with-loop`

```bash
#!/usr/bin/env bash
# dev-with-loop: /dev 的 Ralph Loop 包装器

set -euo pipefail

PRD_PATH="${1:-.prd.md}"
PROJECT_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

cd "$PROJECT_ROOT"

# 检测阶段
PHASE=$(bash scripts/detect-phase.sh 2>/dev/null | grep "^PHASE:" | awk '{print $2}' || echo "p0")

# 根据阶段决定参数
if [[ "$PHASE" == "p0" ]]; then
    MAX_ITERATIONS=20
    PROMPT="/dev $PRD_PATH"
elif [[ "$PHASE" == "p1" ]]; then
    MAX_ITERATIONS=10
    PROMPT="/dev"
elif [[ "$PHASE" == "p2" ]] || [[ "$PHASE" == "pending" ]]; then
    echo "✅ 阶段: $PHASE（已完成，无需处理）"
    exit 0
else
    echo "⚠️  阶段: $PHASE（无法检测，跳过）"
    exit 0
fi

# 调用 Ralph Loop
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  启动 Ralph Loop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  阶段: $PHASE"
echo "  最大迭代: $MAX_ITERATIONS"
echo "  命令: $PROMPT"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

/ralph-loop "$PROMPT" \
    --completion-promise "DONE" \
    --max-iterations "$MAX_ITERATIONS"
```

**安装**：

```bash
chmod +x /home/xx/bin/dev-with-loop
```

### 3. 修改 `~/.claude/CLAUDE.md`

**替换 Ralph Loop 调用规则**：

```markdown
## Ralph Loop 使用规则（CRITICAL）

**用户直接调用 Ralph Loop，不要让 AI 内部调用。**

### 正确用法

```bash
# p0 阶段（新功能开发）
/ralph-loop "/dev .prd-xxx.md" --completion-promise "DONE" --max-iterations 20

# 或使用便捷命令
dev-with-loop .prd-xxx.md

# p1 阶段（CI 修复）
/ralph-loop "/dev" --completion-promise "DONE" --max-iterations 10

# 或使用便捷命令
dev-with-loop
```

### AI 职责（在 Ralph Loop 循环内）

**每次迭代结束时检查完成条件**：

p0 阶段：
1. Audit 报告存在且 PASS？
2. .quality-gate-passed 存在？
3. PR 已创建？

p1 阶段：
1. CI 通过？
2. PR 已合并？

**根据条件决定输出**：
- ✅ 全部满足 → 输出 `<promise>DONE</promise>` → Ralph Loop 结束
- ❌ 未满足 → 不输出 promise → 继续执行修复步骤

### 禁止行为

- ❌ 手动写 while 循环
- ❌ 修复一次就停下来
- ❌ 输出"会话结束"、"等待用户确认"
```

### 4. 更新文档

**文件**：`docs/USAGE.md`（新建或更新）

```markdown
# 使用指南

## 开始新功能开发

```bash
# 1. 创建 PRD
cat > .prd-xxx.md <<'EOF'
# PRD: 功能描述
...
EOF

# 2. 调用 dev-with-loop（会自动包装 Ralph Loop）
dev-with-loop .prd-xxx.md

# 3. 等待完成（自动执行 Step 1-8，创建 PR）
```

## 修复 CI 失败

```bash
# 直接调用（会自动检测 p1 阶段）
dev-with-loop

# 或手动指定
/ralph-loop "/dev" --completion-promise "DONE" --max-iterations 10
```

## 直接调用 /dev（不推荐）

如果直接调用 `/dev`，会在 Step 4 和 Step 7 停顿，需要手动催促继续。

**原因**：/dev 调用的 /qa 和 /audit Skills 按规范正常返回，但 AI 缺少明确指令继续，会自然停下来。

**解决**：使用 `dev-with-loop` 或手动包装 Ralph Loop。
```

---

## 完成条件检查（AI 职责）

**AI 在每次 Ralph Loop 迭代结束时，必须检查完成条件并决定是否输出 promise。**

### p0 阶段检查

```
1. 检查 docs/AUDIT-REPORT.md 是否存在？
   ❌ → 调用 /audit → 不输出 promise → 继续

2. 检查 Audit Decision: PASS？
   ❌ → 修复 L1/L2 问题 → 不输出 promise → 继续

3. 检查 .quality-gate-passed 是否存在？
   ❌ → npm run qa:gate → 不输出 promise → 继续

4. 检查 PR 是否已创建？
   ❌ → gh pr create → 不输出 promise → 继续

✅ 全部满足 → 输出 <promise>DONE</promise> → Ralph Loop 结束
```

### p1 阶段检查

```
1. 检查 CI 状态（gh pr checks）

   pending/queued:
     → sleep 30 → 不输出 promise → 继续

   failure:
     → 分析失败原因
     → 修复代码
     → git add && commit && push
     → 不输出 promise → 继续

   success:
     → gh pr merge --squash --delete-branch
     → 输出 <promise>DONE</promise> → 结束 ✅
```

---

## 测试验证

### 测试 1：p0 阶段（新功能）

```bash
cd /home/xx/dev/zenithjoy-engine
git checkout develop
git pull
git checkout -b test-wrapper-p0

cat > .prd-test-wrapper.md <<'EOF'
# PRD: 测试 Ralph Loop Wrapper

> Type: Test
> Priority: P3

## 目标

验证用户直接调用 Ralph Loop 包装 /dev 的方式是否能解决停顿问题。

## 成功标准

- Step 4 调用 /qa 后自动继续
- Step 7 调用 /audit 后自动继续
- 创建 PR 后输出 <promise>DONE</promise>
EOF

# 调用 dev-with-loop
dev-with-loop .prd-test-wrapper.md
```

**预期行为**：
1. ✅ dev-with-loop 检测阶段 → p0
2. ✅ 调用 `/ralph-loop "/dev .prd-test-wrapper.md" ...`
3. ✅ Ralph Loop 启动，在循环内执行 /dev
4. ✅ Step 4 调用 /qa → 返回 → Ralph Loop 驱动继续
5. ✅ Step 7 调用 /audit → 返回 → Ralph Loop 驱动继续
6. ✅ Step 8 创建 PR → 检查完成条件 → 输出 `<promise>DONE</promise>`
7. ✅ Ralph Loop 检测到 promise → 结束

### 测试 2：p1 阶段（CI 修复）

```bash
# 假设当前分支有 PR 且 CI 失败
dev-with-loop
```

**预期行为**：
1. ✅ dev-with-loop 检测阶段 → p1
2. ✅ 调用 `/ralph-loop "/dev" ...`
3. ✅ Ralph Loop 循环内检查 CI → 失败
4. ✅ 修复代码 → push
5. ✅ 继续检查 CI → 成功
6. ✅ 合并 PR → 输出 `<promise>DONE</promise>` → 结束

---

## 优势总结

| 方面 | AI 调用（旧） | 用户调用（新） |
|------|--------------|---------------|
| 可靠性 | ❌ 依赖 AI 自觉 | ✅ 用户直接控制 |
| 复杂度 | ❌ /dev 要判断是否调用 | ✅ /dev 只编排流程 |
| 维护性 | ❌ AI 行为不可预测 | ✅ 确定性强 |
| 用户体验 | ❌ 直接调用 /dev 会停顿 | ✅ 使用 dev-with-loop 不会停顿 |
| 职责分离 | ❌ 混乱（/dev 管循环？） | ✅ 清晰（Ralph Loop 管循环，/dev 管流程） |

---

## 迁移指南

### 用户侧

**之前**：
```bash
/dev .prd.md
# 遇到停顿 → "继续啊"
```

**现在**：
```bash
dev-with-loop .prd.md
# 不会停顿 ✅
```

### 文档侧

- `skills/dev/SKILL.md`：删除内部 Ralph Loop 调用逻辑，添加使用警告
- `~/.claude/CLAUDE.md`：修改 Ralph Loop 规则为"用户调用"
- 新增 `/home/xx/bin/dev-with-loop` 便捷命令
- 新增 `docs/USAGE.md` 使用指南

### AI 侧

**职责变化**：
- ❌ 不再负责调用 Ralph Loop
- ✅ 只负责执行 /dev 流程（Step 1-8）
- ✅ 每次迭代结束检查完成条件
- ✅ 条件满足时输出 `<promise>DONE</promise>`

---

## 立即开始？

要现在实施这个方案吗？我可以：

1. 修改 `skills/dev/SKILL.md`（删除内部 Ralph Loop 调用）
2. 创建 `/home/xx/bin/dev-with-loop` 便捷命令
3. 更新 `~/.claude/CLAUDE.md`
4. 创建测试 PRD 验证效果

这个方案更简单、更可靠，符合"用户控制、AI 执行"的设计哲学。
