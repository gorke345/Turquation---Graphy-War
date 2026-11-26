import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  get,
  onValue,
  orderByChild,
  query,
  ref,
  runTransaction,
  set,
  update,
  limitToLast,
} from 'firebase/database';
import {
  auth,
  isFirebaseConfigured,
  registerEphemeralGuestPresence,
  rtdb,
} from '../firebase';
import { AvatarId, DEFAULT_AVATAR_ID, getAvatarById } from '../engine/avatarsAndMaps';
import { BASE_ELO, DifficultyTier, GameMode, LevelTrack, MIN_ELO } from '../engine/elo';
import { SkinId } from '../engine/skins';
import { MatchSummary } from './multiplayerTypes';

export { auth, rtdb, isFirebaseConfigured, registerEphemeralGuestPresence };

export interface RegisteredProfile {
  uid: string;
  username: string;
  email?: string;
  elo: number;
  levelTrack: LevelTrack;
  skinId: SkinId;
  avatarId: AvatarId;
  matchesPlayed: number;
  wins: number;
  quizPlayed: number;
  quizWins: number;
  battleshipPlayed: number;
  battleshipWins: number;
  graphWarsPlayed: number;
  graphWarsWins: number;
}

export interface MatchHistoryItem {
  matchId: string;
  ownerUid: string;
  mode: GameMode;
  difficulty: DifficultyTier;
  isRanked: boolean;
  rank: number;
  totalPlayers: number;
  eloBefore: number;
  eloAfter: number;
  eloDelta: number;
  usedTytCards: boolean;
  score: number;
  forfeited?: boolean;
  playedAtMs: number;
}

const sanitizeUsername = (raw: string): string => {
  const cleaned = raw.trim().slice(0, 32);
  return cleaned.length >= 2 ? cleaned : `Player_${Math.floor(1000 + Math.random() * 9000)}`;
};

function requireFirebaseConfigured(): { authInst: NonNullable<typeof auth>; dbInst: NonNullable<typeof rtdb> } {
  if (!isFirebaseConfigured || !auth || !rtdb) {
    throw new Error(
      'Firebase .env değişkenleri yapılandırılmamış (VITE_FIREBASE_API_KEY, VITE_FIREBASE_DATABASE_URL vb.).'
    );
  }
  return { authInst: auth, dbInst: rtdb };
}

function parseProfileNode(uid: string, data: Record<string, unknown> | null | undefined, emailFallback?: string): RegisteredProfile {
  const safe = data && typeof data === 'object' ? data : {};
  const toFinite = (val: unknown, fallback: number): number => {
    const n = Number(val);
    return Number.isFinite(n) ? n : fallback;
  };
  return {
    uid,
    username: String(safe.username || 'Player'),
    email: typeof safe.email === 'string' ? safe.email : emailFallback,
    elo: toFinite(safe.elo, BASE_ELO),
    levelTrack: safe.levelTrack === '11_AYT' ? '11_AYT' : 'TYT',
    skinId: (safe.skinId as SkinId) || 'cyan_neon',
    avatarId: getAvatarById(typeof safe.avatarId === 'string' ? safe.avatarId : DEFAULT_AVATAR_ID).id,
    matchesPlayed: toFinite(safe.matchesPlayed, 0),
    wins: toFinite(safe.wins, 0),
    quizPlayed: toFinite(safe.quizPlayed, 0),
    quizWins: toFinite(safe.quizWins, 0),
    battleshipPlayed: toFinite(safe.battleshipPlayed, 0),
    battleshipWins: toFinite(safe.battleshipWins, 0),
    graphWarsPlayed: toFinite(safe.graphWarsPlayed, 0),
    graphWarsWins: toFinite(safe.graphWarsWins, 0),
  };
}

const pendingUserSetup = new Map<string, Promise<RegisteredProfile>>();

export async function ensureRegisteredUserDocs(
  user: User,
  usernameInput?: string,
  levelTrack: LevelTrack = 'TYT',
  skinId: SkinId = 'cyan_neon'
): Promise<RegisteredProfile> {
  const existing = pendingUserSetup.get(user.uid);
  if (existing) return existing;
  const p = ensureRegisteredUserDocsInternal(user, usernameInput, levelTrack, skinId).finally(() => {
    pendingUserSetup.delete(user.uid);
  });
  pendingUserSetup.set(user.uid, p);
  return p;
}

