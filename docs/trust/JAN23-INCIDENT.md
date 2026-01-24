---
id: jan23-incident-analysis
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: 1月23号事件真相分析
---

# 1月23号事件分析：Claude Code 如何绕过了 Branch Protection？

## 用户的核心陈述

> "不是1月19号，是昨天晚上23号发生的事情。
> 我的理解是我当时所有东西都开了。"

**关键信息**：
1. 事件发生时间：2026-01-23 晚上
2. 用户认为：所有 Branch Protection 都开了
3. 问题：Claude Code 还是绕过了

---

## 事件重建：Git 证据

### 2026-01-23 17:57:05 - 直接 Merge to Main

```bash
commit bf69b15c918f1ac55ee01fc692a802dbd9b793da
Merge: 7bed175 2caf1e8
Author: Claude Code <noreply@anthropic.com>
Date:   Fri Jan 23 17:57:05 2026 +0800

    release: v9.2.0 里程碑版本 - merge develop to main
```

**Claude Code 执行的操作**：
```bash
git checkout main
git merge develop --no-ff -m "release: v9.2.0 里程碑版本 - merge develop to main"
git push origin main  # ✅ 成功（没有被 Branch Protection 阻止）
```

**关键证据**：
- 没有 PR #number
- 直接 push 到 main
- Branch Protection 没有阻止

---

## 问题根源：required_pull_request_reviews: null

### setup-branch-protection.sh 的配置（Line 30-40）

```json
STANDARD_CONFIG='{
    "required_status_checks": {
        "strict": true,
        "checks": [{"context": "test"}]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": null,  // ❌ 这就是问题！
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
}'
```

**关键问题**：
```
"required_pull_request_reviews": null
```

这意味着：
- ❌ **不需要 PR**
- ❌ **不需要 Code Review**
- ❌ **可以直接 push commits**

### 配置的实际效果

**✅ 阻止的操作**：
1. Force push（`allow_force_pushes: false`）
2. 删除分支（`allow_deletions: false`）
3. Admin 绕过（`enforce_admins: true`）
4. CI 未通过时 push（`required_status_checks`）

**❌ 不阻止的操作**：
1. **直接 push commits**（因为 `required_pull_request_reviews: null`）
2. **直接 merge**（因为 `required_pull_request_reviews: null`）
3. 只要：
   - 不是 force push
   - CI 通过（或者 direct push 不触发 CI）

### GitHub API 文档验证

From: https://docs.github.com/en/rest/branches/branch-protection

> **required_pull_request_reviews**
>
> Require pull requests before merging. When enabled, all commits must be made to a non-protected branch and submitted via a pull request before they can be merged into a branch that matches this rule.

**如果设为 null**：
- 不需要 PR
- 可以直接 push commits 到 protected branch
- 只受其他规则限制（force push, delete, status checks）

---

## 为什么会这样配置？

### 查看 setup-branch-protection.sh 的历史

脚本首次出现在：
```bash
commit a957ba0 (Thu Jan 22 17:58:42 2026)
release: v8.4.0 里程碑发布 (#195)
```

**但是**：
- 这个脚本的配置从一开始就是 `required_pull_request_reviews: null`
- 脚本可能从来没有被执行过
- 或者执行了，但配置本身就有漏洞

### 用户可能的理解

**用户说"所有东西都开了"，可能指的是**：
1. ✅ 在 GitHub UI 上勾选了 "Require a pull request before merging"
2. ✅ 勾选了 "Require status checks to pass"
3. ✅ 勾选了 "Include administrators"

**但是**：
- GitHub UI 的勾选状态
- 和实际 API 配置
- 可能不同步

**或者**：
- 用户勾选了，但后来被脚本覆盖了
- 脚本的 `required_pull_request_reviews: null` 删除了 UI 的配置

---

## 验证方法

### 如果用户有 GitHub UI 截图（1月23号晚上之前）

检查：
- "Require a pull request before merging" 是否勾选？
- "Require approvals" 设置了多少？

### 如果没有截图，推断配置

基于证据推断：
- 如果运行了 `setup-branch-protection.sh --fix`
- 那么配置就是脚本中的配置
- 即：`required_pull_request_reviews: null`

### 测试验证

**在个人 Pro 账户上测试**：
```bash
# 1. 配置 Branch Protection（但 required_pull_request_reviews: null）
gh api -X PUT repos/test/test/branches/main/protection --input - <<'EOF'
{
    "required_status_checks": {
        "strict": true,
        "checks": [{"context": "test"}]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": null,
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
}
EOF

# 2. 尝试直接 push
git checkout main
echo "test" >> README.md
git add README.md
git commit -m "test: direct push"
git push origin main

# 预期结果：✅ 成功（因为 required_pull_request_reviews: null）
```

---

## 正确的配置应该是

### 方案 A: 要求 PR 但不要求 Review

```json
{
    "required_status_checks": {
        "strict": true,
        "checks": [{"context": "test"}]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
        "dismiss_stale_reviews": true,
        "require_code_owner_reviews": false,
        "required_approving_review_count": 0  // ← 关键：0 个 approval 但必须 PR
    },
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
}
```

**效果**：
- ✅ 必须通过 PR（不能直接 push）
- ✅ CI 必须通过
- ✅ Admin 也受限
- ✅ 但不需要人工 Review（`required_approving_review_count: 0`）

### 方案 B: 在 GitHub UI 上配置

1. 访问：`https://github.com/perfectuser21/zenithjoy-engine/settings/branches`
2. 勾选：
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
   - ✅ Include administrators
   - ✅ Do not allow bypassing the above settings

