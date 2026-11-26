/**
 * 4-Tier Mathematical Function Generator for TYT & 11th Grade / AYT Curriculum:
 * 1. apprentice (Çırak / TYT Temel): Linear f(x) = ax + b
 * 2. explorer (Kaşif / TYT İleri): Absolute value f(x) = a|x - h| + k
 * 3. strategist (Stratejist / 11. Sınıf Giriş): Basic parabola f(x) = ±(x - r)^2 + k
 * 4. master (Usta / 11. Sınıf & AYT): Stretched/reflected/restricted parabola f(x) = a(x - r)^2 + k
 */

import { DifficultyTier } from './elo';
import { compileMathFunction, Point2D } from './mathParser';

export interface GeneratedFunctionProblem {
  id: string;
  difficulty: DifficultyTier;
  family: 'linear' | 'abs' | 'parabola' | 'master_parabola';
  equation: string; // clean display & parser-compatible formula
  promptMode: 'graph' | 'equation';
  domainMin: number | null; // null means (-∞, ∞)
  domainMax: number | null;
  domainLabel: string;
  rangeLabel: string;
  increasingLabel: string;
  decreasingLabel: string;
  xIntercepts: Point2D[];
  yIntercept: Point2D;
  vertex: Point2D | null; // null for linear
  slope: number | null; // only for linear
  symmetryAxis: number | null; // x = r for abs/parabola
  targetX: number; // ask player to evaluate [targetX, f(targetX)]
  targetPoint: Point2D;
  transformationNoteTr?: string;
  transformationNoteEn?: string;
}

function pickRandom<T>(arr: T[], rand: () => number): T {
  return arr[Math.floor(rand() * arr.length)];
}

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function fmtSigned(n: number): string {
  if (n === 0) return '';
  return n > 0 ? ` + ${n}` : ` - ${Math.abs(n)}`;
}

function fmtShift(r: number): string {
  if (r === 0) return 'x';
  return r > 0 ? `(x - ${r})` : `(x + ${Math.abs(r)})`;
}

function fmtAbsShift(h: number): string {
  if (h === 0) return '|x|';
  return h > 0 ? `|x - ${h}|` : `|x + ${Math.abs(h)}|`;
}

function fmtCoeff(a: number, attachTo: string): string {
  if (a === 1) return attachTo;
  if (a === -1) return `-${attachTo}`;
  return `${a}${attachTo}`;
}

