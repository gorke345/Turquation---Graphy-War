import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ARENA_MAPS,
  CHARACTER_AVATARS,
  DEFAULT_AVATAR_ID,
  getArenaMapById,
  getAvatarById,
  resolveArenaMap,
} from './avatarsAndMaps';
import { sanitizeForRtdb } from './rtdbSanitizer';

test('CHARACTER_AVATARS provides 6 unique characters with valid fallback', () => {
  assert.equal(CHARACTER_AVATARS.length, 6);
  const ids = new Set(CHARACTER_AVATARS.map((a) => a.id));
  assert.equal(ids.size, 6);
  assert.equal(getAvatarById('unknown_id').id, DEFAULT_AVATAR_ID);
  assert.equal(getAvatarById('flame_knight').nameEn, 'Flame Knight');
});

test('ARENA_MAPS provides 4 themed maps and resolveArenaMap handles explicit & random selection', () => {
  assert.equal(ARENA_MAPS.length, 4);
  assert.equal(resolveArenaMap('volcano_crater', 123), 'volcano_crater');
  assert.equal(resolveArenaMap('glacier_peak', 999), 'glacier_peak');
  assert.equal(getArenaMapById('nonexistent').id, 'cloud_temple');

  const resolvedSet = new Set([
    resolveArenaMap('random', 0),
    resolveArenaMap('random', 1),
    resolveArenaMap('random', 2),
    resolveArenaMap('random', 3),
  ]);
  assert.equal(resolvedSet.size, 4);
});

test('sanitizeForRtdb recursively strips undefined properties to prevent Firebase RTDB set crashes', () => {
  const guestQueueEntry = {
    id: 'guest_123',
    uid: undefined,
    username: 'GuestFox',
    isGuest: true,
    nested: {
      ok: 42,
      bad: undefined,
      arr: [1, undefined, { a: 'x', b: undefined }],
    },
  };

  const cleaned = sanitizeForRtdb(guestQueueEntry) as Record<string, unknown>;
  assert.equal('uid' in cleaned, false);
  assert.equal(cleaned.id, 'guest_123');
  assert.equal(cleaned.username, 'GuestFox');

  const nested = cleaned.nested as Record<string, unknown>;
  assert.equal('bad' in nested, false);
  assert.equal(nested.ok, 42);

  const arr = nested.arr as unknown[];
  assert.equal(arr[0], 1);
  assert.equal(arr[1], null);
  assert.deepEqual(arr[2], { a: 'x' });
});
