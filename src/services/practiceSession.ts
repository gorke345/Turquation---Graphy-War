/**
 * Local Offline Solo Practice Session Controller.
 * Strictly isolated from Firebase RTDB, online matchmaking, and Elo ratings.
 * Allows a single player to practice all 3 game modes immediately against
 * a clearly labeled offline Practice Bot ("Antrenman Botu").
 */

import {
  ArenaMapId,
  getAvatarById,
  MapSelection,
  resolveArenaMap,
} from '../engine/avatarsAndMaps';
import { DifficultyTier, GameMode } from '../engine/elo';
import {
  generateFunctionProblem,
  GeneratedFunctionProblem,
  validateBattleshipEquation,
} from '../engine/functionGenerator';
import {
  computeGraphWarsStandings,
  FireDirection,
  generateGraphWarsMap,
  GraphWarsObstacle,
  GraphWarsSoldier,
  GraphWarsTrajectory,
  GW_AIM_DURATION_MS,
  GW_FIRING_DURATION_MS,
  traceClassicGraphWarsShot,
} from '../engine/graphWarsEngine';
import {
  areExpressionsEquivalent,
  parseNumberOrFraction,
  parsePoint,
  parsePointList,
  Point2D,
  pointListsEqual,
  pointsEqual,
} from '../engine/mathParser';
import {
  computePracticeBattleshipMove,
  computePracticeGraphWarsBotShot,
  computePracticeQuizBotScore,
  pickPracticeBattleshipFleet,
} from '../engine/practiceEngine';
import {
  BattleshipShot,
  ChatMessage,
  MatchSummary,
  PlayerIdentity,
  QuizSubmission,
  RevealedShip,
  RoomFullState,
  RoomPlayerState,
} from './multiplayerTypes';

type PracticeListener = (room: RoomFullState | null) => void;

interface PracticeShip {
  index: number;
  equation: string;
  points: Point2D[];
  hitKeys: Set<string>;
  sunk: boolean;
}

const BOT_ID = 'practice_bot_offline';

function gradePracticeQuiz(
  problem: GeneratedFunctionProblem,
  sub: QuizSubmission,
  remainingMs: number
): { points: number; correctCount: number; totalFields: number } {
  let correct = 0;
  let total = 0;
  const xInts = Array.isArray(problem.xIntercepts) ? problem.xIntercepts : [];

  total++;
  const pt = parsePoint(sub.targetPoint || '');
  if (pt && pointsEqual(pt, problem.targetPoint)) correct++;

  total++;
  const xList = parsePointList(sub.xIntercepts || '');
  if (xList.valid) {
    if (xInts.length === 0 && xList.isNone) correct++;
    else if (pointListsEqual(xList.points, xInts)) correct++;
  }

  total++;
  const yPt = parsePoint(sub.yIntercept || '');
  if (yPt && pointsEqual(yPt, problem.yIntercept)) correct++;

  if (problem.vertex) {
    total++;
    const vPt = parsePoint(sub.vertexOrSlope || '');
    if (vPt && pointsEqual(vPt, problem.vertex)) correct++;
  } else if (problem.slope !== null) {
    total++;
    const mVal = parseNumberOrFraction(sub.vertexOrSlope || '');
    if (mVal !== null && Math.abs(mVal - problem.slope) < 0.05) correct++;
  }

  if (problem.symmetryAxis !== null) {
    total++;
    const cleaned = (sub.symmetryAxis || '').replace(/x\s*=/i, '').trim();
    const sVal = parseNumberOrFraction(cleaned);
    if (sVal !== null && Math.abs(sVal - problem.symmetryAxis) < 0.05) correct++;
  }

  const normalizeText = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/infinity|sonsuz/g, '∞')
      .replace(/reel|reals|all|tümü/g, 'r');

  if (problem.domainLabel) {
    total++;
    const n = normalizeText(sub.domain || '');
    const target = normalizeText(problem.domainLabel);
    if (n === target || (target === 'r' && (n === 'r' || n === '(-∞,∞)'))) correct++;
  }

  if (problem.rangeLabel) {
    total++;
    if (normalizeText(sub.range || '') === normalizeText(problem.rangeLabel)) correct++;
  }

  if (problem.increasingLabel) {
    total++;
    if (normalizeText(sub.increasing || '') === normalizeText(problem.increasingLabel)) correct++;
  }

  if (problem.decreasingLabel) {
    total++;
    if (normalizeText(sub.decreasing || '') === normalizeText(problem.decreasingLabel)) correct++;
  }

  const speedBonus = correct > 0 ? Math.min(45, Math.max(0, Math.round(remainingMs / 1000))) : 0;
  return { points: correct * 25 + speedBonus, correctCount: correct, totalFields: total };
}

