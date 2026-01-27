# Step 7: 质检

> Audit Node 做代码审计，然后跑测试
> **Stop Hook 强制执行：p0 阶段必须完成质检才能创建 PR**

---

## 质检分层定义

| 层级 | 名称 | 内容 | 何时跑 |
|------|------|------|--------|
| **L1** | 自动化测试 | npm run qa (typecheck + test + build) | PR + Release |
| **L2A** | 代码审计 | Audit Node → AUDIT-REPORT.md | PR + Release |
| **L2B** | Evidence 证据 | .layer2-evidence.md (截图/curl) | Release only |
| **L3** | Acceptance 验收 | DoD 全勾 + Evidence 引用 | Release only |
| **L4** | 过度优化 | 识别但不修 | 审计时标记 |

---

## 双模式质检

| 模式 | 检查内容 | 适用场景 |
|------|----------|----------|
| **PR** (默认) | L1 + L2A | 日常 PR → develop |
| **Release** | L1 + L2A + L2B + L3 | 发版 develop → main |

---

## 流程

```
写完代码 → Audit Node (L2A) → 审计报告 → blocker=0? → npm run qa (L1)
                                              ↓
                                        blocker>0 → 停止，修复
```

---

## Step 7.1: Audit Node (L2A)（必须）

**在跑测试前，必须输出审计报告**。

### 规范来源

参考 `skills/audit/SKILL.md` 中的规则：
- L1 阻塞性（必须修）
- L2 功能性（建议修）
- L3 最佳实践（可选）
- L4 过度优化（不修）

### 输入

- 本次改动的文件
- 目标层级：L2（默认）

### 输出

- `docs/AUDIT-REPORT.md`（必须创建）

### 输出 Schema（固定格式）

```yaml
# Audit Report
Branch: cp-xxx
Date: YYYY-MM-DD
Scope: file1, file2, ...
Target Level: L2

Summary:
  L1: 0
  L2: 0
  L3: 0
  L4: 0

Decision: PASS | FAIL

Findings:
  - id: A1-001
    layer: L1 | L2 | L3 | L4
    file: path/to/file
    line: 123
    issue: 问题描述
    fix: 修复建议
    status: fixed | pending

Blockers: []  # L1 + L2 问题列表
```

### ⚡ Audit Node 完成后的强制指令

**生成 AUDIT-REPORT.md 后，立即继续质检循环**：

1. **不要**输出"审计报告已生成！"
2. **不要**停顿或等待确认
3. **立即**继续 Step 7.2：检查 Blocker

---

## Step 7.2: Blocker 检查

**硬规则：blocker > 0 则停止，不允许进入 PR**

```
查看 docs/AUDIT-REPORT.md:

Decision: PASS   → 继续 Step 7.3
Decision: FAIL   → 停止，修复 L1/L2 问题后重新审计
```

---

## Step 7.3: 跑测试 (L1)

blocker 清零后，跑自动化测试：

```bash
npm run qa  # = typecheck + test + build
```

---

## Step 7.4: 自动化检查（新增）

测试通过后，运行自动化检查：

```bash
# 检查派生视图是否同步
bash scripts/auto-generate-views.sh

# 暂存 evidence（不 commit，留到 Step 8）
git add .quality-evidence.json .quality-gate-passed .history/
```

**说明**：
- `auto-generate-views.sh` 检测 `feature-registry.yml` 变更并自动生成派生视图
- Evidence 暂存但不 commit，避免 SHA 不匹配问题
- Step 8 会一次性提交（代码 + evidence）

---

## PR 模式检查项 (L1 + L2A)

- [ ] `npm run typecheck` 通过 (L1)
- [ ] `npm run test` 通过 (L1)
- [ ] `npm run build` 通过 (L1)
- [ ] `.prd.md` 存在且内容有效
- [ ] `.dod.md` 存在且有验收清单
- [ ] `.dod.md` 包含 `QA:` 引用
- [ ] `docs/QA-DECISION.md` 存在
- [ ] `docs/AUDIT-REPORT.md` 存在且 `Decision: PASS` (L2A)

---

## Release 模式检查项 (L1 + L2A + L2B + L3)

PR 模式检查项 + 以下内容：

- [ ] `.layer2-evidence.md` 存在 (L2B)
- [ ] 截图 ID 对应文件存在 (L2B)
- [ ] `.dod.md` 所有 checkbox 打勾 (L3)
- [ ] DoD 每项有 Evidence 引用 (L3)

---

## Gate 检查

**Stop Hook 执行检查（p0 阶段）**：
1. `docs/AUDIT-REPORT.md` 存在 (L2A)
2. 包含 `Decision: PASS`（FAIL 则 Stop Hook 阻止会话结束，exit 2）
3. `npm run qa` 通过（L1）
4. `.quality-gate-passed` 文件存在（测试通过标记）

**PR Gate 检查（提交 PR 时）**：
- 验证所有产物存在（PRD/DoD/QA-DECISION/AUDIT-REPORT）
- 支持双模式：PR 模式（L1+L2A）/ Release 模式（L1+L2A+L2B+L3）

Release Check 额外检查：
1. `.layer2-evidence.md` 存在且格式正确 (L2B)
2. `.dod.md` 全勾且有 Evidence 引用 (L3)

---

## 结果处理

| 结果 | 动作 |
|------|------|
| Audit → FAIL | 修复 blocker，重新审计 |
| Audit → PASS, npm run qa 失败 | 修复代码，重跑 |
| Audit → PASS, npm run qa 通过 | 继续 Step 8 (PR) |

---

## 质检原则

1. **先审计后测试** - L2A 是 L1 的前置
2. **blocker 是硬门禁** - L1/L2 > 0 不能继续
3. **分层检查** - PR 跑 L1+L2A，Release 加 L2B+L3
4. **L4 不修** - 过度优化只标记不修复
5. **产物留痕** - 审计报告必须存在

---

## 完成后

**立即执行下一步**：

1. 读取 `skills/dev/steps/08-pr.md`
2. 立即创建 PR
3. **不要**输出总结或等待确认
4. **不要**停顿

---

**Step 8：创建 PR**
