import React from 'react';
import { Award, Lock, UserPlus } from 'lucide-react';
import { AvatarId, DEFAULT_AVATAR_ID } from '../engine/avatarsAndMaps';
import { LevelTrack } from '../engine/elo';
import { MatchHistoryItem, RegisteredProfile } from '../services/firebase';
import { Lang, t } from '../i18n/translations';
import { AvatarIllustration } from './AvatarIllustration';

interface ProfilePanelProps {
  lang: Lang;
  isGuest: boolean;
  guestName?: string;
  guestTrack: LevelTrack;
  avatarId?: AvatarId;
  onChangeTrack: (track: LevelTrack) => void;
  profile: RegisteredProfile | null;
  history: MatchHistoryItem[];
  onSwitchToAuth: () => void;
}

export const ProfilePanel: React.FC<ProfilePanelProps> = ({
  lang,
  isGuest,
  guestName,
  guestTrack,
  avatarId = DEFAULT_AVATAR_ID,
  onChangeTrack,
  profile,
  history,
  onSwitchToAuth,
}) => {
  if (isGuest || !profile) {
    return (
      <div className="max-w-xl mx-auto space-y-5">
        <div className="p-5 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-sky-50/70 dark:bg-[#0B1524] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-14 h-14 rounded-2xl border-2 border-slate-900 bg-white dark:bg-[#172740] flex items-center justify-center shrink-0">
              <AvatarIllustration avatarId={avatarId} className="w-12 h-12" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xl font-display font-black text-slate-950 dark:text-white truncate">
                {guestName}
              </h2>
              <p className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                {t(lang, 'guestLabel')}
              </p>
            </div>
          </div>
          <Lock className="w-5 h-5 text-amber-600 dark:text-amber-300 shrink-0" />
        </div>

        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 leading-relaxed">
          {t(lang, 'guestNotice')}
        </p>

        <div className="space-y-2">
          <span className="text-xs font-mono font-bold uppercase text-slate-600 dark:text-slate-300">
            {t(lang, 'levelTrackLabel')}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onChangeTrack('TYT')}
              className={`py-2.5 px-3 rounded-xl text-xs font-display font-black border-2 cursor-pointer transition-colors ${
                guestTrack === 'TYT'
                  ? 'border-slate-900 bg-amber-300 text-slate-950 shadow-[0_3px_0_#0f172a]'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1524] text-slate-600 dark:text-slate-300'
              }`}
            >
              {t(lang, 'trackTyt')}
            </button>
            <button
              type="button"
              onClick={() => onChangeTrack('11_AYT')}
              className={`py-2.5 px-3 rounded-xl text-xs font-display font-black border-2 cursor-pointer transition-colors ${
                guestTrack === '11_AYT'
                  ? 'border-slate-900 bg-amber-300 text-slate-950 shadow-[0_3px_0_#0f172a]'
                  : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1524] text-slate-600 dark:text-slate-300'
              }`}
            >
              {t(lang, 'trackAyt')}
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={onSwitchToAuth}
          className="w-full py-3 px-5 rounded-xl cartoon-btn-green font-display font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          <span>{t(lang, 'register')}</span>
        </button>
      </div>
    );
  }

  const winRate =
    profile.matchesPlayed > 0 ? Math.round((profile.wins / profile.matchesPlayed) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="p-5 rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-sky-50/70 dark:bg-[#0B1524] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-14 h-14 rounded-2xl border-2 border-slate-900 bg-white dark:bg-[#172740] flex items-center justify-center shrink-0">
            <AvatarIllustration avatarId={profile.avatarId} className="w-12 h-12" />
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-display font-black text-slate-950 dark:text-white truncate">
              {profile.username}
            </h2>
            <p className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 mt-0.5 truncate">
              {t(lang, 'registeredLabel')} · {profile.email}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onChangeTrack('TYT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-black border-2 cursor-pointer ${
              profile.levelTrack === 'TYT'
                ? 'border-slate-900 bg-amber-300 text-slate-950'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172740] text-slate-600 dark:text-slate-300'
            }`}
          >
            TYT
          </button>
          <button
            type="button"
            onClick={() => onChangeTrack('11_AYT')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-black border-2 cursor-pointer ${
              profile.levelTrack === '11_AYT'
                ? 'border-slate-900 bg-amber-300 text-slate-950'
                : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#172740] text-slate-600 dark:text-slate-300'
            }`}
          >
            11 / AYT
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-[#0B1524] p-4">
          <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            {t(lang, 'eloCol')}
          </div>
          <div className="text-2xl font-mono font-black text-sky-700 dark:text-amber-300 tabular-nums mt-1 flex items-center gap-1.5">
            <Award className="w-5 h-5 text-amber-500" />
            <span>{profile.elo}</span>
          </div>
        </div>
        <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-[#0B1524] p-4">
          <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            {t(lang, 'matchesCol')}
          </div>
          <div className="text-2xl font-mono font-black text-slate-950 dark:text-white tabular-nums mt-1">
            {profile.matchesPlayed}
          </div>
        </div>
        <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-[#0B1524] p-4">
          <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            {t(lang, 'winRateCol')}
          </div>
          <div className="text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400 tabular-nums mt-1">
            {winRate}%
          </div>
        </div>
        <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-[#0B1524] p-4">
          <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400">
            GRAPH WARS
          </div>
          <div className="text-2xl font-mono font-black text-amber-600 dark:text-amber-300 tabular-nums mt-1">
            {profile.graphWarsWins}/{profile.graphWarsPlayed}
          </div>
        </div>
      </div>

      {/* Mode Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-sm">
        <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-sky-50/50 dark:bg-[#0B1524] p-3.5 flex justify-between items-center">
          <span className="font-display font-bold text-slate-800 dark:text-slate-200">
            {t(lang, 'modeQuizTitle')}
          </span>
          <span className="font-mono font-black text-sky-700 dark:text-amber-300 tabular-nums">
            {profile.quizWins}W / {profile.quizPlayed}M
          </span>
        </div>
        <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-sky-50/50 dark:bg-[#0B1524] p-3.5 flex justify-between items-center">
          <span className="font-display font-bold text-slate-800 dark:text-slate-200">
            {t(lang, 'modeBattleshipTitle')}
          </span>
          <span className="font-mono font-black text-sky-700 dark:text-amber-300 tabular-nums">
            {profile.battleshipWins}W / {profile.battleshipPlayed}M
          </span>
        </div>
        <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-sky-50/50 dark:bg-[#0B1524] p-3.5 flex justify-between items-center">
          <span className="font-display font-bold text-slate-800 dark:text-slate-200">
            {t(lang, 'modeGraphWarsTitle')}
          </span>
          <span className="font-mono font-black text-sky-700 dark:text-amber-300 tabular-nums">
            {profile.graphWarsWins}W / {profile.graphWarsPlayed}M
          </span>
        </div>
      </div>

      {/* Match History */}
      <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-white dark:bg-[#0B1524] overflow-hidden">
        <div className="px-5 py-3 border-b-2 border-slate-900/10 dark:border-slate-700 bg-sky-50/70 dark:bg-[#132238]">
          <h3 className="text-sm font-display font-black text-slate-950 dark:text-white">
            {t(lang, 'recentMatches')}
          </h3>
        </div>
        {history.length === 0 ? (
          <p className="p-6 text-sm font-semibold text-slate-500 text-center">
            {t(lang, 'noMatchHistory')}
          </p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {history.map((m) => (
              <div
                key={m.matchId}
                className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-display font-extrabold text-slate-900 dark:text-slate-100">
                    {m.mode === 'quiz_race'
                      ? t(lang, 'modeQuizTitle')
                      : m.mode === 'battleship'
                        ? t(lang, 'modeBattleshipTitle')
                        : t(lang, 'modeGraphWarsTitle')}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400 font-mono font-bold">
                    #{m.rank}/{m.totalPlayers} · {m.isRanked ? t(lang, 'ranked') : t(lang, 'unranked')}
                    {m.usedTytCards ? ' · TYT 40%' : ''}
                    {m.forfeited ? ` · ${t(lang, 'forfeitedBadge')}` : ''}
                  </div>
                </div>
                <div className="text-right font-mono tabular-nums">
                  <div
                    className={
                      m.eloDelta > 0
                        ? 'text-emerald-600 dark:text-emerald-400 font-black'
                        : m.eloDelta < 0
                          ? 'text-rose-600 dark:text-rose-400 font-black'
                          : 'text-slate-600 dark:text-slate-300 font-bold'
                    }
                  >
                    {m.isRanked
                      ? `${m.eloDelta > 0 ? '+' : ''}${m.eloDelta} Elo`
                      : `${m.score} pts`}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500">
                    {new Date(m.playedAtMs).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
