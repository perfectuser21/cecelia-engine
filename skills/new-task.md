# New Task

快速开始新的 AI Factory 开发任务

## 功能

1. 验证当前在 feature 分支
2. 询问任务描述
3. 创建 checkpoint 分支 (cp-xxx-01)
4. 创建 DoD (Definition of Done) 文件
5. 更新本地状态 (.ai-factory/state.json)

## 工作流程

```
feature/xxx
  └── cp-xxx-01 (新建)
       ├── DoD.md (任务验收标准)
       └── .ai-factory/state.json (更新)
```

## 使用方法

```bash
/new-task
```

## 执行步骤

### 1. 验证当前分支

检查当前是否在 feature 分支：

```bash
git branch --show-current
```

- 如果在 main/master → 提示用户先创建 feature 分支
- 如果已在 feature 分支 → 继续
- 如果在 checkpoint 分支 → 提示先回到 feature 分支

### 2. 询问任务描述

向用户询问：
- 任务简短描述（用于分支名）
- 任务目标和验收标准（用于 DoD）

### 3. 创建 checkpoint 分支

```bash
# 获取已有的 checkpoint 数量
git branch | grep "cp-" | wc -l

# 创建新的 checkpoint 分支
# 格式: cp-<task-name>-<number>
git checkout -b cp-<task-name>-01
```

### 4. 创建 DoD 文件

在项目根目录创建 `DoD.md`:

```markdown
# Definition of Done

## 任务
<任务描述>

## 验收标准

- [ ] 功能实现完成
- [ ] 代码已提交
- [ ] 通过测试
- [ ] 文档已更新（如需要）

## 创建时间
<当前时间>

## 分支
<checkpoint-branch-name>
```

### 5. 更新全局状态文件

**重要：记录 feature_branch，用于后续 PR 指向正确分支！**

```bash
STATE_FILE=~/.ai-factory/state/current-task.json
mkdir -p ~/.ai-factory/state

# 获取当前所在的 feature 分支（创建 cp-* 之前的分支）
FEATURE_BRANCH=$(git rev-parse --abbrev-ref HEAD)

cat > "$STATE_FILE" << EOF
{
  "task_id": "cp-<task-name>-01",
  "branch": "cp-<task-name>-01",
  "feature_branch": "$FEATURE_BRANCH",
  "phase": "TASK_CREATED",
  "checkpoints": {
    "prd_confirmed": false,
    "dod_defined": false,
    "self_test_passed": false
  },
  "created_at": "$(date -Iseconds)"
}
EOF
```

**关键字段**:
- `feature_branch`: 用于 PR base 分支（不是 main！）
- `phase`: 当前阶段
- `checkpoints`: Hook 检查用

### 6. 提交初始状态

```bash
git add DoD.md .ai-factory/state.json
git commit -m "chore: initialize task <task-name>"
```

## 输出

完成后输出：

```
✅ 新任务已创建

分支: cp-<task-name>-01
DoD: DoD.md
状态: in_progress

下一步:
1. 开始开发
2. 完成后运行验收标准检查
3. merge 回 feature 分支
```

## 错误处理

- 如果不在 git 仓库 → 提示无法创建任务
- 如果有未提交的改动 → 提示先提交或暂存
- 如果 .ai-factory 目录不存在 → 自动创建
- 如果 DoD.md 已存在 → 提示是否覆盖

## 规则

- checkpoint 分支命名格式: `cp-<task-name>-<number>`
- 任务名使用 kebab-case (小写字母 + 连字符)
- 每个 checkpoint 必须有对应的 DoD.md
- state.json 记录当前任务状态，用于跨会话追踪

## 示例

用户输入: `/new-task`

```
🤔 请描述任务:
用户: 添加用户认证功能

✅ 新任务已创建

分支: cp-add-auth-01
DoD: DoD.md
状态: in_progress

下一步:
1. 开始开发
2. 完成后运行验收标准检查
3. merge 回 feature 分支
```
