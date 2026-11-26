/**
 * 100% Serverless Multiplayer Engine over Firebase Realtime Database (`rtdbStore`).
 *
 * ZERO WebSocket (`ws://`), ZERO Express/Node server, ZERO bots.
 * Coordinates:
 * - Online real-player presence (`/presence/{sessionId}` + `onDisconnect().remove()`)
 * - Ephemeral guest tracking (`/ephemeral_guests/{sessionId}` + `onDisconnect().remove()`)
 * - Open rooms & Party rooms (`/rooms/{code}`)
 * - Chess.com-style Elo matchmaking queue (`/matchmaking/{bucketKey}/{sessionId}`)
 * - Synchronized 3-second match countdown & host cancel
 * - Simultaneous-turn Classic Graphwar (3 soldiers, obstacles, auto-aligned shots)
 * - 1v1 Function Battleship (hidden equations, `[x,y]` shots, equation guesses)
 * - Unlimited Function Quiz Race (4 rounds, full mathematical component grading)
 * - Live Chat with 10s RTDB timestamp cooldown & fixed TR/EN profanity filter
 * - Rage-Quit Elo protection (`onDisconnect` marks `disconnected: true` during matches;
 *   atomic `/matches_settled/{matchId}` transaction updates ALL registered players)
 */

import {
  applyForfeitEloDiscount,
  calculate1v1Elo,
  calculateMultiplayerElo,
  canPlayersMatchRanked,
  DifficultyTier,
  EloDeltaResult,
  GameMode,
  getMatchmakingEloTolerance,
  MIN_ELO,
} from '../engine/elo';
import { CHAT_COOLDOWN_MS, checkChatCooldown, filterChatMessage } from '../engine/chatFilter';
import {
  canSustainCountdown,
  MATCH_COUNTDOWN_MS,
  MATCH_COUNTDOWN_SECONDS,
} from '../engine/countdown';
import { canRematchRoom } from '../engine/practiceEngine';
import {
  generateFunctionProblem,
  GeneratedFunctionProblem,
  validateBattleshipEquation,
} from '../engine/functionGenerator';
import {
  computeGraphWarsStandings,
  FireDirection,
  generateGraphWarsMap,
  GraphWarsHitEvent,
  GraphWarsLockedShot,
  GraphWarsObstacle,
  GraphWarsSoldier,
  GraphWarsTrajectory,
  GW_AIM_DURATION_MS,
  GW_FIRING_DURATION_MS,
  traceClassicGraphWarsShot,
} from '../engine/graphWarsEngine';
import {
  areExpressionsEquivalent,
  compileMathFunction,
  parseNumberOrFraction,
  parsePoint,
  parsePointList,
  Point2D,
  pointListsEqual,
  pointsEqual,
} from '../engine/mathParser';
import {
  ArenaMapId,
  AvatarId,
  DEFAULT_AVATAR_ID,
  DEFAULT_MAP_ID,
  getAvatarById,
  MapSelection,
  resolveArenaMap,
} from '../engine/avatarsAndMaps';
import { settleMatchRatingsAtomically } from './firebase';
import {
  BattleshipShot,
  ChatMessage,
  ClientMessage,
  MatchSummary,
  PlayerIdentity,
  QueueStatus,
  QuizSubmission,
  RevealedShip,
  RoomFullState,
  RoomPlayerState,
  RoomSummary,
  ServerMessage,
} from './multiplayerTypes';
import { rtdbStore } from './rtdbStore';

type MessageListener = (msg: ServerMessage) => void;

const PLAYER_COLORS = [
  '#02d8e1', // Cyan Neon
  '#f43f5e', // Flame Nova
  '#f59e0b', // Plasma Gold
  '#10b981', // Emerald Laser
  '#a855f7', // Violet Bolt
  '#38bdf8', // Sky
  '#fb923c', // Orange
  '#84cc16', // Lime
  '#e879f9', // Fuchsia
  '#14b8a6', // Teal
];

interface StoredBattleshipShip {
  index: number;
  equation: string;
  points: Point2D[];
  hitKeys?: Record<string, boolean>;
  sunk: boolean;
}

interface StoredRoom {
  code: string;
  mode: GameMode;
  difficulty: DifficultyTier;
  isRanked: boolean;
  mapId?: ArenaMapId;
  mapSelection?: MapSelection;
  status: 'lobby' | 'countdown' | 'playing' | 'finished';
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  createdAt: number;
  countdownStartsAt?: number;
  players?: Record<string, RoomPlayerState>;
  chat?: Record<string, ChatMessage>;
  // Quiz Race
  quiz?: {
    round: number;
    totalRounds: number;
    phase: 'question' | 'reveal';
    endsAt: number;
    problem: GeneratedFunctionProblem;
    submissions?: Record<string, { points: number; correctCount: number; totalFields: number }>;
  };
  // Battleship
  battleship?: {
    phase: 'prep' | 'battle';
    turnPlayerId: string;
    shots?: BattleshipShot[];
    ships?: Record<string, StoredBattleshipShip[]>;
    lastEvent?: {
      type: 'hit' | 'miss' | 'sink' | 'bad_guess';
      actorName: string;
      coord?: Point2D;
      equation?: string;
      timestamp: number;
    };
  };
  // Classic Graph Wars
  graphWars?: {
    round: number;
    totalRounds: number;
    phase: 'aim' | 'firing';
    endsAt: number;
    mapId?: ArenaMapId;
    soldiersPerPlayer: number;
    obstacles: GraphWarsObstacle[];
    lockedShots?: Record<string, GraphWarsLockedShot>;
    trajectories?: GraphWarsTrajectory[];
    craters?: Point2D[];
    usedTytCardsEver?: Record<string, boolean>;
  };
  summary?: MatchSummary;
}

interface QueueNodeEntry {
  id: string;
  uid?: string;
  username: string;
  isGuest: boolean;
  elo: number;
  levelTrack: 'TYT' | '11_AYT';
  skinId: string;
  avatarId?: AvatarId;
  mode: GameMode;
  difficulty: DifficultyTier;
  isRanked: boolean;
  mapSelection?: MapSelection;
  joinedAt: number;
  assignedRoom?: string;
}

function toSafeArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val.filter((item): item is T => item !== undefined && item !== null);
  if (val && typeof val === 'object') {
    return Object.keys(val as Record<string, unknown>)
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => (val as Record<string, T>)[k])
      .filter((item): item is T => item !== undefined && item !== null);
  }
  return [];
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function gradeQuizSubmission(
  problem: GeneratedFunctionProblem,
  sub: QuizSubmission,
  remainingMs: number
): { points: number; correctCount: number; totalFields: number } {
  let correct = 0;
  let total = 0;
  const xInts = toSafeArray<Point2D>(problem.xIntercepts);

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
  const yInt = parsePoint(sub.yIntercept);
  if (yInt && pointsEqual(yInt, problem.yIntercept)) correct++;

  total++;
  if (problem.family === 'linear') {
    const slopeVal = parseNumberOrFraction(sub.vertexOrSlope);
    if (slopeVal !== null && problem.slope !== null && Math.abs(slopeVal - problem.slope) < 0.05) {
      correct++;
    }
  } else if (problem.vertex) {
    const vPt = parsePoint(sub.vertexOrSlope);
    if (vPt && pointsEqual(vPt, problem.vertex)) correct++;
  }

  if (problem.symmetryAxis !== null) {
    total++;
    const symVal = parseNumberOrFraction(sub.symmetryAxis);
    if (symVal !== null && Math.abs(symVal - problem.symmetryAxis) < 0.05) correct++;
  }

  total++;
  if ((sub.domain || '').trim() === problem.domainLabel) correct++;

  total++;
  if ((sub.range || '').trim() === problem.rangeLabel) correct++;

  total++;
  if ((sub.increasing || '').trim() === problem.increasingLabel) correct++;

  total++;
  if ((sub.decreasing || '').trim() === problem.decreasingLabel) correct++;

  const accuracyRatio = correct / total;
  const basePoints = Math.round(accuracyRatio * 500);
  const speedBonus =
    correct > 0 ? Math.round((Math.max(0, remainingMs) / 45_000) * 250 * accuracyRatio) : 0;

  return {
    points: basePoints + speedBonus,
    correctCount: correct,
    totalFields: total,
  };
}

