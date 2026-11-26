export const MATCH_COUNTDOWN_SECONDS = 3;
export const MATCH_COUNTDOWN_MS = MATCH_COUNTDOWN_SECONDS * 1000;

export interface CountdownSnapshot {
  remainingMs: number;
  /** Integer display value: totalSeconds .. 1, then 0 when launching */
  displayNumber: number;
  /** Normalized remaining fraction in [0, 1] for progress ring animation */
  progress: number;
  /** True during the brief final beat right before transition into gameplay */
  isLaunching: boolean;
}

/**
 * Pure deterministic helper that computes the visual countdown state from a
 * server-authoritative `startsAtMs` timestamp and current clock `nowMs`.
 */
export function computeCountdownSnapshot(
  startsAtMs: number,
  nowMs: number,
  totalSeconds: number = MATCH_COUNTDOWN_SECONDS
): CountdownSnapshot {
  const safeTotal = Math.max(1, Math.round(totalSeconds));
  const totalMs = safeTotal * 1000;
  const remainingMs = Math.max(0, startsAtMs - nowMs);
  const clampedMs = Math.min(totalMs, remainingMs);
  const progress = clampedMs / totalMs;
  const isLaunching = remainingMs <= 180;
  const displayNumber = isLaunching
    ? 0
    : Math.min(safeTotal, Math.max(1, Math.ceil(remainingMs / 1000)));

  return {
    remainingMs,
    displayNumber,
    progress,
    isLaunching,
  };
}

/**
 * Guard check determining whether a room has enough connected real players
 * to initiate or sustain a match countdown.
 */
export function canSustainCountdown(playerCount: number, minPlayers: number): boolean {
  return playerCount >= Math.max(1, minPlayers);
}

export interface CountdownBeepParams {
  active: boolean;
  /** Normalized urgency in [0, 1], increasing as remainingMs approaches 0 */
  urgency: number;
  /** Delay until the next beep in ms (slows at start of window, accelerates near 0s) */
  intervalMs: number;
  /** Oscillator pitch in Hz (rises with urgency) */
  frequencyHz: number;
  /** Audio gain in [0.04, 0.22] (gets louder as time runs out) */
  gain: number;
  /** Tone length in seconds (gets tighter as beeps accelerate) */
  durationSec: number;
}

/**
 * Computes accelerating & louder beep cadence parameters for the final seconds
 * of a timed round (default last 10 seconds).
 */
export function getCountdownBeepParams(
  remainingMs: number,
  windowMs = 10_000
): CountdownBeepParams {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0 || remainingMs > windowMs) {
    return {
      active: false,
      urgency: 0,
      intervalMs: 1000,
      frequencyHz: 620,
      gain: 0.04,
      durationSec: 0.095,
    };
  }

  const safeWindow = Math.max(1000, windowMs);
  const linear = Math.min(1, Math.max(0, 1 - remainingMs / safeWindow));
  // Smooth ease-in curve so final 3-4 seconds ramp dramatically in speed and loudness
  const urgency = linear * linear * 0.65 + linear * 0.35;

  const intervalMs = Math.round(980 - urgency * 820); // 980ms -> 160ms
  const frequencyHz = Math.round(620 + urgency * 440); // 620Hz -> 1060Hz
  const gain = Number((0.045 + urgency * 0.175).toFixed(3)); // 0.045 -> 0.22
  const durationSec = Number((0.095 - urgency * 0.04).toFixed(3)); // 95ms -> 55ms

  return {
    active: true,
    urgency,
    intervalMs,
    frequencyHz,
    gain,
    durationSec,
  };
}
