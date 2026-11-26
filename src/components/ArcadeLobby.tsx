import React, { useState } from 'react';
import {
  Award,
  BookOpen,
  Bot,
  Check,
  Compass,
  Globe,
  Link2,
  Lock,
  LogIn,
  LogOut,
  Play,
  Plus,
  Radio,
  Settings,
  Sparkles,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  ARENA_MAPS,
  AvatarId,
  getArenaMapById,
  getAvatarById,
  MapSelection,
} from '../engine/avatarsAndMaps';
import { GameMode, LevelTrack } from '../engine/elo';
import { getLeagueProgress } from '../engine/skins';
import { soundEngine } from '../engine/sound';
import { Lang, t } from '../i18n/translations';
import { RegisteredProfile } from '../services/firebase';
import { QueueStatus, RoomSummary } from '../services/multiplayerTypes';
import { AvatarIllustration, MapPreviewSvg } from './AvatarIllustration';
import { ThemeMode } from './SettingsModal';

interface ArcadeLobbyProps {
  lang: Lang;
  theme: ThemeMode;
  muted: boolean;
  isRegistered: boolean;
  profile: RegisteredProfile | null;
  nickname: string;
  onChangeNickname: (name: string) => void;
  levelTrack: LevelTrack;
  onChangeTrack: (track: LevelTrack) => void;
  avatarId: AvatarId;
  selectedMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  selectedMap: MapSelection;
  onSelectMap: (map: MapSelection) => void;
  isRanked: boolean;
  onChangeRanked: (ranked: boolean) => void;
  onlineCount: number;
  openRooms: RoomSummary[];
  queueStatus: QueueStatus;
  onToggleLang: () => void;
  onToggleMute: () => void;
  onOpenSettings: () => void;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLoginGoogleDirect: () => void;
  onLogout: () => void;
  onOpenLeaderboard: () => void;
  onOpenProfile: () => void;
  onOpenAvatars: () => void;
  onOpenHowToPlay: () => void;
  onPlayMatchmaking: () => void;
  onStartPractice: () => void;
  onLeaveQueue: () => void;
  onCreateRoom: () => void;
  onJoinRoom: (code: string) => void;
  onOpenInviteQrForCode?: (code: string) => void;
  authBusy: boolean;
  lobbyError: string | null;
}

const MAP_OPTIONS: MapSelection[] = [
  'random',
  'cloud_temple',
  'glacier_peak',
  'volcano_crater',
  'desert_pyramid',
];

