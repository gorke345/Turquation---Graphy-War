/**
 * Free Curve & Explosion Skins + Elo League Tier definitions for Turquation.
 */

export type SkinId =
  | 'cyan_neon'
  | 'plasma_gold'
  | 'emerald_laser'
  | 'flame_nova'
  | 'violet_bolt';

export interface ArcadeSkin {
  id: SkinId;
  nameTr: string;
  nameEn: string;
  primary: string;
  secondary: string;
  glow: string;
  particleColors: string[];
}

export const ARCADE_SKINS: ArcadeSkin[] = [
  {
    id: 'cyan_neon',
    nameTr: 'Cyan Neon',
    nameEn: 'Cyan Neon',
    primary: '#02d8e1',
    secondary: '#14b8a6',
    glow: 'rgba(2, 216, 225, 0.55)',
    particleColors: ['#02d8e1', '#67e8f9', '#14b8a6', '#ffffff'],
  },
  {
    id: 'plasma_gold',
    nameTr: 'Plazma Altın',
    nameEn: 'Plasma Gold',
    primary: '#f59e0b',
    secondary: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.55)',
    particleColors: ['#f59e0b', '#fde047', '#fb923c', '#ffffff'],
  },
  {
    id: 'emerald_laser',
    nameTr: 'Zümrüt Lazer',
    nameEn: 'Emerald Laser',
    primary: '#10b981',
    secondary: '#84cc16',
    glow: 'rgba(16, 185, 129, 0.55)',
    particleColors: ['#10b981', '#34d399', '#a3e635', '#ffffff'],
  },
  {
    id: 'flame_nova',
    nameTr: 'Alev Nova',
    nameEn: 'Flame Nova',
    primary: '#f43f5e',
    secondary: '#fb923c',
    glow: 'rgba(244, 63, 94, 0.55)',
    particleColors: ['#f43f5e', '#fb7185', '#fb923c', '#fde047'],
  },
  {
    id: 'violet_bolt',
    nameTr: 'Mor Şimşek',
    nameEn: 'Violet Bolt',
    primary: '#a855f7',
    secondary: '#ec4899',
    glow: 'rgba(168, 85, 247, 0.55)',
    particleColors: ['#a855f7', '#c084fc', '#f472b6', '#ffffff'],
  },
];

export function getSkinById(id?: string): ArcadeSkin {
  return ARCADE_SKINS.find((s) => s.id === id) || ARCADE_SKINS[0];
}

export type LeagueKey = 'bronze' | 'silver' | 'gold' | 'platinum' | 'master';

export interface LeagueProgress {
  key: LeagueKey;
  nameTr: string;
  nameEn: string;
  color: string;
  bgClass: string;
  minElo: number;
  nextElo: number | null;
  nextNameTr: string | null;
  nextNameEn: string | null;
  progressPct: number;
  eloRemaining: number;
}

const LEAGUES: Array<{
  key: LeagueKey;
  nameTr: string;
  nameEn: string;
  color: string;
  bgClass: string;
  minElo: number;
}> = [
  { key: 'bronze', nameTr: 'Bronz', nameEn: 'Bronze', color: '#d97706', bgClass: 'from-amber-700 to-orange-600', minElo: 0 },
  { key: 'silver', nameTr: 'Gümüş', nameEn: 'Silver', color: '#94a3b8', bgClass: 'from-slate-400 to-slate-600', minElo: 1100 },
  { key: 'gold', nameTr: 'Altın', nameEn: 'Gold', color: '#eab308', bgClass: 'from-yellow-400 to-amber-500', minElo: 1300 },
  { key: 'platinum', nameTr: 'Platin', nameEn: 'Platinum', color: '#02d8e1', bgClass: 'from-cyan-400 to-teal-500', minElo: 1500 },
  { key: 'master', nameTr: 'Usta', nameEn: 'Master', color: '#ec4899', bgClass: 'from-fuchsia-500 to-pink-600', minElo: 1700 },
];

export function getLeagueProgress(elo: number): LeagueProgress {
  const safeElo = Math.max(0, Math.round(elo));
  let idx = 0;
  for (let i = LEAGUES.length - 1; i >= 0; i--) {
    if (safeElo >= LEAGUES[i].minElo) {
      idx = i;
      break;
    }
  }
  const current = LEAGUES[idx];
  const next = idx < LEAGUES.length - 1 ? LEAGUES[idx + 1] : null;
  const floor = idx === 0 ? 800 : current.minElo;
  if (!next) {
    return {
      ...current,
      nextElo: null,
      nextNameTr: null,
      nextNameEn: null,
      progressPct: 100,
      eloRemaining: 0,
    };
  }
  const span = Math.max(1, next.minElo - floor);
  const pct = Math.max(0, Math.min(100, Math.round(((safeElo - floor) / span) * 100)));
  return {
    ...current,
    nextElo: next.minElo,
    nextNameTr: next.nameTr,
    nextNameEn: next.nameEn,
    progressPct: pct,
    eloRemaining: Math.max(0, next.minElo - safeElo),
  };
}