async function ensureRegisteredUserDocsInternal(
  user: User,
  usernameInput?: string,
  levelTrack: LevelTrack = 'TYT',
  skinId: SkinId = 'cyan_neon'
): Promise<RegisteredProfile> {
  const { dbInst } = requireFirebaseConfigured();
  const userRef = ref(dbInst, `users/${user.uid}`);
  const lbRef = ref(dbInst, `leaderboard/${user.uid}`);

  const snap = await get(userRef);
  if (snap.exists()) {
    const profile = parseProfileNode(user.uid, snap.val() as Record<string, unknown>, user.email || undefined);
    // Keep public leaderboard node synced
    const lbSnap = await get(lbRef);
    if (!lbSnap.exists()) {
      await set(lbRef, {
        uid: profile.uid,
        username: profile.username,
        elo: profile.elo,
        levelTrack: profile.levelTrack,
        skinId: profile.skinId,
        avatarId: profile.avatarId,
        matchesPlayed: profile.matchesPlayed,
        wins: profile.wins,
        quizPlayed: profile.quizPlayed,
        quizWins: profile.quizWins,
        battleshipPlayed: profile.battleshipPlayed,
        battleshipWins: profile.battleshipWins,
        graphWarsPlayed: profile.graphWarsPlayed,
        graphWarsWins: profile.graphWarsWins,
        updatedAt: Date.now(),
      });
    }
    return profile;
  }

  const username = sanitizeUsername(usernameInput || user.displayName || user.email?.split('@')[0] || 'Player');
  const email = (user.email || `${user.uid}@turquation.app`).slice(0, 180);
  const now = Date.now();

  const initialRecord = {
    uid: user.uid,
    username,
    email,
    elo: BASE_ELO,
    levelTrack,
    skinId,
    avatarId: DEFAULT_AVATAR_ID,
    matchesPlayed: 0,
    wins: 0,
    quizPlayed: 0,
    quizWins: 0,
    battleshipPlayed: 0,
    battleshipWins: 0,
    graphWarsPlayed: 0,
    graphWarsWins: 0,
    createdAt: now,
    updatedAt: now,
  };

  await set(userRef, initialRecord);
  await set(lbRef, {
    uid: user.uid,
    username,
    elo: BASE_ELO,
    levelTrack,
    skinId,
    avatarId: DEFAULT_AVATAR_ID,
    matchesPlayed: 0,
    wins: 0,
    quizPlayed: 0,
    quizWins: 0,
    battleshipPlayed: 0,
    battleshipWins: 0,
    graphWarsPlayed: 0,
    graphWarsWins: 0,
    updatedAt: now,
  });

  return parseProfileNode(user.uid, initialRecord, email);
}

export async function registerWithEmail(
  username: string,
  email: string,
  password: string,
  levelTrack: LevelTrack,
  skinId: SkinId = 'cyan_neon'
): Promise<RegisteredProfile> {
  const { authInst } = requireFirebaseConfigured();
  const cleanUser = sanitizeUsername(username);
  const cred = await createUserWithEmailAndPassword(authInst, email.trim(), password);
  await updateProfile(cred.user, { displayName: cleanUser });
  return ensureRegisteredUserDocs(cred.user, cleanUser, levelTrack, skinId);
}

export async function loginWithEmail(email: string, password: string): Promise<RegisteredProfile> {
  const { authInst } = requireFirebaseConfigured();
  const cred = await signInWithEmailAndPassword(authInst, email.trim(), password);
  return ensureRegisteredUserDocs(cred.user);
}

export async function loginWithGoogle(
  levelTrack: LevelTrack = 'TYT',
  skinId: SkinId = 'cyan_neon'
): Promise<RegisteredProfile> {
  const { authInst } = requireFirebaseConfigured();
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(authInst, provider);
  return ensureRegisteredUserDocs(cred.user, cred.user.displayName || undefined, levelTrack, skinId);
}