export class PracticeSessionController {
  private listener: PracticeListener | null = null;
  private room: RoomFullState | null = null;
  private timers: number[] = [];
  private identity: PlayerIdentity | null = null;
  private mode: GameMode = 'graph_wars';
  private difficulty: DifficultyTier = 'apprentice';
  private mapSelection: MapSelection = 'cloud_temple';

  // Internal private game states
  private bsPlayerShips: PracticeShip[] = [];
  private bsBotShips: PracticeShip[] = [];
  private bsShots: BattleshipShot[] = [];
  private gwObstacles: GraphWarsObstacle[] = [];
  private gwCraters: Point2D[] = [];
  private gwUsedTyt = false;
  private quizSubmissions: Record<string, { points: number; correctCount: number; totalFields: number }> = {};

  public subscribe(fn: PracticeListener) {
    this.listener = fn;
    return () => {
      if (this.listener === fn) this.listener = null;
    };
  }

  public isActive(): boolean {
    return this.room !== null;
  }

  private emit() {
    this.listener?.(this.room ? { ...this.room } : null);
  }

  private clearTimers() {
    for (const id of this.timers) {
      window.clearTimeout(id);
    }
    this.timers = [];
  }

  private schedule(fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      this.timers = this.timers.filter((t) => t !== id);
      fn();
    }, ms);
    this.timers.push(id);
  }

  public start(
    identity: PlayerIdentity,
    mode: GameMode,
    difficulty: DifficultyTier,
    mapSelection: MapSelection
  ) {
    this.clearTimers();
    this.identity = identity;
    this.mode = mode;
    this.difficulty = difficulty;
    this.mapSelection = mapSelection;
    this.gwUsedTyt = false;
    this.bsPlayerShips = [];
    this.bsBotShips = [];
    this.bsShots = [];
    this.gwCraters = [];
    this.quizSubmissions = {};

    const mapId: ArenaMapId = resolveArenaMap(mapSelection, Date.now());
    const playerAvatar = getAvatarById(identity.avatarId);
    const botAvatarId = playerAvatar.id === 'flame_knight' ? 'frost_mage' : 'flame_knight';
    const botAvatar = getAvatarById(botAvatarId);

    const playerState: RoomPlayerState = {
      id: identity.id,
      username: identity.username,
      isGuest: true,
      elo: identity.elo,
      levelTrack: identity.levelTrack,
      skinId: identity.skinId,
      avatarId: playerAvatar.id,
      ready: true,
      score: 0,
      color: playerAvatar.primary,
      joinedAt: Date.now(),
      disconnected: false,
      alive: true,
      kills: 0,
      fleetReady: false,
      shipsRemaining: 2,
      usedTytCards: false,
    };

    const botState: RoomPlayerState = {
      id: BOT_ID,
      username: 'Antrenman Botu',
      isGuest: true,
      elo: 1000,
      levelTrack: identity.levelTrack,
      skinId: 'flame_nova',
      avatarId: botAvatar.id,
      ready: true,
      score: 0,
      color: '#F43F5E',
      joinedAt: Date.now() + 1,
      disconnected: false,
      alive: true,
      kills: 0,
      fleetReady: false,
      shipsRemaining: 2,
      usedTytCards: false,
    };

    const introMsg: ChatMessage = {
      id: `practice_intro_${Date.now()}`,
      senderId: BOT_ID,
      senderName: 'Antrenman Botu',
      text: 'Çevrimdışı antrenman başladı! Bu maçta Elo değişmez, istediğin gibi dene.',
      wasCensored: false,
      timestamp: Date.now(),
    };

    const baseRoom: RoomFullState = {
      code: 'SOLO',
      mode,
      difficulty,
      isRanked: false,
      mapId,
      mapSelection,
      status: 'playing',
      hostId: identity.id,
      minPlayers: 1,
      maxPlayers: 2,
      players: [playerState, botState],
      chat: [introMsg],
    };

    if (mode === 'graph_wars') {
      const map = generateGraphWarsMap(Date.now(), [identity.id, BOT_ID]);
      this.gwObstacles = map.obstacles;
      playerState.soldiers = map.soldiersByPlayer[identity.id];
      botState.soldiers = map.soldiersByPlayer[BOT_ID];
      baseRoom.graphWars = {
        round: 1,
        totalRounds: 10,
        phase: 'aim',
        endsAt: Date.now() + GW_AIM_DURATION_MS,
        mapId,
        soldiersPerPlayer: 3,
        obstacles: map.obstacles,
        trajectories: [],
        craters: [],
      };
      this.room = baseRoom;
      this.emit();
      this.scheduleGraphWarsTimeout(1);
      return;
    }

    if (mode === 'battleship') {
      const botEqs = pickPracticeBattleshipFleet(difficulty, Date.now());
      this.bsBotShips = botEqs.map((eq, idx) => {
        const val = validateBattleshipEquation(eq, difficulty);
        return {
          index: idx,
          equation: eq,
          points: val.points,
          hitKeys: new Set<string>(),
          sunk: false,
        };
      });
      botState.fleetReady = true;
      baseRoom.battleship = {
        phase: 'prep',
        turnPlayerId: identity.id,
        shots: [],
        myShips: [],
        opponentSunkShips: [],
      };
      this.room = baseRoom;
      this.emit();
      return;
    }

    // Quiz Race practice (4 rounds)
    const prob = generateFunctionProblem(difficulty);
    const qDuration = difficulty === 'apprentice' ? 38_000 : 48_000;
    baseRoom.quiz = {
      round: 1,
      totalRounds: 4,
      phase: 'question',
      endsAt: Date.now() + qDuration,
      problem: prob,
      roundResults: {},
    };
    this.room = baseRoom;
    this.emit();
    this.scheduleQuizReveal(1, qDuration + 1200);
  }

  public rematch() {
    if (!this.identity) return;
    this.start(this.identity, this.mode, this.difficulty, this.mapSelection);
  }

  public stop() {
    this.clearTimers();
    this.room = null;
    this.emit();
  }

  public sendChat(text: string) {
    if (!this.room || !this.identity || !text.trim()) return;
    const msg: ChatMessage = {
      id: `pmsg_${Date.now()}`,
      senderId: this.identity.id,
      senderName: this.identity.username,
      text: text.trim().slice(0, 180),
      wasCensored: false,
      timestamp: Date.now(),
    };
    this.room = { ...this.room, chat: [...this.room.chat.slice(-49), msg] };
    this.emit();
  }

  // =========================================================================
  // GRAPH WARS PRACTICE
  // =========================================================================

  private scheduleGraphWarsTimeout(round: number) {
    this.schedule(() => {
      if (
        !this.room ||
        this.room.status !== 'playing' ||
        !this.room.graphWars ||
        this.room.graphWars.round !== round ||
        this.room.graphWars.phase !== 'aim'
      ) {
        return;
      }
      this.resolveGraphWarsRound(null);
    }, GW_AIM_DURATION_MS + 150);
  }

  public lockGraphWarsShot(
    soldierId: string,
    direction: FireDirection,
    equation: string,
    usedTytCards: boolean
  ) {
    if (!this.room || !this.room.graphWars || this.room.graphWars.phase !== 'aim') return;
    if (usedTytCards) this.gwUsedTyt = true;
    this.clearTimers();
    this.resolveGraphWarsRound({ soldierId, direction, equation, usedTytCards });
  }

  private resolveGraphWarsRound(
    playerShot: {
      soldierId: string;
      direction: FireDirection;
      equation: string;
      usedTytCards: boolean;
    } | null
  ) {
    if (!this.room || !this.room.graphWars || !this.identity) return;
    const gw = this.room.graphWars;
    const me = this.room.players.find((p) => p.id === this.identity!.id)!;
    const bot = this.room.players.find((p) => p.id === BOT_ID)!;

    const mySoldiers = (me.soldiers || []).map((s) => ({ ...s }));
    const botSoldiers = (bot.soldiers || []).map((s) => ({ ...s }));
    const allSoldiers: GraphWarsSoldier[] = [...mySoldiers, ...botSoldiers];
    const nameMap: Record<string, string> = {
      [me.id]: me.username,
      [bot.id]: bot.username,
    };

    const botShot = computePracticeGraphWarsBotShot({
      botId: BOT_ID,
      botSoldiers,
      playerSoldiers: mySoldiers,
      obstacles: this.gwObstacles,
      difficulty: this.difficulty,
      seed: gw.round * 31 + Date.now() % 97,
    });

    const trajectories: GraphWarsTrajectory[] = [];
    const killedIds = new Set<string>();

    const evaluateShot = (
      shooter: RoomPlayerState,
      soldiers: GraphWarsSoldier[],
      shot: { soldierId: string; direction: FireDirection; equation: string; usedTytCards: boolean } | null
    ) => {
      if (!shot || !shooter.alive) return;
      const active = soldiers.find((s) => s.id === shot.soldierId && s.alive) || soldiers.find((s) => s.alive);
      if (!active) return;

      const traj = traceClassicGraphWarsShot({
        shooterId: shooter.id,
        shooterName: shooter.username,
        shooterColor: shooter.color,
        shooterSkinId: shooter.skinId,
        shooterAvatarId: shooter.avatarId,
        soldier: active,
        direction: shot.direction,
        equation: shot.equation,
        usedTytCards: shot.usedTytCards,
        obstacles: this.gwObstacles,
        allSoldiers,
        usernameByPlayerId: nameMap,
      });
      if (!traj) return;
      trajectories.push(traj);
      if (traj.stopReason === 'obstacle' && traj.impactPoint) {
        this.gwCraters.push(traj.impactPoint);
      }

      let roundKills = 0;
      for (const hit of traj.hits) {
        killedIds.add(hit.soldierId);
        roundKills++;
        shooter.score += 250;
      }
      if (roundKills >= 2) shooter.score += roundKills * 120;
      shooter.kills = (shooter.kills || 0) + roundKills;
      shooter.score += 30;
    };

    evaluateShot(me, mySoldiers, playerShot);
    evaluateShot(
      bot,
      botSoldiers,
      botShot ? { ...botShot, usedTytCards: false } : null
    );

    const applyKills = (p: RoomPlayerState, list: GraphWarsSoldier[]) => {
      p.soldiers = list.map((s) => (killedIds.has(s.id) ? { ...s, alive: false } : s));
      if (p.alive && !p.soldiers.some((s) => s.alive)) {
        p.alive = false;
        p.eliminatedRound = gw.round;
      }
      p.shotLocked = true;
    };

    applyKills(me, mySoldiers);
    applyKills(bot, botSoldiers);

    this.room = {
      ...this.room,
      players: [me, bot],
      graphWars: {
        ...gw,
        phase: 'firing',
        endsAt: Date.now() + GW_FIRING_DURATION_MS,
        trajectories,
        craters: this.gwCraters.slice(-40),
        myLockedShot: playerShot || undefined,
      },
    };
    this.emit();

    const currentRound = gw.round;
    this.schedule(() => {
      if (!this.room || !this.room.graphWars) return;
      const alivePlayers = this.room.players.filter((p) => p.alive);
      if (currentRound >= this.room.graphWars.totalRounds || alivePlayers.length <= 1) {
        const standings = computeGraphWarsStandings(this.room.players);
        const orderedPlayers = standings
          .map((s) => this.room!.players.find((p) => p.id === s.id))
          .filter((p): p is RoomPlayerState => Boolean(p));
        this.finishPracticeMatch(orderedPlayers);
        return;
      }
      for (const p of this.room.players) p.shotLocked = false;
      const nextRound = currentRound + 1;
      this.room = {
        ...this.room,
        graphWars: {
          ...this.room.graphWars,
          round: nextRound,
          phase: 'aim',
          endsAt: Date.now() + GW_AIM_DURATION_MS,
          trajectories: [],
          myLockedShot: undefined,
        },
      };
      this.emit();
      this.scheduleGraphWarsTimeout(nextRound);
    }, GW_FIRING_DURATION_MS);
  }

  // =========================================================================
  // BATTLESHIP PRACTICE
  // =========================================================================

  public placeBattleshipFleet(equations: string[]) {
    if (!this.room || !this.room.battleship || !this.identity) return;
    const ships: PracticeShip[] = [];
    for (let i = 0; i < 2; i++) {
      const val = validateBattleshipEquation(equations[i] || '', this.difficulty);
      if (!val.ok) return;
      ships.push({
        index: i,
        equation: equations[i].trim(),
        points: val.points,
        hitKeys: new Set<string>(),
        sunk: false,
      });
    }
    this.bsPlayerShips = ships;
    const me = this.room.players.find((p) => p.id === this.identity!.id)!;
    me.fleetReady = true;

    this.syncBattleshipRoom('battle', this.identity.id);
  }

  private toRevealed(s: PracticeShip): RevealedShip {
    return { index: s.index, equation: s.equation, points: s.points, sunk: s.sunk };
  }

  private syncBattleshipRoom(
    phase: 'prep' | 'battle',
    turnPlayerId: string,
    lastEvent?: NonNullable<RoomFullState['battleship']>['lastEvent']
  ) {
    if (!this.room || !this.identity) return;
    const me = this.room.players.find((p) => p.id === this.identity!.id)!;
    const bot = this.room.players.find((p) => p.id === BOT_ID)!;
    me.shipsRemaining = this.bsPlayerShips.filter((s) => !s.sunk).length;
    bot.shipsRemaining = this.bsBotShips.filter((s) => !s.sunk).length;

    const finished = phase === 'battle' && (me.shipsRemaining === 0 || bot.shipsRemaining === 0);

    this.room = {
      ...this.room,
      players: [me, bot],
      battleship: {
        phase,
        turnPlayerId,
        shots: [...this.bsShots],
        myShips: this.bsPlayerShips.map((s) => this.toRevealed(s)),
        opponentSunkShips: this.bsBotShips
          .filter((s) => s.sunk || finished)
          .map((s) => this.toRevealed(s)),
        lastEvent: lastEvent || this.room.battleship?.lastEvent,
      },
    };

    if (finished) {
      const ordered = bot.shipsRemaining === 0 ? [me, bot] : [bot, me];
      this.finishPracticeMatch(ordered);
      return;
    }

    this.emit();

    if (phase === 'battle' && turnPlayerId === BOT_ID) {
      this.schedule(() => this.runBattleshipBotTurn(), 850);
    }
  }

  public fireBattleshipShot(x: number, y: number) {
    if (!this.room?.battleship || !this.identity) return;
    if (this.room.battleship.phase !== 'battle' || this.room.battleship.turnPlayerId !== this.identity.id) {
      return;
    }
    const me = this.room.players.find((p) => p.id === this.identity!.id)!;
    let hit = false;
    let shipIdx: number | undefined;
    let sunkShip: PracticeShip | null = null;

    for (const s of this.bsBotShips) {
      if (s.sunk) continue;
      if (s.points.some((pt) => pt.x === x && pt.y === y)) {
        hit = true;
        shipIdx = s.index;
        s.hitKeys.add(`${x},${y}`);
        if (s.hitKeys.size >= s.points.length) {
          s.sunk = true;
          sunkShip = s;
          me.score += 180;
        } else {
          me.score += 45;
        }
        break;
      }
    }

    this.bsShots.push({
      x,
      y,
      hit,
      byPlayerId: this.identity.id,
      targetPlayerId: BOT_ID,
      ...(shipIdx !== undefined ? { shipIndex: shipIdx } : {}),
    });

    this.syncBattleshipRoom('battle', BOT_ID, {
      type: sunkShip ? 'sink' : hit ? 'hit' : 'miss',
      actorName: me.username,
      coord: { x, y },
      ...(sunkShip ? { equation: sunkShip.equation } : {}),
      timestamp: Date.now(),
    });
  }

  public guessBattleshipEquation(equation: string) {
    if (!this.room?.battleship || !this.identity) return;
    if (this.room.battleship.phase !== 'battle' || this.room.battleship.turnPlayerId !== this.identity.id) {
      return;
    }
    const me = this.room.players.find((p) => p.id === this.identity!.id)!;
    const matched = this.bsBotShips.find((s) => !s.sunk && areExpressionsEquivalent(s.equation, equation));

    if (matched) {
      matched.sunk = true;
      me.score += 220;
      this.syncBattleshipRoom('battle', BOT_ID, {
        type: 'sink',
        actorName: me.username,
        equation: matched.equation,
        timestamp: Date.now(),
      });
    } else {
      this.syncBattleshipRoom('battle', BOT_ID, {
        type: 'bad_guess',
        actorName: me.username,
        equation: equation.trim(),
        timestamp: Date.now(),
      });
    }
  }

  private runBattleshipBotTurn() {
    if (!this.room?.battleship || !this.identity || this.room.status !== 'playing') return;
    const bot = this.room.players.find((p) => p.id === BOT_ID)!;
    const botPrevShots = this.bsShots.filter((s) => s.byPlayerId === BOT_ID);
    const move = computePracticeBattleshipMove({ previousShots: botPrevShots, seed: Date.now() });

    let hit = false;
    let shipIdx: number | undefined;
    let sunkShip: PracticeShip | null = null;

    for (const s of this.bsPlayerShips) {
      if (s.sunk) continue;
      if (s.points.some((pt) => pt.x === move.x && pt.y === move.y)) {
        hit = true;
        shipIdx = s.index;
        s.hitKeys.add(`${move.x},${move.y}`);
        if (s.hitKeys.size >= s.points.length) {
          s.sunk = true;
          sunkShip = s;
          bot.score += 180;
        } else {
          bot.score += 45;
        }
        break;
      }
    }

    this.bsShots.push({
      x: move.x,
      y: move.y,
      hit,
      byPlayerId: BOT_ID,
      targetPlayerId: this.identity.id,
      ...(shipIdx !== undefined ? { shipIndex: shipIdx } : {}),
    });

    this.syncBattleshipRoom('battle', this.identity.id, {
      type: sunkShip ? 'sink' : hit ? 'hit' : 'miss',
      actorName: bot.username,
      coord: move,
      ...(sunkShip ? { equation: sunkShip.equation } : {}),
      timestamp: Date.now(),
    });
  }

  // =========================================================================
  // QUIZ RACE PRACTICE
  // =========================================================================

  private scheduleQuizReveal(round: number, delayMs: number) {
    this.schedule(() => {
      if (!this.room?.quiz || this.room.quiz.round !== round || this.room.quiz.phase !== 'question') {
        return;
      }
      this.revealQuizRound(round);
    }, delayMs);
  }

  public submitQuiz(submission: QuizSubmission) {
    if (!this.room?.quiz || !this.identity || this.room.quiz.phase !== 'question') return;
    const me = this.room.players.find((p) => p.id === this.identity!.id)!;
    if (me.roundSubmitted) return;

    const remainingMs = Math.max(0, this.room.quiz.endsAt - Date.now());
    const graded = gradePracticeQuiz(this.room.quiz.problem, submission, remainingMs);
    me.roundSubmitted = true;
    me.lastRoundPoints = graded.points;
    me.score += graded.points;
    this.quizSubmissions[me.id] = graded;

    this.clearTimers();
    this.revealQuizRound(this.room.quiz.round);
  }

  private revealQuizRound(round: number) {
    if (!this.room?.quiz || !this.identity) return;
    const bot = this.room.players.find((p) => p.id === BOT_ID)!;
    const totalFields = this.quizSubmissions[this.identity.id]?.totalFields || 5;
    const botRes = computePracticeQuizBotScore(totalFields, this.difficulty, round * 17 + 3);
    bot.roundSubmitted = true;
    bot.lastRoundPoints = botRes.points;
    bot.score += botRes.points;
    this.quizSubmissions[BOT_ID] = botRes;

    const revealMs = 5500;
    this.room = {
      ...this.room,
      quiz: {
        ...this.room.quiz,
        phase: 'reveal',
        endsAt: Date.now() + revealMs,
        roundResults: { ...this.quizSubmissions },
      },
    };
    this.emit();

    this.schedule(() => {
      if (!this.room?.quiz) return;
      if (round >= this.room.quiz.totalRounds) {
        const ordered = [...this.room.players].sort((a, b) => b.score - a.score);
        this.finishPracticeMatch(ordered);
        return;
      }
      this.quizSubmissions = {};
      for (const p of this.room.players) {
        p.roundSubmitted = false;
        p.lastRoundPoints = 0;
      }
      const nextRound = round + 1;
      const qDuration = this.difficulty === 'apprentice' ? 38_000 : 48_000;
      this.room = {
        ...this.room,
        quiz: {
          round: nextRound,
          totalRounds: 4,
          phase: 'question',
          endsAt: Date.now() + qDuration,
          problem: generateFunctionProblem(this.difficulty),
          roundResults: {},
        },
      };
      this.emit();
      this.scheduleQuizReveal(nextRound, qDuration + 1200);
    }, revealMs);
  }

  private finishPracticeMatch(orderedPlayers: RoomPlayerState[]) {
    if (!this.room) return;
    this.clearTimers();
    const summary: MatchSummary = {
      matchId: `practice_${Date.now()}`,
      mode: this.room.mode,
      difficulty: this.room.difficulty,
      isRanked: false,
      standings: orderedPlayers.map((p, idx) => ({
        id: p.id,
        username: p.username,
        isGuest: true,
        rank: idx + 1,
        score: p.score || 0,
        kills: p.kills || 0,
        usedTytCards: p.id === this.identity?.id ? this.gwUsedTyt : false,
        eloDelta: 0,
        oldElo: p.elo,
        newElo: p.elo,
      })),
      eloDeltas: [],
    };
    this.room = {
      ...this.room,
      status: 'finished',
      summary,
    };
    this.emit();
  }
}

export const practiceSession = new PracticeSessionController();
