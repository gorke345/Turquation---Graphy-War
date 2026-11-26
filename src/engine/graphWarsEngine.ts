/**
 * Classic Graphwar-Style "GRAPH WARS" Pure Physics & Arena Engine.
 *
 * - Coordinate plane: x ∈ [-25, 25], y ∈ [-15, 15]
 * - Seeded procedural obstacles (zero overlap with any soldier spawn)
 * - Multi-soldier roster: 3 soldiers per player (2–5 players) or 2 soldiers (6–10 players)
 * - Auto-aligned firing: y_actual(x) = f(x) - f(x0) + y0 (always exits cleanly from active soldier)
 * - Directional fire: Left (-1) or Right (+1) with step dx = 0.08
 * - One-shot elimination on enemy soldier hit, continuing through to allow multi-kill combos
 * - Stops with impact crater on obstacle hit, map bounds, NaN/Infinity, or max arc length
 */

import { createSeededRandom } from './functionGenerator';
import { compileMathFunction, Point2D } from './mathParser';

export const GW_X_MIN = -25;
export const GW_X_MAX = 25;
export const GW_Y_MIN = -15;
export const GW_Y_MAX = 15;
export const GW_STEP_DX = 0.08;
export const GW_MAX_ARC_LENGTH = 92;
export const GW_HIT_RADIUS = 0.95;
export const GW_SELF_SAFE_ARC = 1.65;
export const GW_PREVIEW_UNITS = 4.6;
export const GW_AIM_DURATION_MS = 30_000;
export const GW_FIRING_DURATION_MS = 4_800;

export type FireDirection = -1 | 1;

export interface GraphWarsSoldier {
  id: string;
  ownerId: string;
  index: number; // 0, 1, 2
  x: number;
  y: number;
  alive: boolean;
}

export interface GraphWarsObstacle {
  id: string;
  x: number;
  y: number;
  r: number;
}

export interface GraphWarsHitEvent {
  targetPlayerId: string;
  targetUsername: string;
  soldierId: string;
  soldierIndex: number;
  point: Point2D;
  playerEliminated: boolean;
}

export interface GraphWarsTrajectory {
  playerId: string;
  username: string;
  color: string;
  skinId: string;
  avatarId?: string;
  soldierId: string;
  direction: FireDirection;
  equation: string;
  usedTytCards: boolean;
  origin: Point2D;
  path: Point2D[];
  stopReason: 'obstacle' | 'bounds' | 'undefined' | 'arc_limit';
  impactPoint?: Point2D;
  hits: GraphWarsHitEvent[];
}

export interface GraphWarsLockedShot {
  soldierId: string;
  direction: FireDirection;
  equation: string;
  usedTytCards: boolean;
}

export interface GeneratedArenaMap {
  obstacles: GraphWarsObstacle[];
  soldiersByPlayer: Record<string, GraphWarsSoldier[]>;
  soldiersPerPlayer: number;
}

/**
 * Evaluates an auto-aligned Graphwar curve passing through origin (x0, y0):
 *   y_actual(x) = f(x) - f(x0) + y0
 */
export function evaluateAlignedPoint(
  fn: (x: number) => number,
  x: number,
  origin: Point2D,
  originFnVal?: number
): number {
  const f0 = originFnVal !== undefined ? originFnVal : fn(origin.x);
  if (!Number.isFinite(f0)) return NaN;
  const fx = fn(x);
  if (!Number.isFinite(fx)) return NaN;
  return fx - f0 + origin.y;
}

/**
 * Generates a short directional aim preview (first ~4.6 units along dir)
 * without spoiling the full trajectory across the map.
 */
