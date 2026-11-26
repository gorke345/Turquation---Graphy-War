export interface KeypadToken {
  label: string;
  insert: string;
  ariaLabel: string;
}

export const GRAPH_WARS_KEYPAD_TOKENS: KeypadToken[] = [
  { label: 'x', insert: 'x', ariaLabel: 'x' },
  { label: 'x²', insert: 'x^2', ariaLabel: 'x squared' },
  { label: '^', insert: '^', ariaLabel: 'power' },
  { label: '+', insert: ' + ', ariaLabel: 'plus' },
  { label: '−', insert: ' - ', ariaLabel: 'minus' },
  { label: '×', insert: '*', ariaLabel: 'multiply' },
  { label: '( )', insert: '()', ariaLabel: 'parentheses' },
  { label: 'sin', insert: 'sin(', ariaLabel: 'sine' },
  { label: 'cos', insert: 'cos(', ariaLabel: 'cosine' },
  { label: '|x|', insert: 'abs(', ariaLabel: 'absolute value' },
  { label: '0.05*', insert: '0.05*', ariaLabel: '0.05 times' },
];

export const BATTLESHIP_KEYPAD_TOKENS: KeypadToken[] = [
  { label: 'x', insert: 'x', ariaLabel: 'x' },
  { label: 'x²', insert: 'x^2', ariaLabel: 'x squared' },
  { label: '^', insert: '^', ariaLabel: 'power' },
  { label: '+', insert: ' + ', ariaLabel: 'plus' },
  { label: '−', insert: ' - ', ariaLabel: 'minus' },
  { label: '×', insert: '*', ariaLabel: 'multiply' },
  { label: '( )', insert: '()', ariaLabel: 'parentheses' },
  { label: '|x|', insert: 'abs(', ariaLabel: 'absolute value' },
];

export const GRAPH_WARS_EXAMPLE_EQUATIONS: string[] = [
  '-0.04*x^2 + 0.35*x',
  '0.03*x^2 - 0.5*x',
  '2.5*sin(0.25*x)',
  '-0.4*abs(x) + 0.2*x',
  '0.002*x^3 - 0.15*x',
];

/**
 * Pure helper to insert a math token into an input value at a cursor selection range
 * and return the next string + recommended caret position.
 */
export function insertMathToken(
  currentValue: string,
  token: string,
  selectionStart?: number | null,
  selectionEnd?: number | null
): { value: string; cursor: number } {
  const start =
    typeof selectionStart === 'number' && selectionStart >= 0 && selectionStart <= currentValue.length
      ? selectionStart
      : currentValue.length;
  const end =
    typeof selectionEnd === 'number' && selectionEnd >= start && selectionEnd <= currentValue.length
      ? selectionEnd
      : start;

  const before = currentValue.slice(0, start);
  const after = currentValue.slice(end);

  if (token === '()') {
    const selected = currentValue.slice(start, end);
    const next = `${before}(${selected})${after}`;
    const cursor = selected.length > 0 ? start + selected.length + 2 : start + 1;
    return { value: next, cursor };
  }

  const next = `${before}${token}${after}`;
  return { value: next, cursor: start + token.length };
}
