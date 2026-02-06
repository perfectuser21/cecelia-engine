## [12.8.0] - 2026-02-06

### Added

- **AI Content Production Pipeline**: 支持月产 240+ 条 AI 内容
  - ContentGenerator: 内容生成器，支持批量生成
  - ContentProcessor: 内容处理器，自动优化和格式化
  - ContentValidator: 内容验证器，确保质量标准
  - PipelineScheduler: 流水线调度器，管理批量处理
- **完整测试覆盖**:
  - 单元测试：ContentGenerator, ContentProcessor, ContentValidator, PipelineScheduler
  - 集成测试：端到端流水线测试、批量处理测试、错误恢复测试、性能测试（CI 中暂时跳过）
- **API 文档**: docs/API.md 包含完整使用说明

### Technical Details

- 支持每日 8 条内容生产（月产 240 条）
- 并行批处理架构，高效处理大量内容
- 可配置的验证规则和重试机制
- 中英文内容支持，自动语言检测

## [12.7.0] - 2026-02-06

### Removed

- **skills/gate/**: 完全删除 Gate Skill 家族（gate:prd, gate:dod, gate:test, gate:audit, gate:qa, gate:learning）
- **scripts/gate/**: 删除 gate 签名生成/验证脚本
- **tests/gate/**: 删除 gate 相关测试
- **scripts/run-gate-tests.sh**: 删除
- **scripts/qa-with-gate.sh**: 删除
- **.gate-*-passed**: 删除所有 gate 通过标记文件

### Changed

- **skills/dev/steps/01-prd.md**: 移除 gate:prd Subagent 调用
- **skills/dev/steps/05-code.md**: 移除 gate:audit Subagent 调用
- **skills/dev/steps/06-test.md**: 移除 gate:test Subagent 调用
- **skills/dev/steps/07-quality.md**: 移除 gate 汇总逻辑，简化为纯汇总
- **skills/dev/steps/10-learning.md**: 移除 gate:learning Subagent 调用
- **skills/dev/SKILL.md**: 更新流程图为 v3.2（无 Gate），两层职责分离
- **regression-contract.yaml**: 移除 G1-001 ~ G1-007
- **features/feature-registry.yml**: 标记 G1 为已删除
- **skills/dev/scripts/cleanup.sh**: 移除 gate 文件验证和清理

### 设计决策

Gate 机制会让 AI 停下来征求意见，破坏 Stop Hook 的自动循环。
质量检查完全交给 CI，本地只保留 branch-protect.sh 检查文件存在性。
唯一的流程控制 = Stop Hook。

## [12.5.8] - 2026-02-04

### Restored

- **skills/audit/**: 恢复 audit skill（保留但不强制使用）
  - 用户反馈："不要删除 skills 不要用就好了啊"
  - 保留完整功能，可选使用

## [12.5.7] - 2026-02-04

### Changed

- **CLAUDE.md OKR**: 改为"帮助 Cecelia 完成开发任务"
- **FEATURES.md**: H2 和 G1 标记为 Deprecated
- **skills/gate/SKILL.md**: 移除 Subagent 术语

### Removed

- **skills/audit/**: 删除 audit skill（只保留 /dev）→ v12.5.8 已恢复

## [12.5.6] - 2026-02-04

### Changed

- **CLAUDE.md**: 入口只保留 `/dev`，移除 `/audit`

## [12.5.5] - 2026-02-04

### Changed

- **CLAUDE.md 重构**:
  - 突出核心理念：信息最新、CI 唯一防线、PR 驱动、Stop Hook 循环、Worktree 隔离、PRD/DoD 保障
  - 添加 OKR 部分
  - 精简技术配置，移到末尾

## [12.5.4] - 2026-02-04

### Removed

- **废弃文件清理**:
  - 删除 `hooks/pr-gate-v2.sh`（质量检查完全交给 CI）
  - 删除所有已完成的 `.prd-*.md` 和 `.dod-*.md` 文件

### Changed

- **文档更新**:
  - `CLAUDE.md`: 移除 pr-gate-v2.sh 目录条目
  - `docs/KNOWN-ISSUES.md`: 标记 B1 为已关闭
  - `docs/HOOK-DEFENSE-ANALYSIS.md`: 更新 pr-gate-v2 状态
  - `docs/HOOK-ENFORCEMENT-STRATEGY.md`: 更新 pr-gate-v2 状态

## [12.5.3] - Previous releases
See git history for previous changes