/**
 * Modular Turkish & English content filter and 5-second spam cooldown validator
 * for in-game and lobby chat.
 *
 * IMPORTANT: Preserves Turkish dotless "ı" distinct from dotted "i" so normal
 * Turkish words like "sık", "sıkı", "sıkıntı", "sıkıcı", "sıkıldım" are NEVER
 * falsely censored as profanity, while real TR/EN profanity roots are censored.
 */

export const CHAT_COOLDOWN_MS = 5_000;
export const MAX_CHAT_MESSAGE_LENGTH = 200;

const BLOCKED_EXACT_WORDS: string[] = [
  // Turkish profanity / slang exact matches (dotless ı preserved!)
  'amk',
  'aq',
  'amq',
  'oc',
  'oç',
  'pic',
  'piç',
  'sik',
  'siki',
  'sikik',
  'sikiş',
  'sikis',
  'mal',
  'bok',
  'ibne',
  'pust',
  'puşt',
  // English exact matches
  'wtf',
  'stfu',
  'dick',
  'cunt',
  'slut',
].filter(Boolean);

const BLOCKED_ROOT_SUBSTRINGS: string[] = [
  // Turkish longer profanity stems (safe against Turkish ı words because ı !== i)
  'orospu',
  'sikerim',
  'siktir',
  'sikeyim',
  'siktim',
  'sikiyim',
  'sikici',
  'sikiş',
  'yarrak',
  'yarak',
  'gotveren',
  'götveren',
  'gerizekali',
  'gerizekalı',
  'salak',
  'aptal',
  'pezevenk',
  'kahpe',
  'dangalak',
  'serefsiz',
  'şerefsiz',
  'haysiyetsiz',
  // English longer profanity stems
  'fuck',
  'fucking',
  'fucker',
  'shit',
  'bitch',
  'asshole',
  'bastard',
  'pussy',
  'idiot',
  'moron',
  'stupid',
  'retard',
  'whore',
  'nigger',
  'faggot',
].filter(Boolean);

/**
 * Normalizes a token for profanity matching while strictly preserving Turkish
 * dotless "ı" separate from dotted "i" (preventing "sık" / "sıkıntı" -> "sik").
 */
export function normalizeForFilter(token: string): string {
  // Handle Turkish casing explicitly: İ -> i, I -> ı, then standard lowercase
  const lowered = token
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase();

  return lowered
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ş/g, 's')
    .replace(/ü/g, 'u')
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's')
    .replace(/[^a-zı]/g, '');
}

const NORMALIZED_EXACT_SET = new Set(
  BLOCKED_EXACT_WORDS.map(normalizeForFilter).filter(Boolean)
);
const NORMALIZED_ROOTS = Array.from(
  new Set(BLOCKED_ROOT_SUBSTRINGS.map(normalizeForFilter).filter((w) => w.length >= 4))
);

export interface FilterResult {
  cleaned: string;
  wasCensored: boolean;
  censoredCount: number;
}

/**
 * Censors TR & EN profanity/slang words with "***" while keeping math expressions
 * and legitimate Turkish words ("sık", "sıkı", "sıkıntı", "sıkıcı") completely intact.
 */
export function filterChatMessage(raw: string): FilterResult {
  const trimmed = raw.trim().slice(0, MAX_CHAT_MESSAGE_LENGTH);
  if (!trimmed) {
    return { cleaned: '', wasCensored: false, censoredCount: 0 };
  }

  let censoredCount = 0;
  const parts = trimmed.split(/(\s+)/);
  const processed = parts.map((part) => {
    if (/^\s+$/.test(part)) return part;
    const norm = normalizeForFilter(part);
    if (!norm) return part;

    if (NORMALIZED_EXACT_SET.has(norm)) {
      censoredCount++;
      return '***';
    }
    for (const root of NORMALIZED_ROOTS) {
      if (norm.includes(root)) {
        censoredCount++;
        return '***';
      }
    }
    return part;
  });

  return {
    cleaned: processed.join(''),
    wasCensored: censoredCount > 0,
    censoredCount,
  };
}

export interface CooldownCheck {
  allowed: boolean;
  remainingMs: number;
  remainingSeconds: number;
}

/**
 * Checks whether a user is allowed to send a chat message under the 5-second spam rule.
 */
export function checkChatCooldown(lastSentAtMs: number | undefined, nowMs: number): CooldownCheck {
  if (!lastSentAtMs || lastSentAtMs <= 0) {
    return { allowed: true, remainingMs: 0, remainingSeconds: 0 };
  }
  const elapsed = nowMs - lastSentAtMs;
  if (elapsed >= CHAT_COOLDOWN_MS) {
    return { allowed: true, remainingMs: 0, remainingSeconds: 0 };
  }
  const remainingMs = CHAT_COOLDOWN_MS - elapsed;
  return {
    allowed: false,
    remainingMs,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}
