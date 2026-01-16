# ZenithJoy Engine

AI 开发工作流系统 - 把 AI Factory 全局化。

---

## 核心理念

**串行、小任务、强验收**

- 不追求并行
- 不追求流程内自律
- 只追求：CI 绿 = 完成，CI 红 = 继续修

---

## 目录结构

```
zenithjoy-engine/
├── .github/workflows/    # CI 配置
│   └── ci.yml
├── hooks/                # Claude Code Hooks（全局 ~/.claude/hooks/ 符号链接指向这里）
│   ├── branch-protect.sh # 分支保护（PreToolUse: Write/Edit）
│   └── project-detect.sh # 项目初始化检测（PostToolUse: Bash）
├── skills/               # Claude Code Skills
│   └── dev/              # /dev - 统一开发工作流
├── templates/            # 模板文件
├── scripts/              # 工具脚本
└── docs/                 # 文档
```

---

## 唯一入口：/dev

所有开发任务都通过 `/dev` 启动。一个对话完成整个流程：

```
/dev 开始
    │
    ▼
检查当前分支 (git rev-parse --abbrev-ref HEAD)
    │
    ├─ main？→ ❌ 不允许，选择/创建 feature 分支
    │
    ├─ feature/*？→ ✅ 可以开始新任务
    │     │
    │     ├─ 用户想做当前 feature → 创建 cp-* 分支
    │     └─ 用户想做其他 feature → worktree
    │
    └─ cp-*？→ ✅ 继续当前任务
          │
          └─ 从 cp-* 分支名提取 feature 分支
```

---

## 分支流程

```
main (受保护)
  │
  └── feature/xxx (功能分支)
        │
        ├── cp-xxx-01 → PR → feature ✅
        ├── cp-xxx-02 → PR → feature ✅
        └── cp-xxx-03 → PR → feature ✅
              │
              └── feature 完成 → PR → main
```

---

## 核心规则

1. **只在 cp-* 分支写代码** - Hook 会阻止在 main/feature/* 上直接写代码
2. **每个任务 = 一个 cp-* 分支**
3. **一个对话完成整个流程** - 不需要跨对话状态
4. **纯 git 检测** - 不需要状态文件
5. **CI 绿是唯一完成标准**
6. **PR 是唯一验收入口**

---

## Hook 保护

`hooks/branch-protect.sh` 在 Write/Edit 前检查：

- 代码文件（.ts, .tsx, .js, .py 等）
- 重要目录（skills/, hooks/, .github/）

**唯一检查**：必须在 `cp-*` 分支上。

如果不在 cp-* 分支，输出 `[SKILL_REQUIRED: dev]` 并阻止。

---

## 并行开发（Worktree）

如果要同时在多个 feature 上工作：

```bash
# 当前在 zenithjoy-engine，feature/zenith-engine
# 想同时做 feature/cecilia

git worktree add ../zenithjoy-engine-cecilia feature/cecilia
cd ../zenithjoy-engine-cecilia

# 在新目录开始 /dev
```

---

## 知识分层架构

开发过程中的经验和问题应该记在哪里？

```
┌─────────────────────────────────────────────────────────┐
│                 全局层 (~/.claude/CLAUDE.md)            │
│           跨项目通用规则、个人习惯、全局配置             │
└─────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ zenithjoy-engine│ │   项目 A        │ │   项目 B        │
│                 │ │                 │ │                 │
│ CLAUDE.md:      │ │ CLAUDE.md:      │ │ CLAUDE.md:      │
│ - Engine 文档   │ │ - 项目规则      │ │ - 项目规则      │
│                 │ │ - 项目经验      │ │ - 项目经验      │
│ docs/LEARNINGS: │ │                 │ │                 │
│ - Engine 开发   │ │                 │ │                 │
│   过程的经验    │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │ Notion (可选)   │
                  │ - 长期知识库    │
                  │ - 会话摘要      │
                  └─────────────────┘
```

### 记录规则

| 场景 | 记录位置 |
|------|----------|
| Engine 自身的 bug | engine 的 GitHub Issues |
| Engine 开发过程的经验 | engine 的 `docs/LEARNINGS.md` |
| 项目特定的规则 | 项目的 `CLAUDE.md` |
| 项目开发过程的经验 | 项目的 `docs/` 或 Notion |
| 跨项目通用经验 | `~/.claude/CLAUDE.md` |

### 自动化

- `/dev` 流程的 Step 7 (Learn) 会询问本次开发学到的经验
- 经验可以选择保存到：项目本地 / Notion / 全局配置

---

## 后续接入

- [ ] Cecilia（AI 助手）
- [ ] Dashboard（开发流程可视化）
- [ ] CI 失败通知（Notion）
- [ ] 自动 Learn → Notion 同步

---

**版本**: 见 `package.json`（权威源）
**创建**: 2026-01-15
**更新**: 2026-01-16