export function generateFunctionProblem(
  difficulty: DifficultyTier,
  seed: number = Date.now()
): GeneratedFunctionProblem {
  const rand = createSeededRandom(seed);
  const promptMode: 'graph' | 'equation' = rand() > 0.45 ? 'graph' : 'equation';
  const id = `fn_${difficulty}_${seed}`;

  if (difficulty === 'apprentice') {
    const a = pickRandom([-3, -2, -1, 1, 2, 3], rand);
    // Ensure clean integer x-intercept by making b a multiple of a
    const root = pickRandom([-4, -3, -2, -1, 0, 1, 2, 3, 4], rand);
    const b = -a * root;
    const eq = `${fmtCoeff(a, 'x')}${fmtSigned(b)}`.trim();
    const targetX = pickRandom([-3, -2, -1, 1, 2, 3].filter((x) => x !== 0 && x !== root), rand);
    const targetY = a * targetX + b;

    return {
      id,
      difficulty,
      family: 'linear',
      equation: eq,
      promptMode,
      domainMin: null,
      domainMax: null,
      domainLabel: 'R',
      rangeLabel: 'R',
      increasingLabel: a > 0 ? 'R' : 'Yok / None',
      decreasingLabel: a < 0 ? 'R' : 'Yok / None',
      xIntercepts: [{ x: root, y: 0 }],
      yIntercept: { x: 0, y: b },
      vertex: null,
      slope: a,
      symmetryAxis: null,
      targetX,
      targetPoint: { x: targetX, y: targetY },
    };
  }

  if (difficulty === 'explorer') {
    const a = pickRandom([-2, -1, 1, 2], rand);
    const h = pickRandom([-3, -2, -1, 0, 1, 2, 3], rand);
    // Pick k so intercepts are clean integers or none
    const kChoices = a > 0 ? [-4, -2, 0, 2] : [-2, 0, 2, 4];
    const k = pickRandom(kChoices, rand);
    const eq = `${fmtCoeff(a, fmtAbsShift(h))}${fmtSigned(k)}`.trim();

    const evalFn = (x: number) => a * Math.abs(x - h) + k;
    const yIntercept = { x: 0, y: evalFn(0) };

    // Solve a|x-h| + k = 0 => |x-h| = -k/a
    const rhs = -k / a;
    const xIntercepts: Point2D[] = [];
    if (rhs === 0) {
      xIntercepts.push({ x: h, y: 0 });
    } else if (rhs > 0) {
      xIntercepts.push({ x: h - rhs, y: 0 }, { x: h + rhs, y: 0 });
    }

    const targetX = pickRandom([-3, -2, -1, 1, 2, 3].filter((x) => x !== h && x !== 0), rand);
    return {
      id,
      difficulty,
      family: 'abs',
      equation: eq,
      promptMode,
      domainMin: null,
      domainMax: null,
      domainLabel: 'R',
      rangeLabel: a > 0 ? `[${k}, ∞)` : `(-∞, ${k}]`,
      increasingLabel: a > 0 ? `[${h}, ∞)` : `(-∞, ${h}]`,
      decreasingLabel: a > 0 ? `(-∞, ${h}]` : `[${h}, ∞)`,
      xIntercepts,
      yIntercept,
      vertex: { x: h, y: k },
      slope: null,
      symmetryAxis: h,
      targetX,
      targetPoint: { x: targetX, y: evalFn(targetX) },
    };
  }

  if (difficulty === 'strategist') {
    const a = pickRandom([-1, 1], rand);
    const r = pickRandom([-3, -2, -1, 0, 1, 2, 3], rand);
    // Clean squares for k so roots are integers or clean no-root case
    const sqChoices = [0, 1, 4, 9];
    const sq = pickRandom(sqChoices, rand);
    const k = a > 0 ? (rand() > 0.25 ? -sq : 2) : rand() > 0.25 ? sq : -2;

    const base = r === 0 ? 'x^2' : `${fmtShift(r)}^2`;
    const eq = `${fmtCoeff(a, base)}${fmtSigned(k)}`.trim();
    const evalFn = (x: number) => a * Math.pow(x - r, 2) + k;

    const rhs = -k / a;
    const xIntercepts: Point2D[] = [];
    if (rhs === 0) {
      xIntercepts.push({ x: r, y: 0 });
    } else if (rhs > 0) {
      const d = Math.sqrt(rhs);
      xIntercepts.push({ x: r - d, y: 0 }, { x: r + d, y: 0 });
    }

    const targetX = pickRandom([-3, -2, -1, 1, 2, 3].filter((x) => x !== r && x !== 0), rand);
    return {
      id,
      difficulty,
      family: 'parabola',
      equation: eq,
      promptMode,
      domainMin: null,
      domainMax: null,
      domainLabel: 'R',
      rangeLabel: a > 0 ? `[${k}, ∞)` : `(-∞, ${k}]`,
      increasingLabel: a > 0 ? `[${r}, ∞)` : `(-∞, ${r}]`,
      decreasingLabel: a > 0 ? `(-∞, ${r}]` : `[${r}, ∞)`,
      xIntercepts,
      yIntercept: { x: 0, y: evalFn(0) },
      vertex: { x: r, y: k },
      slope: null,
      symmetryAxis: r,
      targetX,
      targetPoint: { x: targetX, y: evalFn(targetX) },
    };
  }

  // Tier 4: master (11th grade / AYT — stretch/compression, reflections, restricted domain)
  const a = pickRandom([-2, -0.5, 0.5, 2], rand);
  const r = pickRandom([-2, -1, 0, 1, 2], rand);
  const dRoot = pickRandom([0, 2], rand);
  const k = a > 0 ? -a * dRoot * dRoot : -a * dRoot * dRoot; // gives exact roots r ± dRoot

  const base = r === 0 ? 'x^2' : `${fmtShift(r)}^2`;
  const eq = `${fmtCoeff(a, base)}${fmtSigned(k)}`.trim();
  const evalFn = (x: number) => a * Math.pow(x - r, 2) + k;

  const useRestricted = rand() > 0.35;
  const domainMin = useRestricted ? r - 2 : null;
  const domainMax = useRestricted ? r + 2 : null;

  const xIntercepts: Point2D[] = [];
  if (dRoot === 0) {
    xIntercepts.push({ x: r, y: 0 });
  } else {
    const candidates = [r - dRoot, r + dRoot].filter(
      (x) => (domainMin === null || x >= domainMin) && (domainMax === null || x <= domainMax)
    );
    for (const cx of candidates) xIntercepts.push({ x: cx, y: 0 });
  }

  let rangeLabel: string;
  if (useRestricted && domainMin !== null && domainMax !== null) {
    const endY = evalFn(domainMax);
    const lo = Math.min(k, endY);
    const hi = Math.max(k, endY);
    rangeLabel = `[${lo}, ${hi}]`;
  } else {
    rangeLabel = a > 0 ? `[${k}, ∞)` : `(-∞, ${k}]`;
  }

  const domainLabel =
    useRestricted && domainMin !== null && domainMax !== null ? `[${domainMin}, ${domainMax}]` : 'R';

  const increasingLabel =
    useRestricted && domainMin !== null && domainMax !== null
      ? a > 0
        ? `[${r}, ${domainMax}]`
        : `[${domainMin}, ${r}]`
      : a > 0
        ? `[${r}, ∞)`
        : `(-∞, ${r}]`;

  const decreasingLabel =
    useRestricted && domainMin !== null && domainMax !== null
      ? a > 0
        ? `[${domainMin}, ${r}]`
        : `[${r}, ${domainMax}]`
      : a > 0
        ? `(-∞, ${r}]`
        : `[${r}, ∞)`;

  const targetX = r + (rand() > 0.5 ? 2 : -2);

  return {
    id,
    difficulty,
    family: 'master_parabola',
    equation: eq,
    promptMode,
    domainMin,
    domainMax,
    domainLabel,
    rangeLabel,
    increasingLabel,
    decreasingLabel,
    xIntercepts,
    yIntercept: { x: 0, y: evalFn(0) },
    vertex: { x: r, y: k },
    slope: null,
    symmetryAxis: r,
    targetX,
    targetPoint: { x: targetX, y: evalFn(targetX) },
    transformationNoteTr:
      a < 0 ? 'x-eksenine göre simetrik (-f(x)) ve ölçekli' : 'Ölçekli ve ötelenmiş parabol',
    transformationNoteEn:
      a < 0 ? 'Reflected across x-axis (-f(x)) and scaled' : 'Scaled and translated parabola',
  };
}

