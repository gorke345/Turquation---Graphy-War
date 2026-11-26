import React, { useEffect, useRef, useState } from 'react';
import { Flame, Swords, X, Zap } from 'lucide-react';
import { computeCountdownSnapshot } from '../engine/countdown';
import { soundEngine } from '../engine/sound';
import { Lang, t } from '../i18n/translations';
import { MatchCountdownState, RoomFullState } from '../services/multiplayerTypes';

interface MatchCountdownOverlayProps {
  lang: Lang;
  room: RoomFullState;
  countdown: MatchCountdownState;
  isHost: boolean;
  onCancel?: () => void;
}

const RING_RADIUS = 64;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const MatchCountdownOverlay: React.FC<MatchCountdownOverlayProps> = ({
  lang,
  room,
  countdown,
  isHost,
  onCancel,
}) => {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const lastAudioStepRef = useRef<number | null>(null);

  useEffect(() => {
    lastAudioStepRef.current = null;
    let rafId = 0;
    const tick = () => {
      setNowMs(Date.now());
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [countdown.startsAt]);

  const snap = computeCountdownSnapshot(countdown.startsAt, nowMs, countdown.totalSeconds);

  // Trigger rising synth pip on each integer step (3, 2, 1) and launch chord on GO
  useEffect(() => {
    if (lastAudioStepRef.current === snap.displayNumber) return;
    lastAudioStepRef.current = snap.displayNumber;
    if (snap.displayNumber > 0) {
      soundEngine.playCountdownTick(snap.displayNumber);
    } else {
      soundEngine.playCountdownGo();
    }
  }, [snap.displayNumber]);

  const modeName =
    room.mode === 'quiz_race'
      ? t(lang, 'modeQuizTitle')
      : room.mode === 'battleship'
        ? t(lang, 'modeBattleshipTitle')
        : t(lang, 'modeGraphWarsTitle');

  const ModeIcon =
    room.mode === 'quiz_race' ? Zap : room.mode === 'battleship' ? Swords : Flame;

  // Color progression builds tension cleanly across 3 -> 2 -> 1 -> GO
  const strokeClass = snap.isLaunching
    ? 'stroke-emerald-500 dark:stroke-emerald-400'
    : snap.displayNumber === 1
      ? 'stroke-amber-500 dark:stroke-amber-400'
      : 'stroke-sky-600 dark:stroke-cyan-400';

  const numberClass = snap.isLaunching
    ? 'text-emerald-600 dark:text-emerald-400'
    : snap.displayNumber === 1
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-900 dark:text-white';

  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - snap.progress);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'countdownTitle')}
      data-testid="countdown-overlay"
      data-countdown-value={snap.displayNumber}
      className="fixed inset-0 z-40 bg-slate-900/45 dark:bg-black/75 flex items-center justify-center p-4 animate-countdown-fade"
    >
      <div className="w-full max-w-sm bg-white dark:bg-[#121926] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 sm:p-7 text-center space-y-5 animate-countdown-card">
        {/* Contextual Match Header */}
        <div className="space-y-1">
          <div className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-sky-700 dark:text-cyan-400">
            <ModeIcon className="w-4 h-4 shrink-0" />
            <span>{modeName}</span>
          </div>
          <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-100">
            {t(lang, 'countdownTitle')}
          </h2>
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            {t(lang, `diff_${room.difficulty}`)} ·{' '}
            {room.isRanked ? t(lang, 'ranked') : t(lang, 'unranked')} · #{room.code}
          </p>
        </div>

        {/* Circular SVG Coordinate Dial + Animated Countdown Number */}
        <div className="relative w-44 h-44 mx-auto flex items-center justify-center">
          <svg
            viewBox="0 0 160 160"
            className="w-full h-full -rotate-90"
            aria-hidden="true"
          >
            {/* Subtle coordinate crosshair inside dial */}
            <line
              x1="28"
              y1="80"
              x2="132"
              y2="80"
              className="stroke-slate-200/80 dark:stroke-slate-800"
              strokeWidth="1"
            />
            <line
              x1="80"
              y1="28"
              x2="80"
              y2="132"
              className="stroke-slate-200/80 dark:stroke-slate-800"
              strokeWidth="1"
            />
            {/* Background track ring */}
            <circle
              cx="80"
              cy="80"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="8"
              className="stroke-slate-100 dark:stroke-slate-800"
            />
            {/* Live progress arc */}
            <circle
              cx="80"
              cy="80"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              className={`${strokeClass} transition-colors duration-150`}
            />
          </svg>

          <div
            aria-live="assertive"
            aria-atomic="true"
            className="absolute inset-0 flex items-center justify-center"
          >
            <span
              key={snap.isLaunching ? 'go' : snap.displayNumber}
              className={`font-display font-extrabold tabular-nums select-none animate-countdown-pop ${
                snap.isLaunching ? 'text-3xl tracking-tight' : 'text-6xl'
              } ${numberClass}`}
            >
              {snap.isLaunching ? t(lang, 'countdownGo') : snap.displayNumber}
            </span>
          </div>
        </div>

        {/* Subtitle & Real Connected Players Launching */}
        <div className="space-y-2.5">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            {t(lang, 'countdownSubtitle')}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs font-mono text-slate-700 dark:text-slate-300 pt-2 border-t border-slate-100 dark:border-slate-800/80">
            {room.players.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: p.color }}
                />
                <span className="truncate max-w-[110px]">{p.username}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Host Cancel Control (only while >= 1s remains) */}
        {isHost && onCancel && !snap.isLaunching && (
          <div className="pt-1">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-[#090D14] border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-500/40 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              <span>{t(lang, 'cancelCountdown')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