export function traceAimPreview(
  equation: string,
  origin: Point2D,
  direction: FireDirection,
  maxDist = GW_PREVIEW_UNITS
): { ok: boolean; points: Point2D[]; error?: string } {
  const compiled = compileMathFunction(equation);
  if (!compiled.fn) {
    return { ok: false, points: [], error: compiled.error || 'Invalid equation' };
  }
  const f0 = compiled.fn(origin.x);
  if (!Number.isFinite(f0)) {
    return { ok: false, points: [], error: 'f(x0) is undefined at active soldier position' };
  }

  const points: Point2D[] = [{ x: origin.x, y: origin.y }];
  let arcLen = 0;
  let prevX = origin.x;
  let prevY = origin.y;

  for (let dist = GW_STEP_DX; dist <= maxDist; dist += GW_STEP_DX) {
    const x = origin.x + direction * dist;
    if (x < GW_X_MIN || x > GW_X_MAX) break;
    const y = evaluateAlignedPoint(compiled.fn, x, origin, f0);
    if (!Number.isFinite(y) || y < GW_Y_MIN || y > GW_Y_MAX) break;
    const seg = Math.hypot(x - prevX, y - prevY);
    if (seg > 3.5) break; // Discontinuity guard (vertical asymptote)
    arcLen += seg;
    if (arcLen > maxDist * 1.65) break;
    points.push({ x, y });
    prevX = x;
    prevY = y;
  }

  return { ok: true, points };
}

/**
 * Generates deterministic seeded obstacles and non-overlapping multi-soldier spawns
 * across x ∈ [-25, 25], y ∈ [-15, 15].
 */
export function generateGraphWarsMap(
  seed: number,
  playerIds: string[]
): GeneratedArenaMap {
  const rand = createSeededRandom(seed);
  const count = Math.max(1, playerIds.length);
  const soldiersPerPlayer = count <= 5 ? 3 : 2;

  const obstacles: GraphWarsObstacle[] = [];
  const targetObstacles = 10 + Math.floor(rand() * 4); // 10–13 asteroids/barriers

  // 1. Place central & flanking obstacles first with clean spacing
  let attempts = 0;
  while (obstacles.length < targetObstacles && attempts < 240) {
    attempts++;
    const x = Number(((rand() * 38) - 19).toFixed(1)); // [-19, 19]
    const y = Number(((rand() * 22) - 11).toFixed(1)); // [-11, 11]
    const r = Number((1.3 + rand() * 1.9).toFixed(2)); // [1.3, 3.2]

    const overlapsObstacle = obstacles.some(
      (o) => Math.hypot(o.x - x, o.y - y) < o.r + r + 1.4
    );
    if (overlapsObstacle) continue;

    obstacles.push({
      id: `obs_${obstacles.length + 1}`,
      x,
      y,
      r,
    });
  }

  // 2. Spawn soldiers per player with generous clearance from all obstacles & other soldiers
  //    so characters and their nameplates remain crisp and readable at all times.
  const allPlacedSoldiers: GraphWarsSoldier[] = [];
  const soldiersByPlayer: Record<string, GraphWarsSoldier[]> = {};
  const idealSpacing = count <= 4 ? 6.2 : 4.8;
  const fallbackMinSpacing = count <= 4 ? 4.8 : 3.9;

  playerIds.forEach((pid, pIdx) => {
    const mySoldiers: GraphWarsSoldier[] = [];

    for (let sIdx = 0; sIdx < soldiersPerPlayer; sIdx++) {
      let placed: Point2D | null = null;

      for (let tries = 0; tries < 240; tries++) {
        let sx: number;
        let sy: number;

        if (count === 2) {
          // Classic Graphwar left-vs-right flanks with well-separated vertical bands
          const sideSign = pIdx === 0 ? -1 : 1;
          sx = sideSign * (10.5 + rand() * 12.2); // [-22.7, -10.5] or [10.5, 22.7]
          const bandHeight = 25 / soldiersPerPlayer;
          const bandBase = -12.5 + sIdx * bandHeight;
          sy = bandBase + 1.1 + rand() * Math.max(1.4, bandHeight - 2.2);
        } else {
          // Balanced angular sectors around the battlefield for 3–10 players
          const sectorStep = (Math.PI * 2) / count;
          const baseAngle =
            pIdx * sectorStep +
            (sIdx - (soldiersPerPlayer - 1) / 2) * Math.min(0.36, sectorStep * 0.34) +
            (rand() - 0.5) * 0.12;
          const radiusScale = 0.56 + rand() * 0.36;
          sx = Math.cos(baseAngle) * 22.0 * radiusScale;
          sy = Math.sin(baseAngle) * 12.6 * radiusScale;
        }

        sx = Number(Math.max(GW_X_MIN + 2.4, Math.min(GW_X_MAX - 2.4, sx)).toFixed(1));
        sy = Number(Math.max(GW_Y_MIN + 2.2, Math.min(GW_Y_MAX - 2.2, sy)).toFixed(1));

        const minObsClearance = tries < 160 ? 2.15 : 1.75;
        const hitsObstacle = obstacles.some(
          (obs) => Math.hypot(obs.x - sx, obs.y - sy) < obs.r + minObsClearance
        );
        if (hitsObstacle) continue;

        const minSoldierDist = tries < 140 ? idealSpacing : tries < 200 ? fallbackMinSpacing : 4.0;
        const tooCloseToSoldier = allPlacedSoldiers.some(
          (s) => Math.hypot(s.x - sx, s.y - sy) < minSoldierDist
        );
        if (tooCloseToSoldier) continue;

        placed = { x: sx, y: sy };
        break;
      }

      // Smart grid fallback: pick the open point on the player's side maximizing clearance
      if (!placed) {
        let bestPt: Point2D = {
          x: pIdx % 2 === 0 ? -22.5 : 22.5,
          y: -9 + sIdx * 9,
        };
        let bestScore = -Infinity;
        const sideSign = count === 2 ? (pIdx === 0 ? -1 : 1) : 0;

        for (let gx = -22; gx <= 22; gx += 2) {
          if (sideSign < 0 && gx > -8) continue;
          if (sideSign > 0 && gx < 8) continue;
          for (let gy = -12; gy <= 12; gy += 2) {
            const minObs = obstacles.reduce(
              (acc, o) => Math.min(acc, Math.hypot(o.x - gx, o.y - gy) - o.r),
              99
            );
            if (minObs < 1.55) continue;
            const minSol = allPlacedSoldiers.reduce(
              (acc, s) => Math.min(acc, Math.hypot(s.x - gx, s.y - gy)),
              99
            );
            const score = Math.min(minSol, 10) * 2 + Math.min(minObs, 5);
            if (score > bestScore) {
              bestScore = score;
              bestPt = { x: gx, y: gy };
            }
          }
        }
        placed = bestPt;
      }

      const soldier: GraphWarsSoldier = {
        id: `${pid}_s${sIdx}`,
        ownerId: pid,
        index: sIdx,
        x: placed.x,
        y: placed.y,
        alive: true,
      };
      mySoldiers.push(soldier);
      allPlacedSoldiers.push(soldier);
    }

    soldiersByPlayer[pid] = mySoldiers;
  });

  return {
    obstacles,
    soldiersByPlayer,
    soldiersPerPlayer,
  };
}

