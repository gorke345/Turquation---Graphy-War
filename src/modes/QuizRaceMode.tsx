import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Clock, Trophy } from 'lucide-react';
import { ArenaChat } from '../components/ArenaChat';
import { CoordinateCanvas } from '../components/CoordinateCanvas';
import { GridDensity, ThemeMode } from '../components/SettingsModal';
import { getCountdownBeepParams } from '../engine/countdown';
import { GeneratedFunctionProblem } from '../engine/functionGenerator';
import { formatCoord } from '../engine/mathParser';
import { soundEngine } from '../engine/sound';
import { Lang, t } from '../i18n/translations';
import { QuizSubmission, RoomFullState } from '../services/multiplayerTypes';

interface QuizRaceModeProps {
  lang: Lang;
  theme: ThemeMode;
  gridDensity: GridDensity;
  room: RoomFullState;
  myId: string;
  onSubmit: (submission: QuizSubmission) => void;
  onSendChat: (text: string) => void;
  chatCooldownUntilMs: number;
  onLeave: () => void;
}

function buildIntervalChoices(
  correct: string,
  problem: GeneratedFunctionProblem,
  field: 'domain' | 'range' | 'inc' | 'dec'
): string[] {
  const set = new Set<string>([correct]);
  const r = problem.vertex?.x ?? 0;
  const k = problem.vertex?.y ?? 0;

  if (field === 'domain') {
    set.add('R');
    set.add(`[${r - 2}, ${r + 2}]`);
    set.add(`[${r - 1}, ${r + 3}]`);
    set.add(`[${k}, ∞)`);
  } else if (field === 'range') {
    set.add('R');
    set.add(`[${k}, ∞)`);
    set.add(`(-∞, ${k}]`);
    set.add(`[${k - 2}, ∞)`);
    set.add(`[${r}, ∞)`);
  } else {
    set.add('R');
    set.add('Yok / None');
    set.add(`[${r}, ∞)`);
    set.add(`(-∞, ${r}]`);
    if (typeof problem.domainMin === 'number' && typeof problem.domainMax === 'number') {
      set.add(`[${r}, ${problem.domainMax}]`);
      set.add(`[${problem.domainMin}, ${r}]`);
    }
  }
  return Array.from(set).slice(0, 4);
}

