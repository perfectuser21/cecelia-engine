import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // 串行执行测试文件，避免并发时 git/shell 命令竞争
    fileParallelism: false,
    // E2E tests may take longer
    testTimeout: 30000, // 30 seconds for e2e tests
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      // 覆盖率阈值（暂时设低，后续逐步提高）
      thresholds: {
        statements: 50,
        branches: 50,
        functions: 50,
        lines: 50,
      },
    },
  },
});
