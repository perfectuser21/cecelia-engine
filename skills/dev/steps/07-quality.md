# Step 7: 提交 PR

> 提交代码并创建 Pull Request

**Task Checkpoint**: `TaskUpdate({ taskId: "7", status: "in_progress" })`

---

## 提交代码

```bash
git add -A
git commit -m "feat: <功能描述>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
git push origin HEAD
```

---

## 创建 PR

```bash
gh pr create --base develop --title "<标题>" --body "<描述>"
```

---

## 完成后

PR 已创建，等待 CI 检查。

**Task Checkpoint**: `TaskUpdate({ taskId: "7", status: "completed" })`

**接下来**：Stop Hook 会自动监控 CI 状态
- CI 失败 → 自动循环修复
- CI 通过 → 继续 Step 8
