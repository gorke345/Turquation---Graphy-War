import { DifficultyTier } from './elo';
import { BATTLESHIP_PRESETS, validateBattleshipEquation } from './functionGenerator';
import {
  FireDirection,
  GraphWarsObstacle,
  GraphWarsSoldier,
  GW_X_MAX,
  GW_X_MIN,
  traceClassicGraphWarsShot,
} from './graphWarsEngine';
import { Point2D } from './mathParser';

export interface PracticeBotShot {
  soldierId: string;
  direction: FireDirection;
  equation: string;
}

/**
 * Computes a fair, beatable Graph Wars shot for the offline Solo Practice Bot.
 * Evaluates candidate parabolic & wave curves from an alive bot soldier toward a
 * living player soldier, preferring obstacle-clearing arcs with slight organic jitter.
 */
export function computePracticeGraphWarsBotShot(params: {
  botId: string;
  botSoldiers: GraphWarsSoldier[];
  playerSoldiers: GraphWarsSoldier[];
  obstacles: GraphWarsObstacle[];
  difficulty: DifficultyTier;
  seed?: number;
}): PracticeBotShot | null {
  const aliveBot = params.botSoldiers.filter((s) => s.alive);
  const aliveTargets = params.playerSoldiers.filter((s) => s.alive);
  if (aliveBot.length === 0 || aliveTargets.length === 0) return null;

  const seed = params.seed ?? Date.now();
  const shooter = aliveBot[Math.abs(seed) % aliveBot.length];
  const target = aliveTargets[Math.abs(seed * 7 + 3) % aliveTargets.length];

  const dx = target.x - shooter.x;
  const dy = target.y - shooter.y;
  const direction: FireDirection = dx >= 0 ? 1 : -1;

  // Compute an exact parabola y - y0 = a*(x - x0)^2 + b*(x - x0) passing near target
  const safeDx = Math.abs(dx) < 1.5 ? (direction === 1 ? 4 : -4) : dx;
  const jitter = params.difficulty === 'apprentice' ? 1.8 : 0.9;
  const jitterSign = seed % 2 === 0 ? 1 : -1;
  const aimedDy = dy + jitterSign * jitter;

  const candidateCurvatures = [-0.035, -0.02, 0.025, -0.05, 0.04, 0];
  let bestEq = '-0.03*x^2 + 0.2*x';
  let bestScore = -Infinity;

  const allSoldiers = [...params.botSoldiers, ...params.playerSoldiers];

  for (const a of candidateCurvatures) {
    // We want f(x) = a*(x - x0)^2 + b*(x - x0) => at x = x0 + safeDx: a*safeDx^2 + b*safeDx = aimedDy
    const b = (aimedDy - a * safeDx * safeDx) / safeDx;
    const clampedB = Math.max(-2.5, Math.min(2.5, b));
    const aStr = Number(a.toFixed(4));
    const bStr = Number(clampedB.toFixed(3));
    const x0Str = shooter.x >= 0 ? `(x - ${shooter.x})` : `(x + ${Math.abs(shooter.x)})`;
    const eq =
      aStr === 0
        ? `${bStr}*x`
        : `${aStr}*${x0Str}^2 + (${bStr})*${x0Str}`;

    const traj = traceClassicGraphWarsShot({
      shooterId: params.botId,
      shooterName: 'Antrenman Botu',
      shooterColor: '#F43F5E',
      shooterSkinId: 'flame_nova',
      shooterAvatarId: 'flame_knight',
      soldier: shooter,
      direction,
      equation: eq,
      usedTytCards: false,
      obstacles: params.obstacles,
      allSoldiers,
      usernameByPlayerId: { [params.botId]: 'Antrenman Botu' },
    });

    if (!traj || traj.path.length < 3) continue;

    // Score trajectory: avoid immediate obstacle crash, reward proximity to target
    let minTargetDist = Infinity;
    for (const pt of traj.path) {
      const dist = Math.hypot(pt.x - target.x, pt.y - target.y);
      if (dist < minTargetDist) minTargetDist = dist;
    }

    const traveledX = Math.abs(traj.path[traj.path.length - 1].x - shooter.x);
    const hitBonus = traj.hits.length > 0 ? 12 : 0;
    const obstaclePenalty = traj.stopReason === 'obstacle' && traveledX < Math.abs(dx) * 0.65 ? -15 : 0;
    const score = hitBonus + obstaclePenalty - minTargetDist;

    if (score > bestScore) {
      bestScore = score;
      bestEq = eq;
    }
  }

  return {
    soldierId: shooter.id,
    direction,
    equation: bestEq,
  };
}