export const ArcadeLobby: React.FC<ArcadeLobbyProps> = ({
  lang,
  theme,
  muted,
  isRegistered,
  profile,
  nickname,
  onChangeNickname,
  levelTrack,
  onChangeTrack,
  avatarId,
  selectedMode,
  onSelectMode,
  selectedMap,
  onSelectMap,
  isRanked,
  onChangeRanked,
  onlineCount,
  openRooms,
  queueStatus,
  onToggleLang,
  onToggleMute,
  onOpenSettings,
  onOpenAuth,
  onLoginGoogleDirect,
  onLogout,
  onOpenLeaderboard,
  onOpenProfile,
  onOpenAvatars,
  onOpenHowToPlay,
  onPlayMatchmaking,
  onStartPractice,
  onLeaveQueue,
  onCreateRoom,
  onJoinRoom,
  onOpenInviteQrForCode,
  authBusy,
  lobbyError,
}) => {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const isDark = theme === 'dark';
  const activeAvatar = getAvatarById(avatarId);
  const displayName =
    isRegistered && profile
      ? profile.username
      : nickname.trim() || (lang === 'tr' ? 'Misafir' : 'Guest');
  const displayElo = isRegistered && profile ? profile.elo : 1000;
  const league = getLeagueProgress(displayElo);
  const leagueTitle = lang === 'tr' ? `${league.nameTr} Lig` : `${league.nameEn} League`;

  const handleJoinCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = roomCodeInput.trim().toUpperCase();
    if (!cleaned) return;
    soundEngine.playClick();
    onJoinRoom(cleaned);
  };

  const handlePlayFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    soundEngine.playClick();
    if (queueStatus.inQueue) {
      onLeaveQueue();
    } else {
      onPlayMatchmaking();
    }
  };

  return (
    <div className="relative z-10 min-h-screen w-full flex flex-col px-3 sm:px-5 lg:px-7 py-3.5 sm:py-5">
      <div className="w-full max-w-[1380px] mx-auto flex-1 flex flex-col justify-center gap-4">
        {/* ====================================================================
            TOP UTILITY BAR — Compact Real Player Counter & Quick Controls
           ==================================================================== */}
        <header className="cartoon-card bg-white/95 dark:bg-[#101C2E]/95 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          {/* Clean Brand Wordmark (single-line, zero subtitle/badge clutter) */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <svg
                viewBox="0 0 32 32"
                className="w-7 h-7 shrink-0"
                aria-hidden="true"
              >
                <rect
                  x="2"
                  y="2"
                  width="28"
                  height="28"
                  rx="8"
                  fill="#FACC15"
                  stroke="#0F172A"
                  strokeWidth="2.5"
                />
                <path
                  d="M7 22 Q16 5 25 22"
                  fill="none"
                  stroke="#0284C7"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
                <circle cx="16" cy="13.5" r="2.6" fill="#EF4444" stroke="#0F172A" strokeWidth="1.5" />
              </svg>
              <span className="font-display font-black text-lg tracking-tight text-slate-950 dark:text-white whitespace-nowrap">
                TURQUATION
              </span>
            </div>

            <span className="hidden sm:inline text-slate-300 dark:text-slate-600" aria-hidden="true">
              ·
            </span>

            <div className="flex items-center gap-1.5 text-xs font-mono font-extrabold text-emerald-800 dark:text-emerald-300 tabular-nums whitespace-nowrap">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>
                {onlineCount} {t(lang, 'onlinePlayersLabel')}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onToggleLang();
              }}
              aria-label="Toggle language"
              className="px-2.5 py-2 rounded-xl bg-white dark:bg-[#172740] text-xs font-mono font-extrabold text-slate-900 dark:text-white cartoon-btn-white flex items-center gap-1 cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-sky-600 dark:text-amber-300" />
              <span>{lang.toUpperCase()}</span>
            </button>

            <button
              type="button"
              onClick={() => onToggleMute()}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="p-2 rounded-xl bg-white dark:bg-[#172740] text-slate-900 dark:text-white cartoon-btn-white cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playClick();
                onOpenSettings();
              }}
              data-testid="open-settings-btn"
              aria-label={t(lang, 'settingsBtn')}
              className="p-2 rounded-xl bg-white dark:bg-[#172740] text-slate-900 dark:text-white cartoon-btn-white cursor-pointer"
            >
              <Settings className="w-4 h-4 text-sky-600 dark:text-amber-300" />
            </button>
          </div>
        </header>

        {/* ====================================================================
            MAIN 3-COLUMN CARTOON-ARCADE ISLANDS LOBBY GRID
           ==================================================================== */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* ================================================================
              COLUMN 1 (4 COLS) — HERO CHARACTER PEDESTAL & LAUNCH CONTROLS
             ================================================================ */}
          <section className="lg:col-span-4 cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 sm:p-5 flex flex-col justify-between gap-4">
            {/* Hero Pedestal Stage (Dominant Visual Anchor) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-mono font-extrabold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                    {lang === 'tr' ? activeAvatar.titleTr : activeAvatar.titleEn}
                  </div>
                  <h2
                    data-testid="lobby-active-avatar-name"
                    className="text-xl font-display font-black text-slate-950 dark:text-white leading-tight"
                  >
                    {lang === 'tr' ? activeAvatar.nameTr : activeAvatar.nameEn}
                  </h2>
                </div>

                <button
                  type="button"
                  data-testid="open-avatars-btn"
                  onClick={() => {
                    soundEngine.playClick();
                    onOpenAvatars();
                  }}
                  className="px-3 py-1.5 rounded-xl cartoon-btn-amber font-display font-black text-xs flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t(lang, 'avatarChangeBtn')}</span>
                </button>
              </div>

              {/* Clickable Floating Island Character Stage */}
              <button
                type="button"
                onClick={() => {
                  soundEngine.playClick();
                  onOpenAvatars();
                }}
                aria-label={t(lang, 'avatarChangeBtn')}
                className="group relative w-full rounded-2xl border-2 border-slate-900 dark:border-slate-600 overflow-hidden p-4 flex flex-col items-center justify-center cursor-pointer transition-transform hover:-translate-y-0.5"
                style={{
                  background: isDark
                    ? `linear-gradient(180deg, ${activeAvatar.cardBgDark} 0%, #0B1524 100%)`
                    : `linear-gradient(180deg, ${activeAvatar.cardBg} 0%, #FFFFFF 100%)`,
                }}
              >
                {/* Sunburst comic rays */}
                <svg
                  viewBox="0 0 260 150"
                  className={`absolute inset-0 w-full h-full pointer-events-none ${
                    isDark ? 'opacity-15' : 'opacity-35'
                  }`}
                  preserveAspectRatio="xMidYMid slice"
                  aria-hidden="true"
                >
                  <polygon points="130,75 0,0 48,0" fill={isDark ? activeAvatar.primary : '#FFFFFF'} />
                  <polygon points="130,75 96,0 164,0" fill={isDark ? activeAvatar.primary : '#FFFFFF'} />
                  <polygon points="130,75 212,0 260,0" fill={isDark ? activeAvatar.primary : '#FFFFFF'} />
                  <polygon points="130,75 260,55 260,105" fill={isDark ? activeAvatar.primary : '#FFFFFF'} />
                  <polygon points="130,75 0,55 0,105" fill={isDark ? activeAvatar.primary : '#FFFFFF'} />
                </svg>

                {/* Hero Avatar Portrait */}
                <div className="relative z-10 animate-hero-bob">
                  <AvatarIllustration avatarId={activeAvatar.id} className="w-32 h-32 drop-shadow-md" />
                </div>

                {/* Floating Grassy Pedestal Disc */}
                <div className="relative z-10 -mt-3 w-40 h-5 rounded-full bg-emerald-400 dark:bg-emerald-500 border-2 border-slate-900 dark:border-slate-950 shadow-[0_4px_0_#92400e]" />

                {/* Special VFX Tag */}
                <div className="relative z-10 mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/95 dark:bg-[#0B1524]/95 border-2 border-slate-900 dark:border-slate-600 text-[11px] font-mono font-bold text-slate-900 dark:text-slate-100">
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-slate-900 dark:border-slate-300"
                    style={{ backgroundColor: activeAvatar.trailColor }}
                  />
                  <span>{lang === 'tr' ? activeAvatar.fxLabelTr : activeAvatar.fxLabelEn}</span>
                </div>
              </button>
            </div>

            {/* Nickname + Primary Matchmaking & Create Room Launch Form */}
            <form onSubmit={handlePlayFormSubmit} className="space-y-3">
              {!isRegistered ? (
                <div className="space-y-1">
                  <label
                    htmlFor="lobby-nickname"
                    className="text-xs font-display font-extrabold text-slate-700 dark:text-slate-200 flex items-center justify-between"
                  >
                    <span>{t(lang, 'nicknameLabel')}</span>
                    <span className="font-mono text-[10px] text-amber-700 dark:text-amber-300">
                      {t(lang, 'guestLabel')}
                    </span>
                  </label>
                  <input
                    id="lobby-nickname"
                    data-testid="lobby-nickname-input"
                    type="text"
                    maxLength={22}
                    value={nickname}
                    onChange={(e) => onChangeNickname(e.target.value)}
                    placeholder={t(lang, 'nicknamePlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-500 text-sm font-display font-extrabold text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                </div>
              ) : (
                <div className="px-3.5 py-2.5 rounded-xl bg-sky-50 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="font-display font-black text-base text-slate-950 dark:text-white truncate">
                      {displayName}
                    </div>
                    <div className="text-[11px] font-mono font-bold text-sky-700 dark:text-amber-300 tabular-nums">
                      {displayElo} Elo · {leagueTitle}
                    </div>
                  </div>
                  <Award className="w-5 h-5 text-amber-500 shrink-0" />
                </div>
              )}

              {lobbyError && (
                <div
                  role="alert"
                  className="px-3 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/70 border-2 border-rose-600 text-xs font-bold text-rose-800 dark:text-rose-200 text-center"
                >
                  {lobbyError}
                </div>
              )}

              {queueStatus.inQueue ? (
                <div className="p-3.5 rounded-2xl bg-sky-100 dark:bg-sky-950/60 border-2 border-slate-900 dark:border-sky-400 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-sm font-display font-black text-sky-950 dark:text-sky-200">
                      <Radio className="w-4 h-4" />
                      <span>{t(lang, 'searchingPlayers')}</span>
                    </div>
                    <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                      {queueStatus.waitSeconds}s · {queueStatus.queuedCount}
                    </span>
                  </div>
                  {queueStatus.isRanked && (
                    <div className="text-[11px] font-mono font-bold text-sky-800 dark:text-sky-300">
                      {t(lang, 'eloRangeLabel')}: ±{queueStatus.eloTolerance}
                    </div>
                  )}
                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 border-2 border-slate-900 shadow-[0_3px_0_#0f172a] text-white font-display font-black text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>{t(lang, 'cancelQueue')}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <button
                    type="submit"
                    data-testid="play-cta-btn"
                    data-start="true"
                    className="w-full py-3.5 px-5 rounded-2xl cartoon-btn-green font-display font-black text-lg tracking-wide flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-5 h-5 fill-current" />
                    <span>{t(lang, 'startMatchmakingCta')}</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      data-testid="create-room-btn"
                      onClick={() => {
                        soundEngine.playClick();
                        onCreateRoom();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl cartoon-btn-sky font-display font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4 stroke-[3] shrink-0" />
                      <span>{t(lang, 'createRoomPlus')}</span>
                    </button>

                    <button
                      type="button"
                      data-testid="practice-mode-btn"
                      onClick={() => {
                        soundEngine.playClick();
                        onStartPractice();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl cartoon-btn-amber font-display font-black text-xs sm:text-sm tracking-wide flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Bot className="w-4 h-4 shrink-0" />
                      <span>{t(lang, 'practiceModeCta')}</span>
                    </button>
                  </div>
                </div>
              )}

              <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 text-center">
                {t(lang, 'controlHint')}
              </p>
            </form>
          </section>

          {/* ================================================================
              COLUMN 2 (5 COLS) — MODE SELECTOR, 4-MAP ISLAND PICKER & RULES
             ================================================================ */}
          <main className="lg:col-span-5 flex flex-col gap-4">
            {/* Game Modes Selector */}
            <section
              aria-label="Game Modes"
              className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-display font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  {lang === 'tr' ? 'Oyun Modu Seç' : 'Choose Game Mode'}
                </h2>
                <span className="text-[11px] font-mono font-extrabold text-sky-700 dark:text-amber-300">
                  {selectedMode === 'graph_wars'
                    ? 'K=56'
                    : selectedMode === 'battleship'
                      ? '1v1 · K=32'
                      : 'K=36'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2.5">
                {/* MODE 1: GRAPH WARS */}
                <button
                  type="button"
                  data-testid="mode-card-graph_wars"
                  onClick={() => {
                    soundEngine.playClick();
                    onSelectMode('graph_wars');
                  }}
                  className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    selectedMode === 'graph_wars'
                      ? 'bg-sky-100 dark:bg-sky-950/75 border-slate-900 dark:border-sky-300 shadow-[0_4px_0_#0f172a] -translate-y-0.5'
                      : 'bg-slate-50 dark:bg-[#0B1524] border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-sky-400'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display font-black text-base text-slate-950 dark:text-white">
                        {t(lang, 'modeGraphWarsTitle')}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-amber-300 border border-slate-900 text-slate-950 font-mono text-[10px] font-extrabold">
                        {t(lang, 'highestEloRibbon')}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-1">
                      {t(lang, 'modeGraphWarsTag')}
                    </p>
                  </div>
                  <div
                    className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 ${
                      selectedMode === 'graph_wars'
                        ? 'bg-emerald-400 border-slate-900 text-slate-950'
                        : 'bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-transparent'
                    }`}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </div>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* MODE 2: BATTLESHIP */}
                  <button
                    type="button"
                    data-testid="mode-card-battleship"
                    onClick={() => {
                      soundEngine.playClick();
                      onSelectMode('battleship');
                    }}
                    className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      selectedMode === 'battleship'
                        ? 'bg-amber-100 dark:bg-amber-950/60 border-slate-900 dark:border-amber-300 shadow-[0_4px_0_#0f172a] -translate-y-0.5'
                        : 'bg-slate-50 dark:bg-[#0B1524] border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-amber-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-display font-black text-sm text-slate-950 dark:text-white truncate">
                        {t(lang, 'modeBattleshipTitle')}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-300/90 border border-slate-900 text-[10px] font-mono font-extrabold text-slate-950 shrink-0">
                        1v1
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                      {t(lang, 'modeBattleshipTag')}
                    </p>
                  </button>

                  {/* MODE 3: QUIZ RACE */}
                  <button
                    type="button"
                    data-testid="mode-card-quiz_race"
                    onClick={() => {
                      soundEngine.playClick();
                      onSelectMode('quiz_race');
                    }}
                    className={`text-left p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-1.5 ${
                      selectedMode === 'quiz_race'
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 border-slate-900 dark:border-emerald-300 shadow-[0_4px_0_#0f172a] -translate-y-0.5'
                        : 'bg-slate-50 dark:bg-[#0B1524] border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-emerald-400'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="font-display font-black text-sm text-slate-950 dark:text-white truncate">
                        {t(lang, 'modeQuizTitle')}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-emerald-300 border border-slate-900 text-[10px] font-mono font-extrabold text-slate-950 shrink-0">
                        4 {t(lang, 'roundLabel')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2">
                      {t(lang, 'modeQuizTag')}
                    </p>
                  </button>
                </div>
              </div>
            </section>

            {/* Themed Map Selector (4 Island Maps + Random) */}
            <section
              aria-label={t(lang, 'mapSelectorTitle')}
              className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-display font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-sky-600 dark:text-amber-300" />
                  <span>{t(lang, 'mapSelectorTitle')}</span>
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300">
                  {selectedMap === 'random'
                    ? t(lang, 'mapRandomLabel')
                    : lang === 'tr'
                      ? getArenaMapById(selectedMap).nameTr
                      : getArenaMapById(selectedMap).nameEn}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {MAP_OPTIONS.map((mId) => {
                  const active = selectedMap === mId;
                  const mapMeta = mId === 'random' ? null : ARENA_MAPS.find((x) => x.id === mId);
                  const label =
                    mId === 'random'
                      ? t(lang, 'mapRandomLabel')
                      : lang === 'tr'
                        ? mapMeta!.nameTr.split(' ')[0]
                        : mapMeta!.nameEn.split(' ')[0];
                  return (
                    <button
                      key={mId}
                      type="button"
                      data-testid={`map-option-${mId}`}
                      onClick={() => {
                        soundEngine.playClick();
                        onSelectMap(mId);
                      }}
                      className={`rounded-xl overflow-hidden border-2 transition-all cursor-pointer flex flex-col ${
                        active
                          ? 'border-slate-900 dark:border-amber-300 shadow-[0_3px_0_#0f172a] -translate-y-0.5 ring-2 ring-amber-400'
                          : 'border-slate-300 dark:border-slate-700 hover:border-slate-900 dark:hover:border-slate-400 opacity-90 hover:opacity-100'
                      }`}
                    >
                      <MapPreviewSvg mapId={mId} className="w-full h-11 block" />
                      <span
                        className={`py-1 px-1 text-[10px] font-display font-extrabold text-center truncate w-full ${
                          active
                            ? 'bg-amber-300 text-slate-950'
                            : 'bg-slate-50 dark:bg-[#0B1524] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Track + Ranked Switch */}
            <section className="flex-1 cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 flex flex-col justify-center">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Curriculum Track */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400">
                    {t(lang, 'levelTrackLabel')}
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onChangeTrack('TYT');
                      }}
                      className={`py-1.5 rounded-lg text-xs font-display font-black cursor-pointer ${
                        levelTrack === 'TYT'
                          ? 'bg-amber-300 text-slate-950 border border-slate-900'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t(lang, 'trackTyt')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onChangeTrack('11_AYT');
                      }}
                      className={`py-1.5 rounded-lg text-xs font-display font-black cursor-pointer ${
                        levelTrack === '11_AYT'
                          ? 'bg-amber-300 text-slate-950 border border-slate-900'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      11 / AYT
                    </button>
                  </div>
                </div>

                {/* Unranked / Ranked Toggle */}
                <div className="space-y-1">
                  <span className="text-[11px] font-mono font-bold uppercase text-slate-500 dark:text-slate-400 flex items-center justify-between">
                    <span>{lang === 'tr' ? 'Kuyruk' : 'Queue'}</span>
                    {!isRegistered && <Lock className="w-3 h-3 text-amber-600" />}
                  </span>
                  <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onChangeRanked(false);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-display font-black cursor-pointer ${
                        !isRanked
                          ? 'bg-white dark:bg-[#192B47] text-slate-950 dark:text-white border border-slate-900 dark:border-slate-500'
                          : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t(lang, 'unranked')}
                    </button>
                    <button
                      type="button"
                      disabled={!isRegistered}
                      title={!isRegistered ? t(lang, 'rankedLockedGuest') : undefined}
                      onClick={() => {
                        if (!isRegistered) return;
                        soundEngine.playClick();
                        onChangeRanked(true);
                      }}
                      className={`py-1.5 rounded-lg text-xs font-display font-black flex items-center justify-center gap-1 ${
                        !isRegistered
                          ? 'text-slate-400 dark:text-slate-600 cursor-not-allowed'
                          : isRanked
                            ? 'bg-amber-400 text-slate-950 border border-slate-900 cursor-pointer'
                            : 'text-slate-600 dark:text-slate-400 cursor-pointer'
                      }`}
                    >
                      {isRegistered ? (
                        <Trophy className="w-3 h-3" />
                      ) : (
                        <Lock className="w-3 h-3" />
                      )}
                      <span>Elo</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </main>

          {/* ================================================================
              COLUMN 3 (3 COLS) — ACCOUNT / SHORTCUTS & PRIVATE PARTY ROOMS
             ================================================================ */}
          <aside className="lg:col-span-3 flex flex-col gap-4">
            {/* Account & 4 Arcade Shortcuts */}
            <section className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 space-y-3">
              {isRegistered && profile ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-display font-black text-slate-900 dark:text-white">
                      {leagueTitle}
                    </span>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t(lang, 'logout')}</span>
                    </button>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-900 overflow-hidden">
                    <div
                      className="h-full bg-amber-400 transition-all"
                      style={{ width: `${Math.max(8, league.progressPct)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
                    <span>
                      {profile.matchesPlayed} {t(lang, 'quickStatsMatches')}
                    </span>
                    <span className="text-emerald-700 dark:text-emerald-400">
                      {profile.wins} {t(lang, 'quickStatsWins')}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-xs font-display font-black text-slate-900 dark:text-white">
                    {lang === 'tr' ? 'Elo & Liderlik İçin Giriş Yap' : 'Sign In for Elo & Ranks'}
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        soundEngine.playClick();
                        onLoginGoogleDirect();
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-white dark:bg-[#172740] text-slate-900 dark:text-white font-display font-extrabold text-xs cartoon-btn-white flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <span>{t(lang, 'googleSignIn')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onOpenAuth('login');
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-sky-50 dark:bg-[#0B1524] text-sky-900 dark:text-sky-200 font-display font-extrabold text-xs cartoon-btn-white flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>{t(lang, 'emailAuthBtn')}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* 4 Arcade Shortcut Tiles */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onOpenLeaderboard();
                  }}
                  className="py-2 px-2 rounded-xl bg-amber-50 dark:bg-[#0B1524] text-slate-900 dark:text-slate-100 font-display font-extrabold text-xs cartoon-btn-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trophy className="w-3.5 h-3.5 text-amber-500" />
                  <span>{t(lang, 'shortcutLeaderboard')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onOpenProfile();
                  }}
                  className="py-2 px-2 rounded-xl bg-sky-50 dark:bg-[#0B1524] text-slate-900 dark:text-slate-100 font-display font-extrabold text-xs cartoon-btn-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <User className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{t(lang, 'shortcutProfile')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onOpenAvatars();
                  }}
                  className="py-2 px-2 rounded-xl bg-emerald-50 dark:bg-[#0B1524] text-slate-900 dark:text-slate-100 font-display font-extrabold text-xs cartoon-btn-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>{t(lang, 'shortcutAvatars')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    onOpenHowToPlay();
                  }}
                  className="py-2 px-2 rounded-xl bg-slate-50 dark:bg-[#0B1524] text-slate-900 dark:text-slate-100 font-display font-extrabold text-xs cartoon-btn-white flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>{t(lang, 'shortcutHowToPlay')}</span>
                </button>
              </div>
            </section>

            {/* Private Room Code Join + Open Rooms */}
            <section className="flex-1 cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-4 flex flex-col justify-between gap-3">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xs font-display font-black uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-sky-600 dark:text-amber-300" />
                    <span>{t(lang, 'partyRoomsPanelTitle')}</span>
                  </h2>
                  <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                    {openRooms.length} {t(lang, 'openRooms')}
                  </span>
                </div>

                <form onSubmit={handleJoinCodeSubmit} className="flex items-center gap-1.5">
                  <label htmlFor="join-code-input" className="sr-only">
                    {t(lang, 'roomCodePlaceholder')}
                  </label>
                  <input
                    id="join-code-input"
                    data-testid="join-code-input"
                    type="text"
                    maxLength={6}
                    value={roomCodeInput}
                    onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                    placeholder={t(lang, 'roomCodePlaceholder')}
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 font-mono text-xs font-extrabold tracking-widest uppercase text-slate-950 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="submit"
                    data-testid="join-room-btn"
                    className="px-3.5 py-2 rounded-xl cartoon-btn-amber font-display font-black text-xs cursor-pointer shrink-0"
                  >
                    {t(lang, 'joinRoom')}
                  </button>
                </form>

                {/* Open Rooms List */}
                <div className="space-y-1.5 max-h-[210px] overflow-y-auto pr-0.5">
                  {openRooms.length === 0 ? (
                    <div className="py-5 px-3 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-dashed border-slate-300 dark:border-slate-700 text-center space-y-2">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {t(lang, 'noOpenRooms')}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          soundEngine.playClick();
                          onCreateRoom();
                        }}
                        className="px-3 py-1.5 rounded-lg cartoon-btn-sky text-xs font-display font-black cursor-pointer"
                      >
                        {t(lang, 'firstRoomCta')}
                      </button>
                    </div>
                  ) : (
                    openRooms.map((r) => {
                      const mapInfo = getArenaMapById(r.mapId);
                      return (
                        <div
                          key={r.code}
                          className="p-2.5 rounded-xl bg-sky-50/80 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-700 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-black text-sky-800 dark:text-amber-300">
                                #{r.code}
                              </span>
                              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 truncate">
                                {lang === 'tr' ? mapInfo.nameTr : mapInfo.nameEn}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 truncate">
                              {r.hostName} · {r.playerCount}/{r.maxPlayers}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {onOpenInviteQrForCode && (
                              <button
                                type="button"
                                onClick={() => onOpenInviteQrForCode(r.code)}
                                aria-label={t(lang, 'inviteQrBtn')}
                                className="p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-900 text-slate-700 dark:text-slate-200 cursor-pointer"
                              >
                                <Link2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playClick();
                                onJoinRoom(r.code);
                              }}
                              className="px-2.5 py-1.5 rounded-lg cartoon-btn-green text-xs font-display font-black cursor-pointer"
                            >
                              {t(lang, 'joinRoom')}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
};
