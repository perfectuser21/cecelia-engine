# Ralph Loop 迭代追踪机制

**版本**: 10.1.0
**状态**: Stable
**适用范围**: 所有使用 `/ralph-loop` 的开发任务

---

## 概述

Ralph Loop 迭代追踪机制自动记录 `/ralph-loop` 插件的迭代过程，包括：
- 总迭代次数
- 每次迭代的失败原因
- 最终成功或失败的统计

## 什么是 Ralph Loop?

`/ralph-loop` 是 Claude Code 的官方插件，用于自动循环执行任务直到完成：
- 当 Stop Hook 返回 `exit 2` 时，ralph-loop 会重新注入相同的提示语
- 当检测到 `completion-promise` 或达到 `max-iterations` 时结束

详细说明参考：`docs/.archive/COMPLETE-WORKFLOW-WITH-RALPH.md`

---

## 功能特性

### 自动追踪

- ✅ **无需手动操作**：Stop Hook 自动记录每次迭代
- ✅ **失败原因记录**：精确记录在哪一步失败（Step 7.1/7.2/7.3/8/9）
- ✅ **时间戳记录**：每次迭代的时间戳
- ✅ **成功率统计**：自动计算成功/失败比例

### 多维度展示

- 📊 **Stop Hook 输出**：实时显示当前迭代编号
- 📊 **最终报告**：会话结束时生成完整报告
- 📊 **CI Summary**：GitHub Actions 显示迭代统计
- 📊 **归档文件**：完整追踪数据保存到 `.archive/ralph-loops/`

---

## 使用方式

### 基础用法

使用 `/ralph-loop` 时，追踪会自动启用：

```bash
/ralph-loop "实现功能 X。
步骤:
1. 写代码
2. 调用 /audit（必须 Decision: PASS）
3. 运行 npm run qa:gate（必须通过）
4. 完成时输出 <promise>COMPLETE</promise>" \
  --max-iterations 20 \
  --completion-promise "COMPLETE"
```

**无需任何额外配置**，追踪会自动开始。

### Stop Hook 输出

每次 Stop Hook 被触发时，会显示当前迭代信息：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  [Stop Hook: Step 7 质检门控]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  分支: cp-01241234-ralph-tracker
  📊 Ralph Loop 迭代: #2

  ❌ Step 7.2: Audit 未通过！

  当前 Decision: FAIL

  之前迭代历史:
    Iteration 1: 阻止在 Step 7.3 (测试失败)
    Iteration 2: 阻止在 Step 7.2 (Audit Decision: FAIL)  ← 当前
```

### 最终报告

当 ralph-loop 完成后（exit 0），Stop Hook 会生成完整报告：

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📊 Ralph Loop 完成报告
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

任务: zenithjoy-engine
分支: cp-01241234-ralph-tracker
总迭代: 4 次
总耗时: 15 分钟

迭代历史:
  Iteration 1 (10:05): ❌ 阻止在 Step 7.2
    → 原因: Audit Decision: FAIL

  Iteration 2 (10:10): ❌ 阻止在 Step 7.3
    → 原因: Quality gate failed

  Iteration 3 (10:15): ❌ 阻止在 Step 8
    → 原因: PR not created yet

  Iteration 4 (10:20): ✅ 成功
    → PR #259 已创建，p0 阶段完成

成功率: 1/4 (25%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### CI 集成

在 GitHub Actions 的 Summary 中查看迭代统计：

1. 打开 PR 的 Actions 页面
2. 查看 "Test" job 的 Summary 标签页
3. 找到 "📊 Ralph Loop 统计" 部分

示例输出：

```markdown
## 📊 Ralph Loop 统计

**项目**: zenithjoy-engine
**分支**: cp-01241234-ralph-tracker
**总迭代次数**: 4

### 迭代历史

