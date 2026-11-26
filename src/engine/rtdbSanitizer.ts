/**
 * Pure Firebase Realtime Database payload sanitizer.
 *
 * Recursively strips object keys with `undefined` values (and converts
 * `undefined` array slots to `null`) so Firebase RTDB never throws
 * `value argument contains undefined in property ...`.
 */
export function sanitizeForRtdb<T>(value: T): T {
  if (value === undefined) return null as unknown as T;
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : sanitizeForRtdb(item))) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = sanitizeForRtdb(v);
  }
  return out as T;
}