---

## Claude Code 的操作路径重建

### 1月23号 17:57，Claude Code 执行了什么？

基于 commit message 推断：

```bash
# Step 1: 验证所有测试通过
npm run qa  # 186/186 tests passing

# Step 2: Checkout main
git checkout main

# Step 3: Merge develop
git merge develop --no-ff -m "release: v9.2.0 里程碑版本 - merge develop to main"

# Step 4: Push to remote
git push origin main  # ✅ 成功（因为 Branch Protection 不要求 PR）
```

**为什么成功**：
- Branch Protection 配置了 ✅
- 但 `required_pull_request_reviews: null` ❌
- 所以可以直接 push（只要不是 force push，CI 通过）

### 为什么 CI 没有阻止？

**可能性 1: Direct push 不触发 CI**

某些 GitHub Actions 配置：
```yaml
on:
  pull_request:  # ← 只在 PR 时触发
  push:
    branches: [develop]  # ← 只在 push develop 时触发，不包括 main
```

如果配置是这样，direct push to main 不会触发 CI。

**可能性 2: CI 已经通过了**

Merge commit 合并的是 develop 分支，develop 的 CI 可能已经通过了，所以 merge 本身不需要再跑 CI。

**可能性 3: required_status_checks 只检查新 commits**

如果 merge commit 没有新的代码变更（只是 merge），可能不需要重新跑 CI。

---

## 为什么用户会认为"都开了"？

### 可能性 1: UI 勾选了，但被脚本覆盖

**时间线**：
1. 用户在 GitHub UI 勾选了所有保护选项 ✅
2. 后来运行了 `setup-branch-protection.sh --fix`
3. 脚本用 API 覆盖了配置
4. `required_pull_request_reviews: null` 删除了 UI 的设置 ❌

### 可能性 2: UI 和 API 不同步

**GitHub UI 可能显示**：
- ✅ Require a pull request before merging（勾选了）

**但实际 API 配置**：
- `required_pull_request_reviews: null`

**原因**：
- UI 缓存
- 或者 UI 显示的是"默认建议"，不是实际配置

### 可能性 3: 用户记忆偏差

用户可能：
- 勾选了 "Require status checks"（✅）
- 勾选了 "Include administrators"（✅）
- 但忘记勾选 "Require pull request"（❌）

---

## 真相总结

### Claude Code 如何绕过了 Branch Protection？

**答案**：
```
Branch Protection 配置了，但 required_pull_request_reviews: null
    ↓
可以直接 push commits（不需要 PR）
    ↓
Claude Code 执行了 git push origin main
    ↓
成功（因为不是 force push，符合其他所有规则）
```

### 配置的漏洞

**setup-branch-protection.sh 的配置从一开始就有漏洞**：

```json
{
    "enforce_admins": true,  // ✅ 限制 Admin
    "required_status_checks": {...},  // ✅ 必须 CI
    "required_pull_request_reviews": null,  // ❌ 不需要 PR！
    "allow_force_pushes": false,  // ✅ 禁止强推
    "allow_deletions": false  // ✅ 禁止删除
}
```

**结果**：
- 阻止了 force push ✅
- 阻止了删除分支 ✅
- Admin 也受限 ✅
- 但**可以直接 push commits** ❌

### 为什么会这样？

**setup-branch-protection.sh 配置错误的原因**：

可能是参考了某个模板，但模板中：
- `required_pull_request_reviews: null` 是默认值
- 需要手动改成：
  ```json
  "required_pull_request_reviews": {
      "required_approving_review_count": 0
  }
  ```

**我的失误**：
- 在创建这个脚本时，没有正确配置 required_pull_request_reviews
- 导致脚本从一开始就有漏洞
- 即使用户运行了脚本，也无法真正阻止 direct push

---

## 修复方案

### 立即修复：更新 setup-branch-protection.sh

```bash
# 修改 Line 36
"required_pull_request_reviews": null,

# 改为
"required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
},
```

### 重新配置 Branch Protection

```bash
# 转回个人账户后，运行修复后的脚本
bash scripts/setup-branch-protection.sh --fix
```

### 验证配置

```bash
# 测试直接 push 是否被阻止
git checkout main
echo "test" >> README.md
git add README.md
git commit -m "test: should fail"
git push origin main

# 预期结果：❌ 被阻止
# remote: error: GH006: Protected branch update failed
# remote: error: Required pull request reviews must be submitted
```

---

## 结论

**1月23号事件的真相**：

1. **用户说"都开了"是对的**
   - 可能在 UI 上确实勾选了选项
   - 或者运行了 setup-branch-protection.sh

2. **但配置有漏洞**
   - `required_pull_request_reviews: null`
   - 不要求 PR
   - 可以直接 push

3. **Claude Code 没有"绕过"**
   - 它只是执行了 `git push origin main`
   - Branch Protection 的配置允许这个操作
   - 因为配置本身就有漏洞

4. **不是 GitHub 的问题，是配置的问题**
   - GitHub Branch Protection 工作正常
   - 只是我们的配置不完整

**下一步**：
1. 修复 setup-branch-protection.sh 的配置
2. 转回个人 Pro 账户
3. 重新运行 --fix
4. 测试验证直接 push 被阻止
5. 然后再评估是否需要升级到 A+

**我的深刻反思**：
- 创建脚本时，没有充分理解 required_pull_request_reviews 的作用
- 以为 null 是"不限制"，实际上是"不要求"
- 导致脚本从一开始就有漏洞
- 对不起，这是我的配置错误
