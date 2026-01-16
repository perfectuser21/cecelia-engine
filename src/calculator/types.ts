/**
 * Calculator Types
 * Strict TypeScript definitions for calculator operations
 */

export enum Operation {
  ADD = 'ADD',
  SUB = 'SUB',
  MUL = 'MUL',
  DIV = 'DIV',
  POW = 'POW',
}

export interface CalculatorInput {
  a: number;
  b: number;
  operation: Operation;
}

export interface CalculatorResult {
  success: boolean;
  value: number;
  error?: string;
  input: CalculatorInput;
}

export interface ChainableCalculator {
  value: number;
  add(n: number): ChainableCalculator;
  sub(n: number): ChainableCalculator;
  mul(n: number): ChainableCalculator;
  div(n: number): ChainableCalculator;
  pow(n: number): ChainableCalculator;
  result(): CalculatorResult;
}