/**
 * Picks a smart default firing direction (+1 right or -1 left) aimed toward
 * the average x-position of alive enemy soldiers.
 */
export function getDefaultFireDirection(
  origin: Point2D,
  enemySoldiers: GraphWarsSoldier[]
): FireDirection {
  const aliveEnemies = enemySoldiers.filter((s) => s.alive);
  if (aliveEnemies.length === 0) {
    return origin.x <= 0 ? 1 : -1;
  }
  const avgEnemyX = aliveEnemies.reduce((sum, s) => sum + s.x, 0) / aliveEnemies.length;
  return avgEnemyX >= origin.x ? 1 : -1;
}

/**
 * Simulates a single classic Graphwar auto-aligned shot step-by-step (dx = 0.08).
 * - Never harms shooter's own soldiers.
 * - Eliminates enemy soldiers in ONE SHOT and continues flying (allowing multi-kills).
 * - Stops on obstacle collision, map boundary, undefined math value, or max arc length.
 */
export function traceClassicGraphWarsShot(params: {
  shooterId: string;
  shooterName: string;
  shooterColor: string;
  shooterSkinId: string;
  shooterAvatarId?: string;
  soldier: GraphWarsSoldier;
  direction: FireDirection;
  equation: string;
  usedTytCards: boolean;
  obstacles: GraphWarsObstacle[];
  allSoldiers: GraphWarsSoldier[];
  usernameByPlayerId: Record<string, string>;
}): GraphWarsTrajectory | null {
  const {
    shooterId,
    shooterName,
    shooterColor,
    shooterSkinId,
    shooterAvatarId,
    soldier,
    direction,
    equation,
    usedTytCards,
    obstacles,
    allSoldiers,
    usernameByPlayerId,
  } = params;

  const compiled = compileMathFunction(equation);
  if (!compiled.fn) return null;

  const origin: Point2D = { x: soldier.x, y: soldier.y };
  const f0 = compiled.fn(origin.x);
  if (!Number.isFinite(f0)) {
    return {
      playerId: shooterId,
      username: shooterName,
      color: shooterColor,
      skinId: shooterSkinId,
      avatarId: shooterAvatarId,
      soldierId: soldier.id,
      direction,
      equation: equation.trim(),
      usedTytCards,
      origin,
      path: [origin],
      stopReason: 'undefined',
      impactPoint: origin,
      hits: [],
    };
  }

  const path: Point2D[] = [{ x: Number(origin.x.toFixed(2)), y: Number(origin.y.toFixed(2)) }];
  const hits: GraphWarsHitEvent[] = [];
  const hitSoldierIds = new Set<string>();

  let arcLen = 0;
  let prevX = origin.x;
  let prevY = origin.y;
  let stopReason: GraphWarsTrajectory['stopReason'] = 'bounds';
  let impactPoint: Point2D | undefined;

  // Track enemy alive counts locally so we accurately mark playerEliminated
  const aliveCounts = new Map<string, number>();
  for (const s of allSoldiers) {
    if (s.alive) {
      aliveCounts.set(s.ownerId, (aliveCounts.get(s.ownerId) || 0) + 1);
    }
  }

  const maxSteps = Math.ceil((GW_X_MAX - GW_X_MIN) / GW_STEP_DX) + 2;

  for (let stepIdx = 1; stepIdx <= maxSteps; stepIdx++) {
    const x = origin.x + direction * stepIdx * GW_STEP_DX;
    if (x < GW_X_MIN || x > GW_X_MAX) {
      stopReason = 'bounds';
      impactPoint = { x: Number(prevX.toFixed(2)), y: Number(prevY.toFixed(2)) };
      break;
    }

    const y = evaluateAlignedPoint(compiled.fn, x, origin, f0);
    if (!Number.isFinite(y)) {
      stopReason = 'undefined';
      impactPoint = { x: Number(prevX.toFixed(2)), y: Number(prevY.toFixed(2)) };
      break;
    }

    const segLen = Math.hypot(x - prevX, y - prevY);
    // Vertical asymptote / huge discontinuity guard
    if (segLen > 5.0) {
      stopReason = 'undefined';
      impactPoint = { x: Number(prevX.toFixed(2)), y: Number(prevY.toFixed(2)) };
      break;
    }

    if (y < GW_Y_MIN || y > GW_Y_MAX) {
      stopReason = 'bounds';
      impactPoint = { x: Number(prevX.toFixed(2)), y: Number(prevY.toFixed(2)) };
      break;
    }

    arcLen += segLen;
    const pt: Point2D = { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };

    // Obstacle collision check (after tiny exit clearance)
    const hitObs = obstacles.find(
      (obs) => Math.hypot(x - obs.x, y - obs.y) <= obs.r
    );
    if (hitObs && arcLen > 0.35) {
      path.push(pt);
      stopReason = 'obstacle';
      impactPoint = pt;
      break;
    }

    // Subsample stored points slightly when slope is gentle to keep RTDB payloads fast & compact
    if (stepIdx % 2 === 0 || segLen > 0.25) {
      path.push(pt);
    }

    // Enemy soldier one-shot elimination check (continues flying after hit for multi-kills!)
    for (const target of allSoldiers) {
      if (!target.alive) continue;
      if (target.ownerId === shooterId) {
        // Self-protection: never harm own soldier
        continue;
      }
      if (hitSoldierIds.has(target.id)) continue;

      if (Math.hypot(x - target.x, y - target.y) <= GW_HIT_RADIUS) {
        hitSoldierIds.add(target.id);
        const remaining = Math.max(0, (aliveCounts.get(target.ownerId) || 1) - 1);
        aliveCounts.set(target.ownerId, remaining);
        hits.push({
          targetPlayerId: target.ownerId,
          targetUsername: usernameByPlayerId[target.ownerId] || 'Player',
          soldierId: target.id,
          soldierIndex: target.index,
          point: pt,
          playerEliminated: remaining === 0,
        });
      }
    }

    prevX = x;
    prevY = y;

    if (arcLen >= GW_MAX_ARC_LENGTH) {
      stopReason = 'arc_limit';
      impactPoint = pt;
      break;
    }
  }

  return {
    playerId: shooterId,
    username: shooterName,
    color: shooterColor,
    skinId: shooterSkinId,
    avatarId: shooterAvatarId,
    soldierId: soldier.id,
    direction,
    equation: equation.trim(),
    usedTytCards,
    origin,
    path,
    stopReason,
    impactPoint,
    hits,
  };
}

