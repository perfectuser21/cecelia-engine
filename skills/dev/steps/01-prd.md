# Step 1: PRD 确定

> 生成产品需求文档，直接继续 Step 2

---

## 入口模式

### 有头入口（默认）

用户发起需求，Claude 生成 PRD 后直接继续：

```
用户: "我想加一个用户登录功能"
    ↓
Claude: 生成 PRD → 继续 Step 2
```

### 无头入口（N8N）

N8N 直接发送完整 PRD，跳过对话：

```json
{
  "prd": {
    "需求来源": "自动化任务",
    "功能描述": "...",
    "涉及文件": "...",
    "成功标准": "..."
  }
}
```

Claude 直接使用 PRD → 继续

---

## PRD 模板

```markdown
## PRD - <功能名>

**需求来源**: <用户原话或任务来源>
**功能描述**: <我理解的功能>
**涉及文件**: <需要创建/修改的文件>
**成功标准**: <如何判断功能完成>
```

---

## 示例

```markdown
## PRD - 用户登录功能

**需求来源**: "加一个登录页面"

**功能描述**:
- 用户名/密码登录表单
- 登录成功跳转首页
- 登录失败显示错误

**涉及文件**:
- src/pages/Login.tsx（新建）
- src/api/auth.ts（新建）
- src/routes.tsx（修改）

**成功标准**:
- [ ] 用户可以输入用户名和密码
- [ ] 点击登录按钮后调用 API
- [ ] 登录成功后跳转到首页
- [ ] 登录失败后显示错误提示
- [ ] 表单验证正常工作
```

---

## 注意事项

- **必须包含"成功标准"字段** - 用于后续的 DoD 和完成度检查
- PRD 要简洁，不要写太多
- 生成后直接继续，不等待

---

## 完成后：gate:prd 审核（必须）

PRD 生成后，**必须**调用 gate:prd 进行独立审核：

```javascript
// 审核循环（阻止型：FAIL 就不能继续）
while (true) {
  const result = await Task({
    subagent_type: "general-purpose",
    prompt: `你是独立的 PRD 审核员。审核以下 PRD 文件：
      - 文件：${prd_file}

      检查内容：
      1. 需求来源是否清晰
      2. 功能描述是否具体可执行
      3. 成功标准是否可验收
      4. 涉及文件是否合理

      输出格式：
      Decision: PASS | FAIL
      Findings: [检查结果列表]
      Required Fixes: [如果 FAIL，具体修复要求]`,
    description: "Gate: PRD 审核"
  });

  if (result.decision === "PASS") {
    // 生成 gate 文件
    await Bash({ command: `bash scripts/gate/generate-gate-file.sh prd PASS` });
    break;  // 继续 Step 2
  }

  // FAIL: 根据 Required Fixes 修改 PRD
  // ...修改后再次循环审核
}
```

**审核标准**：参考 `skills/gate/gates/prd.md`

**Task Checkpoint**: `TaskUpdate({ taskId: "1", status: "completed" })`

---

继续 → Step 2

**注意**：`.dev-mode` 文件在 Step 3 分支创建后生成（需要正确的分支名）。
