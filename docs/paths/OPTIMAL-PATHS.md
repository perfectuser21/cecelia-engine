---
id: optimal-paths
version: 2.0.0
created: 2026-01-24
updated: 2026-01-24
source: features/feature-registry.yml
generation: auto-generated (scripts/generate-path-views.sh)
changelog:
  - 2.0.0: 从 feature-registry.yml 自动生成
---

# Optimal Paths - 推荐体验路径

**来源**: `features/feature-registry.yml` (单一事实源)
**用途**: 每个 feature 的"推荐体验路径"（优化后的流程）
**生成**: 自动生成，不要手动编辑

---

## Platform Core 5 - 平台基础设施

### H1: Branch Protection

```
检测当前分支 → main/develop → exit 2 (阻止) | cp-*/feature/* → exit 0 (放行)
```

---

### H7: Stop Hook Quality Gate

```
StopHook 触发 → 阶段检测 (detect-phase.sh) → p0: 检查质检+PR | p1: 检查CI | p2: exit 0
```

---

### H2: PR Gate (Dual Mode)

```
检测命令 (gh pr create) → 判断模式 (PR/Release) → 检查产物 → 通过/阻止
```

---

### W1: Two-Phase Dev Workflow

```
完整的 Golden Path（11 步）：
1. PRD 确定
2. 环境检测
3. 分支创建 (cp-MMDDTTTT-xxx)
4. DoD 定稿 (含 QA Decision Node)
5. 写代码
6. 写测试
7. 质检循环 (Audit + L1, Stop Hook 强制)
8. 提交 PR (p0 结束)
9. CI 修复 (p1 事件驱动)
10. Learning
11. Cleanup
```

---

### N1: Cecelia Headless Mode

```
n8n 触发 → cecelia-run → PHASE_OVERRIDE (可选) → claude -p "/dev ..." →
执行流程 → 输出 JSON → cecelia-api 更新 Core + 同步 Notion
```

---

## Product Core 5 - 引擎核心能力

### P1: Regression Testing Framework

```
定义 RCI (regression-contract.yaml) → rc-filter.sh 过滤 →
run-regression.sh 执行 → 验证契约不被破坏
```

---

### P2: DevGate

```
CI test job → DevGate checks → 三个检查全部通过 → CI 继续
```

---

### P3: Quality Reporting

```
执行脚本 → 扫描 repo 结构 → 生成 JSON/TXT 报告 → 供 Dashboard/Cecelia 使用
```

---

### P4: CI Quality Gates

```
PR 创建 → CI 触发 → version-check + test + DevGate → 全部通过 → ci-passed
```

---

### P5: Worktree Parallel Development

```
/dev 启动 → 检测活跃分支 → 提示用户选择 (继续/worktree/新分支) →
创建 worktree (可选) → 开发 → cleanup 清理 worktree
```

---

## 更新规则

**本文件自动生成，不要手动编辑**。

所有变更必须：
1. 先更新 `features/feature-registry.yml`
2. 运行: `bash scripts/generate-path-views.sh`
3. 提交生成的视图文件

---

**来源**: features/feature-registry.yml
**版本**: 2.0.0
**生成时间**: 2026-01-24
