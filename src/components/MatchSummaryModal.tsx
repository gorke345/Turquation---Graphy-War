import React, { useEffect } from 'react';
import { RotateCcw, Trophy } from 'lucide-react';
import { MatchSummary } from '../services/multiplayerTypes';
import { Lang, t } from '../i18n/translations';
import { soundEngine } from '../engine/sound';

interface MatchSummaryModalProps {
  lang: Lang;
  summary: MatchSummary;
  myId: string;
  canRematch?: boolean;
  onRematch?: () => void;
  onClose: () => void;
}

export const MatchSummaryModal: React.FC<MatchSummaryModalProps> = ({
  lang,
  summary,
  myId,
  canRematch = false,
  onRematch,
  onClose,
}) => {
  useEffect(() => {
    soundEngine.playVictory();
  }, []);

  const standings = summary.standings || [];
  const myRow = standings.find((s) => s.id === myId);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 flex items-center justify-center p-4">
      <div className="w-full max-w-xl cartoon-card bg-white dark:bg-[#101C2E] p-6 space-y-5">
        <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-700 pb-4">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-500 dark:text-amber-300" />
            <div>
              <h2 className="text-xl font-display font-black text-slate-950 dark:text-white">
                {t(lang, 'matchOver')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-300 font-mono font-bold">
                {summary.isRanked ? t(lang, 'ranked') : t(lang, 'eloUnranked')}
              </p>
            </div>
          </div>

          {myRow && summary.isRanked && (
            <div className="text-right font-mono tabular-nums">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {t(lang, 'eloChange')}
              </div>
              <div
                className={`text-xl font-bold ${
                  myRow.eloDelta > 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : myRow.eloDelta < 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {myRow.eloDelta > 0 ? `+${myRow.eloDelta}` : myRow.eloDelta}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          {standings.map((row) => {
            const isSelf = row.id === myId;
            return (
              <div
                key={row.id}
                className={`py-3 px-3.5 rounded-xl border-2 flex items-center justify-between text-sm ${
                  isSelf
                    ? 'bg-sky-50 dark:bg-[#172B47] border-slate-900 dark:border-sky-400'
                    : 'bg-slate-50 dark:bg-[#0B1524] border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono font-black text-sky-600 dark:text-amber-300 w-7 tabular-nums shrink-0">
                    #{row.rank}
                  </span>
                  <div className="min-w-0">
                    <span className="font-display font-extrabold text-slate-950 dark:text-white truncate">
                      {row.username}
                    </span>
                    {row.usedTytCards && (
                      <span className="ml-2 text-xs font-mono text-amber-600 dark:text-amber-400">
                        TYT 40%
                      </span>
                    )}
                    {row.forfeited && (
                      <span className="ml-2 text-xs font-mono text-rose-600 dark:text-rose-400">
                        · {t(lang, 'forfeitedBadge')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 font-mono tabular-nums text-xs shrink-0">
                  {typeof row.kills === 'number' && summary.mode === 'graph_wars' && (
                    <span className="text-rose-600 dark:text-rose-400 font-bold">
                      {row.kills}K
                    </span>
                  )}
                  <span className="font-bold text-slate-700 dark:text-slate-200">{row.score} pts</span>
                  {summary.isRanked && (
                    <span
                      className={`font-bold w-14 text-right ${
                        row.eloDelta > 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : row.eloDelta < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {row.eloDelta > 0
                        ? `+${row.eloDelta}`
                        : row.eloDelta === 0
                          ? '±0'
                          : row.eloDelta}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className={`grid gap-2.5 ${canRematch && onRematch ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {canRematch && onRematch && (
            <button
              type="button"
              data-testid="rematch-btn"
              onClick={() => {
                soundEngine.playClick();
                onRematch();
              }}
              className="w-full py-3 px-4 rounded-xl cartoon-btn-green font-display font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t(lang, 'rematchBtn')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`w-full py-3 px-4 rounded-xl font-display font-black text-sm cursor-pointer ${
              canRematch && onRematch
                ? 'bg-white dark:bg-[#172740] text-slate-900 dark:text-white cartoon-btn-white'
                : 'cartoon-btn-green'
            }`}
          >
            {t(lang, 'playAgain')}
          </button>
        </div>
      </div>
    </div>
  );
};