export type TytCardFamily = 'parabola' | 'linear' | 'abs' | 'wave';

export interface TytCardConfig {
  family: TytCardFamily;
  a: number;
  h: number;
}

/**
 * Builds a clean mathematical equation string from TYT-Friendly Curve Cards.
 * Because Graphwar auto-aligns vertically to active soldier (x0, y0), no +k term is required!
 */
export function buildTytCardEquation(cfg: TytCardConfig): string {
  const { family, a, h } = cfg;
  if (family === 'linear') {
    return `${a}x`;
  }
  if (family === 'abs') {
    const inner = h === 0 ? '|x|' : h > 0 ? `|x - ${h}|` : `|x + ${Math.abs(h)}|`;
    return `${a}${inner}`;
  }
  if (family === 'wave') {
    const freq = Math.max(0.2, Math.min(1.2, Number((0.4 + Math.abs(h) * 0.05).toFixed(2))));
    return `${a}sin(${freq}x)`;
  }
  // parabola
  const shift = h === 0 ? 'x^2' : h > 0 ? `(x - ${h})^2` : `(x + ${Math.abs(h)})^2`;
  return `${a}${shift}`;
}

/**
 * Computes final Graph Wars rankings, penalizing disconnected/forfeited players cleanly.
 */
export function computeGraphWarsStandings<
  T extends {
    id: string;
    alive?: boolean;
    disconnected?: boolean;
    soldiers?: GraphWarsSoldier[];
    score: number;
    kills?: number;
    eliminatedRound?: number;
  }
