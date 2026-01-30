# Step 6: 写测试

> 每个功能必须有对应的测试

**Task Checkpoint**: `TaskUpdate({ taskId: "6", status: "in_progress" })`

---

## 核心原则

```
DoD 里写的验收标准 → 变成测试代码

例如：
  DoD: "用户能登录"
    ↓
  测试: it('用户能登录', () => { ... })

  DoD: "密码错误有提示"
    ↓
  测试: it('密码错误有提示', () => { ... })
```

---

## 测试文件命名

- `功能.ts` → `功能.test.ts`
- 例：`login.ts` → `login.test.ts`

---

## 测试要求

- [ ] 必须有断言（expect）
- [ ] 覆盖核心功能路径
- [ ] 覆盖主要边界情况

---

## 示例

```typescript
// login.test.ts
import { describe, it, expect } from 'vitest'
import { login } from './login'

describe('login', () => {
  it('正确用户名密码能登录成功', async () => {
    const result = await login('user', 'password')
    expect(result.success).toBe(true)
  })

  it('错误密码显示错误提示', async () => {
    const result = await login('user', 'wrong')
    expect(result.success).toBe(false)
    expect(result.error).toBe('密码错误')
  })

  it('空用户名不能提交', async () => {
    const result = await login('', 'password')
    expect(result.success).toBe(false)
  })
})
```

---

## 不写测试的后果

- 没有测试可能被 CI 拦截
- PR review 时会被指出缺少测试

---

## Gate 审核（必须）

测试写完后，**必须**调用 gate:test 进行独立审核：

```javascript
// 审核循环（阻止型：FAIL 就不能继续）
while (true) {
  const result = await Task({
    subagent_type: "general-purpose",
    prompt: `你是独立的测试审核员。审核以下文件：
      - DoD: ${dod_file}
      - 测试文件: ${test_files}

      检查内容：
      1. DoD ↔ 测试覆盖率（每个验收项都有测试）
      2. 边界用例覆盖（空值、极端值）
      3. 反例测试（错误路径）
      4. 测试质量（断言明确性）

      输出格式：
      Decision: PASS | FAIL
      Findings: [检查结果列表]
      Required Fixes: [如果 FAIL，具体修复要求]`,
    description: "Gate: 测试审核"
  });

  if (result.decision === "PASS") {
    // 生成 gate 文件
    await Bash({ command: `bash scripts/gate/generate-gate-file.sh test PASS` });
    break;  // 继续 Step 7
  }

  // FAIL: 根据 Required Fixes 补充测试
  // ...添加缺失的测试用例...
  // 再次循环审核
}
```

**审核标准**：参考 `skills/gate/gates/test.md`

---

## 完成后

**Task Checkpoint**: `TaskUpdate({ taskId: "6", status: "completed" })`

**立即执行下一步**：

1. 读取 `skills/dev/steps/07-quality.md`
2. 立即进入 Quality 汇总
3. **不要**输出总结或等待确认
4. **不要**停顿

---

**Step 7：Quality 汇总**
