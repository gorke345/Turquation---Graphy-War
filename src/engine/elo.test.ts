import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyForfeitEloDiscount,
  calculate1v1Elo,
  calculateMultiplayerElo,
  getMatchmakingEloTolerance,
  canPlayersMatchRanked,
  MODE_K_FACTOR,
} from './elo';

test('1v1 Chess.com Elo awards symmetric delta for equal players and larger delta for upset', () => {
  const equal = calculate1v1Elo(1000, 1000, 1);
  assert.equal(equal.deltaA, 16);
  assert.equal(equal.deltaB, -16);

  const upset = calculate1v1Elo(900, 1200, 1);
  assert.ok(upset.deltaA > 24);
  assert.ok(upset.deltaB < -24);
});

test('GRAPH WARS has the strictly highest K-factor across all modes', () => {
  assert.ok(MODE_K_FACTOR.graph_wars > MODE_K_FACTOR.quiz_race);
  assert.ok(MODE_K_FACTOR.graph_wars > MODE_K_FACTOR.battleship);
});

test('multiplayer ranked Elo follows top-3 descending, middle=0, and progressive loss below middle', () => {
  const players = [1, 2, 3, 4, 5, 6, 7].map((rank) => ({
    id: `p${rank}`,
    elo: 1000,
    rank,
  }));

  const results = calculateMultiplayerElo(players, 'graph_wars');
  const byRank = (r: number) => results.find((x) => x.id === `p${r}`)!.delta;

  // Top 3 positive and strictly ordered: 1st > 2nd > 3rd > 0
  assert.ok(byRank(1) > byRank(2));
  assert.ok(byRank(2) > byRank(3));
  assert.ok(byRank(3) > 0);

  // Exact middle (4 of 7) is 0 (no loss)
  assert.equal(byRank(4), 0);

  // Below middle loses Elo progressively: 5th > 6th > 7th (more negative toward last place)
  assert.ok(byRank(5) < 0);
  assert.ok(byRank(6) < byRank(5));
  assert.ok(byRank(7) < byRank(6));
});

test('TYT Card Assist in GRAPH WARS significantly reduces Elo gain (40%)', () => {
  const standard = calculateMultiplayerElo(
    [
      { id: 'a', elo: 1000, rank: 1, usedTytCards: false },
      { id: 'b', elo: 1000, rank: 2, usedTytCards: false },
      { id: 'c', elo: 1000, rank: 3, usedTytCards: false },
    ],
    'graph_wars'
  );
  const tytAssisted = calculateMultiplayerElo(
    [
      { id: 'a', elo: 1000, rank: 1, usedTytCards: true },
      { id: 'b', elo: 1000, rank: 2, usedTytCards: false },
      { id: 'c', elo: 1000, rank: 3, usedTytCards: false },
    ],
    'graph_wars'
  );

  const dStd = standard.find((x) => x.id === 'a')!.delta;
  const dTyt = tytAssisted.find((x) => x.id === 'a')!.delta;
  assert.ok(dTyt > 0);
  assert.equal(dTyt, Math.round(dStd * 0.4));
});

test('matchmaking tolerance starts at ±100 and expands ±50 every 15 seconds', () => {
  assert.equal(getMatchmakingEloTolerance(0), 100);
  assert.equal(getMatchmakingEloTolerance(14), 100);
  assert.equal(getMatchmakingEloTolerance(15), 150);
  assert.equal(getMatchmakingEloTolerance(30), 200);

  assert.equal(canPlayersMatchRanked(1000, 0, 1140, 0), false);
  assert.equal(canPlayersMatchRanked(1000, 16, 1140, 0), true);
});

test('forfeited/leaving opponent loses strictly less Elo than a normal full loss', () => {
  assert.equal(applyForfeitEloDiscount(-28), -14);
  assert.equal(applyForfeitEloDiscount(-16), -8);
  assert.equal(applyForfeitEloDiscount(-1), -1);
  assert.equal(applyForfeitEloDiscount(12), 12);

  const normal2p = calculateMultiplayerElo(
    [
      { id: 'winner', elo: 1000, rank: 1 },
      { id: 'loser', elo: 1000, rank: 2, forfeited: false },
    ],
    'graph_wars'
  );
  const forfeit2p = calculateMultiplayerElo(
    [
      { id: 'winner', elo: 1000, rank: 1 },
      { id: 'loser', elo: 1000, rank: 2, forfeited: true },
    ],
    'graph_wars'
  );

  const normalLoss = normal2p.find((x) => x.id === 'loser')!.delta;
  const forfeitLoss = forfeit2p.find((x) => x.id === 'loser')!.delta;
  assert.ok(normalLoss < 0);
  assert.ok(forfeitLoss < 0);
  assert.ok(Math.abs(forfeitLoss) < Math.abs(normalLoss));
  assert.equal(forfeit2p.find((x) => x.id === 'winner')!.delta, normal2p.find((x) => x.id === 'winner')!.delta);
});
