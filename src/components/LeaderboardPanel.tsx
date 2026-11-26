import React from 'react';
import { Trophy, UserPlus } from 'lucide-react';
import { RegisteredProfile } from '../services/firebase';
import { Lang, t } from '../i18n/translations';
import { AvatarIllustration } from './AvatarIllustration';

interface LeaderboardPanelProps {
  lang: Lang;
  isGuest: boolean;
  currentUid?: string;
  entries: RegisteredProfile[];
  onSwitchToAuth: () => void;
}

export const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  lang,
  isGuest,
  currentUid,
  entries,
  onSwitchToAuth,
}) => {
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-amber-300 border-2 border-slate-900 flex items-center justify-center shrink-0">
            <Trophy className="w-5 h-5 text-slate-950" />
          </div>
          <h2 className="text-xl font-display font-black text-slate-950 dark:text-white">
            {t(lang, 'leaderboardTitle')}
          </h2>
        </div>
        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
          {entries.length} {t(lang, 'playersCount')}
        </span>
      </div>

      {isGuest && (
        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-slate-900 dark:border-amber-400/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-xs font-semibold text-amber-950 dark:text-amber-200 leading-relaxed">
            {t(lang, 'leaderboardGuestBanner')}
          </p>
          <button
            type="button"
            onClick={onSwitchToAuth}
            className="px-4 py-2 rounded-xl cartoon-btn-green font-display font-black text-xs flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer shrink-0"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>{t(lang, 'register')}</span>
          </button>
        </div>
      )}

      <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-sky-50/40 dark:bg-[#0B1524] overflow-hidden">
        {entries.length === 0 ? (
          <div className="p-10 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
            {t(lang, 'noLeaderboardData')}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-900/15 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 font-display font-black bg-sky-100/80 dark:bg-[#132238]">
                  <th className="py-3 px-4">{t(lang, 'rankCol')}</th>
                  <th className="py-3 px-4">{t(lang, 'playerCol')}</th>
                  <th className="py-3 px-4">{t(lang, 'trackCol')}</th>
                  <th className="py-3 px-4 text-right">{t(lang, 'eloCol')}</th>
                  <th className="py-3 px-4 text-right">{t(lang, 'matchesCol')}</th>
                  <th className="py-3 px-4 text-right">{t(lang, 'winRateCol')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {entries.map((entry, idx) => {
                  const isSelf = entry.uid === currentUid;
                  const winRate =
                    entry.matchesPlayed > 0
                      ? Math.round((entry.wins / entry.matchesPlayed) * 100)
                      : 0;
                  return (
                    <tr
                      key={entry.uid}
                      className={
                        isSelf
                          ? 'bg-amber-100/70 dark:bg-sky-900/35 text-slate-950 dark:text-white'
                          : 'text-slate-800 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800/40'
                      }
                    >
                      <td className="py-3 px-4 font-mono font-black tabular-nums text-sky-700 dark:text-amber-300">
                        #{idx + 1}
                      </td>
                      <td className="py-3 px-4 font-display font-extrabold">
                        <div className="flex items-center gap-2.5">
                          <AvatarIllustration avatarId={entry.avatarId} className="w-7 h-7 shrink-0" />
                          <span className="truncate">{entry.username}</span>
                          {isSelf && (
                            <span className="text-xs font-mono font-bold text-sky-700 dark:text-amber-300">
                              · {t(lang, 'youMarker')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 dark:text-slate-300 font-mono font-bold">
                        {entry.levelTrack === '11_AYT' ? '11/AYT' : 'TYT'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-sky-700 dark:text-amber-300 tabular-nums">
                        {entry.elo}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                        {entry.matchesPlayed}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                        {winRate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
