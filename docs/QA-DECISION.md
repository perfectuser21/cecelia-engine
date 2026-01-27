# QA Decision

Decision: UPDATE_RCI
Priority: P1
RepoType: Engine

Tests:
  - dod_item: "dev-with-loop 命令可用"
    method: manual
    location: manual:执行 which dev-with-loop 确认路径存在
  - dod_item: "skills/dev/SKILL.md 已修改（v2.1.0）"
    method: manual
    location: manual:检查文件包含使用警告和版本号
  - dod_item: "~/.claude/CLAUDE.md 已更新"
    method: manual
    location: manual:确认包含用户调用规则
  - dod_item: "测试验证：dev-with-loop 不会在 Step 4/7 停顿"
    method: manual
    location: manual:完整执行 dev-with-loop 流程观察行为
  - dod_item: "文档已更新（CHANGELOG、FEATURES）"
    method: manual
    location: manual:确认文档同步更新

RCI:
  new: []
  update:
    - W7-001  # Ralph Loop 自动启动（改为用户直接调用）
    - W7-003  # 版本号自动更新（完成信号改为 DONE）

Reason: Ralph Loop 调用方式从 AI 内部改为用户直接调用，需要更新相关 RCI 的描述和验证方式