export async function logoutRegisteredUser(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { authInst } = requireFirebaseConfigured();
  const cleanEmail = email.trim();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    throw new Error('Geçerli bir e-posta adresi girin.');
  }
  await sendPasswordResetEmail(authInst, cleanEmail);
}

export async function updateUserLevelTrack(uid: string, levelTrack: LevelTrack): Promise<void> {
  if (!rtdb) return;
  const now = Date.now();
  await update(ref(rtdb, `users/${uid}`), { levelTrack, updatedAt: now });
  await update(ref(rtdb, `leaderboard/${uid}`), { levelTrack, updatedAt: now });
}

export async function updateUserSkin(uid: string, skinId: SkinId): Promise<void> {
  if (!rtdb) return;
  const now = Date.now();
  await update(ref(rtdb, `users/${uid}`), { skinId, updatedAt: now });
  await update(ref(rtdb, `leaderboard/${uid}`), { skinId, updatedAt: now });
}

export async function updateUserAvatar(uid: string, avatarId: AvatarId): Promise<void> {
  if (!rtdb) return;
  const now = Date.now();
  await update(ref(rtdb, `users/${uid}`), { avatarId, updatedAt: now });
  await update(ref(rtdb, `leaderboard/${uid}`), { avatarId, updatedAt: now });
}

/**
 * Atomic Match Elo Settlement (closes the Rage-Quit Elo loophole!):
 * Uses `runTransaction` on `/matches_settled/{matchId}` so that ONLY ONE active
 * client acquires the settlement lock and atomically applies Elo changes + match
 * history for ALL registered players in the match — INCLUDING disconnected/rage-quit
 * players. Guests are strictly skipped.
 */
export async function settleMatchRatingsAtomically(
  summary: MatchSummary,
  settlerUid: string | undefined
): Promise<boolean> {
  if (!rtdb || !settlerUid) return false;

  const safeStandings = Array.isArray(summary?.standings) ? summary.standings : [];
  const registeredStandings = safeStandings.filter((s) => s && !s.isGuest && Boolean(s.uid));
  if (registeredStandings.length === 0) return false;

  const safeMatchId = summary.matchId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
  const lockRef = ref(rtdb, `matches_settled/${safeMatchId}`);
  const now = Date.now();

  try {
    const txResult = await runTransaction(lockRef, (current) => {
      if (current !== null) {
        // Already settled by another active client
        return;
      }
      return {
        matchId: safeMatchId,
        settledBy: settlerUid,
        settledAt: now,
        mode: summary.mode,
        isRanked: summary.isRanked,
      };
    });

    if (!txResult.committed) {
      return false;
    }

    // Apply Elo and match history updates for EVERY registered player (including rage-quitters)
    for (const row of registeredStandings) {
      const targetUid = row.uid!;
      const safeDelta = summary.isRanked
        ? Math.max(-120, Math.min(120, Math.round(row.eloDelta)))
        : 0;
      const won = row.rank === 1;

      const userSnap = await get(ref(rtdb, `users/${targetUid}`));
      const existing = userSnap.exists()
        ? (userSnap.val() as Record<string, unknown>)
        : {
            uid: targetUid,
            username: row.username,
            elo: row.oldElo,
            levelTrack: 'TYT',
            skinId: 'cyan_neon',
          };

      const oldElo = Number(existing.elo ?? row.oldElo ?? BASE_ELO);
      const newElo = Math.max(MIN_ELO, Math.min(5000, oldElo + safeDelta));

      const nextStats = {
        uid: targetUid,
        username: String(existing.username || row.username),
        elo: newElo,
        levelTrack: existing.levelTrack === '11_AYT' ? '11_AYT' : 'TYT',
        skinId: (existing.skinId as SkinId) || 'cyan_neon',
        avatarId: getAvatarById(typeof existing.avatarId === 'string' ? existing.avatarId : DEFAULT_AVATAR_ID).id,
        matchesPlayed: Number(existing.matchesPlayed ?? 0) + 1,
        wins: Number(existing.wins ?? 0) + (won ? 1 : 0),
        quizPlayed: Number(existing.quizPlayed ?? 0) + (summary.mode === 'quiz_race' ? 1 : 0),
        quizWins: Number(existing.quizWins ?? 0) + (summary.mode === 'quiz_race' && won ? 1 : 0),
        battleshipPlayed:
          Number(existing.battleshipPlayed ?? 0) + (summary.mode === 'battleship' ? 1 : 0),
        battleshipWins:
          Number(existing.battleshipWins ?? 0) + (summary.mode === 'battleship' && won ? 1 : 0),
        graphWarsPlayed:
          Number(existing.graphWarsPlayed ?? 0) + (summary.mode === 'graph_wars' ? 1 : 0),
        graphWarsWins:
          Number(existing.graphWarsWins ?? 0) + (summary.mode === 'graph_wars' && won ? 1 : 0),
        lastSettledMatchId: safeMatchId,
        updatedAt: now,
      };

      await update(ref(rtdb, `users/${targetUid}`), nextStats);
      await update(ref(rtdb, `leaderboard/${targetUid}`), nextStats);

      const historyItem: MatchHistoryItem = {
        matchId: safeMatchId,
        ownerUid: targetUid,
        mode: summary.mode,
        difficulty: summary.difficulty,
        isRanked: summary.isRanked,
        rank: Math.max(1, Math.min(100, Math.round(row.rank))),
        totalPlayers: safeStandings.length,
        eloBefore: oldElo,
        eloAfter: newElo,
        eloDelta: safeDelta,
        usedTytCards: Boolean(row.usedTytCards),
        score: Math.max(0, Math.round(row.score)),
        forfeited: Boolean(row.forfeited),
        playedAtMs: now,
      };
      await set(ref(rtdb, `user_matches/${targetUid}/${safeMatchId}`), historyItem);
    }

    return true;
  } catch (err) {
    console.error('Atomic match Elo settlement error:', err);
    return false;
  }
}

