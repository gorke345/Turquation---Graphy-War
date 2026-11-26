import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTytCardEquation,
  computeGraphWarsStandings,
  evaluateAlignedPoint,
  generateGraphWarsMap,
  GW_X_MAX,
  GW_X_MIN,
  GW_Y_MAX,
  GW_Y_MIN,
  traceAimPreview,
  traceClassicGraphWarsShot,
} from './graphWarsEngine';
import { getLeagueProgress } from './skins';

test('generateGraphWarsMap places 3 soldiers for 2-5 players and 2 for 6-10 with zero obstacle overlap', () => {
  const map2 = generateGraphWarsMap(4242, ['p1', 'p2']);
  assert.equal(map2.soldiersPerPlayer, 3);
  assert.equal(map2.soldiersByPlayer.p1.length, 3);
  assert.equal(map2.soldiersByPlayer.p2.length, 3);
  assert.ok(map2.obstacles.length >= 8);

  const allSoldiers = [...map2.soldiersByPlayer.p1, ...map2.soldiersByPlayer.p2];
  for (const s of allSoldiers) {
    assert.ok(s.x >= GW_X_MIN && s.x <= GW_X_MAX);
    assert.ok(s.y >= GW_Y_MIN && s.y <= GW_Y_MAX);
    for (const obs of map2.obstacles) {
      const dist = Math.hypot(s.x - obs.x, s.y - obs.y);
      assert.ok(dist > obs.r + 0.5, `Soldier ${s.id} overlapped obstacle ${obs.id}`);
    }
  }

  const map7 = generateGraphWarsMap(999, ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  assert.equal(map7.soldiersPerPlayer, 2);
  assert.equal(map7.soldiersByPlayer.a.length, 2);

  // Verify generous pairwise soldier spacing across multiple seeds so sprites never crowd
  for (const seed of [101, 202, 4242, 9999]) {
    const m2 = generateGraphWarsMap(seed, ['p1', 'p2']);
    const list2 = [...m2.soldiersByPlayer.p1, ...m2.soldiersByPlayer.p2];
    for (let i = 0; i < list2.length; i++) {
      for (let j = i + 1; j < list2.length; j++) {
        const d = Math.hypot(list2[i].x - list2[j].x, list2[i].y - list2[j].y);
        assert.ok(d >= 4.5, `Seed ${seed}: soldiers ${list2[i].id} & ${list2[j].id} too close (${d.toFixed(2)})`);
      }
    }
  }
});

test('auto-aligned firing y_actual(x) = f(x) - f(x0) + y0 always passes through active soldier', () => {
  const origin = { x: -12, y: 4 };
  const fn = (x: number) => 0.1 * x * x + 2 * x - 7;
  const y0 = evaluateAlignedPoint(fn, origin.x, origin);
  assert.ok(Math.abs(y0 - origin.y) < 1e-9);

  const preview = traceAimPreview('2sin(0.5x)', origin, 1);
  assert.equal(preview.ok, true);
  assert.ok(preview.points.length > 5);
  assert.equal(preview.points[0].x, origin.x);
  assert.equal(preview.points[0].y, origin.y);
});

test('traceClassicGraphWarsShot supports one-shot multi-kill combo and stops on obstacles', () => {
  const shooterSoldier = { id: 'p1_s0', ownerId: 'p1', index: 0, x: -15, y: 0, alive: true };
  const enemy1 = { id: 'p2_s0', ownerId: 'p2', index: 0, x: -5, y: 0, alive: true };
  const enemy2 = { id: 'p2_s1', ownerId: 'p2', index: 1, x: 5, y: 0, alive: true };
  const obstacleAfter = { id: 'obs_1', x: 12, y: 0, r: 2 };

  const traj = traceClassicGraphWarsShot({
    shooterId: 'p1',
    shooterName: 'Alpha',
    shooterColor: '#02d8e1',
    shooterSkinId: 'cyan_neon',
    soldier: shooterSoldier,
    direction: 1,
    equation: '0', // Flat horizontal line y = 0 right through both enemies into obstacle
    usedTytCards: false,
    obstacles: [obstacleAfter],
    allSoldiers: [shooterSoldier, enemy1, enemy2],
    usernameByPlayerId: { p1: 'Alpha', p2: 'Beta' },
  });

  assert.ok(traj);
  assert.equal(traj.hits.length, 2);
  assert.equal(traj.hits[0].soldierId, 'p2_s0');
  assert.equal(traj.hits[1].soldierId, 'p2_s1');
  assert.equal(traj.hits[1].playerEliminated, true);
  assert.equal(traj.stopReason, 'obstacle');
  assert.ok(traj.impactPoint && traj.impactPoint.x <= 10.5);
});

test('computeGraphWarsStandings penalizes rage-quit disconnected players at bottom', () => {
  const standings = computeGraphWarsStandings([
    { id: 'quitter', disconnected: true, alive: true, score: 900, kills: 3 },
    { id: 'survivor', disconnected: false, alive: true, score: 300, kills: 1 },
    { id: 'eliminated', disconnected: false, alive: false, score: 200, kills: 1, eliminatedRound: 2 },
  ]);
  assert.equal(standings[0].id, 'survivor');
  assert.equal(standings[1].id, 'eliminated');
  assert.equal(standings[2].id, 'quitter');
});

test('TYT card builder and League progression compute valid outputs', () => {
  assert.equal(buildTytCardEquation({ family: 'parabola', a: -0.1, h: 2 }), '-0.1(x - 2)^2');
  assert.equal(buildTytCardEquation({ family: 'wave', a: 2, h: 0 }), '2sin(0.4x)');
  assert.equal(buildTytCardEquation({ family: 'abs', a: 0.5, h: -3 }), '0.5|x + 3|');

  const bronze = getLeagueProgress(1000);
  assert.equal(bronze.key, 'bronze');
  assert.equal(bronze.nextElo, 1100);
  assert.equal(bronze.eloRemaining, 100);

  const plat = getLeagueProgress(1550);
  assert.equal(plat.key, 'platinum');
  assert.equal(plat.eloRemaining, 150);
});
