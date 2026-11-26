import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canRematchRoom,
  computePracticeBattleshipMove,
  computePracticeGraphWarsBotShot,
  computePracticeQuizBotScore,
  pickPracticeBattleshipFleet,
} from './practiceEngine';
import {
  GRAPH_WARS_EXAMPLE_EQUATIONS,
  insertMathToken,
} from './mathKeypad';
import { generateGraphWarsMap } from './graphWarsEngine';
import { compileMathFunction } from './mathParser';
import { validateBattleshipEquation } from './functionGenerator';

test('insertMathToken inserts token at cursor and advances caret', () => {
  const res = insertMathToken('0.5*', 'x^2', 4, 4);
  assert.equal(res.value, '0.5*x^2');
  assert.equal(res.cursor, 7);

  const parensEmpty = insertMathToken('sin', '()', 3, 3);
  assert.equal(parensEmpty.value, 'sin()');
  assert.equal(parensEmpty.cursor, 4);

  const parensWrap = insertMathToken('x + 1', '()', 0, 5);
  assert.equal(parensWrap.value, '(x + 1)');
  assert.equal(parensWrap.cursor, 7);
});

test('all example Graph Wars equations compile cleanly', () => {
  for (const eq of GRAPH_WARS_EXAMPLE_EQUATIONS) {
    const compiled = compileMathFunction(eq);
    assert.ok(compiled.fn, `Expected valid equation: ${eq}`);
    assert.ok(Number.isFinite(compiled.fn(0)));
  }
});

test('computePracticeGraphWarsBotShot returns valid compiled shot aimed toward enemy', () => {
  const map = generateGraphWarsMap(42, ['p1', 'bot']);
  const p1Soldiers = map.soldiersByPlayer.p1;
  const botSoldiers = map.soldiersByPlayer.bot;

  const shot = computePracticeGraphWarsBotShot({
    botId: 'bot',
    botSoldiers,
    playerSoldiers: p1Soldiers,
    obstacles: map.obstacles,
    difficulty: 'apprentice',
    seed: 13,
  });

  assert.ok(shot);
  assert.ok(botSoldiers.some((s) => s.id === shot.soldierId));
  assert.ok(shot.direction === 1 || shot.direction === -1);
  const compiled = compileMathFunction(shot.equation);
  assert.ok(compiled.fn, `Bot equation should compile: ${shot.equation}`);
});

test('pickPracticeBattleshipFleet picks 2 distinct valid functions', () => {
  const fleet = pickPracticeBattleshipFleet('strategist', 19);
  assert.equal(fleet.length, 2);
  assert.notEqual(fleet[0], fleet[1]);
  assert.equal(validateBattleshipEquation(fleet[0], 'strategist').ok, true);
  assert.equal(validateBattleshipEquation(fleet[1], 'strategist').ok, true);
});

test('computePracticeBattleshipMove hunts around known hits and avoids repeats', () => {
  const move = computePracticeBattleshipMove({
    previousShots: [
      { x: 2, y: 2, hit: true },
      { x: 3, y: 3, hit: false },
    ],
    seed: 5,
  });
  assert.notDeepEqual(move, { x: 2, y: 2 });
  assert.notDeepEqual(move, { x: 3, y: 3 });
  assert.ok(Math.abs(move.x - 2) <= 2 && Math.abs(move.y - 2) <= 2);
});

test('computePracticeQuizBotScore returns bounded realistic score', () => {
  const score = computePracticeQuizBotScore(6, 'apprentice', 7);
  assert.ok(score.correctCount >= 1 && score.correctCount <= 6);
  assert.ok(score.points >= score.correctCount * 25);
});

test('canRematchRoom validates finished state and active player count', () => {
  assert.equal(canRematchRoom({ status: 'finished', activePlayerCount: 2, minPlayers: 2 }), true);
  assert.equal(canRematchRoom({ status: 'finished', activePlayerCount: 1, minPlayers: 2 }), false);
  assert.equal(canRematchRoom({ status: 'playing', activePlayerCount: 2, minPlayers: 2 }), false);
  assert.equal(canRematchRoom({ status: 'finished', activePlayerCount: 1, minPlayers: 1 }), true);
});
