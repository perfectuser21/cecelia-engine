# Step 4: DoD

> 定义验收标准（Definition of Done）

**Task Checkpoint**: `TaskUpdate({ taskId: "4", status: "in_progress" })`

---

## 流程

```
DoD 草稿 → DoD 定稿 → gate:dod + QA (并行 subagents) → 继续
```

**关键变化 (v3)**：gate:dod 和 QA Decision 并行执行，两个都 PASS 才能继续。

---

## Step 4.1: DoD 草稿

把 PRD 里的"成功标准"变成可勾选的清单（Test 可以先空）：

```
PRD 成功标准: "用户能登录"
    ↓
DoD 草稿:
  - [ ] 用户输入正确密码能登录成功
        Test: (待定)
  - [ ] 用户输入错误密码显示错误提示
        Test: (待定)
```

---

## Step 4.2: QA Decision Node（必须）

**在 DoD 定稿前，必须输出 QA 决策产物**。

### 规范来源

参考 `skills/qa/SKILL.md` 中的规则：
- 测试大类：Regression / Unit / E2E
- RCI 判定标准
- Golden Path 判定标准
- 测试方式决策（auto/manual）

### 输入

- PRD (.prd.md)
- DoD 草稿
- 改动类型（feature/bugfix/refactor）

### 输出

- `docs/QA-DECISION.md`（必须创建）

### 输出 Schema（固定格式）

```yaml
# QA Decision
Decision: NO_RCI | MUST_ADD_RCI | UPDATE_RCI
Priority: P0 | P1 | P2
RepoType: Engine | Business

Tests:
  - dod_item: "功能描述"
    method: auto | manual
    location: tests/xxx.test.ts | manual:描述

RCI:
  new: []      # 需要新增的 RCI ID
  update: []   # 需要更新的 RCI ID

Reason: 一句话说明决策理由
```

### ⚡ QA Node 完成后的强制指令

**生成 QA-DECISION.md 后，立即进入 Step 4.3 (DoD 定稿)**：

1. **不要**输出"QA 决策已生成！"
2. **不要**停顿或等待确认
3. **立即**继续下一步：补全 DoD 的 Test 字段

---

## Step 4.3: DoD 定稿

根据 QA 决策产物，补全每个 DoD 条目的 Test 字段：

```markdown
# DoD - <功能名>

QA: docs/QA-DECISION.md   ← 必须引用

## 验收标准

### 功能验收
- [ ] 用户输入正确密码能登录成功
      Test: tests/auth.test.ts
- [ ] 用户输入错误密码显示错误提示
      Test: tests/auth.test.ts

### 测试验收
- [ ] npm run qa 通过
      Test: contract:C2-001
```

---

## DoD 模板

```markdown
# DoD - <功能名>

QA: docs/QA-DECISION.md

## 验收标准

### 功能验收
- [ ] <功能点 1>
      Test: tests/... | contract:... | manual:...
- [ ] <功能点 2>
      Test: tests/... | contract:... | manual:...

### 测试验收
- [ ] npm run qa 通过
      Test: contract:C2-001
```

### Test 字段格式说明

| 格式 | 场景 | 优先级 | 示例 |
|------|------|--------|------|
| `tests/xxx.test.ts` | 自动化单元测试 | ⭐⭐⭐ 最优 | `tests/auth.test.ts` |
| `contract:RCI-ID` | 回归契约验证 | ⭐⭐ 次优 | `contract:C2-001` |
| `manual:描述` | 手动验证步骤 | ⭐ 最后 | `manual:截图验证UI` |

**选择原则**：能自动化测试的优先自动化，其次引用回归契约，最后才用手动验证。

---

## Gate 检查

PR Gate 会检查：
1. `.dod.md` 存在且内容有效
2. `.dod.md` 包含 `QA: docs/QA-DECISION.md` 引用
3. `docs/QA-DECISION.md` 存在

---

## Step 4.4: 并行审核（必须）

DoD 定稿后，**并行**启动两个 Subagent：

```javascript
// 并行启动 gate:dod 和 QA Decision
const [dodResult, qaResult] = await Promise.all([
  // Subagent 1: gate:dod 审核
  Task({
    subagent_type: "general-purpose",
    prompt: `你是独立的 DoD 审核员。审核以下文件：
      - PRD: ${prd_file}
      - DoD: ${dod_file}

      检查内容：
      1. PRD ↔ DoD 覆盖率（每个成功标准都有对应验收项）
      2. 验收项具体性（可验证、可量化）
      3. Test 字段有效性（格式正确）

      输出格式：
      Decision: PASS | FAIL
      Findings: [检查结果列表]
      Required Fixes: [如果 FAIL，具体修复要求]`,
    description: "Gate: DoD 审核"
  }),

  // Subagent 2: QA Decision
  Task({
    subagent_type: "general-purpose",
    prompt: `你是 QA 决策员。根据 PRD 和 DoD 做测试决策：
      - PRD: ${prd_file}
      - DoD: ${dod_file}

      参考 skills/qa/SKILL.md 规则，输出 docs/QA-DECISION.md：
      - Decision: NO_RCI | MUST_ADD_RCI | UPDATE_RCI
      - Priority: P0 | P1 | P2
      - Tests: [每个 DoD 条目的测试方式]
      - RCI: [涉及的回归契约]
      - Reason: 决策理由`,
    description: "QA Decision"
  })
]);

// 两个都 PASS 才能继续
if (dodResult.decision === "FAIL" || qaResult.decision === "FAIL") {
  // 根据 Required Fixes 修改，再次并行审核
  // ...
}

// 生成 gate 文件
await Bash({ command: `bash scripts/gate/generate-gate-file.sh dod PASS` });
```

**审核标准**：参考 `skills/gate/gates/dod.md`

---

## 完成后

**Task Checkpoint**: `TaskUpdate({ taskId: "4", status: "completed" })`

**立即执行下一步**：

1. 读取 `skills/dev/steps/05-code.md`
2. 立即开始写代码
3. **不要**输出总结或等待确认
4. **不要**停顿

---

**Step 5：写代码**
