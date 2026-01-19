# Step 1: PRD 确定

> 生成产品需求文档，等用户确认

**完成后设置状态**：
```bash
git config branch."$BRANCH_NAME".step 1
```

---

## 入口模式

### 有头入口（默认）

用户直接发起需求，Claude 与用户对话确认 PRD：

```
用户: "我想加一个用户登录功能"
    ↓
Claude: 生成 PRD 草稿
    ↓
用户: 确认或修改
    ↓
Claude: PRD 确定 → step 1
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

Claude 直接使用 PRD → step 1

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
- 用户确认后才能继续
- 如果用户有修改意见，更新 PRD 后再确认

---

## 测试任务检测

**如果 PRD 标题包含 `[TEST]` 前缀，标记为测试任务**：

```bash
# 检测 PRD 标题是否包含 [TEST]
if [[ "$PRD_TITLE" == *"[TEST]"* ]]; then
    git config branch."$BRANCH_NAME".is-test true
    echo "🧪 检测到测试任务，已设置 is-test=true"
fi
```

**测试任务的特殊处理**：
- Step 8: 跳过 CHANGELOG 和版本号更新
- Step 10: Learning 可选（只记录流程经验）
- Step 11: Cleanup 时提示检查是否有残留

---

## 用户确认后

```bash
BRANCH_NAME=$(git rev-parse --abbrev-ref HEAD)
git config branch."$BRANCH_NAME".step 1

# 检测测试任务
if [[ "$PRD_TITLE" == *"[TEST]"* ]]; then
    git config branch."$BRANCH_NAME".is-test true
    echo "🧪 测试任务模式"
fi

echo "✅ Step 1 完成 (PRD 确认)"
```

---

## 与 N8N 集成

N8N 可以通过 API 直接发送 PRD：

```bash
# N8N 发送的 payload
{
  "mode": "headless",
  "prd": {
    "需求来源": "自动化任务 #123",
    "功能描述": "添加数据导出功能",
    "涉及文件": "src/api/export.ts, src/components/ExportButton.tsx",
    "成功标准": "用户可以点击按钮导出 CSV 文件"
  }
}
```

Claude 检测到 `mode: headless` 时：
1. 跳过对话确认
2. 直接使用 PRD
3. 设置 step 1
4. 继续 Step 2
