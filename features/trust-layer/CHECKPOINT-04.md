---
id: checkpoint-04-test-isolation
version: 1.0.0
created: 2026-01-23
updated: 2026-01-23
changelog:
  - 1.0.0: 初始版本
---

# Checkpoint 04: 测试环境隔离

## 问题

部分测试文件仍在 PROJECT_ROOT 创建临时目录，导致：
- 测试期间污染 git status
- 并发测试可能冲突
- 测试崩溃时遗留文件
- Hook 环境不稳定

### 当前污染源

```typescript
// tests/hooks/pr-gate-phase1.test.ts
const TEST_DIR = join(PROJECT_ROOT, ".test-phase1");  // ❌ 污染项目目录

// tests/hooks/metrics.test.ts
const TEST_HISTORY_DIR = path.join(ROOT, '.test-metrics-history');  // ❌ 污染项目目录
```

### 已修复（参考）

```typescript
// tests/hooks/pr-gate-phase2.test.ts
const TEST_DIR = join(tmpdir(), `zenithjoy-test-phase2-${Date.now()}`);  // ✅ 隔离
```

## 解决方案

将所有测试改为使用 `tmpdir()` + 时间戳隔离：

### pr-gate-phase1.test.ts

```typescript
import { tmpdir } from 'os';

const TEST_DIR = join(tmpdir(), `zenithjoy-test-phase1-${Date.now()}`);
```

### metrics.test.ts

```typescript
import { tmpdir } from 'os';

const TEST_HISTORY_DIR = join(tmpdir(), `zenithjoy-test-metrics-${Date.now()}`);
```

## 实现

### pr-gate-phase1.test.ts

```typescript
import { tmpdir } from "os";

const TEST_DIR = join(tmpdir(), `zenithjoy-test-phase1-${Date.now()}`);

// 添加 beforeEach 清理，防止 test-to-test 污染
beforeEach(() => {
  if (existsSync(TEST_DIR)) {
    const files = readdirSync(TEST_DIR);
    files.forEach((f) => {
      const filePath = join(TEST_DIR, f);
      rmSync(filePath, { force: true, recursive: true });
    });
  }
});
```

### metrics.test.ts

移除了未使用的 `TEST_HISTORY_DIR`（已污染项目目录的常量定义）。
所有测试早已使用 tmpdir()，此常量从未被实际使用。

## 验收

- [x] pr-gate-phase1.test.ts 使用 tmpdir()
- [x] metrics.test.ts 移除污染代码
- [x] 测试运行期间 git status 干净
- [x] 186/186 测试通过
- [x] 并发运行无冲突（时间戳隔离）

## 状态

- [x] 完成
