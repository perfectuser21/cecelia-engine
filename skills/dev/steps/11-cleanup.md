# Step 11: Cleanup

> 生成任务报告 + 清理分支和配置

---

## 任务报告生成

**cleanup 脚本会在清理前自动生成任务报告**：

```
.dev-runs/
├── <task-id>-report.txt   # 给用户看的纯文本报告
└── <task-id>-report.json  # 给 Cecelia 读取的 JSON 报告
```

### TXT 报告内容（重点：三层质检）

```
================================================================================
                          任务完成报告
================================================================================
任务ID:     cp-01191030-task-report
分支:       cp-01191030-task-report -> develop

--------------------------------------------------------------------------------
质检详情 (重点)
--------------------------------------------------------------------------------
Layer 1: 自动化测试    pass
Layer 2: 效果验证      pass
Layer 3: 需求验收      pass
质检结论: pass

--------------------------------------------------------------------------------
CI/CD
--------------------------------------------------------------------------------
PR:         https://github.com/.../pull/123
PR 状态:    已合并
================================================================================
```

### JSON 报告（供 Cecelia 链式任务）

```json
{
  "task_id": "cp-01191030-task-report",
  "quality_report": {
    "L1_automated": "pass",
    "L2_verification": "pass",
    "L3_acceptance": "pass",
    "overall": "pass"
  },
  "ci_cd": {
    "pr_url": "https://github.com/.../pull/123",
    "pr_merged": true
  },
  "files_changed": ["src/auth.ts", "src/auth.test.ts"]
}
```

---

## 测试任务的 Cleanup

```bash
IS_TEST=$(git config branch."$BRANCH_NAME".is-test 2>/dev/null)
```

**测试任务需要额外检查**：

| 检查项 | 说明 |
|--------|------|
| CHANGELOG.md | 确认没有测试相关的版本记录 |
| package.json | 确认版本号没有因测试而增加 |
| LEARNINGS.md | 确认只记录了流程经验（如有） |
| 测试代码 | 确认临时测试代码已删除 |

```bash
if [ "$IS_TEST" = "true" ]; then
    echo "🧪 测试任务 Cleanup 检查清单："
    echo "  - [ ] CHANGELOG.md 无测试版本记录"
    echo "  - [ ] package.json 版本号未变"
    echo "  - [ ] 测试代码已删除"
    echo "  - [ ] is-test 标记将被清理"
fi
```

---

## Post-PR Checklist（新增 - 自我进化机制）

**在清理前，运行自动化检查**：

```bash
bash scripts/post-pr-checklist.sh
```

**检查项**：
1. develop/main 无 PRD/DoD 残留
2. 派生视图版本同步
3. 无临时文件残留
4. 所有 commit 已 push

**如果发现问题**：
- Error → 立即修复并提交
- Warning → 记录但不阻塞

**Self-Evolution**：
- 发现的问题记录到 `docs/SELF-EVOLUTION.md`
- 新问题固化为检查项
- 检查项自动化

---

## 使用 cleanup 脚本（推荐）

```bash
bash skills/dev/scripts/cleanup.sh "$BRANCH_NAME" "$BASE_BRANCH"
```

**脚本会**：
1. **运行 Post-PR Checklist**（新增）
2. 切换到 base 分支
3. 拉取最新代码
4. 删除本地 cp-* 分支
5. 删除远程 cp-* 分支
6. 清理 git config
7. 清理 stale remote refs
8. 检查未提交文件
9. 检查其他遗留 cp-* 分支

---

## 手动清理（备用）

```bash
# 清理 git config
git config --unset branch.$BRANCH_NAME.base-branch 2>/dev/null || true
git config --unset branch.$BRANCH_NAME.prd-confirmed 2>/dev/null || true
git config --unset branch.$BRANCH_NAME.is-test 2>/dev/null || true

# 切回 base 分支
git checkout "$BASE_BRANCH"
git pull

# 删除本地分支
git branch -D "$BRANCH_NAME" 2>/dev/null || true

# 删除远程分支
git push origin --delete "$BRANCH_NAME" 2>/dev/null || true

# 清理 stale refs
git remote prune origin 2>/dev/null || true
```

---

## 完成

```bash
echo "🎉 本轮开发完成！"
```
