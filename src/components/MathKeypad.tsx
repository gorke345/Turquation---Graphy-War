import React from 'react';
import { Sparkles } from 'lucide-react';
import {
  BATTLESHIP_KEYPAD_TOKENS,
  GRAPH_WARS_EXAMPLE_EQUATIONS,
  GRAPH_WARS_KEYPAD_TOKENS,
  insertMathToken,
} from '../engine/mathKeypad';
import { soundEngine } from '../engine/sound';
import { Lang } from '../i18n/translations';

interface MathKeypadProps {
  lang: Lang;
  variant: 'graph_wars' | 'battleship';
  value: string;
  onChange: (next: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  disabled?: boolean;
  examples?: string[];
}

export const MathKeypad: React.FC<MathKeypadProps> = ({
  lang,
  variant,
  value,
  onChange,
  inputRef,
  disabled = false,
  examples,
}) => {
  const tokens = variant === 'graph_wars' ? GRAPH_WARS_KEYPAD_TOKENS : BATTLESHIP_KEYPAD_TOKENS;
  const examplePool =
    examples ?? (variant === 'graph_wars' ? GRAPH_WARS_EXAMPLE_EQUATIONS : []);

  const handleInsert = (insertStr: string) => {
    if (disabled) return;
    soundEngine.playClick();
    const el = inputRef?.current;
    const { value: nextVal, cursor } = insertMathToken(
      value,
      insertStr,
      el?.selectionStart,
      el?.selectionEnd
    );
    onChange(nextVal);
    if (el) {
      window.requestAnimationFrame(() => {
        el.focus();
        try {
          el.setSelectionRange(cursor, cursor);
        } catch {
          // ignore unsupported input types
        }
      });
    }
  };

  const handleCycleExample = () => {
    if (disabled || examplePool.length === 0) return;
    soundEngine.playClick();
    const curIdx = examplePool.indexOf(value.trim());
    const nextEq = examplePool[(curIdx + 1) % examplePool.length];
    onChange(nextEq);
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 pt-1"
      aria-label={lang === 'tr' ? 'Hızlı matematik tuş takımı' : 'Quick math keypad'}
    >
      {tokens.map((tok) => (
        <button
          key={tok.label}
          type="button"
          disabled={disabled}
          aria-label={tok.ariaLabel}
          onClick={() => handleInsert(tok.insert)}
          className="px-2.5 py-1 min-w-[34px] min-h-[32px] rounded-lg bg-slate-100 hover:bg-amber-200 dark:bg-[#0B1524] dark:hover:bg-[#192B47] border-2 border-slate-900/80 dark:border-slate-600 font-mono text-xs font-extrabold text-slate-900 dark:text-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          {tok.label}
        </button>
      ))}

      {examplePool.length > 0 && (
        <button
          type="button"
          disabled={disabled}
          data-testid="math-keypad-example-btn"
          onClick={handleCycleExample}
          className="px-2.5 py-1 min-h-[32px] rounded-lg bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 border-2 border-slate-900 dark:border-amber-400/70 font-display text-[11px] font-black text-amber-950 dark:text-amber-200 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Sparkles className="w-3 h-3" />
          <span>{lang === 'tr' ? 'Örnek' : 'Example'}</span>
        </button>
      )}
    </div>
  );
};
