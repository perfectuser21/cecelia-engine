/**
 * Calculator Core Logic
 * Supports basic operations, chaining, and proper error handling
 */

import {
  Operation,
  CalculatorInput,
  CalculatorResult,
  ChainableCalculator,
} from './types';

/**
 * Perform a single calculation
 */
export function calculate(input: CalculatorInput): CalculatorResult {
  const { a, b, operation } = input;

  try {
    let value: number;

    switch (operation) {
      case Operation.ADD:
        value = a + b;
        break;
      case Operation.SUB:
        value = a - b;
        break;
      case Operation.MUL:
        value = a * b;
        break;
      case Operation.DIV:
        if (b === 0) {
          return {
            success: false,
            value: NaN,
            error: 'Division by zero',
            input,
          };
        }
        value = a / b;
        break;
      case Operation.POW:
        value = Math.pow(a, b);
        break;
      default:
        return {
          success: false,
          value: NaN,
          error: `Unknown operation: ${operation}`,
          input,
        };
    }

    // Handle special numeric cases
    if (!Number.isFinite(value)) {
      return {
        success: false,
        value,
        error: 'Result is not finite',
        input,
      };
    }

    return {
      success: true,
      value,
      input,
    };
  } catch (error) {
    return {
      success: false,
      value: NaN,
      error: error instanceof Error ? error.message : 'Unknown error',
      input,
    };
  }
}

/**
 * Create a chainable calculator starting from an initial value
 */
export function chain(initialValue: number): ChainableCalculator {
  let currentValue = initialValue;
  let lastError: string | undefined;

  const createChain = (): ChainableCalculator => ({
    get value() {
      return currentValue;
    },

    add(n: number): ChainableCalculator {
      const result = calculate({ a: currentValue, b: n, operation: Operation.ADD });
      if (!result.success && !lastError) lastError = result.error;
      currentValue = result.value;
      return createChain();
    },

    sub(n: number): ChainableCalculator {
      const result = calculate({ a: currentValue, b: n, operation: Operation.SUB });
      if (!result.success && !lastError) lastError = result.error;
      currentValue = result.value;
      return createChain();
    },

    mul(n: number): ChainableCalculator {
      const result = calculate({ a: currentValue, b: n, operation: Operation.MUL });
      if (!result.success && !lastError) lastError = result.error;
      currentValue = result.value;
      return createChain();
    },

    div(n: number): ChainableCalculator {
      const result = calculate({ a: currentValue, b: n, operation: Operation.DIV });
      if (!result.success && !lastError) lastError = result.error;
      currentValue = result.value;
      return createChain();
    },

    pow(n: number): ChainableCalculator {
      const result = calculate({ a: currentValue, b: n, operation: Operation.POW });
      if (!result.success && !lastError) lastError = result.error;
      currentValue = result.value;
      return createChain();
    },

    result(): CalculatorResult {
      const success = Number.isFinite(currentValue) && !lastError;
      return {
        success,
        value: currentValue,
        error: lastError,
        input: { a: initialValue, b: currentValue, operation: Operation.ADD },
      };
    },
  });

  return createChain();
}
