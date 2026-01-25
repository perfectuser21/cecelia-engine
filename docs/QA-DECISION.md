# QA Decision: 实施全新 CI 分层方案

Decision: Minimal（Golden Path 测试）

**理由**:
1. 这是基础设施改动（脚本 + CI 配置），不是业务逻辑
2. 主要涉及 shell 脚本和 GitHub Actions，测试成本高于收益
3. 通过手动验证和 CI 实际运行来确保正确性

## Golden Paths

1. **本地 preflight 成功路径**
   - 运行 `npm run ci:preflight`
   - L1-fast（typecheck + test）通过
   - L3-fast（lint/format check）通过
   - 输出成功信息

2. **PR L2B-min 检查路径**
   - `.layer2-evidence.md` 存在
   - 包含必需字段（## 手动验证、## 自动化测试）
   - 至少 1 条可复核证据

3. **AI Review 发送 comment 路径**
   - CI 全绿后触发
   - 调用 VPS API 成功
   - 发送 PR comment

## 不测试的内容

- shell 脚本内部逻辑（复杂度低，手动验证即可）
- GitHub Actions workflow（通过实际 PR 验证）
- VPS API 响应（外部依赖）

## 回归契约

不影响现有测试，所有现有测试应保持通过。

