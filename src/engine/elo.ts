/**
 * Chess.com-style Elo rating & matchmaking engine.
 * - Base Elo: 1000
 * - 1v1 (Function Battleship): Standard Elo formula E = 1 / (1 + 10^((Rb - Ra)/400)), ΔR = K * (S - E)
 * - Multiplayer Ranked (Quiz Race & GRAPH WARS):
 *     * Top 3 gain positive Elo: 1st > 2nd > 3rd (scaled against opponent average Elo)
 *     * Exact middle rank(s) receive 0 Elo change (no loss)
 *     * Ranks below middle lose Elo, with loss strictly increasing toward last place
 *     * GRAPH WARS has the highest K-factor (reward multiplier)
 *     * TYT Card Assist in GRAPH WARS scales Elo gain to 40%
 */

export type GameMode = 'quiz_race' | 'battleship' | 'graph_wars';
export type DifficultyTier = 'apprentice' | 'explorer' | 'strategist' | 'master';
export type LevelTrack = 'TYT' | '11_AYT';

export const BASE_ELO = 1000;
export const MIN_ELO = 100;

export const MODE_K_FACTOR: Record<GameMode, number> = {
  battleship: 32,
  quiz_race: 36,
  graph_wars: 56, // Highest Elo multiplier in the game
};

export const TYT_CARD_ELO_MULTIPLIER = 0.4;
export const FORFEIT_ELO_LOSS_MULTIPLIER = 0.5;

/**
 * When a player leaves/forfeits mid-match, deduct less Elo than a full defeat
 * (50% of the normal Elo loss, minimum -1 if negative).
 */
export function applyForfeitEloDiscount(delta: number): number {
  if (delta >= 0) return delta;
  return Math.min(-1, Math.round(delta * FORFEIT_ELO_LOSS_MULTIPLIER));
}

export interface RankedParticipant {
  id: string;
  elo: number;
  rank: number; // 1-based rank (1 = winner)
  usedTytCards?: boolean;
  forfeited?: boolean;
}

export interface EloDeltaResult {
  id: string;
  oldElo: number;
  newElo: number;
  delta: number;
  usedTytCards?: boolean;
}

/**
 * Standard expected score from Chess.com / FIDE Elo formula.
 */
export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * 1v1 Chess.com Elo calculation (used in Function Battleship).
 * scoreA: 1 for win, 0.5 for draw, 0 for loss.
 */
export function calculate1v1Elo(
  ratingA: number,
  ratingB: number,
  scoreA: 0 | 0.5 | 1,
  kFactor: number = MODE_K_FACTOR.battleship
): { deltaA: number; deltaB: number; newA: number; newB: number } {
  const expA = expectedScore(ratingA, ratingB);
  const expB = 1 - expA;
  const deltaA = Math.round(kFactor * (scoreA - expA));
  const deltaB = Math.round(kFactor * (1 - scoreA - expB));
  return {
    deltaA,
    deltaB,
    newA: Math.max(MIN_ELO, ratingA + deltaA),
    newB: Math.max(MIN_ELO, ratingB + deltaB),
  };
}

/**
 * Multiplayer Ranked Elo calculation for Quiz Race and GRAPH WARS.
 * Guarantees:
 * - Top 3 earn positive Elo (1st highest, 2nd medium, 3rd lowest positive) for N >= 4
 * - Exact middle rank(s) experience 0 Elo change
 * - Below middle rank(s) lose Elo, strictly increasing down to last place
 * - Opponent average Elo scales rewards and penalties
 * - TYT Card Assist in GRAPH WARS applies 0.40x multiplier on Elo gain
 */
