# Step 4: DoD

> 定义验收标准（Definition of Done）

---

## 流程

```
DoD 草稿 → 调用 /qa → QA 决策产物 → DoD 定稿
```

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

## Step 4.2: 调用 /qa（必须）

**在 DoD 定稿前，必须调用 /qa skill 输出测试决策**：

```
/qa
```

**输入**：
- PRD (.prd.md)
- DoD 草稿
- 改动类型（feature/bugfix/refactor）

**输出**：
- `docs/QA-DECISION.md`（必须创建）

**QA 决策内容**：
- 要不要新增/更新 RCI
- 每个 DoD 条目用 auto 还是 manual 测试
- P0 功能必须 auto，不允许 manual

---

## Step 4.3: DoD 定稿

根据 QA 决策，补全每个 DoD 条目的 Test 字段：

```markdown
# DoD - <功能名>

QA: docs/QA-DECISION.md   ← 必须引用

## 验收标准

### 功能验收
- [ ] 用户输入正确密码能登录成功
      Test: auto (tests/auth.test.ts)
- [ ] 用户输入错误密码显示错误提示
      Test: auto (tests/auth.test.ts)

### 测试验收
- [ ] npm run qa 通过
```

---

## DoD 模板

```markdown
# DoD - <功能名>

QA: docs/QA-DECISION.md

## 验收标准

### 功能验收
- [ ] <功能点 1>
      Test: auto/manual (位置/说明)
- [ ] <功能点 2>
      Test: auto/manual (位置/说明)

### 测试验收
- [ ] npm run qa 通过
```

---

## Gate 检查

PR Gate 会检查：
1. `.dod.md` 存在且内容有效
2. `.dod.md` 包含 `QA: docs/QA-DECISION.md` 引用
3. `docs/QA-DECISION.md` 存在

---

## 完成后

```bash
echo "✅ Step 4 完成 (DoD + QA 决策)，可以开始写代码"
```

**DoD 定稿后，进入 Step 5：写代码**
