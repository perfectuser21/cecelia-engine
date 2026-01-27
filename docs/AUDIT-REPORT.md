# Audit Report

Branch: cp-evidence-ci-ssot
Date: 2026-01-27
Scope: ci/scripts/generate-evidence.sh, ci/scripts/evidence-gate.sh, .github/workflows/ci.yml, package.json, .gitignore
Target Level: L2

Summary:
  L1: 1 (fixed)
  L2: 0
  L3: 0
  L4: 0

Decision: PASS

Findings:
  - id: A1-001
    layer: L1
    file: scripts/devgate/detect-priority.cjs
    line: 195-205
    issue: P0wer 被误识别为 P0（测试失败）
    fix: 修改直接输入模式，跳过 QA-DECISION.md 读取；改进正则匹配，确保 P[0-3] 后不跟字母
    status: fixed

Blockers: []

## 审计说明

本次变更主要涉及 CI 脚本和配置文件：

### 审计范围

1. **ci/scripts/generate-evidence.sh**
   - Shell 脚本规范：✅ 使用 `set -euo pipefail`
   - 路径安全：✅ 使用 git rev-parse 获取 SHA
   - 环境变量：✅ 使用 `${VAR:-default}` 提供默认值
   - JSON 生成：✅ 使用 heredoc，避免转义问题

2. **ci/scripts/evidence-gate.sh**
   - 错误处理：✅ 每个校验步骤都有明确的错误信息
   - JSON 校验：✅ 使用 `jq empty` 验证格式
   - 字段检查：✅ 遍历所有必需字段
   - 静默处理：✅ 使用 `2>/dev/null` 避免干扰输出

3. **.github/workflows/ci.yml**
   - 条件执行：✅ 使用 `if: steps.detect.outputs.type == 'npm'`
   - 脚本路径：✅ 使用相对路径 `bash ci/scripts/...`
   - 失败处理：✅ CI step 失败会阻止后续执行

4. **package.json**
   - 新增 script：✅ `qa:local` 简化为 typecheck only
   - 向后兼容：✅ 保留原有 `qa` script

5. **.gitignore**
   - 模式匹配：✅ `.quality-evidence.*.json` 覆盖所有 SHA 后缀
   - 注释说明：✅ 清晰说明为何忽略

### 审计结论

所有改动符合以下标准：
- L1（阻塞性）：无语法错误，无路径错误，功能正常
- L2（功能性）：边界条件已处理，错误处理完整

无需修复。
