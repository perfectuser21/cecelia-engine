# Checkpoint 02: 统一测试入口

## 问题

当前测试调用方式不统一：
- 本地: `npm test`
- Hook: `npm test`（但环境变量不同）
- CI: `npm test`（.github/workflows/ci.yml）

导致：
- 环境不一致（CI=true vs undefined）
- 输出格式不同
- 无法保证可复现性

## 解决方案

创建统一测试入口：`npm run gate:test`

### package.json

```json
{
  "scripts": {
    "test": "vitest run",
    "gate:test": "CI=true NODE_ENV=test vitest run --reporter=verbose --reporter=json --outputFile=artifacts/test-results.json"
  }
}
```

### 调用点统一

1. **本地开发**: `npm test` (快速反馈)
2. **Gate/Hook**: `npm run gate:test` (完整证据)
3. **CI**: `npm run gate:test` (完全一致)

### 环境变量固定

```bash
export CI=true
export NODE_ENV=test
export TZ=UTC
```

## 验收

- [x] 创建 `gate:test` 命令
- [x] Hook 调用 `gate:test`
- [x] 输出保存到 artifacts/gate/test-{timestamp}.log
- [ ] CI 调用 `gate:test` (下一步)
- [ ] 本地/Hook/CI 结果一致 (待 CI 修改)

## 实现

### package.json

```json
"gate:test": "CI=true NODE_ENV=test TZ=UTC vitest run --reporter=verbose"
```

### hooks/pr-gate-v2.sh

```bash
if grep -q '"gate:test"' package.json 2>/dev/null; then
    echo -n "  test (gate)... " >&2
    mkdir -p "$PROJECT_ROOT/artifacts/gate"
    GATE_TEST_LOG="$PROJECT_ROOT/artifacts/gate/test-$(date +%Y%m%d-%H%M%S).log"
    if npm run gate:test > "$GATE_TEST_LOG" 2>&1; then
        echo "[OK]" >&2
    else
        echo "[FAIL]" >&2
        echo "  完整日志: $GATE_TEST_LOG" >&2
        grep -E "FAIL|✕" "$GATE_TEST_LOG" | tail -30 >&2
        FAILED=1
    fi
fi
```

## 状态

- [x] 完成（Hook 部分）
- [ ] CI 部分待下一个 checkpoint
