---
id: checkpoint-05-gate-v3
version: 1.0.0
created: 2026-01-24
updated: 2026-01-24
changelog:
  - 1.0.0: 初始版本
---

# Checkpoint 05: Gate v3 验证

## 问题

Gate v3 核心要素已通过 Checkpoints 02-04 实现，需要验证整体系统：
- gate:test 统一入口 ✅
- Hook 证据采集 ✅
- CI 统一调用 ✅
- 测试环境隔离 ✅

## Gate v3 核心要素

### 1. 统一测试入口

```json
// package.json
"gate:test": "CI=true NODE_ENV=test TZ=UTC vitest run --reporter=verbose"
```

### 2. Hook 证据采集

```bash
# hooks/pr-gate-v2.sh
mkdir -p "$PROJECT_ROOT/artifacts/gate"
GATE_TEST_LOG="$PROJECT_ROOT/artifacts/gate/test-$(date +%Y%m%d-%H%M%S).log"
npm run gate:test > "$GATE_TEST_LOG" 2>&1
```

### 3. CI 统一调用

```yaml
# .github/workflows/ci.yml
npm run gate:test --if-present
```

### 4. 测试环境隔离

- 所有测试使用 tmpdir() + 时间戳
- 无 PROJECT_ROOT 污染
- beforeEach 清理机制

## 验收

- [x] gate:test 命令存在且可执行
- [x] Hook 调用 gate:test 并保存证据
- [x] CI 调用 gate:test
- [x] 186/186 测试通过
- [x] 本地/Hook/CI 环境变量一致（CI=true NODE_ENV=test TZ=UTC）
- [x] 测试环境完全隔离

## 状态

- [x] 完成（通过 Checkpoints 02-04 实现）
