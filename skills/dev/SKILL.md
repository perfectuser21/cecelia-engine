---
name: dev
description: |
  开发工作流。用户说任何开发需求时自动触发。
  自动生成 PRD + DoD，区分新开发/迭代开发，自测通过后才算完成。

  触发条件：
  - 用户说任何开发相关的需求
  - 用户说 /dev
---

# /dev - 开发工作流

## 核心原则

1. **用户说的话 → 我自动生成 PRD + DoD**
2. **新开发 vs 迭代开发自动判断**
3. **我自己测试，DoD 全过才算完成**

---

## Step 0: 检测项目状态

```bash
# 检测 git 和 remote
if [ ! -d .git ]; then
  echo "PROJECT_STATUS=NEW"
elif ! git remote get-url origin >/dev/null 2>&1; then
  echo "PROJECT_STATUS=NEW"
else
  echo "PROJECT_STATUS=EXISTING"
  CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
  echo "BRANCH=$CURRENT_BRANCH"

  # 检测是否在 cp-* 分支
  if [[ $CURRENT_BRANCH != cp-* ]]; then
    # 检测是否在 feature 分支
    if [[ $CURRENT_BRANCH == feature/* ]]; then
      echo "ON_FEATURE_BRANCH=true"
    else
      echo "ON_FEATURE_BRANCH=false"
    fi
  else
    echo "ON_CHECKPOINT_BRANCH=true"
  fi
fi
```

**新项目 (PROJECT_STATUS=NEW)**：
1. 询问项目名称
2. `gh repo create` 创建 GitHub 仓库
3. 配置分支保护
4. 复制 ci.yml 模板
5. 创建 feature 分支

**老项目 (PROJECT_STATUS=EXISTING)**：
1. 检测当前分支
2. 如果在 main → 先创建/切换到 feature 分支
3. 如果在 feature 分支 → 创建 cp-* 分支
4. 如果在 cp-* 分支 → 直接开始

---

## Step 1: 自动生成 PRD + DoD

**不需要用户写 PRD！我根据用户说的话自动生成。**

### 判断开发类型

```
用户说的需求
      ↓
搜索相关代码/文件
      ↓
┌─────┴─────┐
↓           ↓
找到相关代码  没找到
↓           ↓
迭代开发     新开发
```

### 新开发 PRD 模板

```markdown
## PRD - 新功能

**需求来源**: 用户原话
**功能描述**: 我理解后的一句话总结
**涉及文件**: 需要创建的新文件列表
**依赖**: 需要的依赖包/服务

## DoD - 验收标准

### 自动测试（CI 必须全过）
- TEST: <可执行命令，返回 0=通过>
- TEST: <可执行命令>
- TEST: <可执行命令>

### 人工确认
- CHECK: <需要用户确认的点>
```

### 迭代开发 PRD 模板

```markdown
## PRD - 功能迭代

**需求来源**: 用户原话
**现有功能**: 已有的相关代码/文件
**改动描述**: 需要修改/添加什么
**影响范围**: 可能影响的其他模块

## DoD - 验收标准

### 自动测试（CI 必须全过）
- TEST: <原有测试仍通过>
- TEST: <新功能测试>
- TEST: <回归测试>

### 人工确认
- CHECK: <需要用户确认的点>
```

---

## Step 2: 用户确认 PRD + DoD

展示生成的 PRD + DoD，问用户：
- 这个理解对吗？
- DoD 够不够？要加什么？

用户说"可以"、"没问题"、"开始" → 继续

---

## Step 3: 写代码

按 DoD 逐项实现。

---

## Step 4: 自测（关键！）

**写完代码后，我必须自己跑 DoD 里的每个 TEST。**

```bash
echo "=== 开始自测 ==="

# 逐个执行 TEST
for test in "${TESTS[@]}"; do
  echo "运行: $test"
  if eval "$test"; then
    echo "✅ PASS"
  else
    echo "❌ FAIL"
    FAILED=true
  fi
done

if [ "$FAILED" = true ]; then
  echo "❌ 自测未通过，需要修复"
else
  echo "✅ 自测全部通过，可以提交"
fi
```

**自测不过 → 修复 → 重新自测 → 循环直到全过**

---

## Step 5: 完成 (/finish)

只有自测全过才能执行：

