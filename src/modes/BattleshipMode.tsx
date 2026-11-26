import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, Shield, Target } from 'lucide-react';
import { ArenaChat } from '../components/ArenaChat';
import { CoordinateCanvas, PlottedCurve, PlottedMarker } from '../components/CoordinateCanvas';
import { MathKeypad } from '../components/MathKeypad';
import { GridDensity, ThemeMode } from '../components/SettingsModal';
import { BATTLESHIP_PRESETS, validateBattleshipEquation } from '../engine/functionGenerator';
import { compileMathFunction, parsePoint } from '../engine/mathParser';
import { soundEngine } from '../engine/sound';
import { Lang, t } from '../i18n/translations';
import { RoomFullState } from '../services/multiplayerTypes';

interface BattleshipModeProps {
  lang: Lang;
  theme: ThemeMode;
  gridDensity: GridDensity;
  room: RoomFullState;
  myId: string;
  onPlaceFleet: (equations: string[]) => void;
  onFireShot: (x: number, y: number) => void;
  onGuessEquation: (equation: string) => void;
  onSendChat: (text: string) => void;
  chatCooldownUntilMs: number;
  onLeave: () => void;
}

export const BattleshipMode: React.FC<BattleshipModeProps> = ({
  lang,
  theme,
  gridDensity,
  room,
  myId,
  onPlaceFleet,
  onFireShot,
  onGuessEquation,
  onSendChat,
  chatCooldownUntilMs,
  onLeave,
}) => {
  const bs = room.battleship!;
  const players = Array.isArray(room.players) ? room.players : [];
  const me = players.find((p) => p.id === myId);
  const opponent = players.find((p) => p.id !== myId);

  const presets = BATTLESHIP_PRESETS[room.difficulty];
  const [eq1, setEq1] = useState(presets[0]);
  const [eq2, setEq2] = useState(presets[1]);
  const [coordInput, setCoordInput] = useState('');
  const [guessInput, setGuessInput] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const guessInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!bs.lastEvent) return;
    if (bs.lastEvent.type === 'hit') soundEngine.playHit();
    else if (bs.lastEvent.type === 'sink') soundEngine.playVictory();
    else if (bs.lastEvent.type === 'miss' || bs.lastEvent.type === 'bad_guess') soundEngine.playMiss();
  }, [bs.lastEvent?.timestamp]);

  const v1 = validateBattleshipEquation(eq1, room.difficulty);
  const v2 = validateBattleshipEquation(eq2, room.difficulty);
  const isMyTurn = bs.turnPlayerId === myId;
  const primaryColor = theme === 'dark' ? '#22D3EE' : '#0284C7';
  const secondaryColor = theme === 'dark' ? '#F59E0B' : '#D97706';

  const handleLockFleet = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    if (!v1.ok) {
      setLocalError(`#1: ${v1.reason}`);
      return;
    }
    if (!v2.ok) {
      setLocalError(`#2: ${v2.reason}`);
      return;
    }
    soundEngine.playClick();
    onPlaceFleet([eq1, eq2]);
  };

  const handleFireForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMyTurn) return;
    setLocalError(null);
    const pt = parsePoint(coordInput);
    if (!pt || !Number.isInteger(pt.x) || !Number.isInteger(pt.y)) {
      setLocalError(t(lang, 'errInvalidPoint'));
      return;
    }
    onFireShot(pt.x, pt.y);
    setCoordInput('');
  };

  const handleGuessForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isMyTurn) return;
    setLocalError(null);
    const compiled = compileMathFunction(guessInput);
    if (!compiled.fn) {
      setLocalError(t(lang, 'errInvalidEq'));
      return;
    }
    onGuessEquation(guessInput);
    setGuessInput('');
  };

  // Prep Phase UI
  if (bs.phase === 'prep') {
    const previewCurves: PlottedCurve[] = [];
    const previewMarkers: PlottedMarker[] = [];
    if (v1.ok) {
      previewCurves.push({ equation: eq1, color: primaryColor });
      v1.points.forEach((p) => previewMarkers.push({ x: p.x, y: p.y, kind: 'lattice', color: primaryColor }));
    }
    if (v2.ok) {
      previewCurves.push({ equation: eq2, color: secondaryColor });
      v2.points.forEach((p) => previewMarkers.push({ x: p.x, y: p.y, kind: 'lattice', color: secondaryColor }));
    }

    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 px-5 py-3 flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-slate-950 dark:text-white">
              {t(lang, 'prepPhaseTitle')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-300">{t(lang, 'prepPhaseDesc')}</p>
          </div>
          <button
            type="button"
            onClick={onLeave}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#172740] text-xs font-display font-black text-slate-900 dark:text-slate-100 cartoon-btn-white cursor-pointer"
          >
            {t(lang, 'leaveRoom')}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          <div className="lg:col-span-5 aspect-square max-h-[440px] cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-2">
            <CoordinateCanvas
              testId="battleship-prep-canvas"
              range={7}
              theme={theme}
              gridDensity={gridDensity}
              curves={previewCurves}
              markers={previewMarkers}
            />
          </div>

          <div className="lg:col-span-4 cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-5 space-y-4">
            {me?.fleetReady ? (
              <div className="py-12 text-center space-y-3">
                <Shield className="w-10 h-10 text-sky-600 dark:text-amber-300 mx-auto" />
                <p className="text-sm font-display font-black text-slate-950 dark:text-white">
                  {t(lang, 'waitingOpponentFleet')}
                </p>
                <p className="text-xs font-mono text-slate-500 dark:text-slate-300">
                  f₁(x) = {eq1} · f₂(x) = {eq2}
                </p>
              </div>
            ) : (
              <form onSubmit={handleLockFleet} className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="bs-eq1"
                      className="font-display font-extrabold text-sky-700 dark:text-sky-300"
                    >
                      {t(lang, 'functionSlot')} #1: f₁(x) =
                    </label>
                    <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {v1.points.length} pts
                    </span>
                  </div>
                  <input
                    id="bs-eq1"
                    type="text"
                    value={eq1}
                    onChange={(e) => setEq1(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 font-mono text-sm font-bold text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {!v1.ok && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{v1.reason}</p>}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label
                      htmlFor="bs-eq2"
                      className="font-display font-extrabold text-amber-700 dark:text-amber-300"
                    >
                      {t(lang, 'functionSlot')} #2: f₂(x) =
                    </label>
                    <span className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                      {v2.points.length} pts
                    </span>
                  </div>
                  <input
                    id="bs-eq2"
                    type="text"
                    value={eq2}
                    onChange={(e) => setEq2(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 font-mono text-sm font-bold text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {!v2.ok && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{v2.reason}</p>}
                </div>

                {/* Preset quick templates */}
                <div className="space-y-1.5">
                  <span className="text-xs font-display font-bold text-slate-600 dark:text-slate-300">
                    {lang === 'tr' ? 'Hızlı Şablonlar' : 'Quick Presets'}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {presets.map((p, idx) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => (idx % 2 === 0 ? setEq1(p) : setEq2(p))}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-[#0B1524] border-2 border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-amber-400 font-mono text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {localError && (
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{localError}</p>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl cartoon-btn-green font-display font-black text-sm cursor-pointer"
                >
                  {t(lang, 'lockFleet')}
                </button>
              </form>
            )}
          </div>

          <div className="lg:col-span-3 min-h-[280px] max-h-[440px]">
            <ArenaChat
              lang={lang}
              messages={Array.isArray(room.chat) ? room.chat : []}
              myId={myId}
              onSend={onSendChat}
              cooldownUntilMs={chatCooldownUntilMs}
            />
          </div>
        </div>
      </div>
    );
  }

  // Battle Phase
  const shots = bs.shots || [];
  const myShips = bs.myShips || [];
  const opponentSunkShips = bs.opponentSunkShips || [];
  const myShotsOnEnemy = shots.filter((s) => s.byPlayerId === myId);
  const enemyShotsOnMe = shots.filter((s) => s.targetPlayerId === myId);

  const enemyCurves: PlottedCurve[] = opponentSunkShips.map((s) => ({
    equation: s.equation,
    color: '#F43F5E',
  }));
  const enemyMarkers: PlottedMarker[] = myShotsOnEnemy.map((s) => ({
    x: s.x,
    y: s.y,
    kind: s.hit ? 'hit' : 'miss',
  }));

  const myCurves: PlottedCurve[] = myShips.map((s, idx) => ({
    equation: s.equation,
    color: s.sunk ? '#64748B' : idx === 0 ? primaryColor : secondaryColor,
    dashed: s.sunk,
  }));
  const myMarkers: PlottedMarker[] = enemyShotsOnMe.map((s) => ({
    x: s.x,
    y: s.y,
    kind: s.hit ? 'hit' : 'miss',
  }));

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Turn & Status HUD */}
      <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className={`font-display font-black text-sm ${
              isMyTurn ? 'text-sky-700 dark:text-amber-300' : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            {isMyTurn ? t(lang, 'yourTurn') : t(lang, 'opponentTurn')}
          </span>
          {bs.lastEvent && (
            <span
              className={`text-xs font-mono font-bold ${
                bs.lastEvent.type === 'hit' || bs.lastEvent.type === 'sink'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-300'
              }`}
            >
              {bs.lastEvent.actorName}:{' '}
              {bs.lastEvent.type === 'hit'
                ? `${t(lang, 'hitLabel')} [${bs.lastEvent.coord?.x},${bs.lastEvent.coord?.y}]`
                : bs.lastEvent.type === 'sink'
                  ? `${t(lang, 'sunkLabel')} f(x)=${bs.lastEvent.equation}`
                  : bs.lastEvent.type === 'bad_guess'
                    ? `${t(lang, 'missLabel')} (${bs.lastEvent.equation})`
                    : `${t(lang, 'missLabel')} [${bs.lastEvent.coord?.x},${bs.lastEvent.coord?.y}]`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs font-mono font-bold tabular-nums">
          <span className="text-sky-700 dark:text-sky-300">
            {me?.username}: {me?.shipsRemaining ?? 0} {t(lang, 'shipsRemaining')}
          </span>
          <span className="text-slate-300 dark:text-slate-600">|</span>
          <span className="text-rose-600 dark:text-rose-300">
            {opponent?.username}: {opponent?.shipsRemaining ?? 0} {t(lang, 'shipsRemaining')}
          </span>
          <button
            type="button"
            onClick={onLeave}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#172740] text-slate-900 dark:text-slate-100 cartoon-btn-white font-display font-black cursor-pointer"
          >
            {t(lang, 'leaveRoom')}
          </button>
        </div>
      </div>

      {/* Controls Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <form
          onSubmit={handleFireForm}
          className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-3.5 flex items-end gap-2.5"
        >
          <div className="flex-1">
            <label
              htmlFor="bs-fire-coord"
              className="block text-xs font-display font-extrabold text-slate-700 dark:text-slate-200 mb-1"
            >
              {t(lang, 'fireCoordLabel')}
            </label>
            <input
              id="bs-fire-coord"
              type="text"
              disabled={!isMyTurn}
              value={coordInput}
              onChange={(e) => setCoordInput(e.target.value)}
              placeholder="[2, -3]"
              className="w-full px-3 py-2 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 font-mono text-xs font-bold text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
            />
          </div>
          <button
            type="submit"
            disabled={!isMyTurn}
            className="px-4 py-2 rounded-xl cartoon-btn-green disabled:opacity-50 font-display font-black text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{t(lang, 'fireBtn')}</span>
          </button>
        </form>

        <form
          onSubmit={handleGuessForm}
          className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-3.5 space-y-2"
        >
          <div className="flex items-end gap-2.5">
            <div className="flex-1">
              <label
                htmlFor="bs-guess-eq"
                className="block text-xs font-display font-extrabold text-slate-700 dark:text-slate-200 mb-1"
              >
                {t(lang, 'guessEqLabel')}
              </label>
              <input
                ref={guessInputRef}
                id="bs-guess-eq"
                type="text"
                disabled={!isMyTurn}
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder="(x - 1)^2 - 4"
                className="w-full px-3 py-2 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 font-mono text-xs font-bold text-slate-950 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={!isMyTurn}
              className="px-4 py-2 rounded-xl cartoon-btn-amber disabled:opacity-50 font-display font-black text-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Target className="w-3.5 h-3.5" />
              <span>{t(lang, 'guessBtn')}</span>
            </button>
          </div>
          <MathKeypad
            lang={lang}
            variant="battleship"
            value={guessInput}
            onChange={setGuessInput}
            inputRef={guessInputRef}
            disabled={!isMyTurn}
          />
        </form>
      </div>

      {localError && (
        <p className="text-xs font-bold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/70 border-2 border-rose-500 rounded-xl px-3 py-2">
          {localError}
        </p>
      )}

      {/* Dual Coordinate Boards + Live In-Game Chat */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        <div className="xl:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-black text-rose-600 dark:text-rose-300">
                {t(lang, 'enemyRadar')}
              </span>
              <span className="font-mono font-bold text-slate-500 dark:text-slate-300">
                {opponent?.username}
              </span>
            </div>
            <div className="aspect-square max-h-[420px] w-full max-w-[420px] mx-auto">
              <CoordinateCanvas
                testId="battleship-enemy-canvas"
                range={7}
                theme={theme}
                gridDensity={gridDensity}
                curves={enemyCurves}
                markers={enemyMarkers}
                interactive={isMyTurn}
                onLatticeClick={(x, y) => {
                  if (!isMyTurn) return;
                  onFireShot(x, y);
                }}
              />
            </div>
          </div>

          <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-display font-black text-sky-700 dark:text-amber-300">
                {t(lang, 'yourBoard')}
              </span>
              <span className="font-mono font-bold text-slate-500 dark:text-slate-300">
                {myShips.map((s) => s.equation).join(' · ')}
              </span>
            </div>
            <div className="aspect-square max-h-[420px] w-full max-w-[420px] mx-auto">
              <CoordinateCanvas
                testId="battleship-own-canvas"
                range={7}
                theme={theme}
                gridDensity={gridDensity}
                curves={myCurves}
                markers={myMarkers}
              />
            </div>
          </div>
        </div>

        <div className="xl:col-span-3 min-h-[280px] max-h-[480px]">
          <ArenaChat
            lang={lang}
            messages={Array.isArray(room.chat) ? room.chat : []}
            myId={myId}
            onSend={onSendChat}
            cooldownUntilMs={chatCooldownUntilMs}
          />
        </div>
      </div>
    </div>
  );
};
