/**
 * P1 轮询循环压力测试
 * 修复后的正确版本
 */

// 修复：正确的类型
export const testValue: number = 42;

export function testFunction(): number {
  return testValue; // 类型匹配 ✅
}
