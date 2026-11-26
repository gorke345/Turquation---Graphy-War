import React, { useEffect, useRef } from 'react';
import { Check, Sparkles, X } from 'lucide-react';
import {
  AvatarId,
  CHARACTER_AVATARS,
  drawAvatarSprite,
  getAvatarById,
} from '../engine/avatarsAndMaps';
import { soundEngine } from '../engine/sound';
import { Lang, t } from '../i18n/translations';
import { AvatarIllustration } from './AvatarIllustration';
import { ThemeMode } from './SettingsModal';

interface AvatarSelectModalProps {
  open: boolean;
  lang: Lang;
  theme: ThemeMode;
  selectedAvatarId: AvatarId;
  onSelectAvatar: (avatarId: AvatarId) => void;
  onClose: () => void;
}

/**
 * Live mini battlefield preview showing how your chosen character renders as
 * your 3 arena units with team ring, curve trajectory, and burst impact effect.
 */
const UnitBattlePreviewCanvas: React.FC<{ avatarId: AvatarId; isDark: boolean }> = ({
  avatarId,
  isDark,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const avatar = getAvatarById(avatarId);
    const w = 360;
    const h = 112;
    canvas.width = w;
    canvas.height = h;

    // Island mini coordinate plane (theme-aware)
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    if (isDark) {
      grad.addColorStop(0, '#0C1E33');
      grad.addColorStop(1, '#122943');
    } else {
      grad.addColorStop(0, '#E0F2FE');
      grad.addColorStop(1, '#F8FAFC');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle coordinate grid
    ctx.strokeStyle = isDark ? 'rgba(125, 211, 252, 0.16)' : 'rgba(14, 116, 144, 0.16)';
    ctx.lineWidth = 1;
    for (let x = 24; x < w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 24; y < h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Mini themed obstacle in the center
    ctx.fillStyle = isDark ? '#7C5332' : '#B47B49';
    ctx.beginPath();
    ctx.arc(195, 68, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(195, 58, 17, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isDark ? '#020617' : '#0F172A';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(195, 68, 20, 0, Math.PI * 2);
    ctx.stroke();

    // Character projectile parabola leaping over obstacle
    ctx.save();
    ctx.strokeStyle = avatar.trailGlow;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(96, 62);
    ctx.quadraticCurveTo(195, 6, 304, 54);
    ctx.stroke();

    ctx.strokeStyle = avatar.trailColor;
    ctx.lineWidth = 3.2;
    ctx.stroke();
    ctx.restore();

    // Character impact burst at target point (304, 54)
    const burstAngles = [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4];
    burstAngles.forEach((ang, idx) => {
      const bx = 304 + Math.cos(ang) * (13 + (idx % 2) * 5);
      const by = 54 + Math.sin(ang) * (13 + (idx % 2) * 5);
      ctx.fillStyle = avatar.burstColors[idx % avatar.burstColors.length];
      ctx.strokeStyle = isDark ? '#020617' : '#0F172A';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(bx, by, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });

    // 3 player units on left flank (unit #2 highlighted as active)
    drawAvatarSprite(ctx, avatar.id, 38, 36, 13, avatar.primary, { soldierNumber: 1, isDark });
    drawAvatarSprite(ctx, avatar.id, 96, 62, 15, avatar.primary, {
      isSelected: true,
      soldierNumber: 2,
      isDark,
    });
    drawAvatarSprite(ctx, avatar.id, 46, 86, 13, avatar.primary, { soldierNumber: 3, isDark });
  }, [avatarId, isDark]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-[112px] rounded-xl border-2 border-slate-900 dark:border-slate-600 block"
    />
  );
};

export const AvatarSelectModal: React.FC<AvatarSelectModalProps> = ({
  open,
  lang,
  theme,
  selectedAvatarId,
  onSelectAvatar,
  onClose,
}) => {
  if (!open) return null;

  const isDark = theme === 'dark';
  const active = getAvatarById(selectedAvatarId);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/65 flex items-center justify-center p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'avatarShowcaseTitle')}
      data-testid="avatar-select-modal"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[90vh] overflow-y-auto cartoon-card bg-white dark:bg-[#101C2E] p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 text-xs font-mono font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t(lang, 'freeBadge')}</span>
            </div>
            <h2 className="text-2xl font-display font-black tracking-tight text-slate-900 dark:text-white mt-0.5">
              {t(lang, 'avatarShowcaseTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-0.5">
              {t(lang, 'avatarShowcaseSubtitle')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t(lang, 'closeSettings')}
            className="p-2 rounded-xl border-2 border-slate-900 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected Character Spotlight + Live 3-Unit Battlefield Preview */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 rounded-2xl border-2 border-slate-900 dark:border-slate-600 bg-sky-50/90 dark:bg-[#0B1524]">
          <div className="md:col-span-5 flex items-center gap-3.5">
            <div
              className="w-24 h-24 rounded-2xl border-2 border-slate-900 dark:border-slate-500 flex items-center justify-center shrink-0 shadow-[0_4px_0_#0f172a] dark:shadow-[0_4px_0_#020617]"
              style={{ backgroundColor: isDark ? active.cardBgDark : active.cardBg }}
            >
              <AvatarIllustration avatarId={active.id} className="w-20 h-20" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {lang === 'tr' ? active.titleTr : active.titleEn}
              </div>
              <div className="text-xl font-display font-black text-slate-950 dark:text-white leading-tight">
                {lang === 'tr' ? active.nameTr : active.nameEn}
              </div>
              <div className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
                <span
                  className="w-3 h-3 rounded-full border border-slate-900 dark:border-slate-300 shrink-0"
                  style={{ backgroundColor: active.trailColor }}
                />
                <span className="truncate">
                  {lang === 'tr' ? active.fxLabelTr : active.fxLabelEn}
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-7 space-y-1">
            <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              {t(lang, 'avatarUnitPreviewLabel')}
            </div>
            <UnitBattlePreviewCanvas avatarId={active.id} isDark={isDark} />
          </div>
        </div>

        {/* 6 Selectable Cartoon Characters Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CHARACTER_AVATARS.map((char) => {
            const isSelected = char.id === selectedAvatarId;
            return (
              <button
                key={char.id}
                type="button"
                data-testid={`avatar-option-${char.id}`}
                onClick={() => {
                  soundEngine.playClick();
                  onSelectAvatar(char.id);
                }}
                className={`relative text-left p-3 rounded-2xl border-2 transition-transform duration-100 cursor-pointer flex flex-col items-center text-center gap-2 ${
                  isSelected
                    ? 'border-slate-900 dark:border-amber-300 bg-amber-50 dark:bg-[#192842] shadow-[0_5px_0_#0f172a] dark:shadow-[0_5px_0_#020617] -translate-y-0.5 ring-2 ring-amber-400'
                    : 'border-slate-900 dark:border-slate-600 bg-white dark:bg-[#0D1828] shadow-[0_3px_0_#0f172a] dark:shadow-[0_3px_0_#020617] hover:-translate-y-0.5'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg bg-emerald-400 border-2 border-slate-900 text-slate-950 font-mono text-[10px] font-extrabold flex items-center gap-0.5">
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>{t(lang, 'selectedLabel')}</span>
                  </span>
                )}

                <div
                  className="w-20 h-20 rounded-2xl border-2 border-slate-900 dark:border-slate-500 flex items-center justify-center"
                  style={{ backgroundColor: isDark ? char.cardBgDark : char.cardBg }}
                >
                  <AvatarIllustration avatarId={char.id} className="w-16 h-16" />
                </div>

                <div>
                  <div className="font-display font-black text-sm sm:text-base text-slate-950 dark:text-white leading-tight">
                    {lang === 'tr' ? char.nameTr : char.nameEn}
                  </div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'tr' ? char.fxLabelTr : char.fxLabelEn}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Confirm Footer */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            data-testid="avatar-modal-confirm-btn"
            onClick={() => {
              soundEngine.playClick();
              onClose();
            }}
            className="px-7 py-3 rounded-2xl cartoon-btn-green font-display font-black text-base cursor-pointer"
          >
            {t(lang, 'avatarConfirmBtn')}
          </button>
        </div>
      </div>
    </div>
  );
};
