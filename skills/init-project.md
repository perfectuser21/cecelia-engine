# /init-project

初始化新项目的完整开发环境。

## 执行步骤

1. 检测当前目录状态
2. 初始化 Git 仓库（如果未初始化）
3. 创建 GitHub 远程仓库
4. 创建分支结构（main + feature）
5. 复制 CI/CD workflow 模板
6. 创建项目 CLAUDE.md 文档
7. 初始提交并推送到远程

## 实现

### 1. 检测当前目录

检查：
- 是否已有 .git 目录
- 是否已关联远程仓库
- 是否已有 CLAUDE.md

```bash
pwd
ls -la | grep -E "^d.*\.git$"
git remote -v 2>/dev/null || echo "No git repo"
test -f CLAUDE.md && echo "CLAUDE.md exists" || echo "CLAUDE.md not found"
```

### 2. 初始化 Git（如果需要）

```bash
git init
```

### 3. 创建 GitHub 仓库

询问用户：
```
请提供 GitHub 仓库名称（例如：my-new-project）：
```

使用 gh CLI 创建：
```bash
gh repo create <repo-name> --private --source=. --remote=origin
```

### 4. 创建分支结构

根据全局规则，创建规范的分支命名：

```bash
# 确保在 main 分支
git checkout -b main 2>/dev/null || git checkout main

# 创建默认 feature 分支（产品线/功能线）
REPO_NAME=$(basename $(pwd))
git checkout -b ${REPO_NAME}/main

# 回到 main
git checkout main
```

### 5. 复制 CI/CD workflow 模板

创建 .github/workflows 目录并复制模板：

```bash
mkdir -p .github/workflows

# 如果存在通用模板，复制过来
if [ -f ~/.claude/templates/workflow-template.yml ]; then
    cp ~/.claude/templates/workflow-template.yml .github/workflows/ci.yml
fi
```

通用 workflow 模板内容（如果不存在则创建）：

```yaml
name: CI

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci || npm install

      - name: Run tests
        run: npm test || echo "No tests configured"

      - name: Build
        run: npm run build || echo "No build script configured"
```

### 6. 创建项目 CLAUDE.md

基础模板内容：

```markdown
# 项目开发规则

## 项目信息

- **项目名称**: <REPO_NAME>
- **创建时间**: <DATE>
- **开发环境**: VPS (146.190.52.84)

## 分支策略

主分支：
- `main` - 生产环境代码

功能分支：
- `<REPO_NAME>/main` - 主功能线
- `<REPO_NAME>/<feature>/task` - 具体任务分支

## 开发流程

1. 从功能分支创建任务分支
2. 完成开发后提交到任务分支
3. 创建 PR 合并到功能分支
4. 功能分支测试通过后合并到 main

## 依赖说明

（根据项目实际情况填写）

## 部署说明

（根据项目实际情况填写）
```

### 7. 初始提交并推送

```bash
# 添加所有文件
git add .

# 初始提交
git commit -m "$(cat <<'EOF'
Initial commit: project setup

- Initialize Git repository
- Add GitHub remote
- Setup branch structure
- Add CI/CD workflow
- Add project CLAUDE.md

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

# 推送到远程
git push -u origin main

# 推送 feature 分支
REPO_NAME=$(basename $(pwd))
git checkout ${REPO_NAME}/main
git push -u origin ${REPO_NAME}/main
git checkout main
```

## 执行流程

当用户调用 `/init-project` 时：

1. **显示当前状态**
   ```
   正在检测当前目录：/path/to/project
   - Git 状态: [已初始化/未初始化]
   - 远程仓库: [已配置/未配置]
   - CLAUDE.md: [存在/不存在]
   ```

2. **询问确认**
   ```
   将要执行以下操作：
   - 初始化 Git 仓库
   - 创建 GitHub 仓库
   - 设置分支结构
   - 添加 CI/CD workflow
   - 创建 CLAUDE.md

   请提供 GitHub 仓库名称：
   ```

3. **执行初始化**
   - 逐步执行上述步骤
   - 每步显示进度和结果

4. **完成总结**
   ```
   ✅ 项目初始化完成

   - GitHub 仓库: https://github.com/username/repo-name
   - 主分支: main
   - 功能分支: repo-name/main
   - CI/CD: .github/workflows/ci.yml
   - 项目文档: CLAUDE.md

   下一步：
   1. 开始开发功能时使用：git checkout repo-name/main
   2. 创建任务分支：git checkout -b repo-name/main/add-feature
   ```

## 注意事项

- 如果目录已有 .git，跳过 git init
- 如果已有远程仓库，询问是否覆盖
- 如果 CLAUDE.md 已存在，询问是否覆盖
- 所有危险操作前必须确认
- 确保 gh CLI 已登录：`gh auth status`

## 错误处理

- 如果 gh CLI 未安装或未登录，提示用户配置
- 如果仓库名已存在，询问使用其他名称
- 如果推送失败，提示检查权限和网络

## 依赖

- git
- gh (GitHub CLI)
- bash