/**
 * Picks 2 distinct valid Battleship functions for the offline Practice Bot.
 */
export function pickPracticeBattleshipFleet(
  difficulty: DifficultyTier,
  seed = Date.now()
): string[] {
  const pool = BATTLESHIP_PRESETS[difficulty] || BATTLESHIP_PRESETS.apprentice;
  const validPool = pool.filter((eq) => validateBattleshipEquation(eq, difficulty).ok);
  if (validPool.length < 2) {
    return ['x + 1', '-x + 2'];
  }
  const idx1 = Math.abs(seed) % validPool.length;
  const idx2 = (idx1 + 1 + (Math.abs(seed * 3) % (validPool.length - 1))) % validPool.length;
  return [validPool[idx1], validPool[idx2]];
}

/**
 * Chooses the next Battleship [x, y] target for the offline Practice Bot.
 * Prefers integer neighbors around known hits; otherwise picks an unshot point in [-5, 5].
 */
export function computePracticeBattleshipMove(params: {
  previousShots: Array<{ x: number; y: number; hit: boolean }>;
  seed?: number;
}): Point2D {
  const tried = new Set(params.previousShots.map((s) => `${s.x},${s.y}`));
  const hits = params.previousShots.filter((s) => s.hit);

  // Hunt nearby lattice points around prior hits
  const offsets: Array<[number, number]> = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 2],
    [-1, -2],
  ];

  for (const h of hits) {
    for (const [dx, dy] of offsets) {
      const nx = h.x + dx;
      const ny = h.y + dy;
      if (nx >= -6 && nx <= 6 && ny >= -6 && ny <= 6 && !tried.has(`${nx},${ny}`)) {
        return { x: nx, y: ny };
      }
    }
  }

  // Otherwise scan structured search points in [-5, 5]
  const candidates: Point2D[] = [];
  for (let x = -5; x <= 5; x++) {
    for (let y = -5; y <= 5; y++) {
      if (!tried.has(`${x},${y}`)) {
        candidates.push({ x, y });
      }
    }
  }

  if (candidates.length === 0) {
    return { x: 0, y: 0 };
  }

  const seed = Math.abs(params.seed ?? Date.now());
  return candidates[seed % candidates.length];
}

/**
 * Generates a realistic benchmark Quiz Race round score for the offline Practice Bot.
 */
export function computePracticeQuizBotScore(
  totalFields: number,
  difficulty: DifficultyTier,
  seed = Date.now()
): { points: number; correctCount: number; totalFields: number } {
  const ratio = difficulty === 'apprentice' ? 0.65 : 0.78;
  const jitter = (Math.abs(seed) % 3) - 1; // -1, 0, +1
  const correctCount = Math.max(
    1,
    Math.min(totalFields, Math.round(totalFields * ratio) + jitter)
  );
  const speedBonus = 15 + (Math.abs(seed * 7) % 30);
  const points = correctCount * 25 + speedBonus;
  return { points, correctCount, totalFields };
}

/**
 * Pure helper validating whether a finished room can be reset into a Rematch lobby.
 */
export function canRematchRoom(params: {
  status: string;
  activePlayerCount: number;
  minPlayers: number;
}): boolean {
  return params.status === 'finished' && params.activePlayerCount >= Math.max(1, params.minPlayers);
}

export function clampCoordX(x: number): number {
  return Math.max(GW_X_MIN, Math.min(GW_X_MAX, x));
}
