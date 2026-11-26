import React, { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Link2, QrCode, X } from 'lucide-react';
import { Lang, t } from '../i18n/translations';

interface InviteQrModalProps {
  open: boolean;
  roomCode: string;
  lang: Lang;
  onClose: () => void;
}

export const InviteQrModal: React.FC<InviteQrModalProps> = ({
  open,
  roomCode,
  lang,
  onClose,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const inviteUrl = useMemo(() => {
    if (typeof window === 'undefined' || !roomCode) return '';
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('room', roomCode.toUpperCase());
    return url.toString();
  }, [roomCode]);

  useEffect(() => {
    if (!open || !inviteUrl) return;
    let active = true;
    QRCode.toDataURL(inviteUrl, {
      width: 240,
      margin: 2,
      color: {
        dark: '#070B14',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [open, inviteUrl]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copyLink = () => {
    navigator.clipboard?.writeText(inviteUrl).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  const copyCode = () => {
    navigator.clipboard?.writeText(roomCode.toUpperCase()).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t(lang, 'inviteModalTitle')}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md cartoon-card bg-white dark:bg-[#101C2E] p-6 space-y-5 text-slate-900 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b-2 border-slate-200 dark:border-slate-700 pb-3.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-300 border-2 border-slate-900 text-slate-950 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-display font-black">{t(lang, 'inviteModalTitle')}</h2>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
                {t(lang, 'inviteModalSubtitle')}
              </p>
            </div>
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

        {/* QR Code Card */}
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 rounded-2xl bg-white border-2 border-slate-900 shadow-[0_4px_0_#0f172a]">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`Room ${roomCode} QR Code`}
                width={208}
                height={208}
                className="w-52 h-52 block rounded-lg"
              />
            ) : (
              <div className="w-52 h-52 flex items-center justify-center text-xs font-mono text-slate-500">
                QR...
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={copyCode}
            className="px-4 py-1.5 rounded-xl bg-amber-300 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] font-mono text-lg font-black tracking-[0.22em] text-slate-950 flex items-center gap-2 cursor-pointer"
          >
            <span>{roomCode.toUpperCase()}</span>
            {copiedCode ? (
              <Check className="w-4 h-4 text-emerald-800" />
            ) : (
              <Copy className="w-4 h-4 opacity-80" />
            )}
          </button>
        </div>

        {/* Invite Link Copy */}
        <div className="space-y-2">
          <div className="px-3 py-2 rounded-xl bg-sky-50 dark:bg-[#0B1524] border-2 border-slate-900/20 dark:border-slate-700 font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate select-all">
            {inviteUrl}
          </div>
          <button
            type="button"
            onClick={copyLink}
            data-testid="copy-invite-link-btn"
            className="w-full py-2.5 px-4 rounded-xl cartoon-btn-sky font-display font-black text-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
            <span>{copiedLink ? t(lang, 'copied') : t(lang, 'copyInviteLink')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