function buildMatchSummary(
  room: StoredRoom,
  ordered: Array<{ id: string; rank: number; score: number }>
): MatchSummary {
  const playersMap = room.players || {};
  const tytEver = room.graphWars?.usedTytCardsEver || {};

  let eloDeltas: EloDeltaResult[] = [];
  if (room.isRanked && ordered.length >= 2) {
    if (room.mode === 'battleship' && ordered.length === 2) {
      const p1 = playersMap[ordered[0].id];
      const p2 = playersMap[ordered[1].id];
      if (p1 && p2) {
        const res = calculate1v1Elo(p1.elo, p2.elo, 1);
        const loserDelta = p2.disconnected
          ? applyForfeitEloDiscount(res.deltaB)
          : res.deltaB;
        eloDeltas = [
          { id: p1.id, oldElo: p1.elo, newElo: res.newA, delta: res.deltaA },
          {
            id: p2.id,
            oldElo: p2.elo,
            newElo: Math.max(MIN_ELO, p2.elo + loserDelta),
            delta: loserDelta,
          },
        ];
      }
    } else if (room.mode === 'quiz_race' || room.mode === 'graph_wars') {
      const participants = ordered
        .map((o) => {
          const pl = playersMap[o.id];
          if (!pl) return null;
          return {
            id: o.id,
            elo: pl.elo,
            rank: o.rank,
            usedTytCards: Boolean(tytEver[o.id] || pl.usedTytCards),
            forfeited: Boolean(pl.disconnected),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);
      eloDeltas = calculateMultiplayerElo(participants, room.mode);
    }
  }

  const standings = ordered
    .map((o) => {
      const pl = playersMap[o.id];
      if (!pl) return null;
      const ed = eloDeltas.find((d) => d.id === o.id);
      return {
        id: pl.id,
        uid: pl.uid,
        username: pl.username || 'Oyuncu',
        isGuest: Boolean(pl.isGuest),
        rank: o.rank,
        score: o.score,
        kills: pl.kills ?? 0,
        forfeited: Boolean(pl.disconnected),
        usedTytCards: Boolean(tytEver[pl.id] || pl.usedTytCards),
        eloDelta: ed ? ed.delta : 0,
        oldElo: ed ? ed.oldElo : pl.elo,
        newElo: ed ? ed.newElo : pl.elo,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    matchId: `m_${room.code}_${Date.now()}`,
    mode: room.mode,
    difficulty: room.difficulty,
    isRanked: room.isRanked,
    standings,
    eloDeltas,
  };
}

/**
 * Applies forfeit elimination & finishes an active match immediately whenever
 * <= 1 active connected player remains (handles Graph Wars, Battleship, and Quiz Race).
 */
function applyPlayingForfeitAndCheckEnd(cur: StoredRoom): boolean {
  if (!cur || cur.status !== 'playing') return false;
  const pMap = cur.players && typeof cur.players === 'object' ? cur.players : {};
  const validPlayers = Object.values(pMap)
    .filter((p): p is RoomPlayerState => Boolean(p && typeof p === 'object' && p.id))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
  const connected = validPlayers.filter((p) => !p.disconnected);

  let mutated = false;

  if (cur.mode === 'graph_wars' && cur.graphWars) {
    for (const pl of validPlayers) {
      if (pl.disconnected && pl.alive) {
        pl.alive = false;
        pl.eliminatedRound = cur.graphWars.round;
        const safeSoldiers = toSafeArray<GraphWarsSoldier>(pl.soldiers);
        if (safeSoldiers.length > 0) {
          pl.soldiers = safeSoldiers.map((s) => ({ ...s, alive: false }));
        }
        mutated = true;
      }
    }
    const remainingAlive = validPlayers.filter((p) => p.alive && !p.disconnected);
    if (connected.length <= 1 || (validPlayers.length >= 2 && remainingAlive.length <= 1)) {
      if (remainingAlive.length === 1) {
        remainingAlive[0].score = (remainingAlive[0].score || 0) + 250;
      } else if (connected.length === 1) {
        connected[0].score = (connected[0].score || 0) + 250;
      }
      cur.status = 'finished';
      const ordered = computeGraphWarsStandings(validPlayers);
      cur.summary = buildMatchSummary(cur, ordered);
      return true;
    }
    return mutated;
  }

  if (cur.mode === 'battleship') {
    if (connected.length <= 1) {
      const disconnectedPlayers = validPlayers.filter((p) => p.disconnected);
      for (const dp of disconnectedPlayers) {
        dp.shipsRemaining = 0;
      }
      const winner = connected[0];
      if (winner) {
        winner.score = (winner.score || 0) + 500;
      }
      const ordered: Array<{ id: string; rank: number; score: number }> = [];
      if (winner) {
        ordered.push({ id: winner.id, rank: 1, score: winner.score || 500 });
      }
      disconnectedPlayers.forEach((dp) => {
        ordered.push({ id: dp.id, rank: ordered.length + 1, score: dp.score || 0 });
      });
      cur.status = 'finished';
      cur.summary = buildMatchSummary(cur, ordered);
      return true;
    }
    return false;
  }

  if (cur.mode === 'quiz_race') {
    if (connected.length <= 1) {
      const sorted = [...validPlayers].sort((a, b) => {
        const aDisc = Boolean(a.disconnected);
        const bDisc = Boolean(b.disconnected);
        if (aDisc !== bDisc) return aDisc ? 1 : -1;
        return (b.score || 0) - (a.score || 0);
      });
      const ordered = sorted.map((p, idx) => ({
        id: p.id,
        rank: idx + 1,
        score: p.score || 0,
      }));
      cur.status = 'finished';
      cur.summary = buildMatchSummary(cur, ordered);
      return true;
    }
    return false;
  }

  return false;
}

class RtdbMultiplayerClient {
  private listeners = new Set<MessageListener>();
  private identity: PlayerIdentity | null = null;
  private currentRoomCode: string | null = null;
  private currentRoomSnapshot: StoredRoom | null = null;
  private lastKnownRoomStatus: string | null = null;

  private unsubPresence: (() => void) | null = null;
  private unsubRoomsList: (() => void) | null = null;
  private unsubActiveRoom: (() => void) | null = null;
  private cancelPresenceDisconnect: (() => Promise<void>) | null = null;
  private cancelRoomDisconnect: (() => Promise<void>) | null = null;

  private roomTickInterval: number | null = null;

  // Matchmaking state
  private queueBucketKey: string | null = null;
  private queueJoinedAt = 0;
  private queueParams: { mode: GameMode; difficulty: DifficultyTier; isRanked: boolean } | null = null;
  private unsubQueue: (() => void) | null = null;
  private cancelQueueDisconnect: (() => Promise<void>) | null = null;
  private queueTickInterval: number | null = null;
  private queueEntriesCache: Record<string, QueueNodeEntry> = {};

  private settledMatchIds = new Set<string>();

  private emit(msg: ServerMessage) {
    for (const listener of this.listeners) {
      listener(msg);
    }
  }

  public subscribe(listener: MessageListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public async connect(identity: PlayerIdentity) {
    const prevId = this.identity?.id;
    this.identity = { ...identity };

    if (prevId && prevId !== identity.id) {
      await this.cleanupSessionNodes(prevId);
    }

    // 1. Register real-time presence with onDisconnect().remove()
    try {
      const presencePath = `presence/${identity.id}`;
      if (this.cancelPresenceDisconnect) {
        await this.cancelPresenceDisconnect();
      }
      this.cancelPresenceDisconnect = await rtdbStore.onDisconnectRemove(presencePath);
      await rtdbStore.set(presencePath, {
        id: identity.id,
        username: identity.username,
        isGuest: identity.isGuest,
        elo: identity.elo,
        connectedAt: Date.now(),
      });
    } catch {
      // Do not abort room/presence subscriptions if presence write is transiently rejected
    }

    // 2. Subscribe to online players count
    if (!this.unsubPresence) {
      this.unsubPresence = rtdbStore.onValue<Record<string, unknown>>('presence', (val) => {
        const count = val && typeof val === 'object' ? Math.max(1, Object.keys(val).length) : 1;
        this.emit({ type: 'online_count', count });
      });
    }

    // 3. Subscribe to open rooms list
    if (!this.unsubRoomsList) {
      this.unsubRoomsList = rtdbStore.onValue<Record<string, StoredRoom>>('rooms', (val) => {
        const summaries: RoomSummary[] = [];
        if (val && typeof val === 'object') {
          const now = Date.now();
          for (const room of Object.values(val)) {
            if (!room || typeof room !== 'object' || !room.code) continue;
            // Ignore stale empty rooms older than 2 hours
            const players =
              room.players && typeof room.players === 'object'
                ? Object.values(room.players).filter(
                    (p): p is RoomPlayerState => Boolean(p && typeof p === 'object' && p.id)
                  )
                : [];
            const activePlayers = players.filter((p) => !p.disconnected);
            if (activePlayers.length === 0 || now - (room.createdAt || now) > 7_200_000) continue;
            if (room.status === 'lobby') {
              const host = room.players?.[room.hostId];
              summaries.push({
                code: room.code,
                mode: room.mode,
                difficulty: room.difficulty,
                isRanked: Boolean(room.isRanked),
                mapId: room.mapId || DEFAULT_MAP_ID,
                status: room.status,
                playerCount: activePlayers.length,
                maxPlayers: room.maxPlayers,
                hostName: host?.username || activePlayers[0]?.username || 'Host',
              });
            }
          }
        }
        summaries.sort((a, b) => b.playerCount - a.playerCount);
        this.emit({ type: 'rooms_list', rooms: summaries });
      });
    }

    // Sync identity fields into current room if already in lobby
    if (this.currentRoomCode && this.currentRoomSnapshot?.status === 'lobby') {
      const avatar = getAvatarById(identity.avatarId);
      await rtdbStore
        .update(`rooms/${this.currentRoomCode}/players/${identity.id}`, {
          username: identity.username,
          levelTrack: identity.levelTrack,
          elo: identity.elo,
          skinId: identity.skinId,
          avatarId: avatar.id,
          color: avatar.primary,
        })
        .catch(() => {});
    }

    this.emit({ type: 'identified', player: this.identity, onlineCount: 1 });
  }

  private async cleanupSessionNodes(sessionId: string) {
    if (this.cancelPresenceDisconnect) {
      await this.cancelPresenceDisconnect();
      this.cancelPresenceDisconnect = null;
    }
    await rtdbStore.remove(`presence/${sessionId}`).catch(() => {});
  }

  public async disconnect() {
    const id = this.identity?.id;
    await this.leaveQueue();
    await this.leaveRoom();
    if (this.unsubPresence) {
      this.unsubPresence();
      this.unsubPresence = null;
    }
    if (this.unsubRoomsList) {
      this.unsubRoomsList();
      this.unsubRoomsList = null;
    }
    if (id) {
      await this.cleanupSessionNodes(id);
    }
    this.identity = null;
  }

  public send(msg: ClientMessage) {
    void this.handleClientMessage(msg).catch((err) => {
      this.emit({
        type: 'error',
        message: err instanceof Error ? err.message : 'Action failed',
      });
    });
  }

  private async handleClientMessage(msg: ClientMessage) {
    if (msg.type === 'identify') {
      await this.connect(msg.player);
      return;
    }
    if (!this.identity) return;

    switch (msg.type) {
      case 'list_rooms':
        break;
      case 'create_room':
        await this.createRoom(msg.mode, msg.difficulty, msg.isRanked, msg.mapSelection);
        break;
      case 'set_room_map':
        await this.setRoomMap(msg.mapSelection);
        break;
      case 'join_room':
        await this.joinRoom(msg.code);
        break;
      case 'rejoin_room':
        await this.rejoinRoom(msg.code);
        break;
      case 'leave_room':
        await this.leaveRoom();
        break;
      case 'rematch':
        await this.rematchRoom();
        break;
      case 'toggle_ready':
        await this.toggleReady();
        break;
      case 'start_match':
        await this.startMatchCountdown();
        break;
      case 'cancel_countdown':
        await this.cancelCountdown();
        break;
      case 'join_queue':
        await this.joinQueue(msg.mode, msg.difficulty, msg.isRanked, msg.mapSelection);
        break;
      case 'leave_queue':
        await this.leaveQueue();
        break;
      case 'quiz_submit':
        await this.submitQuiz(msg.submission);
        break;
      case 'battleship_place':
        await this.placeBattleshipFleet(msg.equations);
        break;
      case 'battleship_fire':
        await this.fireBattleshipShot(msg.x, msg.y);
        break;
      case 'battleship_guess':
        await this.guessBattleshipEquation(msg.equation);
        break;
      case 'graph_wars_lock':
        await this.lockGraphWarsShot(msg.soldierId, msg.direction, msg.equation, msg.usedTytCards);
        break;
      case 'chat_send':
        await this.sendChatMessage(msg.text);
        break;
    }
  }

  // ==========================================================================
  // ROOM SUBSCRIPTION & LIFECYCLE
  // ==========================================================================

  private serializeRoom(raw: StoredRoom, viewerId: string): RoomFullState {
    const playersObj = raw.players && typeof raw.players === 'object' ? raw.players : {};
    const playersArr = Object.values(playersObj)
      .filter((p): p is RoomPlayerState => Boolean(p && typeof p === 'object' && p.id))
      .map((p) => ({
        ...p,
        avatarId: getAvatarById(p.avatarId).id,
        ...(p.soldiers ? { soldiers: toSafeArray<GraphWarsSoldier>(p.soldiers) } : {}),
      }))
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    const chatArr =
      raw.chat && typeof raw.chat === 'object'
        ? Object.values(raw.chat)
            .filter((c): c is ChatMessage => Boolean(c && typeof c === 'object' && c.id))
            .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0))
            .slice(-50)
        : [];
    const activeMapId: ArenaMapId = raw.mapId || raw.graphWars?.mapId || DEFAULT_MAP_ID;

    const normalizedSummary: MatchSummary | undefined = raw.summary
      ? {
          ...raw.summary,
          standings: toSafeArray(raw.summary.standings),
          eloDeltas: toSafeArray(raw.summary.eloDeltas),
        }
      : undefined;

    const state: RoomFullState = {
      code: raw.code,
      mode: raw.mode,
      difficulty: raw.difficulty,
      isRanked: Boolean(raw.isRanked),
      mapId: activeMapId,
      mapSelection: raw.mapSelection || activeMapId,
      status: raw.status,
      hostId: raw.hostId,
      minPlayers: raw.minPlayers,
      maxPlayers: raw.maxPlayers,
      players: playersArr,
      chat: chatArr,
      countdown:
        raw.status === 'countdown' && raw.countdownStartsAt
          ? { startsAt: raw.countdownStartsAt, totalSeconds: MATCH_COUNTDOWN_SECONDS }
          : undefined,
      summary: normalizedSummary,
    };

    if (raw.status === 'playing' || raw.status === 'finished') {
      if (raw.mode === 'quiz_race' && raw.quiz && raw.quiz.problem) {
        state.quiz = {
          round: raw.quiz.round,
          totalRounds: raw.quiz.totalRounds,
          phase: raw.quiz.phase,
          endsAt: raw.quiz.endsAt,
          problem: {
            ...raw.quiz.problem,
            xIntercepts: toSafeArray<Point2D>(raw.quiz.problem.xIntercepts),
          },
          roundResults: raw.quiz.submissions || {},
        };
      } else if (raw.mode === 'battleship' && raw.battleship) {
        const shipsByPlayer = raw.battleship.ships || {};
        const myRaw = toSafeArray<StoredBattleshipShip>(shipsByPlayer[viewerId]);
        const oppId = playersArr.find((p) => p.id !== viewerId)?.id;
        const oppRaw = oppId ? toSafeArray<StoredBattleshipShip>(shipsByPlayer[oppId]) : [];
        const toRevealed = (s: StoredBattleshipShip): RevealedShip => ({
          index: s.index,
          equation: s.equation,
          points: toSafeArray<Point2D>(s.points),
          sunk: Boolean(s.sunk),
        });
        state.battleship = {
          phase: raw.battleship.phase,
          turnPlayerId: raw.battleship.turnPlayerId,
          shots: toSafeArray<BattleshipShot>(raw.battleship.shots),
          myShips: myRaw.map(toRevealed),
          opponentSunkShips: oppRaw
            .filter((s) => s.sunk || raw.status === 'finished')
            .map(toRevealed),
          lastEvent: raw.battleship.lastEvent,
        };
      } else if (raw.mode === 'graph_wars' && raw.graphWars) {
        const myLocked = raw.graphWars.lockedShots?.[viewerId];
        const normalizedTrajectories =
          raw.graphWars.phase === 'firing' || raw.status === 'finished'
            ? toSafeArray<GraphWarsTrajectory>(raw.graphWars.trajectories).map((tr) => ({
                ...tr,
                path: toSafeArray<Point2D>(tr.path),
                hits: toSafeArray<GraphWarsHitEvent>(tr.hits),
              }))
            : [];
        state.graphWars = {
          round: raw.graphWars.round,
          totalRounds: raw.graphWars.totalRounds,
          phase: raw.graphWars.phase,
          endsAt: raw.graphWars.endsAt,
          mapId: raw.graphWars.mapId || activeMapId,
          soldiersPerPlayer: raw.graphWars.soldiersPerPlayer || 3,
          obstacles: toSafeArray<GraphWarsObstacle>(raw.graphWars.obstacles),
          trajectories: normalizedTrajectories,
          craters: toSafeArray<Point2D>(raw.graphWars.craters),
          myLockedShot: myLocked,
        };
      }
    }

    return state;
  }

  private async attachToRoom(code: string) {
    this.detachRoomListeners();
    this.currentRoomCode = code;
    this.lastKnownRoomStatus = null;

    if (this.identity) {
      await this.configureRoomDisconnect(code, 'lobby');
    }

    this.unsubActiveRoom = rtdbStore.onValue<StoredRoom>(`rooms/${code}`, (raw) => {
      if (!raw || !this.identity) {
        if (this.currentRoomCode === code) {
          this.currentRoomSnapshot = null;
          this.emit({ type: 'room_state', room: null });
        }
        return;
      }

      this.currentRoomSnapshot = raw;

      // Switch onDisconnect hook when transitioning between lobby/countdown and active playing match
      // so rage-quitters during a playing match are marked disconnected: true instead of erased!
      if (this.lastKnownRoomStatus !== raw.status) {
        this.lastKnownRoomStatus = raw.status;
        void this.configureRoomDisconnect(code, raw.status);
      }

      const serialized = this.serializeRoom(raw, this.identity.id);

      // Trigger atomic Elo settlement when match finishes (using normalized summary)
      if (
        serialized.status === 'finished' &&
        serialized.summary &&
        !this.settledMatchIds.has(serialized.summary.matchId)
      ) {
        this.settledMatchIds.add(serialized.summary.matchId);
        if (!this.identity.isGuest && this.identity.uid) {
          void settleMatchRatingsAtomically(serialized.summary, this.identity.uid);
        }
      }

      // Check immediate disconnect forfeit or host migration
      void this.reconcileRoomHealth(raw);

      this.emit({
        type: 'room_state',
        room: serialized,
      });
    });

    // Periodic timer tick (every 350ms) drives synchronized countdown launch & round timers via atomic transactions
    this.roomTickInterval = window.setInterval(() => {
      if (this.currentRoomSnapshot) {
        void this.tickRoomTimers(this.currentRoomSnapshot);
      }
    }, 350);
  }

  private async configureRoomDisconnect(code: string, status: StoredRoom['status']) {
    if (!this.identity) return;
    if (this.cancelRoomDisconnect) {
      await this.cancelRoomDisconnect();
      this.cancelRoomDisconnect = null;
    }
    const pid = this.identity.id;
    if (status === 'playing') {
      // Rage-Quit Protection: Keep player in roster, mark disconnected = true!
      this.cancelRoomDisconnect = await rtdbStore.onDisconnectSet(
        `rooms/${code}/players/${pid}/disconnected`,
        true
      );
    } else {
      // In lobby/countdown/finished, clean remove player node on disconnect
      this.cancelRoomDisconnect = await rtdbStore.onDisconnectRemove(
        `rooms/${code}/players/${pid}`
      );
    }
  }

  private detachRoomListeners() {
    if (this.unsubActiveRoom) {
      this.unsubActiveRoom();
      this.unsubActiveRoom = null;
    }
    if (this.roomTickInterval !== null) {
      clearInterval(this.roomTickInterval);
      this.roomTickInterval = null;
    }
    this.currentRoomSnapshot = null;
    this.lastKnownRoomStatus = null;
  }

  private async reconcileRoomHealth(raw: StoredRoom) {
    if (!this.identity) return;
    const playersArr = Object.values(raw.players && typeof raw.players === 'object' ? raw.players : {})
      .filter((p): p is RoomPlayerState => Boolean(p && typeof p === 'object' && p.id))
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    const connected = playersArr.filter((p) => !p.disconnected);
    if (connected.length === 0) return;

    // Only the earliest connected player acts as coordinator to minimize transaction contention
    const coordinatorId = connected[0].id;
    if (coordinatorId !== this.identity.id) return;

    // 1. Host migration if host left lobby
    if (raw.status === 'lobby' && !raw.players?.[raw.hostId]) {
      await rtdbStore.update(`rooms/${raw.code}`, { hostId: coordinatorId });
      return;
    }

    // 2. Cancel countdown if players dropped below minPlayers
    if (raw.status === 'countdown' && !canSustainCountdown(connected.length, raw.minPlayers)) {
      await rtdbStore.runTransaction<StoredRoom>(`rooms/${raw.code}`, (cur) => {
        if (!cur || cur.status !== 'countdown') return undefined;
        cur.status = 'lobby';
        delete cur.countdownStartsAt;
        return cur;
      });
      return;
    }

    // 3. Opponent Leave / Rage-Quit Forfeit Handling across ALL 3 modes!
    if (raw.status === 'playing') {
      const newlyForfeited =
        raw.mode === 'graph_wars' ? playersArr.filter((p) => p.disconnected && p.alive) : [];
      const aliveConnected =
        raw.mode === 'graph_wars' ? connected.filter((p) => p.alive) : connected;

      const shouldReconcile =
        connected.length <= 1 ||
        newlyForfeited.length > 0 ||
        (raw.mode === 'graph_wars' && playersArr.length >= 2 && aliveConnected.length <= 1);

      if (shouldReconcile) {
        await rtdbStore.runTransaction<StoredRoom>(`rooms/${raw.code}`, (cur) => {
          if (!cur || cur.status !== 'playing') return undefined;
          const changed = applyPlayingForfeitAndCheckEnd(cur);
          return changed ? cur : undefined;
        });
      }
    }
  }

  private async tickRoomTimers(raw: StoredRoom) {
    if (!this.identity) return;
    const now = Date.now();
    const playersArr = Object.values(raw.players && typeof raw.players === 'object' ? raw.players : {})
      .filter((p): p is RoomPlayerState => Boolean(p && typeof p === 'object' && p.id && !p.disconnected))
      .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
    if (playersArr.length === 0) return;

    // Allow coordinator immediately, or any active player after +900ms grace if coordinator lags
    const isCoordinator = playersArr[0].id === this.identity.id;
    const grace = isCoordinator ? 0 : 900;

    if (raw.status === 'countdown' && raw.countdownStartsAt && now >= raw.countdownStartsAt + grace) {
      await this.transitionCountdownToPlaying(raw.code);
      return;
    }

    if (raw.status === 'playing') {
      // Safety net: if opponent left and an earlier transaction collided, finish match on next tick
      if (playersArr.length <= 1) {
        await this.reconcileRoomHealth(raw);
        return;
      }

      if (raw.mode === 'quiz_race' && raw.quiz) {
        if (raw.quiz.phase === 'question') {
          // +1200ms buffer lets clients auto-submit filled answers at 0s and get graded before reveal
          if (now >= raw.quiz.endsAt + 1200 + grace) {
            await this.advanceQuizToReveal(raw.code, raw.quiz.round);
          }
        } else if (now >= raw.quiz.endsAt + grace) {
          await this.advanceQuizToNextRound(raw.code, raw.quiz.round);
        }
      } else if (raw.mode === 'graph_wars' && raw.graphWars && now >= raw.graphWars.endsAt + grace) {
        if (raw.graphWars.phase === 'aim') {
          await this.resolveGraphWarsTurn(raw.code, raw.graphWars.round);
        } else {
          await this.startNextGraphWarsRound(raw.code, raw.graphWars.round);
        }
      }
    }
  }

  // ==========================================================================
  // CREATE / JOIN / LEAVE / READY / COUNTDOWN
  // ==========================================================================

  private async createRoom(
    mode: GameMode,
    difficulty: DifficultyTier,
    isRanked: boolean,
    mapSelection: MapSelection = 'random'
  ) {
    if (!this.identity) return;
    if (isRanked && this.identity.isGuest) {
      this.emit({ type: 'error', message: 'Guests cannot create Ranked rooms.' });
      return;
    }

    await this.leaveQueue();
    await this.leaveRoom();

    let code = generateRoomCode();
    for (let i = 0; i < 6; i++) {
      const exists = await rtdbStore.get(`rooms/${code}`);
      if (!exists) break;
      code = generateRoomCode();
    }

    const maxPlayers = mode === 'battleship' ? 2 : mode === 'graph_wars' ? 10 : 50;
    const minPlayers = mode === 'quiz_race' && !isRanked ? 1 : 2;
    const avatar = getAvatarById(this.identity.avatarId);
    const resolvedMap = resolveArenaMap(mapSelection, Date.now() + code.charCodeAt(0) * 17);

    const hostPlayer: RoomPlayerState = {
      id: this.identity.id,
      ...(this.identity.uid ? { uid: this.identity.uid } : {}),
      username: this.identity.username,
      isGuest: this.identity.isGuest,
      elo: this.identity.elo,
      levelTrack: this.identity.levelTrack,
      skinId: this.identity.skinId,
      avatarId: avatar.id,
      ready: true,
      score: 0,
      color: avatar.primary,
      joinedAt: Date.now(),
      disconnected: false,
      alive: true,
      kills: 0,
      fleetReady: false,
      shipsRemaining: 2,
      usedTytCards: false,
    };

    const room: StoredRoom = {
      code,
      mode,
      difficulty,
      isRanked,
      mapId: resolvedMap,
      mapSelection,
      status: 'lobby',
      hostId: this.identity.id,
      minPlayers,
      maxPlayers,
      createdAt: Date.now(),
      players: {
        [this.identity.id]: hostPlayer,
      },
    };

    await rtdbStore.set(`rooms/${code}`, room);
    await this.attachToRoom(code);
  }

  private async setRoomMap(mapSelection: MapSelection) {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'lobby' || cur.hostId !== pid) return undefined;
      cur.mapSelection = mapSelection;
      cur.mapId = resolveArenaMap(mapSelection, Date.now() + cur.code.charCodeAt(0) * 29);
      return cur;
    });
  }

  private async joinRoom(rawCode: string) {
    if (!this.identity) return;
    const code = rawCode.trim().toUpperCase();
    if (!code) return;

    const existing = await rtdbStore.get<StoredRoom>(`rooms/${code}`);
    if (!existing) {
      this.emit({ type: 'error', message: `Oda bulunamadı: ${code}` });
      return;
    }
    if (existing.isRanked && this.identity.isGuest) {
      this.emit({ type: 'error', message: 'Misafirler yalnızca Derecesiz odalara katılabilir.' });
      return;
    }
    const alreadyMember = Boolean(existing.players?.[this.identity.id]);
    if (alreadyMember && (existing.status === 'playing' || existing.status === 'countdown')) {
      await this.rejoinRoom(code);
      return;
    }
    if (existing.status !== 'lobby') {
      this.emit({ type: 'error', message: 'Bu odada maç zaten başladı.' });
      return;
    }

    await this.leaveQueue();
    if (this.currentRoomCode && this.currentRoomCode !== code) {
      await this.leaveRoom();
    }

    const me = this.identity;
    let joinErr: string | null = null;

    const tx = await rtdbStore.runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
      if (!cur) {
        joinErr = 'Oda bulunamadı.';
        return undefined;
      }
      if (cur.status !== 'lobby') {
        joinErr = 'Maç zaten başladı.';
        return undefined;
      }
      const players = cur.players || {};
      if (!players[me.id] && Object.keys(players).length >= cur.maxPlayers) {
        joinErr = 'Oda dolu.';
        return undefined;
      }
      const existingColors = new Set(Object.values(players).map((p) => p.color));
      const avatar = getAvatarById(me.avatarId);
      const assignedColor = !existingColors.has(avatar.primary)
        ? avatar.primary
        : PLAYER_COLORS.find((c) => !existingColors.has(c)) ||
          PLAYER_COLORS[Object.keys(players).length % PLAYER_COLORS.length];

      players[me.id] = {
        id: me.id,
        ...(me.uid ? { uid: me.uid } : {}),
        username: me.username,
        isGuest: me.isGuest,
        elo: me.elo,
        levelTrack: me.levelTrack,
        skinId: me.skinId,
        avatarId: avatar.id,
        ready: me.id === cur.hostId,
        score: 0,
        color: assignedColor,
        joinedAt: Date.now(),
        disconnected: false,
        alive: true,
        kills: 0,
        fleetReady: false,
        shipsRemaining: 2,
        usedTytCards: false,
      };
      cur.players = players;
      return cur;
    });

    if (!tx.committed) {
      this.emit({ type: 'error', message: joinErr || 'Odaya katılınamadı.' });
      return;
    }

    await this.attachToRoom(code);
  }

  private async leaveRoom() {
    const code = this.currentRoomCode;
    const pid = this.identity?.id;
    const snap = this.currentRoomSnapshot;

    this.detachRoomListeners();
    this.currentRoomCode = null;
    if (this.cancelRoomDisconnect) {
      await this.cancelRoomDisconnect();
      this.cancelRoomDisconnect = null;
    }

    if (code && pid) {
      if (snap?.status === 'playing') {
        // Explicit mid-match leave: atomically mark disconnected AND finish match if <= 1 player remains!
        await rtdbStore
          .runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
            if (!cur || !cur.players) return cur ?? undefined;
            if (cur.players[pid]) {
              cur.players[pid].disconnected = true;
            }
            if (cur.status === 'playing') {
              applyPlayingForfeitAndCheckEnd(cur);
            }
            return cur;
          })
          .catch(async () => {
            await rtdbStore.set(`rooms/${code}/players/${pid}/disconnected`, true).catch(() => {});
          });
      } else {
        await rtdbStore
          .runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
            if (!cur || !cur.players) return cur ?? undefined;
            if (cur.status === 'playing') {
              // Room started playing right as user clicked leave
              if (cur.players[pid]) {
                cur.players[pid].disconnected = true;
              }
              applyPlayingForfeitAndCheckEnd(cur);
              return cur;
            }
            delete cur.players[pid];
            const remaining = Object.values(cur.players).filter(
              (p): p is RoomPlayerState => Boolean(p && typeof p === 'object' && p.id && !p.disconnected)
            );
            if (remaining.length === 0) {
              return null as unknown as StoredRoom;
            }
            if (cur.hostId === pid) {
              cur.hostId = remaining[0].id;
            }
            if (cur.status === 'countdown' && !canSustainCountdown(remaining.length, cur.minPlayers)) {
              cur.status = 'lobby';
              delete cur.countdownStartsAt;
            }
            return cur;
          })
          .catch(() => {});
      }
    }

    this.emit({ type: 'room_state', room: null });
  }

  private async rejoinRoom(rawCode: string) {
    if (!this.identity) return;
    const code = rawCode.trim().toUpperCase();
    if (!code || code === 'SOLO') return;

    const existing = await rtdbStore.get<StoredRoom>(`rooms/${code}`);
    if (!existing || !existing.players?.[this.identity.id]) {
      return;
    }
    if (existing.status === 'finished') {
      await this.attachToRoom(code);
      return;
    }

    const pid = this.identity.id;
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
      if (!cur || !cur.players?.[pid]) return undefined;
      cur.players[pid].disconnected = false;
      delete cur.players[pid].disconnectedAt;
      return cur;
    });

    await this.attachToRoom(code);
  }

  private async rematchRoom() {
    if (!this.currentRoomCode || !this.identity) return;
    const code = this.currentRoomCode;
    const pid = this.identity.id;

    await rtdbStore.runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
      if (!cur || !cur.players) return undefined;
      const connectedPlayers = Object.values(cur.players).filter(
        (p): p is RoomPlayerState => Boolean(p && typeof p === 'object' && p.id && !p.disconnected)
      );
      if (
        !canRematchRoom({
          status: cur.status,
          activePlayerCount: connectedPlayers.length,
          minPlayers: cur.minPlayers,
        })
      ) {
        return undefined;
      }

      // Remove disconnected ghosts and reset active players cleanly for a fresh lobby match
      const nextPlayers: Record<string, RoomPlayerState> = {};
      const nextHostId =
        cur.players[cur.hostId] && !cur.players[cur.hostId].disconnected
          ? cur.hostId
          : connectedPlayers[0]?.id || pid;

      for (const p of connectedPlayers) {
        nextPlayers[p.id] = {
          ...p,
          ready: p.id === nextHostId || p.id === pid,
          score: 0,
          disconnected: false,
          alive: true,
          kills: 0,
          fleetReady: false,
          shipsRemaining: 2,
          shotLocked: false,
          usedTytCards: false,
          roundSubmitted: false,
          lastRoundPoints: 0,
        };
        delete nextPlayers[p.id].soldiers;
        delete nextPlayers[p.id].eliminatedRound;
        delete nextPlayers[p.id].disconnectedAt;
      }

      cur.status = 'lobby';
      cur.hostId = nextHostId;
      cur.players = nextPlayers;
      cur.mapId = resolveArenaMap(cur.mapSelection || cur.mapId || DEFAULT_MAP_ID, Date.now());
      delete cur.countdownStartsAt;
      delete cur.quiz;
      delete cur.battleship;
      delete cur.graphWars;
      delete cur.summary;
      return cur;
    });
  }

  private async toggleReady() {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'lobby' || !cur.players?.[pid]) return undefined;
      cur.players[pid].ready = !cur.players[pid].ready;
      return cur;
    });
  }

  private async startMatchCountdown() {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;
    let errMsg: string | null = null;

    const tx = await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'lobby') return undefined;
      if (cur.hostId !== pid) {
        errMsg = 'Yalnızca oda kurucusu maçı başlatabilir.';
        return undefined;
      }
      const activeCount = Object.values(cur.players || {}).filter((p) => !p.disconnected).length;
      if (!canSustainCountdown(activeCount, cur.minPlayers)) {
        errMsg = `Başlatmak için en az ${cur.minPlayers} gerçek oyuncu gerekir.`;
        return undefined;
      }
      cur.status = 'countdown';
      cur.countdownStartsAt = Date.now() + MATCH_COUNTDOWN_MS;
      return cur;
    });

    if (!tx.committed && errMsg) {
      this.emit({ type: 'error', message: errMsg });
    }
  }

  private async cancelCountdown() {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'countdown') return undefined;
      if (cur.hostId !== pid) return undefined;
      cur.status = 'lobby';
      delete cur.countdownStartsAt;
      return cur;
    });
  }

  private async transitionCountdownToPlaying(code: string) {
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
      if (!cur || cur.status !== 'countdown') return undefined;
      const activePlayers = Object.values(cur.players || {}).filter((p) => !p.disconnected);
      if (!canSustainCountdown(activePlayers.length, cur.minPlayers)) {
        cur.status = 'lobby';
        delete cur.countdownStartsAt;
        return cur;
      }

      cur.status = 'playing';
      delete cur.countdownStartsAt;
      delete cur.summary;

      for (const p of Object.values(cur.players || {})) {
        p.score = 0;
        p.alive = !p.disconnected;
        p.kills = 0;
        p.fleetReady = false;
        p.shipsRemaining = 2;
        p.shotLocked = false;
        p.usedTytCards = false;
        p.roundSubmitted = false;
        p.lastRoundPoints = 0;
        delete p.eliminatedRound;
      }

      if (cur.mode === 'quiz_race') {
        const seed = Date.now() + 7919 + code.charCodeAt(0) * 131;
        cur.quiz = {
          round: 1,
          totalRounds: 4,
          phase: 'question',
          endsAt: Date.now() + 45_000,
          problem: generateFunctionProblem(cur.difficulty, seed),
          submissions: {},
        };
      } else if (cur.mode === 'battleship') {
        cur.battleship = {
          phase: 'prep',
          turnPlayerId: activePlayers[0].id,
          shots: [],
          ships: {},
        };
      } else if (cur.mode === 'graph_wars') {
        const seed = Date.now() + code.charCodeAt(0) * 997 + code.charCodeAt(1) * 31;
        const playerIds = activePlayers.map((p) => p.id);
        const arena = generateGraphWarsMap(seed, playerIds);
        const resolvedMapId = cur.mapId || resolveArenaMap(cur.mapSelection, seed);
        cur.mapId = resolvedMapId;

        for (const pid of playerIds) {
          if (cur.players?.[pid]) {
            cur.players[pid].soldiers = arena.soldiersByPlayer[pid];
            cur.players[pid].alive = true;
          }
        }

        cur.graphWars = {
          round: 1,
          totalRounds: 8,
          phase: 'aim',
          endsAt: Date.now() + GW_AIM_DURATION_MS,
          mapId: resolvedMapId,
          soldiersPerPlayer: arena.soldiersPerPlayer,
          obstacles: arena.obstacles,
          lockedShots: {},
          trajectories: [],
          craters: [],
          usedTytCardsEver: {},
        };
      }

      return cur;
    });
  }

  // ==========================================================================
  // MATCHMAKING QUEUE (Chess.com ±100 Elo, +±50/15s, 100% Real Players)
  // ==========================================================================

  private async joinQueue(
    mode: GameMode,
    difficulty: DifficultyTier,
    isRanked: boolean,
    mapSelection: MapSelection = 'random'
  ) {
    if (!this.identity) return;
    if (isRanked && this.identity.isGuest) {
      this.emit({ type: 'error', message: 'Misafirler Dereceli eşleştirmeye katılamaz.' });
      return;
    }

    await this.leaveRoom();
    await this.leaveQueue();

    const bucketKey = `${mode}_${difficulty}_${isRanked ? 'ranked' : 'unranked'}`;
    const myPath = `matchmaking/${bucketKey}/${this.identity.id}`;
    this.queueBucketKey = bucketKey;
    this.queueJoinedAt = Date.now();
    this.queueParams = { mode, difficulty, isRanked };

    const entry: QueueNodeEntry = {
      id: this.identity.id,
      ...(this.identity.uid ? { uid: this.identity.uid } : {}),
      username: this.identity.username,
      isGuest: this.identity.isGuest,
      elo: this.identity.elo,
      levelTrack: this.identity.levelTrack,
      skinId: this.identity.skinId,
      avatarId: getAvatarById(this.identity.avatarId).id,
      mode,
      difficulty,
      isRanked,
      mapSelection,
      joinedAt: this.queueJoinedAt,
    };

    this.cancelQueueDisconnect = await rtdbStore.onDisconnectRemove(myPath);
    await rtdbStore.set(myPath, entry);

    this.unsubQueue = rtdbStore.onValue<Record<string, QueueNodeEntry>>(
      `matchmaking/${bucketKey}`,
      (val) => {
        this.queueEntriesCache = val || {};
        const myNode = this.identity ? this.queueEntriesCache[this.identity.id] : undefined;
        if (myNode?.assignedRoom) {
          const roomCode = myNode.assignedRoom;
          void this.acceptMatchedRoom(roomCode);
        } else {
          void this.tryMatchBucket();
        }
      }
    );

    this.queueTickInterval = window.setInterval(() => {
      if (!this.queueParams) return;
      const waitSeconds = Math.floor((Date.now() - this.queueJoinedAt) / 1000);
      const eloTolerance = getMatchmakingEloTolerance(waitSeconds);
      const queuedCount = Object.values(this.queueEntriesCache).filter((e) => !e.assignedRoom).length;

      this.emit({
        type: 'queue_status',
        status: {
          inQueue: true,
          mode: this.queueParams.mode,
          difficulty: this.queueParams.difficulty,
          isRanked: this.queueParams.isRanked,
          waitSeconds,
          eloTolerance,
          queuedCount: Math.max(1, queuedCount),
        },
      });

      void this.tryMatchBucket();
    }, 1000);

    this.emit({
      type: 'queue_status',
      status: {
        inQueue: true,
        mode,
        difficulty,
        isRanked,
        waitSeconds: 0,
        eloTolerance: 100,
        queuedCount: 1,
      },
    });
  }

  private async tryMatchBucket() {
    if (!this.identity || !this.queueBucketKey || !this.queueParams) return;
    const now = Date.now();
    const entries = Object.values(this.queueEntriesCache)
      .filter((e) => e && !e.assignedRoom && now - e.joinedAt < 600_000)
      .sort((a, b) => a.joinedAt - b.joinedAt || a.id.localeCompare(b.id));

    if (entries.length < 2) return;
    // Only the earliest queued player acts as matchmaker to avoid duplicate rooms
    if (entries[0].id !== this.identity.id) return;

    const anchor = entries[0];
    const waitA = (now - anchor.joinedAt) / 1000;
    const maxGroup = anchor.mode === 'battleship' ? 2 : anchor.mode === 'graph_wars' ? 10 : 20;
    const group: QueueNodeEntry[] = [anchor];

    for (let i = 1; i < entries.length && group.length < maxGroup; i++) {
      const cand = entries[i];
      if (anchor.isRanked) {
        const waitB = (now - cand.joinedAt) / 1000;
        if (!canPlayersMatchRanked(anchor.elo, waitA, cand.elo, waitB)) continue;
      }
      group.push(cand);
    }

    if (group.length < 2) return;

    // Create matched room directly in countdown state and atomically assign all group players
    const code = generateRoomCode();
    const maxPlayers = anchor.mode === 'battleship' ? 2 : anchor.mode === 'graph_wars' ? 10 : 50;
    const playersRecord: Record<string, RoomPlayerState> = {};

    const usedColors = new Set<string>();
    group.forEach((g, idx) => {
      const avatar = getAvatarById(g.avatarId || DEFAULT_AVATAR_ID);
      const color = !usedColors.has(avatar.primary)
        ? avatar.primary
        : PLAYER_COLORS.find((c) => !usedColors.has(c)) || PLAYER_COLORS[idx % PLAYER_COLORS.length];
      usedColors.add(color);
      playersRecord[g.id] = {
        id: g.id,
        ...(g.uid ? { uid: g.uid } : {}),
        username: g.username,
        isGuest: g.isGuest,
        elo: g.elo,
        levelTrack: g.levelTrack,
        skinId: (g.skinId as RoomPlayerState['skinId']) || 'cyan_neon',
        avatarId: avatar.id,
        ready: true,
        score: 0,
        color,
        joinedAt: now + idx,
        disconnected: false,
        alive: true,
        kills: 0,
        fleetReady: false,
        shipsRemaining: 2,
        usedTytCards: false,
      };
    });

    const chosenMap = resolveArenaMap(anchor.mapSelection, now + code.charCodeAt(0) * 19);
    const matchedRoom: StoredRoom = {
      code,
      mode: anchor.mode,
      difficulty: anchor.difficulty,
      isRanked: anchor.isRanked,
      mapId: chosenMap,
      mapSelection: anchor.mapSelection || 'random',
      status: 'countdown',
      countdownStartsAt: now + MATCH_COUNTDOWN_MS,
      hostId: anchor.id,
      minPlayers: 2,
      maxPlayers,
      createdAt: now,
      players: playersRecord,
    };

    await rtdbStore.set(`rooms/${code}`, matchedRoom);
    for (const g of group) {
      await rtdbStore.set(`matchmaking/${this.queueBucketKey}/${g.id}/assignedRoom`, code);
    }
  }

  private async acceptMatchedRoom(code: string) {
    await this.leaveQueue();
    await this.attachToRoom(code);
  }

  private async leaveQueue() {
    if (this.unsubQueue) {
      this.unsubQueue();
      this.unsubQueue = null;
    }
    if (this.queueTickInterval !== null) {
      clearInterval(this.queueTickInterval);
      this.queueTickInterval = null;
    }
    if (this.cancelQueueDisconnect) {
      await this.cancelQueueDisconnect();
      this.cancelQueueDisconnect = null;
    }
    if (this.queueBucketKey && this.identity) {
      await rtdbStore.remove(`matchmaking/${this.queueBucketKey}/${this.identity.id}`).catch(() => {});
    }
    this.queueBucketKey = null;
    this.queueParams = null;
    this.queueEntriesCache = {};
    this.emit({
      type: 'queue_status',
      status: { inQueue: false, waitSeconds: 0, eloTolerance: 100, queuedCount: 0 },
    });
  }

  // ==========================================================================
  // MODE 1: QUIZ RACE
  // ==========================================================================

  private async submitQuiz(sub: QuizSubmission) {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;

    await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'playing' || cur.mode !== 'quiz_race' || !cur.quiz) return undefined;
      if (cur.quiz.phase !== 'question') return undefined;
      const submissions = cur.quiz.submissions || {};
      if (submissions[pid]) return undefined;
      const player = cur.players?.[pid];
      if (!player) return undefined;

      const remainingMs = Math.max(0, cur.quiz.endsAt - Date.now());
      const graded = gradeQuizSubmission(cur.quiz.problem, sub, remainingMs);
      submissions[pid] = graded;
      cur.quiz.submissions = submissions;
      player.score = (player.score || 0) + graded.points;
      player.roundSubmitted = true;
      player.lastRoundPoints = graded.points;

      const connectedPlayers = Object.values(cur.players || {}).filter((p) => !p.disconnected);
      if (connectedPlayers.every((p) => Boolean(submissions[p.id]))) {
        cur.quiz.phase = 'reveal';
        cur.quiz.endsAt = Date.now() + 4_000;
      }
      return cur;
    });
  }

  private async advanceQuizToReveal(code: string, expectedRound: number) {
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
      if (!cur || cur.status !== 'playing' || !cur.quiz) return undefined;
      if (cur.quiz.round !== expectedRound || cur.quiz.phase !== 'question') return undefined;
      cur.quiz.phase = 'reveal';
      cur.quiz.endsAt = Date.now() + 4_000;
      return cur;
    });
  }

  private async advanceQuizToNextRound(code: string, expectedRound: number) {
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
      if (!cur || cur.status !== 'playing' || !cur.quiz) return undefined;
      if (cur.quiz.round !== expectedRound || cur.quiz.phase !== 'reveal') return undefined;

      const nextRound = cur.quiz.round + 1;
      if (nextRound > cur.quiz.totalRounds) {
        cur.status = 'finished';
        const ordered = Object.values(cur.players || {})
          .sort((a, b) => {
            if (Boolean(a.disconnected) !== Boolean(b.disconnected)) return a.disconnected ? 1 : -1;
            return b.score - a.score;
          })
          .map((p, idx) => ({ id: p.id, rank: idx + 1, score: p.score }));
        cur.summary = buildMatchSummary(cur, ordered);
        return cur;
      }

      const seed = Date.now() + nextRound * 7919 + code.charCodeAt(0) * 131;
      cur.quiz = {
        round: nextRound,
        totalRounds: cur.quiz.totalRounds,
        phase: 'question',
        endsAt: Date.now() + 45_000,
        problem: generateFunctionProblem(cur.difficulty, seed),
        submissions: {},
      };
      for (const p of Object.values(cur.players || {})) {
        p.roundSubmitted = false;
        p.lastRoundPoints = 0;
      }
      return cur;
    });
  }

  // ==========================================================================
  // MODE 2: FUNCTION BATTLESHIP (1v1)
  // ==========================================================================

  private async placeBattleshipFleet(equations: string[]) {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;
    const snap = this.currentRoomSnapshot;
    if (!snap || snap.mode !== 'battleship') return;

    if (!Array.isArray(equations) || equations.length !== 2) {
      this.emit({ type: 'error', message: 'Tam olarak 2 gizli fonksiyon gereklidir.' });
      return;
    }

    const ships: StoredBattleshipShip[] = [];
    for (let i = 0; i < 2; i++) {
      const val = validateBattleshipEquation(equations[i], snap.difficulty);
      if (!val.ok) {
        this.emit({ type: 'error', message: `#${i + 1}: ${val.reason}` });
        return;
      }
      ships.push({
        index: i,
        equation: equations[i].trim(),
        points: val.points,
        hitKeys: {},
        sunk: false,
      });
    }

    if (areExpressionsEquivalent(ships[0].equation, ships[1].equation, -7, 7)) {
      this.emit({ type: 'error', message: 'İki gizli fonksiyon birbirinden farklı olmalıdır.' });
      return;
    }

    await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'playing' || !cur.battleship || cur.battleship.phase !== 'prep') {
        return undefined;
      }
      const shipsMap = cur.battleship.ships || {};
      shipsMap[pid] = ships;
      cur.battleship.ships = shipsMap;

      if (cur.players?.[pid]) {
        cur.players[pid].fleetReady = true;
        cur.players[pid].shipsRemaining = 2;
      }

      const playersArr = Object.values(cur.players || {});
      if (playersArr.length === 2 && playersArr.every((p) => p.fleetReady)) {
        cur.battleship.phase = 'battle';
        cur.battleship.turnPlayerId = playersArr[0].id;
      }
      return cur;
    });
  }

  private async fireBattleshipShot(x: number, y: number) {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;
    const rx = Math.round(x);
    const ry = Math.round(y);
    if (rx < -7 || rx > 7 || ry < -7 || ry > 7) {
      this.emit({ type: 'error', message: 'Koordinatlar [-7, 7] aralığında tam sayı olmalıdır.' });
      return;
    }

    await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'playing' || !cur.battleship || cur.battleship.phase !== 'battle') {
        return undefined;
      }
      if (cur.battleship.turnPlayerId !== pid) return undefined;

      const playersArr = Object.values(cur.players || {});
      const opp = playersArr.find((p) => p.id !== pid);
      const actor = cur.players?.[pid];
      if (!opp || !actor) return undefined;

      const shots = toSafeArray<BattleshipShot>(cur.battleship.shots);
      if (shots.some((s) => s.byPlayerId === pid && s.targetPlayerId === opp.id && s.x === rx && s.y === ry)) {
        return undefined;
      }

      const oppShips = toSafeArray<StoredBattleshipShip>(cur.battleship.ships?.[opp.id]);
      let hit = false;
      let hitShipIdx: number | undefined;
      let newlySunk: StoredBattleshipShip | undefined;
      const key = `${rx}_${ry}`;

      for (const ship of oppShips) {
        if (ship.sunk) continue;
        const pts = toSafeArray<Point2D>(ship.points);
        if (pts.some((pt) => pt.x === rx && pt.y === ry)) {
          hit = true;
          hitShipIdx = ship.index;
          ship.hitKeys = ship.hitKeys || {};
          ship.hitKeys[key] = true;
          if (Object.keys(ship.hitKeys).length >= pts.length) {
            ship.sunk = true;
            newlySunk = ship;
          }
          break;
        }
      }

      shots.push({
        x: rx,
        y: ry,
        hit,
        byPlayerId: pid,
        targetPlayerId: opp.id,
        shipIndex: hitShipIdx,
      });
      cur.battleship.shots = shots;

      if (hit) actor.score = (actor.score || 0) + 100;
      if (newlySunk) actor.score = (actor.score || 0) + 300;
      opp.shipsRemaining = oppShips.filter((s) => !s.sunk).length;

      cur.battleship.lastEvent = {
        type: newlySunk ? 'sink' : hit ? 'hit' : 'miss',
        actorName: actor.username,
        coord: { x: rx, y: ry },
        equation: newlySunk?.equation,
        timestamp: Date.now(),
      };

      if (opp.shipsRemaining === 0) {
        cur.status = 'finished';
        cur.summary = buildMatchSummary(cur, [
          { id: pid, rank: 1, score: actor.score },
          { id: opp.id, rank: 2, score: opp.score },
        ]);
        return cur;
      }

      cur.battleship.turnPlayerId = opp.id;
      return cur;
    });
  }

  private async guessBattleshipEquation(equation: string) {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;
    const compiled = compileMathFunction(equation);
    if (!compiled.fn) {
      this.emit({ type: 'error', message: compiled.error || 'Geçersiz denklem.' });
      return;
    }

    await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'playing' || !cur.battleship || cur.battleship.phase !== 'battle') {
        return undefined;
      }
      if (cur.battleship.turnPlayerId !== pid) return undefined;

      const opp = Object.values(cur.players || {}).find((p) => p.id !== pid);
      const actor = cur.players?.[pid];
      if (!opp || !actor) return undefined;

      const oppShips = toSafeArray<StoredBattleshipShip>(cur.battleship.ships?.[opp.id]);
      let matched: StoredBattleshipShip | undefined;
      for (const ship of oppShips) {
        if (!ship.sunk && areExpressionsEquivalent(equation, ship.equation, -7, 7)) {
          ship.sunk = true;
          matched = ship;
          break;
        }
      }

      if (matched) {
        actor.score = (actor.score || 0) + 400;
        opp.shipsRemaining = oppShips.filter((s) => !s.sunk).length;
        cur.battleship.lastEvent = {
          type: 'sink',
          actorName: actor.username,
          equation: matched.equation,
          timestamp: Date.now(),
        };
        if (opp.shipsRemaining === 0) {
          cur.status = 'finished';
          cur.summary = buildMatchSummary(cur, [
            { id: pid, rank: 1, score: actor.score },
            { id: opp.id, rank: 2, score: opp.score },
          ]);
          return cur;
        }
      } else {
        cur.battleship.lastEvent = {
          type: 'bad_guess',
          actorName: actor.username,
          equation: equation.trim(),
          timestamp: Date.now(),
        };
      }

      cur.battleship.turnPlayerId = opp.id;
      return cur;
    });
  }

  // ==========================================================================
  // MODE 3: CLASSIC GRAPH WARS (Auto-Aligned Multi-Soldier Simultaneous Arena)
  // ==========================================================================

  private async lockGraphWarsShot(
    soldierId: string,
    direction: FireDirection,
    equation: string,
    requestedTytCards: boolean
  ) {
    if (!this.currentRoomCode || !this.identity) return;
    const pid = this.identity.id;
    const compiled = compileMathFunction(equation);
    if (!compiled.fn) {
      this.emit({ type: 'error', message: compiled.error || 'Geçersiz denklem.' });
      return;
    }

    let shouldResolveRound: number | null = null;

    await rtdbStore.runTransaction<StoredRoom>(`rooms/${this.currentRoomCode}`, (cur) => {
      if (!cur || cur.status !== 'playing' || !cur.graphWars || cur.graphWars.phase !== 'aim') {
        return undefined;
      }
      const player = cur.players?.[pid];
      if (!player || !player.alive || player.disconnected) return undefined;

      const aliveSoldiers = toSafeArray<GraphWarsSoldier>(player.soldiers).filter((s) => s.alive);
      if (aliveSoldiers.length === 0) return undefined;
      const chosenSoldier = aliveSoldiers.find((s) => s.id === soldierId) || aliveSoldiers[0];

      // Validate f(x0) is finite at the active soldier's x0
      const f0 = compiled.fn!(chosenSoldier.x);
      if (!Number.isFinite(f0)) return undefined;

      const usedTytCards = Boolean(requestedTytCards && player.levelTrack === 'TYT');
      if (usedTytCards) {
        cur.graphWars.usedTytCardsEver = cur.graphWars.usedTytCardsEver || {};
        cur.graphWars.usedTytCardsEver[pid] = true;
        player.usedTytCards = true;
      }

      cur.graphWars.lockedShots = cur.graphWars.lockedShots || {};
      cur.graphWars.lockedShots[pid] = {
        soldierId: chosenSoldier.id,
        direction: direction === -1 ? -1 : 1,
        equation: equation.trim(),
        usedTytCards,
      };
      player.shotLocked = true;

      const alivePlayers = Object.values(cur.players || {}).filter(
        (p) => p.alive && !p.disconnected
      );
      if (alivePlayers.every((p) => p.shotLocked)) {
        shouldResolveRound = cur.graphWars.round;
      }
      return cur;
    });

    if (shouldResolveRound !== null && this.currentRoomCode) {
      await this.resolveGraphWarsTurn(this.currentRoomCode, shouldResolveRound);
    }
  }

  private async resolveGraphWarsTurn(code: string, expectedRound: number) {
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
      if (!cur || cur.status !== 'playing' || !cur.graphWars) return undefined;
      if (cur.graphWars.round !== expectedRound || cur.graphWars.phase !== 'aim') return undefined;

      const playersMap = cur.players || {};
      const playersArr = Object.values(playersMap);
      const allSoldiersSnapshot: GraphWarsSoldier[] = [];
      const usernameById: Record<string, string> = {};

      for (const p of playersArr) {
        usernameById[p.id] = p.username;
        for (const s of toSafeArray<GraphWarsSoldier>(p.soldiers)) {
          allSoldiersSnapshot.push({ ...s });
        }
      }

      const lockedShots = cur.graphWars.lockedShots || {};
      const trajectories: GraphWarsTrajectory[] = [];
      const craters: Point2D[] = [...toSafeArray<Point2D>(cur.graphWars.craters)];
      const killedSoldierIds = new Set<string>();

      for (const shooter of playersArr) {
        if (!shooter.alive || shooter.disconnected) continue;
        const locked = lockedShots[shooter.id];
        if (!locked) continue;

        const shooterSoldiers = toSafeArray<GraphWarsSoldier>(shooter.soldiers).filter((s) => s.alive);
        const activeSoldier =
          shooterSoldiers.find((s) => s.id === locked.soldierId) || shooterSoldiers[0];
        if (!activeSoldier) continue;

        const traj = traceClassicGraphWarsShot({
          shooterId: shooter.id,
          shooterName: shooter.username,
          shooterColor: shooter.color,
          shooterSkinId: shooter.skinId || 'cyan_neon',
          shooterAvatarId: getAvatarById(shooter.avatarId).id,
          soldier: activeSoldier,
          direction: locked.direction,
          equation: locked.equation,
          usedTytCards: locked.usedTytCards,
          obstacles: toSafeArray<GraphWarsObstacle>(cur.graphWars.obstacles),
          allSoldiers: allSoldiersSnapshot,
          usernameByPlayerId: usernameById,
        });

        if (!traj) continue;
        trajectories.push(traj);

        if (traj.stopReason === 'obstacle' && traj.impactPoint) {
          craters.push(traj.impactPoint);
        }

        // Award points & kills (simultaneous hits across all shots in the same turn)
        let roundKills = 0;
        for (const hit of toSafeArray<GraphWarsHitEvent>(traj.hits)) {
          killedSoldierIds.add(hit.soldierId);
          roundKills++;
          shooter.score = (shooter.score || 0) + 250;
          if (hit.playerEliminated) {
            shooter.score = (shooter.score || 0) + 200;
          }
        }
        // Multi-kill combo bonus!
        if (roundKills >= 2) {
          shooter.score = (shooter.score || 0) + roundKills * 120;
        }
        shooter.kills = (shooter.kills || 0) + roundKills;
        // Survival turn bonus
        shooter.score = (shooter.score || 0) + 30;
      }

      // Apply all eliminations atomically after simultaneous evaluation
      for (const p of playersArr) {
        const safeSoldiers = toSafeArray<GraphWarsSoldier>(p.soldiers);
        if (safeSoldiers.length === 0) continue;
        p.soldiers = safeSoldiers.map((s) =>
          killedSoldierIds.has(s.id) ? { ...s, alive: false } : s
        );
        const stillHasAlive = p.soldiers.some((s) => s.alive);
        if (p.alive && !stillHasAlive) {
          p.alive = false;
          p.eliminatedRound = cur.graphWars.round;
        }
      }

      cur.graphWars.phase = 'firing';
      cur.graphWars.endsAt = Date.now() + GW_FIRING_DURATION_MS;
      cur.graphWars.trajectories = trajectories;
      cur.graphWars.craters = craters.slice(-40);
      return cur;
    });
  }

  private async startNextGraphWarsRound(code: string, expectedRound: number) {
    await rtdbStore.runTransaction<StoredRoom>(`rooms/${code}`, (cur) => {
      if (!cur || cur.status !== 'playing' || !cur.graphWars) return undefined;
      if (cur.graphWars.round !== expectedRound || cur.graphWars.phase !== 'firing') return undefined;

      const playersArr = Object.values(cur.players || {});
      const alivePlayers = playersArr.filter((p) => p.alive && !p.disconnected);
      const nextRound = cur.graphWars.round + 1;

      if (nextRound > cur.graphWars.totalRounds || alivePlayers.length <= 1) {
        cur.status = 'finished';
        const ordered = computeGraphWarsStandings(playersArr);
        cur.summary = buildMatchSummary(cur, ordered);
        return cur;
      }

      cur.graphWars.round = nextRound;
      cur.graphWars.phase = 'aim';
      cur.graphWars.endsAt = Date.now() + GW_AIM_DURATION_MS;
      cur.graphWars.lockedShots = {};
      cur.graphWars.trajectories = [];

      for (const p of playersArr) {
        p.shotLocked = false;
      }
      return cur;
    });
  }

  // ==========================================================================
  // LIVE CHAT (RTDB 10s Cooldown Timestamp + Fixed TR/EN Profanity Filter)
  // ==========================================================================

  private async sendChatMessage(rawText: string) {
    if (!this.currentRoomCode || !this.identity) return;
    const code = this.currentRoomCode;
    const pid = this.identity.id;
    const now = Date.now();

    const filtered = filterChatMessage(rawText);
    if (!filtered.cleaned) return;

    // Enforce 5-second spam cooldown via RTDB timestamp transaction
    let blockedRemainingMs = 0;
    const cooldownPath = `chat_cooldowns/${code}/${pid}`;
    const tx = await rtdbStore.runTransaction<{ lastSentAt: number }>(cooldownPath, (cur) => {
      const check = checkChatCooldown(cur?.lastSentAt, now);
      if (!check.allowed) {
        blockedRemainingMs = check.remainingMs;
        return undefined;
      }
      return { lastSentAt: now };
    });

    if (!tx.committed) {
      const remSec = Math.max(1, Math.ceil(blockedRemainingMs / 1000));
      this.emit({
        type: 'chat_error',
        error: `Bekleme süresi aktif: ${remSec}s`,
        cooldownRemainingMs: blockedRemainingMs || CHAT_COOLDOWN_MS,
      });
      return;
    }

    const msgId = `msg_${now}_${Math.random().toString(36).slice(2, 7)}`;
    const msg: ChatMessage = {
      id: msgId,
      senderId: pid,
      senderName: this.identity.username,
      text: filtered.cleaned,
      wasCensored: filtered.wasCensored,
      timestamp: now,
    };

    await rtdbStore.set(`rooms/${code}/chat/${msgId}`, msg);
  }
}

export const multiplayerClient = new RtdbMultiplayerClient();
