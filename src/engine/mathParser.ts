/**
 * Safe recursive-descent mathematical expression parser & evaluator.
 * Strictly zero eval() or Function() usage.
 * Supports:
 *  - Arithmetic: +, -, *, /, ^
 *  - Implicit multiplication: 2x, 2x^2, -3(x-1)^2, 2|x+1|, (x-1)(x+2)
 *  - Absolute value bars: |x - 2|, -2|x + 1| + 4
 *  - Functions: abs(x), sqrt(x)
 *  - Coordinate points: [x, y], [2,-3], [ 2.5 , -1 ]
 */

export type TokenType =
  | 'NUMBER'
  | 'IDENT'
  | 'OP'
  | 'LPAREN'
  | 'RPAREN'
  | 'PIPE'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export type AstNode =
  | { kind: 'number'; value: number }
  | { kind: 'var'; name: 'x' }
  | { kind: 'unary'; op: '+' | '-'; expr: AstNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: AstNode; right: AstNode }
  | { kind: 'call'; fn: 'abs' | 'sqrt' | 'sin' | 'cos'; arg: AstNode };

export interface ParseResult {
  ok: boolean;
  ast?: AstNode;
  normalized?: string;
  error?: string;
}

export interface Point2D {
  x: number;
  y: number;
}

const MAX_EXPR_LENGTH = 140;

/**
 * Normalize common mathematical input formats (e.g. "f(x) = ...", "y = ...", unicode minus, squared).
 */
export function normalizeMathInput(raw: string): string {
  let s = raw.trim();
  // Replace unicode minus/dash, multiplication signs, superscripts
  s = s
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/,/g, '.'); // allow Turkish decimal comma inside equations (not points)

  // Strip leading "f(x)=" or "y=" or "g(x)="
  const eqMatch = s.match(/^(?:[a-zA-Z]\s*\(\s*x\s*\)|y)\s*=\s*(.+)$/i);
  if (eqMatch) {
    s = eqMatch[1].trim();
  }
  return s;
}

function tokenize(input: string): { tokens?: Token[]; error?: string } {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      const start = i;
      let dotCount = 0;
      while (i < input.length && /[0-9.]/.test(input[i])) {
        if (input[i] === '.') dotCount++;
        i++;
      }
      const numStr = input.slice(start, i);
      if (dotCount > 1 || numStr === '.') {
        return { error: `Invalid number at position ${start}` };
      }
      tokens.push({ type: 'NUMBER', value: numStr, pos: start });
      continue;
    }

    if (/[a-zA-Z]/.test(ch)) {
      const start = i;
      while (i < input.length && /[a-zA-Z]/.test(input[i])) {
        i++;
      }
      const ident = input.slice(start, i).toLowerCase();
      if (ident === 'x' || ident === 'abs' || ident === 'sqrt' || ident === 'sin' || ident === 'cos') {
        tokens.push({ type: 'IDENT', value: ident, pos: start });
      } else {
        return { error: `Unknown symbol "${ident}"` };
      }
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      tokens.push({ type: 'OP', value: ch, pos: i });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: ch, pos: i });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ch, pos: i });
      i++;
      continue;
    }

    if (ch === '|') {
      tokens.push({ type: 'PIPE', value: ch, pos: i });
      i++;
      continue;
    }

    return { error: `Unexpected character "${ch}"` };
  }

  tokens.push({ type: 'EOF', value: '', pos: input.length });
  return { tokens };
}

/**
 * Insert explicit '*' tokens where implicit multiplication occurs:
 *   2x -> 2 * x
 *   2(x-1) -> 2 * (x-1)
 *   2|x-1| -> 2 * |x-1|
 *   x(x+1) -> x * (x+1)
 *   (x-1)(x+2) -> (x-1) * (x+2)
 *   |x-1|x -> |x-1| * x
 *   2abs(x) -> 2 * abs(x)
 */