export const QuizRaceMode: React.FC<QuizRaceModeProps> = ({
  lang,
  theme,
  gridDensity,
  room,
  myId,
  onSubmit,
  onSendChat,
  chatCooldownUntilMs,
  onLeave,
}) => {
  const quiz = room.quiz!;
  const problem = quiz.problem;
  const xInts = Array.isArray(problem.xIntercepts) ? problem.xIntercepts : [];
  const players = Array.isArray(room.players) ? room.players : [];
  const me = players.find((p) => p.id === myId);

  const [nowMs, setNowMs] = useState(Date.now());
  const [targetPoint, setTargetPoint] = useState('');
  const [xIntercepts, setXIntercepts] = useState('');
  const [yIntercept, setYIntercept] = useState('');
  const [vertexOrSlope, setVertexOrSlope] = useState('');
  const [symmetryAxis, setSymmetryAxis] = useState('');
  const [domain, setDomain] = useState('');
  const [range, setRange] = useState('');
  const [increasing, setIncreasing] = useState('');
  const [decreasing, setDecreasing] = useState('');
  const [wasAutoSubmitted, setWasAutoSubmitted] = useState(false);

  const answersRef = useRef<QuizSubmission>({
    targetPoint: '',
    xIntercepts: '',
    yIntercept: '',
    vertexOrSlope: '',
    symmetryAxis: '',
    domain: '',
    range: '',
    increasing: '',
    decreasing: '',
  });
  answersRef.current = {
    targetPoint,
    xIntercepts,
    yIntercept,
    vertexOrSlope,
    symmetryAxis,
    domain,
    range,
    increasing,
    decreasing,
  };

  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const autoSubmittedRoundRef = useRef<string>('');
  const roundKey = `${quiz.round}_${problem.id}`;

  // Reset form on new round
  useEffect(() => {
    setTargetPoint('');
    setXIntercepts('');
    setYIntercept('');
    setVertexOrSlope('');
    setSymmetryAxis('');
    setDomain('');
    setRange('');
    setIncreasing('');
    setDecreasing('');
    setWasAutoSubmitted(false);
  }, [quiz.round, problem.id]);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 150);
    return () => clearInterval(id);
  }, []);

  // Auto-submit filled answers right as time expires so unsubmitted inputs are still graded & scored!
  useEffect(() => {
    if (quiz.phase !== 'question' || me?.roundSubmitted) return;
    if (autoSubmittedRoundRef.current === roundKey) return;

    const remainingMs = quiz.endsAt - nowMs;
    if (remainingMs <= 500) {
      autoSubmittedRoundRef.current = roundKey;
      setWasAutoSubmitted(true);
      onSubmitRef.current({ ...answersRef.current });
    }
  }, [nowMs, quiz.phase, quiz.endsAt, me?.roundSubmitted, roundKey]);

  // Accelerating & louder warning beep in the final 10 seconds while player hasn't submitted yet
  useEffect(() => {
    if (quiz.phase !== 'question' || me?.roundSubmitted) return;
    let timerId: number | null = null;
    let cancelled = false;

    const scheduleBeep = () => {
      if (cancelled) return;
      const rem = quiz.endsAt - Date.now();
      if (rem <= 0) return;
      if (rem > 10_000) {
        timerId = window.setTimeout(scheduleBeep, Math.min(500, rem - 9_950));
        return;
      }
      const params = getCountdownBeepParams(rem, 10_000);
      if (params.active) {
        soundEngine.playUrgentBeep(params);
        timerId = window.setTimeout(scheduleBeep, params.intervalMs);
      }
    };

    scheduleBeep();
    return () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [quiz.phase, quiz.endsAt, quiz.round, me?.roundSubmitted]);

  const secondsLeft = Math.max(0, Math.ceil((quiz.endsAt - nowMs) / 1000));

  const domainChoices = useMemo(
    () => buildIntervalChoices(problem.domainLabel, problem, 'domain'),
    [problem]
  );
  const rangeChoices = useMemo(
    () => buildIntervalChoices(problem.rangeLabel, problem, 'range'),
    [problem]
  );
  const incChoices = useMemo(
    () => buildIntervalChoices(problem.increasingLabel, problem, 'inc'),
    [problem]
  );
  const decChoices = useMemo(
    () => buildIntervalChoices(problem.decreasingLabel, problem, 'dec'),
    [problem]
  );

  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (me?.roundSubmitted || quiz.phase !== 'question') return;
    autoSubmittedRoundRef.current = roundKey;
    soundEngine.playCorrect();
    onSubmit({ ...answersRef.current });
  };

  const myResult = quiz.roundResults?.[myId];
  const inputCls =
    'w-full px-3 py-2 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 font-mono text-xs font-bold text-slate-950 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60';

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {/* Compact Cartoon-Arcade Game HUD Strip */}
      <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 px-5 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="font-display font-black text-slate-950 dark:text-white">
            {t(lang, 'modeQuizTitle')}
          </span>
          <span className="px-2.5 py-0.5 rounded-lg bg-sky-100 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-sky-400 text-xs font-mono font-extrabold text-sky-900 dark:text-amber-300 tabular-nums">
            {t(lang, 'roundLabel')} {quiz.round}/{quiz.totalRounds}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-xl border-2 flex items-center gap-1.5 font-mono text-sm font-black tabular-nums ${
              secondsLeft <= 10 && quiz.phase === 'question'
                ? 'bg-rose-100 dark:bg-rose-950/75 border-rose-600 text-rose-700 dark:text-rose-300'
                : 'bg-amber-100 dark:bg-[#0B1524] border-slate-900 dark:border-slate-600 text-slate-950 dark:text-white'
            }`}
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span>{secondsLeft}s</span>
          </div>
          <button
            type="button"
            onClick={onLeave}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#172740] text-xs font-display font-black text-slate-900 dark:text-slate-100 cartoon-btn-white cursor-pointer"
          >
            {t(lang, 'leaveRoom')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Function Visual / Equation Card */}
        <div className="lg:col-span-5 space-y-3">
          <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                {problem.promptMode === 'graph'
                  ? lang === 'tr'
                    ? 'Grafikten Analiz'
                    : 'Graph Analysis'
                  : lang === 'tr'
                    ? 'Denklemden Analiz'
                    : 'Equation Analysis'}
              </span>
              {typeof problem.domainMin === 'number' && typeof problem.domainMax === 'number' && (
                <span className="text-xs font-mono font-bold text-amber-700 dark:text-amber-300">
                  x ∈ [{problem.domainMin}, {problem.domainMax}]
                </span>
              )}
            </div>

            {(problem.promptMode === 'equation' || quiz.phase === 'reveal') && (
              <div className="px-4 py-3 rounded-xl bg-sky-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-sky-400/50 text-center">
                <span className="font-mono text-lg font-black text-sky-800 dark:text-amber-300">
                  f(x) = {problem.equation}
                </span>
              </div>
            )}

            <div className="aspect-square w-full max-w-[380px] max-h-[380px] mx-auto">
              <CoordinateCanvas
                testId="quiz-canvas"
                range={7}
                theme={theme}
                gridDensity={gridDensity}
                curves={
                  problem.promptMode === 'graph' || quiz.phase === 'reveal'
                    ? [
                        {
                          equation: problem.equation,
                          color: theme === 'dark' ? '#38BDF8' : '#0284C7',
                          domainMin: problem.domainMin,
                          domainMax: problem.domainMax,
                        },
                      ]
                    : []
                }
                markers={
                  quiz.phase === 'reveal'
                    ? [
                        ...(problem.vertex
                          ? [{ x: problem.vertex.x, y: problem.vertex.y, kind: 'vertex' as const }]
                          : []),
                        { x: problem.yIntercept.x, y: problem.yIntercept.y, kind: 'point' as const },
                        ...xInts.map((p) => ({
                          x: p.x,
                          y: p.y,
                          kind: 'hit' as const,
                        })),
                      ]
                    : problem.promptMode === 'graph' && problem.vertex
                      ? [{ x: problem.vertex.x, y: problem.vertex.y, kind: 'vertex' as const }]
                      : []
                }
              />
            </div>

            {quiz.phase === 'reveal' && (
              <div className="bg-emerald-50 dark:bg-[#0B1524] border-2 border-emerald-500/60 rounded-xl p-3 text-xs font-mono space-y-1 text-slate-800 dark:text-slate-200">
                <div className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                  {lang === 'tr' ? 'Doğru Çözüm' : 'Correct Solution'}
                </div>
                <div>
                  f({problem.targetX}) → {formatCoord(problem.targetPoint)} · y-int:{' '}
                  {formatCoord(problem.yIntercept)}
                </div>
                <div>
                  x-int:{' '}
                  {xInts.length > 0 ? xInts.map(formatCoord).join(', ') : 'Yok / None'}
                </div>
                <div>
                  {problem.family === 'linear'
                    ? `m = ${problem.slope}`
                    : `T = ${problem.vertex ? formatCoord(problem.vertex) : '-'} · x = ${problem.symmetryAxis}`}
                </div>
                <div>
                  D: {problem.domainLabel} · R: {problem.rangeLabel}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Answer Inputs */}
        <div className="lg:col-span-4 cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label
                htmlFor="quiz-target"
                className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
              >
                {t(lang, 'targetPointPrompt', { x: problem.targetX })}
              </label>
              <input
                id="quiz-target"
                type="text"
                disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                value={targetPoint}
                onChange={(e) => setTargetPoint(e.target.value)}
                placeholder={`[${problem.targetX}, ?]`}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5 items-end">
              <div>
                <label
                  htmlFor="quiz-xint"
                  className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
                >
                  {lang === 'tr' ? 'x-Eksen Kesimleri' : 'x-Intercept(s)'}
                </label>
                <input
                  id="quiz-xint"
                  type="text"
                  disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                  value={xIntercepts}
                  onChange={(e) => setXIntercepts(e.target.value)}
                  placeholder="[-2,0], [2,0] / yok"
                  className={inputCls}
                />
              </div>
              <div>
                <label
                  htmlFor="quiz-yint"
                  className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
                >
                  {lang === 'tr' ? 'y-Eksen Kesimi [0,y]' : 'y-Intercept [0,y]'}
                </label>
                <input
                  id="quiz-yint"
                  type="text"
                  disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                  value={yIntercept}
                  onChange={(e) => setYIntercept(e.target.value)}
                  placeholder="[0, 3]"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="quiz-vs"
                  className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
                >
                  {problem.family === 'linear' ? t(lang, 'slopePrompt') : t(lang, 'vertexPrompt')}
                </label>
                <input
                  id="quiz-vs"
                  type="text"
                  disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                  value={vertexOrSlope}
                  onChange={(e) => setVertexOrSlope(e.target.value)}
                  placeholder={problem.family === 'linear' ? '2' : '[1, -4]'}
                  className={inputCls}
                />
              </div>
              {problem.symmetryAxis !== null && (
                <div>
                  <label
                    htmlFor="quiz-sym"
                    className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
                  >
                    {t(lang, 'symmetryPrompt')}
                  </label>
                  <input
                    id="quiz-sym"
                    type="text"
                    disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                    value={symmetryAxis}
                    onChange={(e) => setSymmetryAxis(e.target.value)}
                    placeholder="x = 1"
                    className={inputCls}
                  />
                </div>
              )}
            </div>

            {/* Structured Interval Selectors */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="quiz-domain"
                  className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
                >
                  {t(lang, 'domainPrompt')}
                </label>
                <select
                  id="quiz-domain"
                  disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {domainChoices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="quiz-range"
                  className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
                >
                  {t(lang, 'rangePrompt')}
                </label>
                <select
                  id="quiz-range"
                  disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {rangeChoices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label
                  htmlFor="quiz-inc"
                  className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
                >
                  {t(lang, 'increasingPrompt')}
                </label>
                <select
                  id="quiz-inc"
                  disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                  value={increasing}
                  onChange={(e) => setIncreasing(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {incChoices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="quiz-dec"
                  className="block text-xs font-display font-extrabold text-slate-800 dark:text-slate-200 mb-1"
                >
                  {t(lang, 'decreasingPrompt')}
                </label>
                <select
                  id="quiz-dec"
                  disabled={me?.roundSubmitted || quiz.phase !== 'question'}
                  value={decreasing}
                  onChange={(e) => setDecreasing(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {decChoices.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {me?.roundSubmitted ? (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border-2 border-emerald-500/60 text-xs text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-bold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {wasAutoSubmitted
                      ? lang === 'tr'
                        ? 'Süre doldu — cevapların otomatik değerlendirildi!'
                        : 'Time up — filled answers auto-graded!'
                      : t(lang, 'submittedWait')}
                  </span>
                </span>
                {myResult && (
                  <span className="font-mono font-black tabular-nums shrink-0">
                    +{myResult.points} ({myResult.correctCount}/{myResult.totalFields})
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-1.5">
                <button
                  type="submit"
                  disabled={quiz.phase !== 'question'}
                  className="w-full py-2.5 px-4 rounded-xl cartoon-btn-green disabled:opacity-50 font-display font-black text-sm cursor-pointer"
                >
                  {t(lang, 'submitAnswers')}
                </button>
                <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 text-center">
                  {lang === 'tr'
                    ? 'Süre dolduğunda doldurduğun alanlar otomatik değerlendirilir.'
                    : 'Filled answers are automatically graded when time expires.'}
                </p>
              </div>
            )}
          </form>
        </div>

        {/* Right: Live Standings + In-Game Chat */}
        <div className="lg:col-span-3 flex flex-col gap-3.5">
          <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-display font-black uppercase tracking-wider text-slate-900 dark:text-white">
              <Trophy className="w-4 h-4 text-amber-500 dark:text-amber-300" />
              <span>{t(lang, 'liveStandings')}</span>
            </div>

            <div className="space-y-1.5">
              {sortedPlayers.map((p, idx) => (
                <div
                  key={p.id}
                  className={`py-2 px-3 rounded-xl border-2 flex items-center justify-between text-xs ${
                    p.id === myId
                      ? 'bg-sky-50 dark:bg-[#172B47] border-slate-900 dark:border-sky-400 text-sky-950 dark:text-white'
                      : 'bg-slate-50 dark:bg-[#0B1524] border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono font-black text-slate-400 dark:text-amber-300 w-5 tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="truncate font-display font-extrabold">{p.username}</span>
                    {p.disconnected && (
                      <span className="text-[9px] font-mono font-bold text-rose-500">DC</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                    {p.roundSubmitted && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                    )}
                    <span className="font-black text-sky-700 dark:text-amber-300">{p.score}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="min-h-[280px] max-h-[380px]">
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
    </div>
  );
};
