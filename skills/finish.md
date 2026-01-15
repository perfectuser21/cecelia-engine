# Finish Checkpoint

**触发**: `/finish`

**描述**: 完成当前 checkpoint 的开发，提交代码，推送到 remote，并创建 PR 到 feature 分支

---

## 执行流程

### 1. 验证当前分支

检查是否在 checkpoint 分支 (cp-xxx-01, cp-xxx-02 等):

```bash
git branch --show-current
```

如果不在 cp 分支，报错并退出。

### 2. 验证 DoD 完成

运行 PRD 中的验证命令:

```bash
# 查找当前 feature 的 PRD 文件
# PRD 路径: .prd/{feature-name}/prd.md

# 提取 "## 验收标准" 部分的命令并执行
```

如果验证失败，报错并提示用户修复。

### 3. 提交所有更改

```bash
git add .
git status
git diff --staged

# 生成 commit message (基于改动内容)
git commit -m "$(cat <<'EOF'
{简洁描述本次改动}

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"
```

### 4. 推送到 remote

```bash
git push -u origin $(git branch --show-current)
```

### 5. 创建 PR

提取 feature 分支名 (从 cp-xxx-01 中提取 xxx):

```bash
# 当前分支: cp-xxx-01
# feature 分支: feature/xxx

gh pr create \
  --base feature/{feature-name} \
  --head $(git branch --show-current) \
  --title "Checkpoint: {简洁描述}" \
  --body "$(cat <<'EOF'
## Changes

{列出本次改动的文件和功能点}

## DoD Status

✅ All verification commands passed

## Related

- Feature: feature/{feature-name}
- PRD: .prd/{feature-name}/prd.md

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### 6. 等待 CI 结果

```bash
# 获取 PR 编号
PR_NUMBER=$(gh pr view --json number -q .number)

# 等待 CI 完成 (最多等待 5 分钟)
gh pr checks $PR_NUMBER --watch
```

### 7. 报告结果

#### CI 通过 (绿色)

```
✅ Checkpoint finished successfully!

PR: {PR URL}
CI: All checks passed ✓

You can now merge this PR:
  gh pr merge {PR_NUMBER} --squash --delete-branch

Or continue working on the next checkpoint.
```

#### CI 失败 (红色)

```
❌ CI checks failed

PR: {PR URL}
Failed checks:
  {列出失败的检查项}

Please fix the issues and push again:
  1. Fix the failing tests/lint
  2. git add . && git commit -m "fix: ..."
  3. git push
  4. CI will re-run automatically
```

---

## 错误处理

### 不在 checkpoint 分支

```
❌ Not on a checkpoint branch

Current branch: {branch-name}

Please run this command on a checkpoint branch (cp-xxx-01, cp-xxx-02, etc.)
```

### DoD 验证失败

```
❌ DoD verification failed

Failed command: {command}
Output: {output}

Please fix the issues before finishing this checkpoint.
```

### 无改动

```
❌ No changes to commit

Working tree is clean. Nothing to commit.

If you've already pushed, use:
  gh pr create --base feature/{feature-name} --head $(git branch --show-current)
```

### feature 分支不存在

```
❌ Feature branch not found

Expected: feature/{feature-name}

Please create the feature branch first:
  git checkout -b feature/{feature-name}
  git push -u origin feature/{feature-name}
```

---

## 注意事项

1. **必须在 checkpoint 分支执行**
2. **DoD 必须通过才能提交**
3. **自动推送到 remote**
4. **自动创建 PR (cp → feature)**
5. **等待 CI 结果并报告**
6. **不自动合并 PR** (需要用户确认或运行下一个命令)

---

## 示例

### 正常流程

```bash
# 当前在 cp-auth-01 分支
/finish

# 输出:
✅ Checkpoint finished successfully!

PR: https://github.com/user/repo/pull/123
CI: All checks passed ✓

You can now merge this PR:
  gh pr merge 123 --squash --delete-branch

Or continue working on the next checkpoint.
```

### CI 失败

```bash
/finish

# 输出:
❌ CI checks failed

PR: https://github.com/user/repo/pull/124
Failed checks:
  - test: 2 tests failed
  - lint: 3 errors found

Please fix the issues and push again.
```

---

## 相关命令

- `/start` - 开始新的 checkpoint
- `/verify` - 单独运行 DoD 验证
- `/status` - 查看当前开发状态