function insertImplicitMultiplication(rawTokens: Token[]): Token[] {
  const out: Token[] = [];
  let absDepth = 0;

  // Determine whether each PIPE is an opening or closing absolute value bar
  const isClosingPipe = (prev: Token | undefined): boolean => {
    if (absDepth === 0) return false;
    if (!prev) return false;
    if (prev.type === 'NUMBER') return true;
    if (prev.type === 'IDENT' && prev.value === 'x') return true;
    if (prev.type === 'RPAREN') return true;
    if (prev.type === 'PIPE') return true;
    return false;
  };

  const canEndValue = (t: Token, wasClosingPipe: boolean): boolean => {
    if (t.type === 'NUMBER') return true;
    if (t.type === 'IDENT' && t.value === 'x') return true;
    if (t.type === 'RPAREN') return true;
    if (t.type === 'PIPE' && wasClosingPipe) return true;
    return false;
  };

  const canStartValue = (t: Token, isOpeningPipe: boolean): boolean => {
    if (t.type === 'IDENT') return true;
    if (t.type === 'LPAREN') return true;
    if (t.type === 'PIPE' && isOpeningPipe) return true;
    return false;
  };

  let prevWasClosingPipe = false;

  for (let i = 0; i < rawTokens.length; i++) {
    const curr = rawTokens[i];
    const prev = out.length > 0 ? out[out.length - 1] : undefined;

    let currIsClosingPipe = false;
    let currIsOpeningPipe = false;
    if (curr.type === 'PIPE') {
      if (isClosingPipe(prev)) {
        currIsClosingPipe = true;
      } else {
        currIsOpeningPipe = true;
      }
    }

    if (prev && canEndValue(prev, prevWasClosingPipe) && canStartValue(curr, currIsOpeningPipe)) {
      out.push({ type: 'OP', value: '*', pos: curr.pos });
    }

    if (currIsOpeningPipe) absDepth++;
    if (currIsClosingPipe) absDepth = Math.max(0, absDepth - 1);

    out.push(curr);
    prevWasClosingPipe = currIsClosingPipe;
  }

  return out;
}

