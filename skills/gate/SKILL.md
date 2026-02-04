---
name: gate
version: 1.1.0
description: |
  独立质量审核 Skill 家族。

  每个 gate 是一个"守门检查"，负责验收 + 卡口 + 反馈闭环。
  主流程负责"产出"，gate 负责"审核"。

  规则：
  - PASS → 继续下一步
  - FAIL → 必须修到放行才能继续

triggers:
  - /gate:prd
  - /gate:dod
  - /gate:test
  - /gate:audit
---

# /gate - 独立质量审核 Skill 家族

## 核心理念

```
产出 → Gate 审核 → FAIL → 返回修改 → 再审核 → PASS → 继续
```

**职责分离**：
- 主流程：写 PRD、DoD、代码、测试
- Gate：独立验收，不通过就不让过

**解决的问题**：
- PRD/DoD/QA 可以写空壳文件应付检查
- CI 只检查文件存在，不检查内容质量

## 可用的 Gate

| Gate | 触发时机 | 检查内容 | 优先级 |
|------|---------|---------|--------|
| `/gate:prd` | Step 1 后 | PRD 完整性、需求可验收性、边界清晰度 | A档 |
| `/gate:dod` | Step 4 后 | PRD↔DoD 覆盖率、Test 映射有效性 | A档 |
| `/gate:test` | Step 6 后 | 测试↔DoD 覆盖率、边界用例、反例测试 | A档 |
| `/gate:audit` | Step 7 后 | 审计证据真实性、风险点识别 | A档 |

## 统一输出格式

所有 Gate 必须输出结构化结果：

```yaml
## Gate Result

Decision: PASS | FAIL

### Findings
- [PASS] 检查项 1：描述
- [FAIL] 检查项 2：具体问题

### Required Fixes (if FAIL)
1. 具体修复要求 1
2. 具体修复要求 2

### Evidence
- 文件：xxx.md L10-20
- 验证：实际检查的内容
```

## 使用方式

### 在 /dev 流程中自动调用

```
Step 4: 写 DoD
    ↓
/gate:dod (审核)
    ├─ FAIL → 返回 Step 4 修改
    └─ PASS → 继续 Step 5
```

### 手动调用

```bash
/gate:prd              # 审核当前 PRD
/gate:dod              # 审核当前 DoD
/gate:test             # 审核当前测试
/gate:audit            # 审核当前审计报告
```

## 审核循环

**最大 20 轮**：

```
while (attempts < 20) {
  result = gate:xxx 审核

  if (result === PASS) {
    生成 gate 文件
    break
  }

  根据 Required Fixes 修改
  attempts++
}
```

## 详细规则

每个 Gate 的详细审核标准见子文件：
- `gates/prd.md` - PRD 审核标准
- `gates/dod.md` - DoD 审核标准
- `gates/test.md` - 测试审核标准
- `gates/audit.md` - 审计审核标准

## 与 CI 的关系

| 检查点 | Gate (本地) | CI (远端) |
|--------|------------|-----------|
| 检查时机 | 写完立即检查 | Push 后检查 |
| 检查内容 | 内容质量 | 文件存在 + 格式 + 测试 |
| 反馈速度 | 即时 | 需要等待 |
| 强制性 | Soft | Hard (必须通过) |

**Gate 是 CI 的前置补充**：
- Gate 检查"内容质量"，CI 检查"形式正确"
- Gate 在本地快速反馈，CI 在远端最终把关
