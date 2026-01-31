# QA Decision: Stop Hook 会话隔离

Decision: PASS
Priority: P0
RepoType: Engine

## 变更范围

| 文件 | 类型 | 影响 |
|------|------|------|
| hooks/stop.sh | Hook | 添加分支匹配检查 |

## 分析

### 问题描述
- 多个 Claude 会话在同一项目工作时发生"串线"
- 一个会话创建的 `.dev-mode` 被另一个会话的 Stop Hook 检测到
- 导致一个会话被迫接手另一个会话的任务

### 修复方案
- 读取 `.dev-mode` 中的 `branch:` 字段
- 与当前分支比较
- 不匹配则 exit 0（不属于当前会话的任务）

## Tests

| DoD Item | Method | Location |
|----------|--------|----------|
| 分支匹配检查 | manual:stop-hook-isolation | hooks/stop.sh |

RCI:
  new: []
  update: []

Reason: Hook 逻辑修复，不影响 RCI 覆盖范围。
