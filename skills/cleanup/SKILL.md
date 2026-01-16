---
name: cleanup
description: |
  清理已合并的分支和临时文件。

  触发条件：
  - 用户说 "/cleanup"
  - 用户说 "清理一下"、"清理分支"、"清理临时文件"

  功能：
  1. 清理已合并的 cp-* checkpoint 分支（本地和远程）
  2. 清理临时文件和目录
  3. 显示详细的清理报告
---

# /cleanup - 清理已合并分支和临时文件

## 执行流程

### 第一步：检查当前状态

1. 检查当前分支：
   ```bash
   git branch --show-current
   ```

2. 如果在 cp-* 分支上，警告用户并退出：
   ```
   ⚠️ 你当前在 checkpoint 分支 [分支名]
   请先切换到主分支再执行清理：
   git checkout main
   ```

### 第二步：清理已合并的本地分支

1. 列出所有已合并的 cp-* 分支：
   ```bash
   git branch --merged | grep "^\s*cp-"
   ```

2. 如果有已合并的分支，显示列表并确认：
   ```
   发现以下已合并的 checkpoint 分支：
   - cp-20260115-2345-add-search
   - cp-20260114-1830-fix-bug

   是否删除这些分支？(y/N)
   ```

3. 用户确认后删除：
   ```bash
   git branch --merged | grep "^\s*cp-" | xargs -r git branch -d
   ```

### 第三步：清理远程分支

1. 更新远程分支状态：
   ```bash
   git fetch --prune
   ```

2. 列出远程已删除但本地还有引用的分支：
   ```bash
   git branch -r --merged | grep "origin/cp-"
   ```

3. 如果有远程 cp-* 分支，询问是否删除：
   ```
   发现以下远程 checkpoint 分支：
   - origin/cp-20260115-2345-add-search

   是否从远程删除？(y/N)
   ```

4. 用户确认后删除：
   ```bash
   git push origin --delete cp-20260115-2345-add-search
   ```

### 第四步：清理临时文件

清理以下类型的临时文件：

1. **系统临时文件**：
   ```bash
   find . -name ".DS_Store" -delete
   find . -name "Thumbs.db" -delete
   ```

2. **编辑器临时文件**：
   ```bash
   find . -name "*~" -delete
   find . -name "*.swp" -delete
   find . -name "*.swo" -delete
   ```

3. **日志文件**（询问用户）：
   ```bash
   find . -name "*.log" -type f
   ```

4. **备份文件**：
   ```bash
   find . -name "*.bak" -delete
   find . -name "*Backup.*" -delete
   find . -name "*Old.*" -delete
   find . -name "*New.*" -delete
   ```

5. **临时脚本目录**（如果存在 .archive/）：
   - 显示 .archive/ 的大小
   - 询问是否清空（保留目录）

### 第五步：清理状态文件（可选）

如果存在 `~/.ai-factory/state/` 目录：

1. 检查是否有完成的任务状态文件：
   ```bash
   ls ~/.ai-factory/state/*.completed.json 2>/dev/null
   ```

2. 询问是否删除已完成任务的状态文件

### 第六步：显示清理报告

```
✅ 清理完成

📊 清理统计：
━━━━━━━━━━━━━━━━━━━━━━━━━━
本地分支：
  - 已删除: 3 个
  - 保留: 1 个（未合并）

远程分支：
  - 已删除: 2 个
  - 已修剪: 5 个引用

临时文件：
  - .DS_Store: 12 个
  - 编辑器临时文件: 3 个
  - 备份文件: 0 个
  - 日志文件: 5 个 (跳过)

状态文件：
  - 已完成任务: 2 个 (已删除)

💾 节省空间: 约 2.3 MB
━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## 选项参数

支持以下可选参数：

- `--dry-run`: 只显示将要清理的内容，不实际删除
- `--force`: 跳过所有确认，自动清理
- `--branches-only`: 只清理分支
- `--files-only`: 只清理临时文件

## 安全检查

执行清理前必须检查：

1. ❌ 不能在 cp-* 分支上执行清理
2. ❌ 不能删除未合并的分支（除非 --force）
3. ❌ 不能删除 .git 目录下的任何内容
4. ✅ 删除远程分支前必须确认

## 错误处理

| 错误情况 | 处理方式 |
|---------|---------|
| 当前在 cp-* 分支 | 提示切换分支，退出 |
| 没有权限删除远程分支 | 显示错误，继续清理其他项 |
| git fetch 失败 | 提示检查网络，跳过远程清理 |
| 未合并的分支 | 显示警告，跳过不删除 |

## 示例执行

### 正常清理
```bash
/cleanup
```

### 预览模式
```bash
/cleanup --dry-run
```

### 强制清理（谨慎使用）
```bash
/cleanup --force
```

### 只清理分支
```bash
/cleanup --branches-only
```

## 注意事项

1. **清理前确保重要改动已推送**
2. **--force 模式会跳过所有确认，谨慎使用**
3. **未合并的分支不会被删除**
4. **当前分支永远不会被删除**
5. **只清理 cp-* 格式的 checkpoint 分支**