export function subscribeUserProfile(
  uid: string,
  onUpdate: (profile: RegisteredProfile) => void
): () => void {
  if (!rtdb) return () => {};
  const userRef = ref(rtdb, `users/${uid}`);
  return onValue(userRef, (snap) => {
    if (!snap.exists()) return;
    onUpdate(parseProfileNode(uid, snap.val() as Record<string, unknown>));
  });
}

export function subscribeLeaderboard(
  onUpdate: (entries: RegisteredProfile[]) => void,
  onError?: (err: Error) => void
): () => void {
  if (!rtdb) {
    onUpdate([]);
    return () => {};
  }
  const lbQuery = query(ref(rtdb, 'leaderboard'), orderByChild('elo'), limitToLast(100));
  return onValue(
    lbQuery,
    (snap) => {
      if (!snap.exists()) {
        onUpdate([]);
        return;
      }
      const entries: RegisteredProfile[] = [];
      snap.forEach((child) => {
        const val = child.val() as Record<string, unknown>;
        if (val && child.key) {
          entries.push(parseProfileNode(child.key, val));
        }
      });
      // orderByChild returns ascending; reverse for highest Elo first
      entries.sort((a, b) => b.elo - a.elo);
      onUpdate(entries);
    },
    (error) => {
      if (onError) onError(error);
    }
  );
}

export function subscribeUserMatchHistory(
  uid: string,
  onUpdate: (items: MatchHistoryItem[]) => void
): () => void {
  if (!rtdb) {
    onUpdate([]);
    return () => {};
  }
  const historyQuery = query(ref(rtdb, `user_matches/${uid}`), limitToLast(30));
  return onValue(historyQuery, (snap) => {
    if (!snap.exists()) {
      onUpdate([]);
      return;
    }
    const items: MatchHistoryItem[] = [];
    snap.forEach((child) => {
      const d = child.val() as MatchHistoryItem;
      if (d && d.matchId) items.push(d);
    });
    items.sort((a, b) => b.playedAtMs - a.playedAtMs);
    onUpdate(items);
  });
}

export function subscribeAuthState(cb: (user: User | null) => void): () => void {
  if (!auth) {
    cb(null);
    return () => {};
  }
  return onAuthStateChanged(auth, cb);
}
