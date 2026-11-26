import test from 'node:test';
import assert from 'node:assert/strict';
import { filterChatMessage, checkChatCooldown, CHAT_COOLDOWN_MS } from './chatFilter';

test('preserves legitimate Turkish dotless ı words like sık, sıkı, sıkıntı, sıkıcı', () => {
  const safeSentence = 'Hiç sıkıntı yok, çok sıkı ve sıkıcı olmayan sık bir maçtı!';
  const res = filterChatMessage(safeSentence);
  assert.equal(res.wasCensored, false);
  assert.equal(res.cleaned, safeSentence);

  const upperTurkish = filterChatMessage('SIKINTI YOK SIKICI DEGIL');
  assert.equal(upperTurkish.wasCensored, false);
});

test('censors Turkish and English profanity while preserving normal math chat', () => {
  const clean = filterChatMessage('Harika atış! f(x) = -(x-2)^2 + 5 + 2sin(0.5x)');
  assert.equal(clean.wasCensored, false);
  assert.equal(clean.cleaned, 'Harika atış! f(x) = -(x-2)^2 + 5 + 2sin(0.5x)');

  const trBad = filterChatMessage('ne kadar salak bir hamle amk siktir');
  assert.equal(trBad.wasCensored, true);
  assert.ok(trBad.cleaned.includes('***'));
  assert.ok(!trBad.cleaned.toLowerCase().includes('salak'));
  assert.ok(!trBad.cleaned.toLowerCase().includes('amk'));
  assert.ok(!trBad.cleaned.toLowerCase().includes('siktir'));

  const trExact = filterChatMessage('SİKTİR git s1ktir sik');
  assert.equal(trExact.wasCensored, true);
  assert.equal(trExact.censoredCount, 3);

  const enBad = filterChatMessage('what the fuck dude');
  assert.equal(enBad.wasCensored, true);
  assert.ok(enBad.cleaned.includes('***'));
  assert.ok(!enBad.cleaned.toLowerCase().includes('fuck'));
});

test('enforces strict 5-second spam cooldown', () => {
  assert.equal(CHAT_COOLDOWN_MS, 5_000);
  const first = checkChatCooldown(undefined, 10000);
  assert.equal(first.allowed, true);

  const blocked = checkChatCooldown(10000, 12500);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remainingSeconds, 3);

  const allowedAgain = checkChatCooldown(10000, 10000 + CHAT_COOLDOWN_MS);
  assert.equal(allowedAgain.allowed, true);
});
