# zenithjoy-core

AI 开发工作流核心组件。提供 Hooks、Skills 和 CI 模板，实现强制的开发流程保护。

## 功能

- **分支保护 Hook**: 强制在 `cp-*` 分支开发
- **CI 自动合并**: PR 通过 CI 后自动合并
- **统一开发 Skill**: `/dev` 一个对话完成整个开发流程

## Installation

### 1. 链接 Hooks

```bash
ln -sf /path/to/zenithjoy-core/hooks/branch-protect.sh ~/.claude/hooks/
ln -sf /path/to/zenithjoy-core/hooks/project-detect.sh ~/.claude/hooks/
```

### 2. 链接 Skills

```bash
ln -sf /path/to/zenithjoy-core/skills/dev ~/.claude/skills/
```

### 3. 复制 CI 模板

```bash
cp /path/to/zenithjoy-core/.github/workflows/ci.yml your-project/.github/workflows/
```

## Hooks 配置

在 `~/.claude/settings.json` 中配置：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{"type": "command", "command": "~/.claude/hooks/branch-protect.sh"}]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{"type": "command", "command": "~/.claude/hooks/project-detect.sh"}]
      }
    ]
  }
}
```

| Hook | 触发时机 | 用途 |
|------|----------|------|
| branch-protect.sh | PreToolUse (Write/Edit) | 强制在 cp-* 分支写代码 |
| project-detect.sh | PostToolUse (Bash) | 检测项目初始化状态 |

## Usage

### 开发流程

```
/dev 开始
  → 检查分支 (git)
  → 创建 cp-* 分支
  → PRD + DoD → 用户确认
  → 写代码 + 自测
  → PR + 等待 CI
  → cleanup + learn
  → 完成
```

### 命令

| 命令 | 说明 |
|------|------|
| `/dev` | 启动开发流程（唯一入口） |

## 分支保护

GitHub 层面的强制保护：
- main 禁止直接 push
- PR 必须过 CI
- CI 通过后自动合并

## License

MIT