/**
 * Returns all integer lattice points (x, y) on the function inside the grid bounds.
 * Used for Function Battleship ship placement and hit verification.
 */
export function getIntegerLatticePoints(
  equation: string,
  minX = -7,
  maxX = 7,
  minY = -7,
  maxY = 7
): Point2D[] {
  const compiled = compileMathFunction(equation);
  if (!compiled.fn) return [];

  const points: Point2D[] = [];
  for (let x = minX; x <= maxX; x++) {
    const y = compiled.fn(x);
    if (!Number.isFinite(y)) continue;
    const rounded = Math.round(y);
    if (Math.abs(y - rounded) < 1e-6 && rounded >= minY && rounded <= maxY) {
      points.push({ x, y: rounded });
    }
  }
  return points;
}

/**
 * Validates whether a player's equation fits the chosen difficulty tier for Function Battleship.
 */
export function validateBattleshipEquation(
  equation: string,
  difficulty: DifficultyTier
): { ok: boolean; points: Point2D[]; reason?: string } {
  const compiled = compileMathFunction(equation);
  if (!compiled.fn || !compiled.normalized) {
    return { ok: false, points: [], reason: compiled.error || 'Invalid equation' };
  }

  const norm = compiled.normalized.toLowerCase();
  if (difficulty === 'apprentice' && (norm.includes('^') || norm.includes('|') || norm.includes('abs'))) {
    return { ok: false, points: [], reason: 'Apprentice tier requires linear functions (ax + b)' };
  }
  if (difficulty === 'explorer' && norm.includes('^')) {
    return { ok: false, points: [], reason: 'Explorer tier uses linear or absolute value functions' };
  }

  const points = getIntegerLatticePoints(equation, -7, 7, -7, 7);
  if (points.length < 3) {
    return {
      ok: false,
      points,
      reason: 'Function must pass through at least 3 integer grid points in [-7, 7]',
    };
  }
  return { ok: true, points };
}

/**
 * Preset templates per difficulty for rapid Function Battleship setup.
 */
export const BATTLESHIP_PRESETS: Record<DifficultyTier, string[]> = {
  apprentice: ['x + 2', '-x + 3', '2x - 1', '-2x + 4', 'x - 3'],
  explorer: ['|x - 2| - 3', '-|x + 1| + 4', '2|x| - 4', '-|x - 3| + 2'],
  strategist: ['(x - 1)^2 - 4', '-(x + 2)^2 + 5', 'x^2 - 5', '-(x - 2)^2 + 4'],
  master: ['0.5(x - 2)^2 - 3', '-0.5(x + 2)^2 + 4', '2(x - 1)^2 - 6', '-2(x + 1)^2 + 6'],
};