class Parser {
  private tokens: Token[];
  private pos = 0;
  private depth = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] || { type: 'EOF', value: '', pos: -1 };
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  public parse(): AstNode {
    const node = this.parseAddSub();
    if (this.peek().type !== 'EOF') {
      throw new Error(`Unexpected token "${this.peek().value}"`);
    }
    return node;
  }

  private parseAddSub(): AstNode {
    let left = this.parseMulDiv();
    while (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value as '+' | '-';
      const right = this.parseMulDiv();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseMulDiv(): AstNode {
    let left = this.parseUnary();
    while (this.peek().type === 'OP' && (this.peek().value === '*' || this.peek().value === '/')) {
      const op = this.consume().value as '*' | '/';
      const right = this.parseUnary();
      left = { kind: 'binary', op, left, right };
    }
    return left;
  }

  private parseUnary(): AstNode {
    if (this.peek().type === 'OP' && (this.peek().value === '+' || this.peek().value === '-')) {
      const op = this.consume().value as '+' | '-';
      // Standard math precedence: -x^2 means -(x^2)
      const expr = this.parseUnary();
      return { kind: 'unary', op, expr };
    }
    return this.parsePower();
  }

  private parsePower(): AstNode {
    let base = this.parsePrimary();
    if (this.peek().type === 'OP' && this.peek().value === '^') {
      this.consume();
      // Right-associative exponent with unary support: x^-2
      const exponent = this.parseUnary();
      return { kind: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private parsePrimary(): AstNode {
    if (++this.depth > 64) {
      throw new Error('Expression too deeply nested');
    }
    try {
      const tok = this.peek();

      if (tok.type === 'NUMBER') {
        this.consume();
        const val = Number(tok.value);
        if (!Number.isFinite(val)) throw new Error('Invalid numeric literal');
        return { kind: 'number', value: val };
      }

      if (tok.type === 'IDENT') {
        this.consume();
        if (tok.value === 'x') {
          return { kind: 'var', name: 'x' };
        }
        if (tok.value === 'abs' || tok.value === 'sqrt' || tok.value === 'sin' || tok.value === 'cos') {
          if (this.peek().type !== 'LPAREN') {
            throw new Error(`Expected "(" after ${tok.value}`);
          }
          this.consume();
          const arg = this.parseAddSub();
          if (this.peek().type !== 'RPAREN') {
            throw new Error(`Expected ")" after ${tok.value} argument`);
          }
          this.consume();
          return { kind: 'call', fn: tok.value as 'abs' | 'sqrt' | 'sin' | 'cos', arg };
        }
        throw new Error(`Unknown identifier "${tok.value}"`);
      }

      if (tok.type === 'LPAREN') {
        this.consume();
        const inner = this.parseAddSub();
        if (this.peek().type !== 'RPAREN') {
          throw new Error('Unclosed parenthesis "("');
        }
        this.consume();
        return inner;
      }

      if (tok.type === 'PIPE') {
        this.consume();
        const inner = this.parseAddSub();
        if (this.peek().type !== 'PIPE') {
          throw new Error('Unclosed absolute value bar "|"');
        }
        this.consume();
        return { kind: 'call', fn: 'abs', arg: inner };
      }

      throw new Error(`Unexpected token "${tok.value || 'end of input'}"`);
    } finally {
      this.depth--;
    }
  }
}

export function parseMathExpression(raw: string): ParseResult {
  if (!raw || !raw.trim()) {
    return { ok: false, error: 'Expression is empty' };
  }
  if (raw.length > MAX_EXPR_LENGTH) {
    return { ok: false, error: 'Expression is too long' };
  }

  const normalized = normalizeMathInput(raw);
  if (!normalized) {
    return { ok: false, error: 'Expression is empty' };
  }

  const tokRes = tokenize(normalized);
  if (tokRes.error || !tokRes.tokens) {
    return { ok: false, error: tokRes.error || 'Tokenization error' };
  }

  const withMul = insertImplicitMultiplication(tokRes.tokens);
  try {
    const ast = new Parser(withMul).parse();
    return { ok: true, ast, normalized };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Syntax error',
    };
  }
}

export function evaluateAst(node: AstNode, x: number): number {
  switch (node.kind) {
    case 'number':
      return node.value;
    case 'var':
      return x;
    case 'unary': {
      const v = evaluateAst(node.expr, x);
      return node.op === '-' ? -v : v;
    }
    case 'binary': {
      const l = evaluateAst(node.left, x);
      const r = evaluateAst(node.right, x);
      if (!Number.isFinite(l) || !Number.isFinite(r)) return NaN;
      switch (node.op) {
        case '+':
          return l + r;
        case '-':
          return l - r;
        case '*':
          return l * r;
        case '/':
          return Math.abs(r) < 1e-12 ? NaN : l / r;
        case '^': {
          // Handle integer powers cleanly even for negative bases
          if (Number.isInteger(r)) {
            return Math.pow(l, r);
          }
          if (l < 0) return NaN;
          return Math.pow(l, r);
        }
      }
      break;
    }
    case 'call': {
      const a = evaluateAst(node.arg, x);
      if (!Number.isFinite(a)) return NaN;
      if (node.fn === 'abs') return Math.abs(a);
      if (node.fn === 'sqrt') return a < 0 ? NaN : Math.sqrt(a);
      if (node.fn === 'sin') return Math.sin(a);
      if (node.fn === 'cos') return Math.cos(a);
      return NaN;
    }
  }
  return NaN;
}

export function compileMathFunction(
  raw: string
): { fn?: (x: number) => number; ast?: AstNode; normalized?: string; error?: string } {
  const parsed = parseMathExpression(raw);
  if (!parsed.ok || !parsed.ast) {
    return { error: parsed.error || 'Invalid expression' };
  }
  const ast = parsed.ast;
  return {
    ast,
    normalized: parsed.normalized,
    fn: (x: number) => evaluateAst(ast, x),
  };
}

/**
 * Checks if two mathematical expressions define the same function on a domain.
 */
export function areExpressionsEquivalent(
  exprA: string,
  exprB: string,
  domainMin = -8,
  domainMax = 8,
  tolerance = 1e-4
): boolean {
  const a = compileMathFunction(exprA);
  const b = compileMathFunction(exprB);
  if (!a.fn || !b.fn) return false;

  const samplePoints: number[] = [];
  const steps = 37;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // Slight irrational offset avoids hitting identical special zeroes by luck
    samplePoints.push(domainMin + t * (domainMax - domainMin));
  }
  // Include integer probes
  for (let x = Math.ceil(domainMin); x <= Math.floor(domainMax); x++) {
    samplePoints.push(x);
  }

  let validMatches = 0;
  for (const x of samplePoints) {
    const ya = a.fn(x);
    const yb = b.fn(x);
    const aFinite = Number.isFinite(ya);
    const bFinite = Number.isFinite(yb);
    if (aFinite !== bFinite) return false;
    if (aFinite && bFinite) {
      if (Math.abs(ya - yb) > tolerance) return false;
      validMatches++;
    }
  }
  return validMatches >= 8;
}

/**
 * Parses a single coordinate point strictly in [x, y] format with whitespace tolerance.
 * Accepts: "[2, -3]", "[2,-3]", "[ -1.5 , 4 ]", "[0,0]"
 */
export function parsePoint(raw: string): Point2D | null {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/[−–—]/g, '-');
  const match = cleaned.match(
    /^\[\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*[+-]?\d+)?)\s*,\s*([+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*\/\s*[+-]?\d+)?)\s*\]$/
  );
  if (!match) return null;

  const parseScalar = (s: string): number => {
    if (s.includes('/')) {
      const [num, den] = s.split('/').map((p) => Number(p.trim()));
      if (!Number.isFinite(num) || !Number.isFinite(den) || den === 0) return NaN;
      return num / den;
    }
    return Number(s);
  };

  const x = parseScalar(match[1]);
  const y = parseScalar(match[2]);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x, y };
}

