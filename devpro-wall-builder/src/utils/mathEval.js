/**
 * Safe math expression evaluator using recursive descent parsing.
 * Supports: +, -, *, /, parentheses, decimals, unary minus.
 * NO eval().
 */
export function evaluateMathExpression(expr) {
  if (typeof expr !== 'string' || expr.trim() === '') {
    throw new Error('Empty expression');
  }

  const input = expr.replace(/\s+/g, '');
  let pos = 0;

  function peek() {
    return input[pos];
  }

  function consume(ch) {
    if (input[pos] === ch) { pos++; return; }
    throw new Error(`Expected '${ch}' at position ${pos}`);
  }

  function parseNumber() {
    const start = pos;
    if (input[pos] === '-') pos++;
    if (pos >= input.length || (input[pos] < '0' || input[pos] > '9') && input[pos] !== '.') {
      throw new Error(`Expected number at position ${start}`);
    }
    while (pos < input.length && input[pos] >= '0' && input[pos] <= '9') pos++;
    if (pos < input.length && input[pos] === '.') {
      pos++;
      while (pos < input.length && input[pos] >= '0' && input[pos] <= '9') pos++;
    }
    return parseFloat(input.slice(start, pos));
  }

  function parseFactor() {
    if (peek() === '(') {
      consume('(');
      const val = parseExpr();
      consume(')');
      return val;
    }
    if (peek() === '-') {
      pos++;
      return -parseFactor();
    }
    return parseNumber();
  }

  function parseTerm() {
    let val = parseFactor();
    while (peek() === '*' || peek() === '/') {
      const op = peek();
      pos++;
      const right = parseFactor();
      if (op === '*') val *= right;
      else {
        if (right === 0) throw new Error('Division by zero');
        val /= right;
      }
    }
    return val;
  }

  function parseExpr() {
    let val = parseTerm();
    while (peek() === '+' || peek() === '-') {
      const op = peek();
      pos++;
      const right = parseTerm();
      if (op === '+') val += right;
      else val -= right;
    }
    return val;
  }

  const result = parseExpr();

  if (pos < input.length) {
    throw new Error(`Unexpected character '${input[pos]}' at position ${pos}`);
  }

  if (!isFinite(result)) {
    throw new Error('Result is not finite');
  }

  return Math.round(result);
}
