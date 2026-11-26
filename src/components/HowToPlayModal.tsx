import React, { useEffect } from 'react';
import { BookOpen, Crosshair, Flame, ShieldCheck, Zap, X } from 'lucide-react';
import { Lang, t } from '../i18n/translations';

interface HowToPlayModalProps {
  open: boolean;
  lang: Lang;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ open, lang, onClose }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'howToPlayTitle')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[88vh] overflow-y-auto cartoon-card bg-white dark:bg-[#101C2E] p-6 space-y-4 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-300 border-2 border-slate-900 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-slate-950" />
            </div>
            <h2 className="text-lg font-display font-black">{t(lang, 'howToPlayTitle')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'closeSettings')}
            className="p-1.5 rounded-xl border-2 border-slate-900 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs leading-relaxed">
          <div className="p-4 rounded-2xl bg-sky-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-sky-500/50 space-y-1.5">
            <div className="font-display font-black text-sm text-sky-900 dark:text-sky-300 flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-500" />
              <span>{t(lang, 'howToPlayGraphWarsTitle')}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              {t(lang, 'howToPlayGraphWarsBody')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-amber-500/50 space-y-1.5">
            <div className="font-display font-black text-sm text-amber-900 dark:text-amber-300 flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-amber-600 dark:text-amber-300" />
              <span>{t(lang, 'howToPlayBattleshipTitle')}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              {t(lang, 'howToPlayBattleshipBody')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-emerald-500/50 space-y-1.5">
            <div className="font-display font-black text-sm text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t(lang, 'howToPlayQuizTitle')}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              {t(lang, 'howToPlayQuizBody')}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 space-y-1.5">
            <div className="font-display font-black text-sm text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-amber-300" />
              <span>{t(lang, 'howToPlayEloTitle')}</span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 font-medium">
              {t(lang, 'howToPlayEloBody')}
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t-2 border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl cartoon-btn-green font-display font-black text-xs cursor-pointer"
          >
            {t(lang, 'doneLabel')}
          </button>
        </div>
      </div>
    </div>
  );
};
