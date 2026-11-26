import { ArenaMapId, AvatarId, MapSelection } from '../engine/avatarsAndMaps';
import { DifficultyTier, EloDeltaResult, GameMode, LevelTrack } from '../engine/elo';
import { GeneratedFunctionProblem } from '../engine/functionGenerator';
import {
  FireDirection,
  GraphWarsObstacle,
  GraphWarsSoldier,
  GraphWarsTrajectory,
} from '../engine/graphWarsEngine';
import { Point2D } from '../engine/mathParser';
import { SkinId } from '../engine/skins';

export type { FireDirection, GraphWarsObstacle, GraphWarsSoldier, GraphWarsTrajectory };

export interface PlayerIdentity {
  id: string; // session id (or uid for registered)
  uid?: string;
  username: string;
  isGuest: boolean;
  elo: number;
  levelTrack: LevelTrack;
  skinId: SkinId;
  avatarId: AvatarId;
}

export interface RoomSummary {
  code: string;
  mode: GameMode;
  difficulty: DifficultyTier;
  isRanked: boolean;
  mapId: ArenaMapId;
  status: 'lobby' | 'countdown' | 'playing' | 'finished';
  playerCount: number;
  maxPlayers: number;
  hostName: string;
}

export interface RoomPlayerState {
  id: string;
  uid?: string;
  username: string;
  isGuest: boolean;
  elo: number;
  levelTrack: LevelTrack;
  skinId: SkinId;
  avatarId: AvatarId;
  ready: boolean;
  score: number;
  color: string;
  joinedAt: number;
  disconnected?: boolean;
  disconnectedAt?: number;
  // Battleship specific
  fleetReady?: boolean;
  shipsRemaining?: number;
  // Classic Graph Wars specific
  alive?: boolean;
  soldiers?: GraphWarsSoldier[];
  kills?: number;
  eliminatedRound?: number;
  shotLocked?: boolean;
  usedTytCards?: boolean;
  // Quiz Race specific
  roundSubmitted?: boolean;
  lastRoundPoints?: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  wasCensored: boolean;
  timestamp: number;
}

export interface QuizSubmission {
  targetPoint: string;
  xIntercepts: string;
  yIntercept: string;
  vertexOrSlope: string;
  symmetryAxis: string;
  domain: string;
  range: string;
  increasing: string;
  decreasing: string;
}

export interface QuizState {
  round: number;
  totalRounds: number;
  phase: 'question' | 'reveal';
  endsAt: number;
  problem: GeneratedFunctionProblem;
  roundResults?: Record<string, { points: number; correctCount: number; totalFields: number }>;
}

export interface BattleshipShot {
  x: number;
  y: number;
  hit: boolean;
  byPlayerId: string;
  targetPlayerId: string;
  shipIndex?: number;
}

export interface RevealedShip {
  index: number;
  equation: string;
  points: Point2D[];
  sunk: boolean;
}

export interface BattleshipState {
  phase: 'prep' | 'battle';
  turnPlayerId: string;
  shots: BattleshipShot[];
  myShips: RevealedShip[]; // Always visible to self
  opponentSunkShips: RevealedShip[]; // Only revealed once sunk or finished
  lastEvent?: {
    type: 'hit' | 'miss' | 'sink' | 'bad_guess';
    actorName: string;
    coord?: Point2D;
    equation?: string;
    timestamp: number;
  };
}

export interface GraphWarsState {
  round: number;
  totalRounds: number;
  phase: 'aim' | 'firing';
  endsAt: number;
  mapId: ArenaMapId;
  soldiersPerPlayer: number;
  obstacles: GraphWarsObstacle[];
  trajectories: GraphWarsTrajectory[];
  craters: Point2D[];
  myLockedShot?: {
    soldierId: string;
    direction: FireDirection;
    equation: string;
    usedTytCards: boolean;
  };
}

export interface MatchSummary {
  matchId: string;
  mode: GameMode;
  difficulty: DifficultyTier;
  isRanked: boolean;
  standings: Array<{
    id: string;
    uid?: string;
    username: string;
    isGuest: boolean;
    rank: number;
    score: number;
    kills?: number;
    forfeited?: boolean;
    usedTytCards: boolean;
    eloDelta: number;
    oldElo: number;
    newElo: number;
  }>;
  eloDeltas: EloDeltaResult[];
}

export interface MatchCountdownState {
  startsAt: number;
  totalSeconds: number;
}

export interface RoomFullState {
  code: string;
  mode: GameMode;
  difficulty: DifficultyTier;
  isRanked: boolean;
  mapId: ArenaMapId;
  mapSelection?: MapSelection;
  status: 'lobby' | 'countdown' | 'playing' | 'finished';
  hostId: string;
  minPlayers: number;
  maxPlayers: number;
  players: RoomPlayerState[];
  chat: ChatMessage[];
  countdown?: MatchCountdownState;
  quiz?: QuizState;
  battleship?: BattleshipState;
  graphWars?: GraphWarsState;
  summary?: MatchSummary;
}

export interface QueueStatus {
  inQueue: boolean;
  mode?: GameMode;
  difficulty?: DifficultyTier;
  isRanked?: boolean;
  waitSeconds: number;
  eloTolerance: number;
  queuedCount: number;
}

export type ClientMessage =
  | { type: 'identify'; player: PlayerIdentity }
  | { type: 'list_rooms' }
  | {
      type: 'create_room';
      mode: GameMode;
      difficulty: DifficultyTier;
      isRanked: boolean;
      mapSelection?: MapSelection;
    }
  | { type: 'set_room_map'; mapSelection: MapSelection }
  | { type: 'join_room'; code: string }
  | { type: 'rejoin_room'; code: string }
  | { type: 'leave_room' }
  | { type: 'rematch' }
  | { type: 'toggle_ready' }
  | { type: 'start_match' }
  | { type: 'cancel_countdown' }
  | {
      type: 'join_queue';
      mode: GameMode;
      difficulty: DifficultyTier;
      isRanked: boolean;
      mapSelection?: MapSelection;
    }
  | { type: 'leave_queue' }
  | { type: 'quiz_submit'; submission: QuizSubmission }
  | { type: 'battleship_place'; equations: string[] }
  | { type: 'battleship_fire'; x: number; y: number }
  | { type: 'battleship_guess'; equation: string }
  | {
      type: 'graph_wars_lock';
      soldierId: string;
      direction: FireDirection;
      equation: string;
      usedTytCards: boolean;
    }
  | { type: 'chat_send'; text: string };

export type ServerMessage =
  | { type: 'identified'; player: PlayerIdentity; onlineCount: number }
  | { type: 'online_count'; count: number }
  | { type: 'rooms_list'; rooms: RoomSummary[] }
  | { type: 'room_state'; room: RoomFullState | null }
  | { type: 'queue_status'; status: QueueStatus }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'chat_error'; error: string; cooldownRemainingMs?: number }
  | { type: 'error'; message: string };
