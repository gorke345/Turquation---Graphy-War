import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFunctionProblem,
  getIntegerLatticePoints,
  validateBattleshipEquation,
} from './functionGenerator';
import { compileMathFunction } from './mathParser';

test('generates valid solvable problems for all 4 difficulty tiers', () => {
  const tiers = ['apprentice', 'explorer', 'strategist', 'master'] as const;
  for (const tier of tiers) {
    const prob = generateFunctionProblem(tier, 421337);
    const compiled = compileMathFunction(prob.equation);
    assert.ok(compiled.fn, `Failed to compile ${tier}: ${prob.equation}`);

    // Verify target point matches evaluated equation
    const evalY = compiled.fn(prob.targetPoint.x);
    assert.ok(Math.abs(evalY - prob.targetPoint.y) < 1e-6);

    // Verify y-intercept matches f(0)
    assert.ok(Math.abs(compiled.fn(0) - prob.yIntercept.y) < 1e-6);

    // Verify x-intercepts evaluate to 0
    for (const xi of prob.xIntercepts) {
      assert.ok(Math.abs(compiled.fn(xi.x)) < 1e-6);
    }
  }
});

test('computes integer lattice points and enforces difficulty constraints for Battleship', () => {
  const pts = getIntegerLatticePoints('x + 2', -5, 5, -5, 5);
  assert.ok(pts.length >= 5);

  const badApprentice = validateBattleshipEquation('x^2 - 4', 'apprentice');
  assert.equal(badApprentice.ok, false);

  const okStrategist = validateBattleshipEquation('(x - 1)^2 - 4', 'strategist');
  assert.equal(okStrategist.ok, true);
  assert.ok(okStrategist.points.length >= 3);
});