```bash
# 提交
git add -A
git commit -m "feat: 功能描述

DoD:
$(for test in "${TESTS[@]}"; do echo "- [x] $test"; done)

Co-Authored-By: Claude <noreply@anthropic.com>"

# 推送
git push -u origin HEAD

# 检测当前分支，确定 PR base 分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# cp-* 分支 → 提取所属的 feature 分支名
if [[ $CURRENT_BRANCH == cp-* ]]; then
  # cp-xxx-01 → feature/xxx
  FEATURE_BRANCH=$(echo "$CURRENT_BRANCH" | sed 's/^cp-\([^-]*\)-.*/feature\/\1/')

  # 检查 feature 分支是否存在
  if ! git show-ref --verify --quiet "refs/heads/$FEATURE_BRANCH"; then
    echo "⚠️  Feature 分支 $FEATURE_BRANCH 不存在，自动创建"
    git checkout -b "$FEATURE_BRANCH" origin/main
    git push -u origin "$FEATURE_BRANCH"
    git checkout "$CURRENT_BRANCH"
  fi

  BASE_BRANCH="$FEATURE_BRANCH"
else
  # 非 cp-* 分支，默认 PR 到 main
  BASE_BRANCH="main"
fi

# 创建 PR
gh pr create \
  --base "$BASE_BRANCH" \
  --title "feat: 功能描述" \
  --body "..."

echo "✅ PR 已创建 (base: $BASE_BRANCH)，等待 CI"
echo "CI 通过后自动合并到 $BASE_BRANCH"
```

---

## 完整流程图

```
用户说需求（任何形式）
         │
         ▼
┌─────────────────────────┐
│ Step 0: 检测项目状态     │
│ 新项目？→ 创建 repo      │
│ 老项目？→ 创建 cp-* 分支 │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Step 1: 自动生成 PRD+DoD │
│ 搜索相关代码             │
│ 判断新开发/迭代          │
│ 生成 TEST 命令           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Step 2: 用户确认         │
│ "这个理解对吗？"         │
└───────────┬─────────────┘
            │ 用户确认
            ▼
┌─────────────────────────┐
│ Step 3: 写代码           │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Step 4: 自测             │←──┐
│ 跑每个 TEST              │   │
│ 失败？→ 修复 ────────────┼───┘
│ 全过？→ 继续             │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Step 5: /finish          │
│ commit → push            │
│ PR → feature 分支        │
│ CI 通过 → 自动合并       │
└─────────────────────────┘
```

## 分支层级

```
main (强保护)
  │
  └── feature/xxx (功能分支)
        │
        ├── cp-xxx-01 → PR → feature/xxx ✅
        ├── cp-xxx-02 → PR → feature/xxx ✅
        └── cp-xxx-03 → PR → feature/xxx ✅
              │
              └── feature 完成 → PR → main
```

---

## 示例

### 示例 1: 新开发

**用户说**: "给项目加个 README"

**我自动生成**:

```markdown
## PRD - 新功能

**需求来源**: 给项目加个 README
**功能描述**: 创建 README.md，说明项目用途、安装、使用方法
**涉及文件**: README.md (新建)

## DoD

### 自动测试
- TEST: test -f README.md
- TEST: grep -q "zenithjoy-core" README.md
- TEST: grep -q "安装\|install\|Installation" README.md
- TEST: grep -q "使用\|usage\|Usage" README.md

### 人工确认
- CHECK: 内容准确、格式清晰
```

### 示例 2: 迭代开发

**用户说**: "README 里加上 CI 的说明"

**我自动生成**:

```markdown
## PRD - 功能迭代

**需求来源**: README 里加上 CI 的说明
**现有功能**: README.md 已存在
**改动描述**: 添加 CI/CD 使用说明章节
**影响范围**: 只影响 README.md

## DoD

### 自动测试
- TEST: test -f README.md（原文件仍存在）
- TEST: grep -q "CI" README.md（新增 CI 内容）
- TEST: grep -q "workflow\|GitHub Actions" README.md

### 人工确认
- CHECK: CI 说明准确、步骤清晰
```

---

## 自测失败处理

如果自测失败：

```
❌ TEST 失败: grep -q "CI" README.md

分析原因:
- README.md 里没有 "CI" 这个词

修复:
- 在 README.md 中添加 CI 章节

重新自测...
✅ PASS
```

**循环直到全过，不能跳过。**
