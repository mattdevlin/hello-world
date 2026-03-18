import { describe, it, expect } from 'vitest';
import { evaluateMathExpression } from './mathEval.js';

describe('evaluateMathExpression', () => {
  it('evaluates addition', () => {
    expect(evaluateMathExpression('7500 + 832 + 162')).toBe(8494);
  });

  it('evaluates subtraction', () => {
    expect(evaluateMathExpression('10000 - 500')).toBe(9500);
  });

  it('evaluates multiplication', () => {
    expect(evaluateMathExpression('1200 * 3')).toBe(3600);
  });

  it('evaluates parentheses', () => {
    expect(evaluateMathExpression('2 * (3 + 4)')).toBe(14);
  });

  it('evaluates mixed operations with precedence', () => {
    expect(evaluateMathExpression('100 + 50 * 2')).toBe(200);
  });

  it('evaluates unary minus', () => {
    expect(evaluateMathExpression('-5 + 10')).toBe(5);
  });

  it('evaluates decimals and rounds result', () => {
    expect(evaluateMathExpression('10.5 + 20.3')).toBe(31);
  });

  it('evaluates nested parentheses', () => {
    expect(evaluateMathExpression('((2 + 3) * (4 + 1))')).toBe(25);
  });

  it('throws on division by zero', () => {
    expect(() => evaluateMathExpression('100 / 0')).toThrow('Division by zero');
  });

  it('throws on empty string', () => {
    expect(() => evaluateMathExpression('')).toThrow('Empty expression');
  });

  it('throws on invalid expression', () => {
    expect(() => evaluateMathExpression('abc')).toThrow();
  });

  it('throws on incomplete expression', () => {
    expect(() => evaluateMathExpression('5 +')).toThrow();
  });
});