/**
 * Parses one or more points separated by commas or whitespace:
 * e.g. "[1,0], [3,0]" or "[-2, 0] [4, 0]" or "yok" / "none" / "∅"
 */
export function parsePointList(raw: string): { points: Point2D[]; isNone: boolean; valid: boolean } {
  const trimmed = raw.trim();
  if (!trimmed) return { points: [], isNone: false, valid: false };

  const lower = trimmed.toLowerCase();
  if (lower === 'yok' || lower === 'none' || lower === '∅' || lower === '-' || lower === 'bos') {
    return { points: [], isNone: true, valid: true };
  }

  const matches = trimmed.match(/\[[^\]]+\]/g);
  if (!matches || matches.length === 0) {
    return { points: [], isNone: false, valid: false };
  }

  // Ensure nothing junk remains outside matched brackets and separators
  const remainder = trimmed.replace(/\[[^\]]+\]/g, '').replace(/[,;\s veand]+/gi, '');
  if (remainder.length > 0) {
    return { points: [], isNone: false, valid: false };
  }

  const points: Point2D[] = [];
  for (const m of matches) {
    const pt = parsePoint(m);
    if (!pt) return { points: [], isNone: false, valid: false };
    points.push(pt);
  }
  return { points, isNone: false, valid: true };
}

export function pointsEqual(a: Point2D, b: Point2D, eps = 0.05): boolean {
  return Math.abs(a.x - b.x) <= eps && Math.abs(a.y - b.y) <= eps;
}

export function pointListsEqual(a: Point2D[], b: Point2D[], eps = 0.05): boolean {
  if (a.length !== b.length) return false;
  const used = new Array(b.length).fill(false);
  for (const pa of a) {
    const idx = b.findIndex((pb, j) => !used[j] && pointsEqual(pa, pb, eps));
    if (idx === -1) return false;
    used[idx] = true;
  }
  return true;
}

/**
 * Parses numeric answer including simple fractions like "-3/2" or "0.5" or "x=2"
 */
export function parseNumberOrFraction(raw: string): number | null {
  if (!raw) return null;
  let s = raw.trim().replace(/[−–—]/g, '-').replace(/,/g, '.');
  // Allow "x = 3" or "m = -2"
  const eqIdx = s.indexOf('=');
  if (eqIdx !== -1) {
    s = s.slice(eqIdx + 1).trim();
  }
  if (/^[+-]?\d+(?:\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  const frac = s.match(/^([+-]?\d+(?:\.\d+)?)\s*\/\s*([+-]?\d+(?:\.\d+)?)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) {
      return num / den;
    }
  }
  return null;
}

export function formatCoord(p: Point2D): string {
  const fmt = (n: number) => {
    if (Math.abs(n) < 1e-9) return '0';
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2)));
  };
  return `[${fmt(p.x)},${fmt(p.y)}]`;
}