>(players: T[]): Array<{ id: string; rank: number; score: number }> {
  const sorted = [...players].sort((a, b) => {
    // Disconnected / rage-quit players rank at the bottom
    const aForfeit = Boolean(a.disconnected);
    const bForfeit = Boolean(b.disconnected);
    if (aForfeit !== bForfeit) return aForfeit ? 1 : -1;

    // Alive players rank above eliminated players
    const toAliveCount = (p: T) => {
      if (Array.isArray(p.soldiers)) return p.soldiers.filter((s) => s && s.alive).length;
      if (p.soldiers && typeof p.soldiers === 'object') {
        return Object.values(p.soldiers as Record<string, GraphWarsSoldier>).filter((s) => s && s.alive).length;
      }
      return p.alive ? 1 : 0;
    };
    const aAlive = toAliveCount(a);
    const bAlive = toAliveCount(b);
    if ((bAlive > 0) !== (aAlive > 0)) return bAlive > 0 ? 1 : -1;

    // Later elimination round ranks higher
    if (bAlive === 0 && aAlive === 0 && (b.eliminatedRound || 0) !== (a.eliminatedRound || 0)) {
      return (b.eliminatedRound || 0) - (a.eliminatedRound || 0);
    }

    // More surviving soldiers ranks higher
    if (bAlive !== aAlive) return bAlive - aAlive;

    // Kills & score tiebreakers
    if ((b.kills || 0) !== (a.kills || 0)) return (b.kills || 0) - (a.kills || 0);
    return (b.score || 0) - (a.score || 0);
  });

  return sorted.map((p, idx) => ({
    id: p.id,
    rank: idx + 1,
    score: p.score || 0,
  }));
}
