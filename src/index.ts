/**
 * ZenithJoy Engine - AI Development Workflow Engine
 *
 * This module exports the calculator functionality as an example.
 * The real value of this project is the /dev workflow defined in skills/dev/SKILL.md
 */

export * from './calculator';

/**
 * Simple hello function for /dev flow testing
 */
export function hello(name: string): string {
  return `Hello, ${name}!`;
}
