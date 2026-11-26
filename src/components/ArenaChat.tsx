import React, { useEffect, useRef, useState } from 'react';
import { Send, ShieldAlert } from 'lucide-react';
import { CHAT_COOLDOWN_MS } from '../engine/chatFilter';
import { ChatMessage } from '../services/multiplayerTypes';
import { Lang, t } from '../i18n/translations';

interface ArenaChatProps {
  lang: Lang;
  messages: ChatMessage[];
  myId: string;
  onSend: (text: string) => void;
  cooldownUntilMs: number;
}

export const ArenaChat: React.FC<ArenaChatProps> = ({
  lang,
  messages,
  myId,
  onSend,
  cooldownUntilMs,
}) => {
  const [input, setInput] = useState('');
  const [remainingSec, setRemainingSec] = useState(0);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const safeMessages = Array.isArray(messages) ? messages : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [safeMessages.length]);

  useEffect(() => {
    const tick = () => {
      const rem = Math.max(0, cooldownUntilMs - Date.now());
      setRemainingSec(Math.ceil(rem / 1000));
    };
    tick();
    const id = window.setInterval(tick, 250);
    return () => clearInterval(id);
  }, [cooldownUntilMs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || remainingSec > 0) return;
    onSend(trimmed);
    setInput('');
  };

  return (
    <div
      data-testid="arena-chat"
      className="flex flex-col cartoon-card bg-white/96 dark:bg-[#101C2E]/96 overflow-hidden h-full min-h-[260px]"
    >
      <div className="px-4 py-2.5 border-b-2 border-slate-200 dark:border-slate-700 flex items-center justify-between bg-sky-50/90 dark:bg-[#0B1524]">
        <h3 className="text-xs font-display font-black uppercase tracking-wider text-slate-900 dark:text-white">
          {t(lang, 'chatTitle')}
        </h3>
        <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
          {CHAT_COOLDOWN_MS / 1000}s
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 text-xs">
        {safeMessages.length === 0 ? (
          <p className="text-slate-500 dark:text-slate-400 text-center py-6 font-medium">
            {lang === 'tr' ? 'Sohbet hazır. Saygılı oyunlar!' : 'Chat ready. Good luck!'}
          </p>
        ) : (
          safeMessages.map((m) => {
            const isMe = m.senderId === myId;
            return (
              <div key={m.id} className="space-y-0.5">
                <div className="flex items-baseline gap-2">
                  <span
                    className={`font-display font-extrabold ${
                      isMe ? 'text-sky-700 dark:text-amber-300' : 'text-slate-900 dark:text-slate-100'
                    }`}
                  >
                    {m.senderName}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 tabular-nums">
                    {new Date(m.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-800 dark:text-slate-200 break-words leading-relaxed">{m.text}</p>
                {m.wasCensored && (
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1 font-bold">
                    <ShieldAlert className="w-3 h-3" />
                    <span>{t(lang, 'chatCensoredNotice')}</span>
                  </p>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t-2 border-slate-200 dark:border-slate-700 flex items-center gap-2 bg-sky-50/80 dark:bg-[#0B1524]"
      >
        <input
          type="text"
          maxLength={200}
          value={input}
          disabled={remainingSec > 0}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            remainingSec > 0
              ? t(lang, 'chatCooldown', { s: remainingSec })
              : t(lang, 'chatPlaceholder')
          }
          aria-label={t(lang, 'chatTitle')}
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-white dark:bg-[#101C2E] border-2 border-slate-900 dark:border-slate-600 text-xs font-medium text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={remainingSec > 0 || !input.trim()}
          aria-label={t(lang, 'chatSend')}
          className="px-3 py-2 rounded-xl cartoon-btn-amber disabled:opacity-50 font-display font-black text-xs flex items-center gap-1 shrink-0 cursor-pointer"
        >
          {remainingSec > 0 ? (
            <span className="font-mono tabular-nums">{remainingSec}s</span>
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </button>
      </form>
    </div>
  );
};
