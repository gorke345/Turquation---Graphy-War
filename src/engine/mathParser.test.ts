import test from 'node:test';
import assert from 'node:assert/strict';
import {
  compileMathFunction,
  areExpressionsEquivalent,
  parsePoint,
  parsePointList,
  parseNumberOrFraction,
} from './mathParser';

test('parses implicit multiplication and standard polynomials safely without eval', () => {
  const c1 = compileMathFunction('2x^2 - 3x + 1');
  assert.ok(c1.fn);
  assert.equal(c1.fn(0), 1);
  assert.equal(c1.fn(2), 3); // 8 - 6 + 1
  assert.equal(c1.fn(-1), 6); // 2 + 3 + 1

  const c2 = compileMathFunction('-(x-2)^2 + 5');
  assert.ok(c2.fn);
  assert.equal(c2.fn(2), 5);
  assert.equal(c2.fn(0), 1);
  assert.equal(c2.fn(4), 1);
});

test('parses absolute value expressions including implicit multiplication', () => {
  const c1 = compileMathFunction('|x+1| - 2');
  assert.ok(c1.fn);
  assert.equal(c1.fn(-1), -2);
  assert.equal(c1.fn(1), 0);
  assert.equal(c1.fn(-3), 0);

  const c2 = compileMathFunction('-2|x - 3| + 4');
  assert.ok(c2.fn);
  assert.equal(c2.fn(3), 4);
  assert.equal(c2.fn(5), 0);
  assert.equal(c2.fn(1), 0);
});

test('detects algebraic equivalence across expanded and vertex forms', () => {
  assert.equal(areExpressionsEquivalent('x^2 - 4x + 3', '(x - 2)^2 - 1'), true);
  assert.equal(areExpressionsEquivalent('f(x) = -2(x+1)^2 + 8', '-2x^2 - 4x + 6'), true);
  assert.equal(areExpressionsEquivalent('2x + 1', '2x - 1'), false);
});

test('rejects unsafe or unknown identifiers', () => {
  const bad1 = compileMathFunction('alert(1)');
  assert.equal(bad1.fn, undefined);
  const bad2 = compileMathFunction('window.location');
  assert.equal(bad2.fn, undefined);
  const bad3 = compileMathFunction('2x + ');
  assert.equal(bad3.fn, undefined);
});

test('parses [x,y] points with whitespace tolerance and fractions', () => {
  assert.deepEqual(parsePoint('[2,-3]'), { x: 2, y: -3 });
  assert.deepEqual(parsePoint('[ 2.5 , -1 ]'), { x: 2.5, y: -1 });
  assert.deepEqual(parsePoint('[-3/2, 0]'), { x: -1.5, y: 0 });
  assert.equal(parsePoint('(2, 3)'), null);
  assert.equal(parsePoint('2, 3'), null);
});

test('parses point lists and none/yok markers', () => {
  const list = parsePointList('[-2, 0], [3,0]');
  assert.equal(list.valid, true);
  assert.equal(list.points.length, 2);

  const noneTr = parsePointList('yok');
  assert.equal(noneTr.valid, true);
  assert.equal(noneTr.isNone, true);
});

test('parses numbers and fractions with optional x= prefix', () => {
  assert.equal(parseNumberOrFraction('x = -2'), -2);
  assert.equal(parseNumberOrFraction('-3/2'), -1.5);
  assert.equal(parseNumberOrFraction('abc'), null);
});
