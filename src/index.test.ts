/**
 * Index module tests
 */

import { describe, it, expect } from 'vitest';
import { hello } from './index';

describe('hello', () => {
  it('returns greeting with name', () => {
    expect(hello('World')).toBe('Hello, World!');
  });

  it('handles empty string', () => {
    expect(hello('')).toBe('Hello, !');
  });
});
