import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, KeyRound, LogIn, Mail, UserPlus, X } from 'lucide-react';
import { LevelTrack } from '../engine/elo';
import { isFirebaseConfigured } from '../firebase';
import { Lang, t } from '../i18n/translations';

interface AuthModalProps {
  open: boolean;
  initialMode?: 'login' | 'register';
  lang: Lang;
  defaultTrack: LevelTrack;
  authError: string | null;
  authBusy: boolean;
  onClose: () => void;
  onLoginEmail: (email: string, password: string) => Promise<void>;
  onRegisterEmail: (
    username: string,
    email: string,
    password: string,
    track: LevelTrack
  ) => Promise<void>;
  onLoginGoogle: (track: LevelTrack) => Promise<void>;
  onResetPassword: (email: string) => Promise<boolean>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  initialMode = 'login',
  lang,
  defaultTrack,
  authError,
  authBusy,
  onClose,
  onLoginEmail,
  onRegisterEmail,
  onLoginGoogle,
  onResetPassword,
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>(initialMode);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [track, setTrack] = useState<LevelTrack>(defaultTrack);
  const [localError, setLocalError] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setLocalError(null);
    setResetSuccess(false);
  }, [initialMode, open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setResetSuccess(false);

    if (mode === 'reset') {
      if (!email.trim() || !email.includes('@')) {
        setLocalError(
          lang === 'tr' ? 'Geçerli bir e-posta adresi girin.' : 'Please enter a valid email address.'
        );
        return;
      }
      const ok = await onResetPassword(email.trim());
      if (ok) {
        setResetSuccess(true);
      }
      return;
    }

    if (!email.trim() || password.length < 6 || (mode === 'register' && !username.trim())) {
      setLocalError(t(lang, 'errEmailPassRequired'));
      return;
    }
    if (mode === 'login') {
      await onLoginEmail(email.trim(), password);
    } else {
      await onRegisterEmail(username.trim(), email.trim(), password, track);
    }
  };

  const displayError = localError || authError;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'reset' ? t(lang, 'resetPasswordTitle') : t(lang, 'registeredTab')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md cartoon-card bg-white dark:bg-[#101C2E] p-6 space-y-4 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b-2 border-slate-200 dark:border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            {mode === 'reset' ? (
              <KeyRound className="w-4 h-4 text-amber-500 dark:text-amber-300" />
            ) : (
              <Mail className="w-4 h-4 text-sky-600 dark:text-amber-300" />
            )}
            <h2 className="text-base font-display font-black tracking-tight">
              {mode === 'reset' ? t(lang, 'resetPasswordTitle') : t(lang, 'registeredTab')}
            </h2>
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

        {!isFirebaseConfigured && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-400 text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{t(lang, 'firebaseNotConfigured')}</span>
          </div>
        )}

        {mode !== 'reset' ? (
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-sky-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLocalError(null);
                setResetSuccess(false);
              }}
              className={`py-2 rounded-lg text-xs font-display font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-amber-300 text-slate-950 border border-slate-900'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{t(lang, 'signIn')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setLocalError(null);
                setResetSuccess(false);
              }}
              className={`py-2 rounded-lg text-xs font-display font-black flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-amber-300 text-slate-950 border border-slate-900'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{t(lang, 'register')}</span>
            </button>
          </div>
        ) : (
          <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
            {t(lang, 'resetPasswordDesc')}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'register' && (
            <div>
              <label
                htmlFor="auth-username"
                className="block text-xs font-display font-extrabold text-slate-700 dark:text-slate-200 mb-1"
              >
                {t(lang, 'usernameLabel')}
              </label>
              <input
                id="auth-username"
                type="text"
                maxLength={24}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t(lang, 'usernamePlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          <div>
            <label
              htmlFor="auth-email"
              className="block text-xs font-display font-extrabold text-slate-700 dark:text-slate-200 mb-1"
            >
              {t(lang, 'emailLabel')}
            </label>
            <input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t(lang, 'emailPlaceholder')}
              className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {mode !== 'reset' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-display font-extrabold text-slate-700 dark:text-slate-200"
                >
                  {t(lang, 'passwordLabel')}
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    data-testid="forgot-password-btn"
                    onClick={() => {
                      setMode('reset');
                      setLocalError(null);
                      setResetSuccess(false);
                    }}
                    className="text-[11px] font-display font-extrabold text-sky-700 dark:text-amber-300 hover:underline cursor-pointer"
                  >
                    {t(lang, 'forgotPassword')}
                  </button>
                )}
              </div>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t(lang, 'passwordPlaceholder')}
                className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-1">
              <span className="block text-xs font-display font-extrabold text-slate-700 dark:text-slate-200">
                {t(lang, 'levelTrackLabel')}
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTrack('TYT')}
                  className={`py-2 px-3 rounded-xl text-xs font-display font-black border-2 cursor-pointer ${
                    track === 'TYT'
                      ? 'border-slate-900 bg-amber-300 text-slate-950'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1524] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t(lang, 'trackTytFull')}
                </button>
                <button
                  type="button"
                  onClick={() => setTrack('11_AYT')}
                  className={`py-2 px-3 rounded-xl text-xs font-display font-black border-2 cursor-pointer ${
                    track === '11_AYT'
                      ? 'border-slate-900 bg-amber-300 text-slate-950'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1524] text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t(lang, 'trackAyt')}
                </button>
              </div>
            </div>
          )}

          {resetSuccess && (
            <div
              role="status"
              className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 border-2 border-emerald-600 text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{t(lang, 'resetEmailSent')}</span>
            </div>
          )}

          {displayError && (
            <div
              role="alert"
              className="p-2.5 rounded-xl bg-rose-100 dark:bg-rose-950/70 border-2 border-rose-600 text-xs font-bold text-rose-800 dark:text-rose-200"
            >
              {displayError}
            </div>
          )}

          <button
            type="submit"
            disabled={authBusy || !isFirebaseConfigured}
            className="w-full py-2.5 px-4 rounded-xl cartoon-btn-green disabled:opacity-50 font-display font-black text-sm cursor-pointer"
          >
            {authBusy
              ? '...'
              : mode === 'reset'
                ? t(lang, 'sendResetLink')
                : mode === 'login'
                  ? t(lang, 'signIn')
                  : t(lang, 'register')}
          </button>

          {mode === 'reset' && (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setLocalError(null);
                setResetSuccess(false);
              }}
              className="w-full py-2 px-4 rounded-xl bg-white dark:bg-[#172740] text-slate-900 dark:text-white cartoon-btn-white font-display font-black text-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t(lang, 'backToSignIn')}</span>
            </button>
          )}
        </form>

        {mode !== 'reset' && (
          <>
            <div className="relative flex items-center justify-center py-0.5">
              <div className="border-t-2 border-slate-200 dark:border-slate-700 w-full" />
              <span className="px-2 text-[11px] font-mono font-bold text-slate-500 bg-white dark:bg-[#101C2E] absolute">
                {lang === 'tr' ? 'veya' : 'or'}
              </span>
            </div>

            <button
              type="button"
              disabled={authBusy || !isFirebaseConfigured}
              onClick={() => onLoginGoogle(track)}
              className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-[#172740] disabled:opacity-50 text-slate-900 dark:text-white font-display font-extrabold text-sm cartoon-btn-white flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.29v3.1A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.3a7.21 7.21 0 0 1 0-4.6V6.6H1.29a12 12 0 0 0 0 10.8l3.99-3.1z" />
                <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.29 6.6l3.99 3.1c.95-2.84 3.6-4.95 6.72-4.95z" />
              </svg>
              <span>{t(lang, 'googleSignIn')}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
};
