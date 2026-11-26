import React, { useEffect } from 'react';
import { Globe, Grid, Moon, Settings, Sparkles, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { Lang, t } from '../i18n/translations';

export type ThemeMode = 'light' | 'dark';
export type GridDensity = 'full' | 'minimal';

export interface AppSettings {
  theme: ThemeMode;
  gridDensity: GridDensity;
  particlesEnabled: boolean;
  muted: boolean;
}

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  lang: Lang;
  onChangeLang: (lang: Lang) => void;
  settings: AppSettings;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  onClose,
  lang,
  onChangeLang,
  settings,
  onUpdateSettings,
}) => {
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
      aria-label={t(lang, 'settingsTitle')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md cartoon-card bg-white dark:bg-[#101C2E] p-5 space-y-4 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-sky-600 dark:text-amber-300" />
            <h2 className="text-base font-display font-black">{t(lang, 'settingsTitle')}</h2>
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

        <div className="space-y-3.5 text-xs">
          {/* Theme Switcher: Sunlit Island (default) vs Night Island */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              {settings.theme === 'dark' ? (
                <Moon className="w-4 h-4 text-amber-300" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
              {t(lang, 'settingTheme')}
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-sky-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600">
              <button
                type="button"
                data-testid="theme-light-btn"
                onClick={() => onUpdateSettings({ theme: 'light' })}
                className={`px-2.5 py-1.5 rounded-lg font-display font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  settings.theme === 'light'
                    ? 'bg-amber-300 text-slate-950 border border-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {t(lang, 'themeLight')}
              </button>
              <button
                type="button"
                data-testid="theme-dark-btn"
                onClick={() => onUpdateSettings({ theme: 'dark' })}
                className={`px-2.5 py-1.5 rounded-lg font-display font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  settings.theme === 'dark'
                    ? 'bg-sky-500 text-white border border-slate-900'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                }`}
              >
                {t(lang, 'themeDark')}
              </button>
            </div>
          </div>

          {/* Language Switcher */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-600 dark:text-amber-300" />
              {t(lang, 'settingLanguage')}
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-sky-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600">
              <button
                type="button"
                onClick={() => onChangeLang('tr')}
                className={`px-3 py-1.5 rounded-lg font-display font-bold transition-colors cursor-pointer ${
                  lang === 'tr'
                    ? 'bg-amber-300 text-slate-950 border border-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Türkçe
              </button>
              <button
                type="button"
                onClick={() => onChangeLang('en')}
                className={`px-3 py-1.5 rounded-lg font-display font-bold transition-colors cursor-pointer ${
                  lang === 'en'
                    ? 'bg-amber-300 text-slate-950 border border-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                English
              </button>
            </div>
          </div>

          {/* Sound Effects */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              {settings.muted ? (
                <VolumeX className="w-4 h-4 text-slate-400" />
              ) : (
                <Volume2 className="w-4 h-4 text-emerald-600" />
              )}
              {t(lang, 'settingSound')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!settings.muted}
              onClick={() => onUpdateSettings({ muted: !settings.muted })}
              className={`px-3.5 py-1.5 rounded-xl font-display font-bold border-2 transition-colors cursor-pointer ${
                !settings.muted
                  ? 'bg-emerald-300 border-slate-900 text-slate-950'
                  : 'bg-slate-100 dark:bg-[#0B1524] border-slate-900 dark:border-slate-600 text-slate-600 dark:text-slate-400'
              }`}
            >
              {!settings.muted ? t(lang, 'enabledLabel') : t(lang, 'disabledLabel')}
            </button>
          </div>

          {/* Coordinate Grid Density */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Grid className="w-4 h-4 text-sky-600 dark:text-amber-300" />
              {t(lang, 'settingGrid')}
            </span>
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-sky-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600">
              <button
                type="button"
                onClick={() => onUpdateSettings({ gridDensity: 'full' })}
                className={`px-3 py-1.5 rounded-lg font-display font-bold transition-colors cursor-pointer ${
                  settings.gridDensity === 'full'
                    ? 'bg-amber-300 text-slate-950 border border-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t(lang, 'gridFull')}
              </button>
              <button
                type="button"
                onClick={() => onUpdateSettings({ gridDensity: 'minimal' })}
                className={`px-3 py-1.5 rounded-lg font-display font-bold transition-colors cursor-pointer ${
                  settings.gridDensity === 'minimal'
                    ? 'bg-amber-300 text-slate-950 border border-slate-900'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {t(lang, 'gridMinimal')}
              </button>
            </div>
          </div>

          {/* Particle FX */}
          <div className="flex items-center justify-between gap-3">
            <span className="font-display font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              {t(lang, 'settingParticles')}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.particlesEnabled}
              onClick={() => onUpdateSettings({ particlesEnabled: !settings.particlesEnabled })}
              className={`px-3.5 py-1.5 rounded-xl font-display font-bold border-2 transition-colors cursor-pointer ${
                settings.particlesEnabled
                  ? 'bg-emerald-300 border-slate-900 text-slate-950'
                  : 'bg-slate-100 dark:bg-[#0B1524] border-slate-900 dark:border-slate-600 text-slate-600 dark:text-slate-400'
              }`}
            >
              {settings.particlesEnabled ? t(lang, 'enabledLabel') : t(lang, 'disabledLabel')}
            </button>
          </div>
        </div>

        <div className="pt-3 border-t-2 border-slate-200 dark:border-slate-700 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono">
          <span>M: {t(lang, 'settingSound')} · Esc: {t(lang, 'closeSettings')}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl cartoon-btn-green font-display font-black text-xs cursor-pointer"
          >
            {t(lang, 'doneLabel')}
          </button>
        </div>
      </div>
    </div>
  );
};