- **Iteration 1** (10:05:23): ❌ 阻止在 **Step 7.2** - Audit Decision: FAIL
- **Iteration 2** (10:10:15): ❌ 阻止在 **Step 7.3** - Quality gate failed
- **Iteration 3** (10:15:42): ❌ 阻止在 **Step 8** - PR not created yet
- **Iteration 4** (10:20:18): ✅ success - PR created (#259), p0 phase completed

---

完整追踪数据已归档到 `.archive/ralph-loops/`
```

---

## 追踪数据格式

### `.ralph-loop-tracking.json`

存储在项目根目录，实时更新：

```json
{
  "project": "zenithjoy-engine",
  "branch": "cp-01241234-ralph-tracker",
  "start_time": "2026-01-24T10:00:00Z",
  "iterations": [
    {
      "iteration": 1,
      "timestamp": "2026-01-24T10:05:00Z",
      "phase": "p0",
      "result": "blocked",
      "blocked_at": "Step 7.2",
      "reason": "Audit Decision: FAIL (L1/L2 issues found)"
    },
    {
      "iteration": 2,
      "timestamp": "2026-01-24T10:10:00Z",
      "phase": "p0",
      "result": "blocked",
      "blocked_at": "Step 7.3",
      "reason": "Quality gate failed (tests not passing)"
    },
    {
      "iteration": 3,
      "timestamp": "2026-01-24T10:15:00Z",
      "phase": "p0",
      "result": "blocked",
      "blocked_at": "Step 8",
      "reason": "PR not created yet"
    },
    {
      "iteration": 4,
      "timestamp": "2026-01-24T10:20:00Z",
      "phase": "p0",
      "result": "success",
      "message": "PR created (#259), p0 phase completed"
    }
  ],
  "total_iterations": 4,
  "final_status": "in_progress"
}
```

### 归档文件

会话结束后，追踪文件会被归档到：

```
.archive/ralph-loops/cp-01241234-ralph-tracker-20260124-102018.json
```

文件名格式：`{branch}-{timestamp}.json`

---

## 手动工具

### ralph-tracker.sh

虽然追踪是自动的，但你也可以手动使用这个工具：

```bash
# 初始化追踪文件
bash scripts/ralph-tracker.sh init

# 记录一次迭代（blocked）
bash scripts/ralph-tracker.sh record \
  --iteration 1 \
  --phase p0 \
  --result blocked \
  --blocked-at "Step 7.2" \
  --reason "Audit fail"

# 记录一次迭代（success）
bash scripts/ralph-tracker.sh record \
  --iteration 2 \
  --phase p0 \
  --result success \
  --message "All quality checks passed"

# 生成报告
bash scripts/ralph-tracker.sh report

# 显示简短历史（用于 Stop Hook）
bash scripts/ralph-tracker.sh history

# 归档追踪文件
bash scripts/ralph-tracker.sh archive
```

---

## 常见问题

### Q: 追踪文件会占用很多空间吗？

A: 不会。每个追踪文件通常 < 5KB，归档文件会在 `.archive/ralph-loops/` 目录中。建议定期清理超过 30 天的归档文件：

```bash
find .archive/ralph-loops/ -name "*.json" -mtime +30 -delete
```

### Q: 如果我不使用 /ralph-loop，会有追踪吗？

A: 不会。追踪只在检测到追踪文件存在时才启用。普通会话不会创建追踪文件。

### Q: 追踪失败会影响 Stop Hook 吗？

A: 不会。所有追踪调用都使用 `|| true` 容错，失败不影响 Stop Hook 的主要检查逻辑。

### Q: 可以在 CI 中查看追踪吗？

A: 可以。CI 的 "Display Ralph Loop Metrics" 步骤会在 GitHub Actions Summary 中显示完整的迭代统计。

---

## 实现细节

### 追踪点

| 触发点 | 记录内容 | 文件位置 |
|--------|----------|----------|
| Stop Hook exit 2 (Step 7.1) | Audit 报告缺失 | hooks/stop.sh:~120 |
| Stop Hook exit 2 (Step 7.2) | Audit Decision 不是 PASS | hooks/stop.sh:~145 |
| Stop Hook exit 2 (Step 7.3) | 质检未通过 | hooks/stop.sh:~170 |
| Stop Hook exit 2 (Step 7.3) | 时效性检查失败 | hooks/stop.sh:~280 |
| Stop Hook exit 2 (Step 8) | PR 未创建 | hooks/stop.sh:~320 |
| Stop Hook exit 2 (Step 9) | CI 失败 | hooks/stop.sh:~390 |
| Stop Hook exit 0 (p0) | PR 创建成功 | hooks/stop.sh:~350 |
| Stop Hook exit 0 (p1) | CI 通过 | hooks/stop.sh:~430 |

### 容错机制

所有追踪调用都使用容错：

```bash
bash "$PROJECT_ROOT/scripts/ralph-tracker.sh" record ... 2>/dev/null || true
```

确保即使追踪失败，也不会影响 Stop Hook 的主要功能。

---

## 更新日志

### v10.1.0 (2026-01-24)

- ✨ 初始发布
- ✅ Stop Hook 自动追踪
- ✅ CI Summary 集成
- ✅ 最终报告生成
- ✅ 归档功能

---

## 参考

- Ralph Loop 详细说明：`docs/.archive/COMPLETE-WORKFLOW-WITH-RALPH.md`
- Stop Hook 实现：`hooks/stop.sh`
- CI 配置：`.github/workflows/ci.yml`
- 追踪工具：`scripts/ralph-tracker.sh`
