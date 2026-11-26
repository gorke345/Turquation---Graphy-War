import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canSustainCountdown,
  computeCountdownSnapshot,
  getCountdownBeepParams,
  MATCH_COUNTDOWN_SECONDS,
} from './countdown';

test('computeCountdownSnapshot maps remaining time cleanly across 3, 2, 1, and GO', () => {
  const startsAt = 10_000;

  const at3 = computeCountdownSnapshot(startsAt, 7_000, MATCH_COUNTDOWN_SECONDS);
  assert.equal(at3.displayNumber, 3);
  assert.equal(at3.isLaunching, false);
  assert.equal(at3.progress, 1);

  const at2 = computeCountdownSnapshot(startsAt, 8_100, MATCH_COUNTDOWN_SECONDS);
  assert.equal(at2.displayNumber, 2);
  assert.equal(at2.isLaunching, false);
  assert.ok(at2.progress > 0.6 && at2.progress < 0.65);

  const at1 = computeCountdownSnapshot(startsAt, 9_500, MATCH_COUNTDOWN_SECONDS);
  assert.equal(at1.displayNumber, 1);
  assert.equal(at1.isLaunching, false);
  assert.ok(at1.progress > 0.15 && at1.progress < 0.18);

  const atGo = computeCountdownSnapshot(startsAt, 9_900, MATCH_COUNTDOWN_SECONDS);
  assert.equal(atGo.displayNumber, 0);
  assert.equal(atGo.isLaunching, true);

  const pastEnd = computeCountdownSnapshot(startsAt, 12_000, MATCH_COUNTDOWN_SECONDS);
  assert.equal(pastEnd.remainingMs, 0);
  assert.equal(pastEnd.displayNumber, 0);
  assert.equal(pastEnd.progress, 0);
  assert.equal(pastEnd.isLaunching, true);
});

test('computeCountdownSnapshot clamps clock skew when client clock is behind server', () => {
  const startsAt = 10_000;
  const skewed = computeCountdownSnapshot(startsAt, 5_000, 3);
  assert.equal(skewed.displayNumber, 3);
  assert.equal(skewed.progress, 1);
  assert.equal(skewed.isLaunching, false);
});

test('canSustainCountdown enforces minimum real player requirement', () => {
  assert.equal(canSustainCountdown(2, 2), true);
  assert.equal(canSustainCountdown(1, 2), false);
  assert.equal(canSustainCountdown(1, 1), true);
  assert.equal(canSustainCountdown(0, 1), false);
});

test('getCountdownBeepParams accelerates and grows louder as remaining time approaches 0', () => {
  assert.equal(getCountdownBeepParams(12_000).active, false);
  assert.equal(getCountdownBeepParams(0).active, false);

  const at9s = getCountdownBeepParams(9_000);
  const at5s = getCountdownBeepParams(5_000);
  const at1s = getCountdownBeepParams(1_000);

  assert.equal(at9s.active, true);
  assert.equal(at5s.active, true);
  assert.equal(at1s.active, true);

  // Interval shrinks (faster beeps)
  assert.ok(at9s.intervalMs > at5s.intervalMs && at5s.intervalMs > at1s.intervalMs);
  // Volume increases (louder beeps)
  assert.ok(at9s.gain < at5s.gain && at5s.gain < at1s.gain);
  // Pitch rises
  assert.ok(at9s.frequencyHz < at5s.frequencyHz && at5s.frequencyHz < at1s.frequencyHz);
});
