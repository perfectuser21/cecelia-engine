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

## 完成后

```bash
echo "✅ Step 1 完成 (PRD 已生成)"
```

---

## Gate 审核（可选）

PRD 生成后，可调用 `/gate:prd` 进行独立审核：

```javascript
// 启动审核 Subagent
Task({
  subagent_type: "general-purpose",
  prompt: `你是独立的 PRD 审核员。审核 ${prd_file}...`,
  description: "Gate: PRD 审核"
})

// 根据结果决定
if (result.decision === "FAIL") {
  // 根据 Required Fixes 修改 PRD
  // 再次审核
}
```

**审核标准**：参考 `skills/gate/gates/prd.md`

---

继续 → Step 2

**注意**：`.dev-mode` 文件在 Step 3 分支创建后生成（需要正确的分支名）。