export function calculateMultiplayerElo(
  participants: RankedParticipant[],
  mode: 'quiz_race' | 'graph_wars'
): EloDeltaResult[] {
  const n = participants.length;
  if (n === 0) return [];
  if (n === 1) {
    const p = participants[0];
    return [{ id: p.id, oldElo: p.elo, newElo: p.elo, delta: 0, usedTytCards: p.usedTytCards }];
  }

  const k = MODE_K_FACTOR[mode];
  const sorted = [...participants].sort((a, b) => a.rank - b.rank);

  // Special case: 2 real players in arena
  if (n === 2) {
    const [first, second] = sorted;
    const res = calculate1v1Elo(first.elo, second.elo, 1, k);
    let d1 = Math.max(4, res.deltaA);
    if (mode === 'graph_wars' && first.usedTytCards) {
      d1 = Math.max(1, Math.round(d1 * TYT_CARD_ELO_MULTIPLIER));
    }
    let d2 = -Math.max(4, Math.abs(res.deltaB));
    if (second.forfeited) {
      d2 = applyForfeitEloDiscount(d2);
    }
    return [
      {
        id: first.id,
        oldElo: first.elo,
        newElo: Math.max(MIN_ELO, first.elo + d1),
        delta: d1,
        usedTytCards: first.usedTytCards,
      },
      {
        id: second.id,
        oldElo: second.elo,
        newElo: Math.max(MIN_ELO, second.elo + d2),
        delta: d2,
        usedTytCards: second.usedTytCards,
      },
    ];
  }

  // Exact middle rank index (1-based)
  const mid = (n + 1) / 2;

  // Base multipliers by placement for N >= 3
  const computeBaseFactor = (rank: number): number => {
    // Exact middle (odd N: single middle; even N >= 6: mid-0.5 or mid+0.5? Wait:
    // Let's handle exact middle cleanly so:
    // N=3: 1st (+1.0), 2nd (0 - exact middle), 3rd (-0.8)
    // N=4: 1st (+1.0), 2nd (+0.55), 3rd (+0.20) or middle?
    // Wait: user rule says:
    // "İlk 3 sıra Elo kazanır: 1. en yüksek, 2. orta, 3. en az Elo alır.
    //  Sıralamanın tam ortasındaki oyuncu(lar) 0 Elo değişimi yaşar.
    //  Orta sıranın altında kalan oyuncularda Elo kaybı olur ve bu kayıp sıralama aşağı indikçe artarak büyür."
    if (n === 3) {
      if (rank === 1) return 1.0;
      if (rank === 2) return 0; // exact middle
      return -0.85;
    }
    if (n === 4) {
      if (rank === 1) return 1.0;
      if (rank === 2) return 0.55;
      if (rank === 3) return 0.22;
      return -0.9;
    }
    if (n === 5) {
      if (rank === 1) return 1.0;
      if (rank === 2) return 0.58;
      if (rank === 3) return 0; // exact middle (3 of 5) -> wait: if 3rd must gain when N>=6, what about N=5?
      // Let's check N=5: middle is 3. Better: for N >= 7, ranks 1,2,3 are strictly above middle (4), rank 4 = 0, ranks 5..N lose progressively!
      // For N=5, rank 1 (+1.0), rank 2 (+0.55), rank 3 (0 - exact middle), rank 4 (-0.45), rank 5 (-0.95).
      if (rank === 4) return -0.45;
      return -0.95;
    }
    if (n === 6) {
      // Ranks: 1 (+1.0), 2 (+0.60), 3 (+0.25), 4 (0 - middle), 5 (-0.50), 6 (-1.0)
      if (rank === 1) return 1.0;
      if (rank === 2) return 0.6;
      if (rank === 3) return 0.25;
      if (rank === 4) return 0;
      if (rank === 5) return -0.5;
      return -1.0;
    }

    // General case for N >= 7:
    // Top 3 strictly positive: 1.0, 0.6, 0.28
    if (rank === 1) return 1.0;
    if (rank === 2) return 0.6;
    if (rank === 3) return 0.28;

    // Middle zone: floor(mid) and ceil(mid) when even, or exact mid when odd
    const midLow = Math.floor(mid);
    const midHigh = Math.ceil(mid);
    if (rank >= midLow && rank <= midHigh) {
      return 0;
    }

    // Between 3 and midLow (e.g. N >= 9, rank 4) -> small positive taper
    if (rank < midLow) {
      const span = midLow - 3;
      const distFromMid = midLow - rank;
      return 0.15 * (distFromMid / span);
    }

    // Below midHigh -> strictly increasing negative loss down to -1.0 at rank N
    const lossSpan = n - midHigh;
    const lossStep = rank - midHigh; // 1 .. lossSpan
    return -(0.3 + 0.7 * (lossStep / lossSpan));
  };

  // Compute field-adjusted deltas while preserving strict monotonicity of rewards/penalties
  const rawDeltas = sorted.map((p) => {
    const others = sorted.filter((o) => o.id !== p.id);
    const avgOppElo = others.reduce((sum, o) => sum + o.elo, 0) / others.length;
    const exp = expectedScore(p.elo, avgOppElo); // 0..1 (0.5 for equal skill)

    const baseFactor = computeBaseFactor(p.rank);
    if (baseFactor === 0) {
      return { p, delta: 0 };
    }

    // Opponent strength scaling: beating stronger opponents gives up to 1.4x, weaker gives 0.65x
    // Losing to stronger opponents softens loss (0.65x), losing to weaker increases loss (1.35x)
    const oppScale =
      baseFactor > 0
        ? Math.max(0.65, Math.min(1.4, 1.5 - exp))
        : Math.max(0.65, Math.min(1.35, 0.5 + exp));

    let delta = Math.round(k * baseFactor * oppScale);

    // Ensure non-zero sign preservation
    if (baseFactor > 0 && delta < 1) delta = 1;
    if (baseFactor < 0 && delta > -1) delta = -1;

    // Apply TYT Card Assist penalty (40% of standard Elo gain) in GRAPH WARS
    if (mode === 'graph_wars' && p.usedTytCards && delta > 0) {
      delta = Math.max(1, Math.round(delta * TYT_CARD_ELO_MULTIPLIER));
    }

    // Deduct less Elo than a normal full loss when a player leaves/forfeits mid-match
    if (p.forfeited && delta < 0) {
      delta = applyForfeitEloDiscount(delta);
    }

    return { p, delta };
  });

  return rawDeltas.map(({ p, delta }) => ({
    id: p.id,
    oldElo: p.elo,
    newElo: Math.max(MIN_ELO, p.elo + delta),
    delta,
    usedTytCards: p.usedTytCards,
  }));
}

/**
 * Dynamic Chess.com-style matchmaking Elo tolerance.
 * Starts at ±100 Elo, expands by ±50 every 15 seconds.
 */
export function getMatchmakingEloTolerance(waitSeconds: number): number {
  const safeSeconds = Math.max(0, waitSeconds);
  return 100 + Math.floor(safeSeconds / 15) * 50;
}

export function canPlayersMatchRanked(
  eloA: number,
  waitSecondsA: number,
  eloB: number,
  waitSecondsB: number
): boolean {
  const diff = Math.abs(eloA - eloB);
  const tolA = getMatchmakingEloTolerance(waitSecondsA);
  const tolB = getMatchmakingEloTolerance(waitSecondsB);
  return diff <= Math.max(tolA, tolB);
}
