# QA Decision

Decision: UPDATE_RCI
Priority: P1
RepoType: Engine

## 分析

**改动类型**: refactor + feature
- 清理 /dev Skills 垃圾提示词（refactor）
- 增强多 Feature 支持（feature）

**影响范围**:
- 修改 skills/dev/steps/*.md（文档文件）
- 新增 scripts/feature-*.sh（脚本）
- 核心工作流逻辑未变，只是清理和增强

**测试策略**:
- 文档清理：manual 验证（检查是否还有垃圾提示词）
- 多 Feature 流程：manual 测试（模拟单/多 Feature 场景）
- 向后兼容：auto 回归测试（现有 RCI）

## Tests

- dod_item: "01-prd.md 不再包含等用户确认"
  method: manual
  location: manual:grep 检查文件内容

- dod_item: "05-code.md 不再包含停下来"
  method: manual
  location: manual:grep 检查文件内容

- dod_item: "02.5-parallel-detect.md 简化或删除"
  method: manual
  location: manual:检查文件是否删除或简化

- dod_item: "支持检测复杂需求并拆分 Features"
  method: manual
  location: manual:模拟复杂需求测试

- dod_item: "状态文件格式符合官方标准"
  method: manual
  location: manual:检查 .local.md 文件格式

- dod_item: "/dev continue 命令可用"
  method: manual
  location: manual:测试继续命令

- dod_item: "简单任务仍走单 PR 流程"
  method: manual
  location: manual:测试向后兼容性

- dod_item: "现有回归测试通过"
  method: auto
  location: tests/**/*.test.ts

## RCI

new: []
update: 
  - DEV-001  # /dev 基础流程
  - DEV-002  # PRD/DoD 生成

## Reason

文档清理 + 工作流增强，主要是 manual 验证文档内容正确性，auto 测试确保向后兼容。
