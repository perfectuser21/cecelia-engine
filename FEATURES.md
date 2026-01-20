---
id: features-registry
version: 1.2.0
created: 2026-01-20
updated: 2026-01-20
changelog:
  - 1.2.0: 删除 project-detect hook（死代码）
  - 1.1.0: 删除冗余 hooks (session-init, stop-gate)
  - 1.0.0: 初始版本 - v8.0 升级时创建
---

# Feature Registry

> 定义"全量回归"的边界：Committed features = 必须保护的能力

---

## 状态说明

| 状态 | 含义 | 回归要求 |
|------|------|----------|
| **Committed** | 已承诺的能力，长期存在 | 必须有自动化测试 |
| **Experiment** | 实验中，可能删除 | 可选测试 |
| **Deprecated** | 已废弃，待删除 | 不需要测试 |

---

## Hooks (核心能力)

| ID | Feature | 状态 | 最小验收 | 说明 |
|----|---------|------|----------|------|
| H1 | branch-protect | **Committed** | `tests/hooks/branch-protect.test.ts` | 分支保护 + 步骤状态机 |
| H2 | pr-gate-v2 | **Committed** | `tests/hooks/pr-gate.test.ts` | PR 前质检（L1 + 双模式） |
| ~~H3~~ | ~~project-detect~~ | **Deprecated** | - | v8.0.2 删除，死代码（检测结果无人使用） |
| ~~H4~~ | ~~session-init~~ | **Deprecated** | - | v8.0.1 删除，只显示一次无实际用途 |
| ~~H5~~ | ~~stop-gate~~ | **Deprecated** | - | v8.0.1 删除，功能已合并到 pr-gate-v2 |
| ~~H6~~ | ~~pr-gate~~ | **Deprecated** | - | 被 pr-gate-v2 替代 |
| ~~H7~~ | ~~subagent-quality-gate~~ | **Deprecated** | - | v8.0 删除 |

---

## Workflow (流程能力)

| ID | Feature | 状态 | 最小验收 | 说明 |
|----|---------|------|----------|------|
| W1 | /dev 11 步流程 | **Committed** | 手动验证 | 统一开发入口 |
| W2 | 步骤状态机 | **Committed** | H1 测试覆盖 | git config branch.*.step |
| W3 | 循环回退 | **Committed** | 手动验证 | CI 失败 → step 4 |
| W4 | 测试任务模式 | **Committed** | 手动验证 | [TEST] 前缀检测 |

---

## 业务代码

| ID | Feature | 状态 | 最小验收 | 说明 |
|----|---------|------|----------|------|
| B1 | calculator | **Committed** | `npm test` (80 用例) | 计算器模块示例 |

---

## CI/Release

| ID | Feature | 状态 | 最小验收 | 说明 |
|----|---------|------|----------|------|
| C1 | version-check | **Committed** | CI 运行 | PR 版本号检查 |
| C2 | test job | **Committed** | CI 运行 | L1 全量测试 |
| C3 | shell syntax check | **Committed** | CI 运行 | Shell 脚本语法 |
| C4 | notify-failure | **Committed** | CI 运行 | Notion 失败通知 |

---

## 全量回归定义

```
全量 = 所有 Committed features 的自动化测试

具体命令:
  npm run qa     # 本地 Fast QA
  npm run test   # CI 执行
```

### 全量回归集合

| 类别 | 检查项 | 命令 |
|------|--------|------|
| L1 静态分析 | typecheck | `npm run typecheck` |
| L1 单元测试 | vitest | `npm run test` |
| L1 构建 | tsc | `npm run build` |
| L1 Shell | bash -n | CI 检查 |
| Hooks | 2 个核心 | `npm run test` (tests/hooks/) |

---

## 统计

- **Committed Features**: 9
- **有自动化测试**: 4 (B1 + H1/H2)
- **回归覆盖率**: 44%

**v8.0 目标**: 回归覆盖率 > 60%

---

## 更新规则

1. 新增 Feature → 先 Experiment，有测试后 → Committed
2. 修改 Committed Feature → 必须保证测试通过
3. 删除 Feature → 先标记 Deprecated → 下个大版本删除

---

*全量边界 = 这个文件里 Committed 的一切*
