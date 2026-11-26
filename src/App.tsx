import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { QrCode, Settings, Volume2, VolumeX, X } from 'lucide-react';
import { ArcadeLobby } from './components/ArcadeLobby';
import { AuthModal } from './components/AuthModal';
import { AvatarSelectModal } from './components/AvatarSelectModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { HowToPlayModal } from './components/HowToPlayModal';
import { InviteQrModal } from './components/InviteQrModal';
import { IslandBackdrop } from './components/IslandBackdrop';
import { LeaderboardPanel } from './components/LeaderboardPanel';
import { MatchSummaryModal } from './components/MatchSummaryModal';
import { ProfilePanel } from './components/ProfilePanel';
import { RoomLobby } from './components/RoomLobby';
import { AppSettings, SettingsModal } from './components/SettingsModal';
import { AvatarId, DEFAULT_AVATAR_ID, getAvatarById, MapSelection } from './engine/avatarsAndMaps';
import { CHAT_COOLDOWN_MS } from './engine/chatFilter';
import { DifficultyTier, GameMode, LevelTrack } from './engine/elo';
import { FireDirection } from './engine/graphWarsEngine';
import { canRematchRoom } from './engine/practiceEngine';
import { SkinId } from './engine/skins';
import { soundEngine } from './engine/sound';
import { Lang, t } from './i18n/translations';
import { isFirebaseConfigured } from './firebase';
import { BattleshipMode } from './modes/BattleshipMode';
import { GraphWarsMode } from './modes/GraphWarsMode';
import { QuizRaceMode } from './modes/QuizRaceMode';
import {
  ensureRegisteredUserDocs,
  loginWithEmail,
  loginWithGoogle,
  logoutRegisteredUser,
  MatchHistoryItem,
  registerEphemeralGuestPresence,
  RegisteredProfile,
  registerWithEmail,
  sendPasswordReset,
  subscribeAuthState,
  subscribeLeaderboard,
  subscribeUserMatchHistory,
  subscribeUserProfile,
  updateUserAvatar,
  updateUserLevelTrack,
} from './services/firebase';
import { multiplayerClient } from './services/multiplayerClient';
import { practiceSession } from './services/practiceSession';
import {
  PlayerIdentity,
  QueueStatus,
  QuizSubmission,
  RoomFullState,
  RoomSummary,
  ServerMessage,
} from './services/multiplayerTypes';

type LobbyOverlay = 'none' | 'leaderboard' | 'profile' | 'avatars' | 'howto';

const SETTINGS_STORAGE_KEY = 'turquation_settings_v3';
const SESSION_GUEST_KEY = 'turquation_guest_session_v1';
const SESSION_ROOM_KEY = 'turquation_active_room_v1';

interface GuestSessionCache {
  id: string;
  nickname: string;
  track: LevelTrack;
  avatarId: AvatarId;
}

function loadGuestSessionCache(): GuestSessionCache {
  const fallback: GuestSessionCache = {
    id: `guest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    nickname: '',
    track: 'TYT',
    avatarId: DEFAULT_AVATAR_ID,
  };
  try {
    const raw = window.sessionStorage.getItem(SESSION_GUEST_KEY);
    if (!raw) {
      window.sessionStorage.setItem(SESSION_GUEST_KEY, JSON.stringify(fallback));
      return fallback;
    }
    const parsed = JSON.parse(raw) as Partial<GuestSessionCache>;
    return {
      id: typeof parsed.id === 'string' && parsed.id.startsWith('guest_') ? parsed.id : fallback.id,
      nickname: typeof parsed.nickname === 'string' ? parsed.nickname.slice(0, 22) : '',
      track: parsed.track === '11_AYT' ? '11_AYT' : 'TYT',
      avatarId: getAvatarById(typeof parsed.avatarId === 'string' ? parsed.avatarId : DEFAULT_AVATAR_ID).id,
    };
  } catch {
    return fallback;
  }
}

function loadInitialSettings(): AppSettings {
  const defaults: AppSettings = {
    theme: 'light',
    gridDensity: 'full',
    particlesEnabled: true,
    muted: false,
  };
  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      gridDensity: parsed.gridDensity === 'minimal' ? 'minimal' : 'full',
      particlesEnabled: typeof parsed.particlesEnabled === 'boolean' ? parsed.particlesEnabled : true,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
    };
  } catch {
    return defaults;
  }
}

function TurquationApp() {
  const [lang, setLang] = useState<Lang>('tr');
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Ephemeral guest state (sessionStorage-only: survives F5 reload, auto-purges when tab closes)
  const initialGuestRef = useRef<GuestSessionCache | null>(null);
  if (!initialGuestRef.current) {
    initialGuestRef.current = loadGuestSessionCache();
  }
  const guestSessionIdRef = useRef<string>(initialGuestRef.current.id);
  const [guestNickname, setGuestNickname] = useState(initialGuestRef.current.nickname);
  const [guestTrack, setGuestTrack] = useState<LevelTrack>(initialGuestRef.current.track);
  const [guestSkinId] = useState<SkinId>('cyan_neon');
  const [guestAvatarId, setGuestAvatarId] = useState<AvatarId>(initialGuestRef.current.avatarId);

  // Registered Firebase Auth + RTDB profile state
  const [registeredProfile, setRegisteredProfile] = useState<RegisteredProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<RegisteredProfile[]>([]);
  const [matchHistory, setMatchHistory] = useState<MatchHistoryItem[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  // Lobby selections & modals
  const [selectedMode, setSelectedMode] = useState<GameMode>('graph_wars');
  const [selectedMap, setSelectedMap] = useState<MapSelection>('cloud_temple');
  const [isRanked, setIsRanked] = useState(false);
  const [activeOverlay, setActiveOverlay] = useState<LobbyOverlay>('none');
  const [inviteQrCode, setInviteQrCode] = useState<string | null>(null);

  // Live serverless RTDB multiplayer + offline Solo Practice state
  const [onlineCount, setOnlineCount] = useState(1);
  const [openRooms, setOpenRooms] = useState<RoomSummary[]>([]);
  const [onlineRoom, setOnlineRoom] = useState<RoomFullState | null>(null);
  const [practiceRoom, setPracticeRoom] = useState<RoomFullState | null>(null);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    inQueue: false,
    waitSeconds: 0,
    eloTolerance: 100,
    queuedCount: 0,
  });
  const [serverError, setServerError] = useState<string | null>(null);
  const [chatCooldownUntilMs, setChatCooldownUntilMs] = useState(0);

  const isPracticeActive = practiceRoom !== null;
  const room = practiceRoom || onlineRoom;

  const guestPresenceCleanupRef = useRef<(() => Promise<void>) | null>(null);
  const authActionInFlightRef = useRef(false);
  const settingsOpenRef = useRef(settingsOpen);
  settingsOpenRef.current = settingsOpen;
  const autoJoinedUrlRoomRef = useRef(false);

  const isRegistered = Boolean(registeredProfile);
  const activeTrack: LevelTrack = registeredProfile ? registeredProfile.levelTrack : guestTrack;
  const activeAvatarId: AvatarId = registeredProfile ? registeredProfile.avatarId : guestAvatarId;
  const activeDifficulty: DifficultyTier = activeTrack === '11_AYT' ? 'strategist' : 'apprentice';

  const activeIdentity: PlayerIdentity = useMemo(
    () =>
      registeredProfile
        ? {
            id: registeredProfile.uid,
            uid: registeredProfile.uid,
            username: registeredProfile.username,
            isGuest: false,
            elo: registeredProfile.elo,
            levelTrack: registeredProfile.levelTrack,
            skinId: registeredProfile.skinId,
            avatarId: registeredProfile.avatarId,
          }
        : {
            id: guestSessionIdRef.current,
            username: guestNickname.trim() || 'Misafir',
            isGuest: true,
            elo: 1000,
            levelTrack: guestTrack,
            skinId: guestSkinId,
            avatarId: guestAvatarId,
          },
    [registeredProfile, guestNickname, guestTrack, guestSkinId, guestAvatarId]
  );

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const flashError = useCallback((msg: string) => {
    setServerError(msg);
    window.setTimeout(() => {
      setServerError((cur) => (cur === msg ? null : cur));
    }, 4000);
  }, []);

  // Enforce unranked-only when logged out / guest
  useEffect(() => {
    if (!isRegistered && isRanked) {
      setIsRanked(false);
    }
  }, [isRegistered, isRanked]);

  // Sync theme class, audio mute state, and persisted user settings
  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
    soundEngine.setMuted(settings.muted);
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignore storage quota / private mode errors
    }
  }, [settings]);

  // Mirror game state to document.body.dataset.state
  useEffect(() => {
    if (!room) {
      document.body.dataset.state = 'title';
    } else if (room.status === 'finished') {
      document.body.dataset.state = 'gameover';
    } else {
      document.body.dataset.state = 'playing';
    }
  }, [room]);

  // Global keyboard shortcuts (M mute, Esc closes modals or opens settings)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (!isTyping && (e.key === 'm' || e.key === 'M')) {
        setSettings((prev) => ({ ...prev, muted: !prev.muted }));
      } else if (!isTyping && e.key === 'Escape') {
        if (inviteQrCode) {
          setInviteQrCode(null);
        } else if (authModalOpen) {
          setAuthModalOpen(false);
        } else if (activeOverlay !== 'none') {
          setActiveOverlay('none');
        } else if (!settingsOpenRef.current) {
          setSettingsOpen(true);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inviteQrCode, authModalOpen, activeOverlay]);

  // Firebase Auth listener for returning registered users
  useEffect(() => {
    const unsub = subscribeAuthState(async (user) => {
      if (!user || authActionInFlightRef.current) return;
      try {
        const profile = await ensureRegisteredUserDocs(user);
        setRegisteredProfile(profile);
      } catch (err) {
        console.error('Auth profile sync error:', err);
      }
    });
    return unsub;
  }, []);

  // Keep ephemeral guest session in sessionStorage so F5 reload preserves nickname & avatar
  useEffect(() => {
    try {
      const cache: GuestSessionCache = {
        id: guestSessionIdRef.current,
        nickname: guestNickname,
        track: guestTrack,
        avatarId: guestAvatarId,
      };
      window.sessionStorage.setItem(SESSION_GUEST_KEY, JSON.stringify(cache));
    } catch {
      // ignore private browsing errors
    }
  }, [guestNickname, guestTrack, guestAvatarId]);

  // Persist active online room code in sessionStorage for automatic F5 rejoin
  useEffect(() => {
    try {
      if (onlineRoom && onlineRoom.code && onlineRoom.status !== 'finished') {
        window.sessionStorage.setItem(SESSION_ROOM_KEY, onlineRoom.code);
      } else {
        window.sessionStorage.removeItem(SESSION_ROOM_KEY);
      }
    } catch {
      // ignore
    }
  }, [onlineRoom?.code, onlineRoom?.status]);

  // Subscribe to offline Solo Practice session state
  useEffect(() => {
    const unsub = practiceSession.subscribe((nextRoom) => {
      setPracticeRoom(nextRoom);
    });
    return () => {
      unsub();
      practiceSession.stop();
    };
  }, []);

  // Public Global Leaderboard subscription (accessible read-only for guests & registered users)
  useEffect(() => {
    const unsubLb = subscribeLeaderboard(
      (entries) => setLeaderboard(entries),
      (err) => console.error('Leaderboard subscription error:', err)
    );
    return unsubLb;
  }, []);

  // Subscribe to live Registered User profile and Match History in RTDB
  useEffect(() => {
    if (!registeredProfile) {
      setMatchHistory([]);
      return;
    }

    const unsubProfile = subscribeUserProfile(registeredProfile.uid, (fresh) => {
      if (fresh) setRegisteredProfile(fresh);
    });
    const unsubHistory = subscribeUserMatchHistory(registeredProfile.uid, (items) => {
      setMatchHistory(items);
    });

    return () => {
      unsubProfile();
      unsubHistory();
    };
  }, [registeredProfile?.uid]);

  // Connect serverless RTDB multiplayer client once on mount and subscribe to live events
  useEffect(() => {
    multiplayerClient.connect(activeIdentity);
    const unsub = multiplayerClient.subscribe((msg: ServerMessage) => {
      switch (msg.type) {
        case 'identified':
          setOnlineCount(msg.onlineCount);
          break;
        case 'online_count':
          setOnlineCount(msg.count);
          break;
        case 'rooms_list':
          setOpenRooms(msg.rooms);
          break;
        case 'room_state':
          setOnlineRoom(msg.room);
          break;
        case 'queue_status':
          setQueueStatus(msg.status);
          break;
        case 'chat_message':
          setOnlineRoom((prev) => {
            if (!prev) return prev;
            if (prev.chat.some((c) => c.id === msg.message.id)) return prev;
            return { ...prev, chat: [...prev.chat.slice(-49), msg.message] };
          });
          break;
        case 'chat_error':
          if (msg.cooldownRemainingMs) {
            setChatCooldownUntilMs(Date.now() + msg.cooldownRemainingMs);
          }
          flashError(msg.error);
          break;
        case 'error':
          flashError(msg.message);
          break;
      }
    });

    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep multiplayerClient synced whenever identity changes (auth, nickname, track, skin, elo)
  useEffect(() => {
    multiplayerClient.send({ type: 'identify', player: activeIdentity });
  }, [activeIdentity]);

  // Helper to validate & register ephemeral guest presence before entering queue/room
  const preparePlayerIdentity = useCallback(
    async (allowAutoName = false): Promise<PlayerIdentity | null> => {
      if (registeredProfile) {
        const id: PlayerIdentity = {
          id: registeredProfile.uid,
          uid: registeredProfile.uid,
          username: registeredProfile.username,
          isGuest: false,
          elo: registeredProfile.elo,
          levelTrack: registeredProfile.levelTrack,
          skinId: registeredProfile.skinId,
          avatarId: registeredProfile.avatarId,
        };
        multiplayerClient.send({ type: 'identify', player: id });
        return id;
      }

      let name = guestNickname.trim();
      if (!name) {
        if (allowAutoName) {
          name = `Oyuncu${Math.floor(100 + Math.random() * 899)}`;
          setGuestNickname(name);
        } else {
          flashError(t(lang, 'errEmptyNickname'));
          return null;
        }
      }

      if (!guestPresenceCleanupRef.current) {
        guestPresenceCleanupRef.current = await registerEphemeralGuestPresence(
          guestSessionIdRef.current,
          name
        );
      }

      const guestId: PlayerIdentity = {
        id: guestSessionIdRef.current,
        username: name,
        isGuest: true,
        elo: 1000,
        levelTrack: guestTrack,
        skinId: guestSkinId,
        avatarId: guestAvatarId,
      };
      multiplayerClient.send({ type: 'identify', player: guestId });
      return guestId;
    },
    [registeredProfile, guestNickname, guestTrack, guestSkinId, guestAvatarId, lang, flashError]
  );

  // Support ?room=KOD Party Invite auto-join and ?autostart=1
  useEffect(() => {
    if (autoJoinedUrlRoomRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    const nickParam = params.get('nick');

    if (nickParam && !guestNickname) {
      setGuestNickname(nickParam.slice(0, 22));
    }

    if (roomParam && /^[A-Za-z0-9]{4,6}$/.test(roomParam.trim())) {
      autoJoinedUrlRoomRef.current = true;
      const code = roomParam.trim().toUpperCase();
      const chosenName = nickParam?.trim() || `Oyuncu${Math.floor(100 + Math.random() * 899)}`;
      setGuestNickname(chosenName);
      window.setTimeout(async () => {
        const guestId: PlayerIdentity = {
          id: guestSessionIdRef.current,
          username: chosenName,
          isGuest: true,
          elo: 1000,
          levelTrack: guestTrack,
          skinId: guestSkinId,
          avatarId: 'flame_knight',
        };
        guestPresenceCleanupRef.current = await registerEphemeralGuestPresence(
          guestId.id,
          guestId.username
        );
        multiplayerClient.send({ type: 'identify', player: guestId });
        multiplayerClient.send({ type: 'join_room', code });
        try {
          const clean = new URL(window.location.href);
          clean.searchParams.delete('room');
          window.history.replaceState({}, '', clean.toString());
        } catch {
          // ignore
        }
      }, 120);
    } else if (params.get('autostart') === '1') {
      autoJoinedUrlRoomRef.current = true;
      setGuestNickname((prev) => prev || 'Oyuncu1');
    } else {
      // Automatic F5 reload recovery into active online room
      try {
        const savedRoomCode = window.sessionStorage.getItem(SESSION_ROOM_KEY);
        if (savedRoomCode && /^[A-Za-z0-9]{4,6}$/.test(savedRoomCode)) {
          autoJoinedUrlRoomRef.current = true;
          window.setTimeout(() => {
            multiplayerClient.send({ type: 'rejoin_room', code: savedRoomCode });
          }, 200);
        }
      } catch {
        // ignore
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatAuthError = (err: unknown): string => {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('operation-not-allowed')) {
      return t(lang, 'errEmailProviderDisabled');
    }
    return msg.replace(/^Firebase:\s*/i, '');
  };

  const handleLoginEmail = async (email: string, password: string) => {
    authActionInFlightRef.current = true;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const profile = await loginWithEmail(email, password);
      if (guestPresenceCleanupRef.current) {
        await guestPresenceCleanupRef.current();
        guestPresenceCleanupRef.current = null;
      }
      setRegisteredProfile(profile);
      setAuthModalOpen(false);
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      authActionInFlightRef.current = false;
      setAuthBusy(false);
    }
  };

  const handleRegisterEmail = async (
    username: string,
    email: string,
    password: string,
    track: LevelTrack
  ) => {
    authActionInFlightRef.current = true;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const profile = await registerWithEmail(username, email, password, track);
      if (guestPresenceCleanupRef.current) {
        await guestPresenceCleanupRef.current();
        guestPresenceCleanupRef.current = null;
      }
      setRegisteredProfile(profile);
      setAuthModalOpen(false);
    } catch (err) {
      setAuthError(formatAuthError(err));
    } finally {
      authActionInFlightRef.current = false;
      setAuthBusy(false);
    }
  };

  const handleLoginGoogle = async (track: LevelTrack) => {
    if (!isFirebaseConfigured) {
      setAuthModalMode('login');
      setAuthModalOpen(true);
      return;
    }
    authActionInFlightRef.current = true;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const profile = await loginWithGoogle(track);
      if (guestPresenceCleanupRef.current) {
        await guestPresenceCleanupRef.current();
        guestPresenceCleanupRef.current = null;
      }
      setRegisteredProfile(profile);
      setAuthModalOpen(false);
    } catch (err) {
      setAuthError(formatAuthError(err));
      setAuthModalOpen(true);
    } finally {
      authActionInFlightRef.current = false;
      setAuthBusy(false);
    }
  };

  const handleResetPassword = async (email: string): Promise<boolean> => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await sendPasswordReset(email);
      return true;
    } catch (err) {
      setAuthError(formatAuthError(err));
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = async () => {
    practiceSession.stop();
    multiplayerClient.send({ type: 'leave_queue' });
    multiplayerClient.send({ type: 'leave_room' });
    await logoutRegisteredUser().catch(() => {});
    setRegisteredProfile(null);
    setIsRanked(false);
    setOnlineRoom(null);
    setPracticeRoom(null);
    setQueueStatus({ inQueue: false, waitSeconds: 0, eloTolerance: 100, queuedCount: 0 });
  };

  const handleChangeTrack = async (track: LevelTrack) => {
    if (registeredProfile) {
      setRegisteredProfile({ ...registeredProfile, levelTrack: track });
      await updateUserLevelTrack(registeredProfile.uid, track).catch(() => {});
    } else {
      setGuestTrack(track);
    }
  };

  const handleSelectAvatar = async (avatarId: AvatarId) => {
    if (registeredProfile) {
      setRegisteredProfile({ ...registeredProfile, avatarId });
      await updateUserAvatar(registeredProfile.uid, avatarId).catch(() => {});
    } else {
      setGuestAvatarId(avatarId);
    }
  };

  const handlePlayMatchmaking = async () => {
    const id = await preparePlayerIdentity(false);
    if (!id) return;
    multiplayerClient.send({
      type: 'join_queue',
      mode: selectedMode,
      difficulty: activeDifficulty,
      isRanked: isRegistered && isRanked,
      mapSelection: selectedMap,
    });
  };

  const handleCreateRoom = async () => {
    const id = await preparePlayerIdentity(false);
    if (!id) return;
    multiplayerClient.send({
      type: 'create_room',
      mode: selectedMode,
      difficulty: activeDifficulty,
      isRanked: isRegistered && isRanked,
      mapSelection: selectedMap,
    });
  };

  const handleJoinRoom = async (code: string) => {
    const id = await preparePlayerIdentity(false);
    if (!id) return;
    multiplayerClient.send({ type: 'join_room', code });
  };

  const handleStartPractice = async () => {
    const id = await preparePlayerIdentity(true);
    if (!id) return;
    multiplayerClient.send({ type: 'leave_queue' });
    practiceSession.start(id, selectedMode, activeDifficulty, selectedMap);
  };

  const handleLeaveActiveRoom = () => {
    if (isPracticeActive) {
      practiceSession.stop();
    } else {
      try {
        window.sessionStorage.removeItem(SESSION_ROOM_KEY);
      } catch {
        // ignore
      }
      multiplayerClient.send({ type: 'leave_room' });
    }
  };

  const handleRematch = () => {
    if (isPracticeActive) {
      practiceSession.rematch();
    } else {
      multiplayerClient.send({ type: 'rematch' });
    }
  };

  const handleSendChat = (text: string) => {
    if (isPracticeActive) {
      practiceSession.sendChat(text);
      return;
    }
    setChatCooldownUntilMs(Date.now() + CHAT_COOLDOWN_MS);
    multiplayerClient.send({ type: 'chat_send', text });
  };

  const roomModeLabel = room
    ? room.mode === 'graph_wars'
      ? t(lang, 'modeGraphWarsTitle')
      : room.mode === 'battleship'
        ? t(lang, 'modeBattleshipTitle')
        : t(lang, 'modeQuizTitle')
    : '';

  return (
    <div className="relative min-h-screen bg-[#A5E3FF] dark:bg-[#0B162C] text-slate-900 dark:text-slate-100">
      <IslandBackdrop
        theme={settings.theme}
        gridDensity={settings.gridDensity}
        paused={Boolean(room)}
      />

      {!room ? (
        <ArcadeLobby
          lang={lang}
          theme={settings.theme}
          muted={settings.muted}
          isRegistered={isRegistered}
          profile={registeredProfile}
          nickname={guestNickname}
          onChangeNickname={setGuestNickname}
          levelTrack={activeTrack}
          onChangeTrack={handleChangeTrack}
          avatarId={activeAvatarId}
          selectedMode={selectedMode}
          onSelectMode={setSelectedMode}
          selectedMap={selectedMap}
          onSelectMap={setSelectedMap}
          isRanked={isRanked}
          onChangeRanked={setIsRanked}
          onlineCount={onlineCount}
          openRooms={openRooms}
          queueStatus={queueStatus}
          onToggleLang={() => setLang((l) => (l === 'tr' ? 'en' : 'tr'))}
          onToggleMute={() => updateSettings({ muted: !settings.muted })}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAuth={(m) => {
            setAuthError(null);
            setAuthModalMode(m);
            setAuthModalOpen(true);
          }}
          onLoginGoogleDirect={() => handleLoginGoogle(activeTrack)}
          onLogout={handleLogout}
          onOpenLeaderboard={() => setActiveOverlay('leaderboard')}
          onOpenProfile={() => setActiveOverlay('profile')}
          onOpenAvatars={() => setActiveOverlay('avatars')}
          onOpenHowToPlay={() => setActiveOverlay('howto')}
          onPlayMatchmaking={handlePlayMatchmaking}
          onStartPractice={handleStartPractice}
          onLeaveQueue={() => multiplayerClient.send({ type: 'leave_queue' })}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenInviteQrForCode={(code) => setInviteQrCode(code)}
          authBusy={authBusy}
          lobbyError={serverError}
        />
      ) : (
        <div className="relative z-10 min-h-screen flex flex-col">
          {/* Compact Cartoon-Arcade In-Room Header */}
          <header className="border-b-2 border-slate-900 dark:border-slate-700 bg-white/95 dark:bg-[#101C2E]/95 px-3 sm:px-6 py-2.5 shadow-sm">
            <div className="max-w-[1400px] mx-auto flex items-center justify-between gap-2 sm:gap-4">
              <div className="flex items-center gap-2.5 text-xs font-mono text-slate-700 dark:text-slate-300 truncate">
                <span className="font-display font-black text-base tracking-tight text-slate-950 dark:text-white truncate">
                  {roomModeLabel}
                </span>
                <span className="text-slate-400">·</span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-300 border-2 border-slate-900 text-slate-950 font-black tracking-wider">
                  {isPracticeActive ? 'SOLO' : `#${room.code}`}
                </span>
                {isPracticeActive && (
                  <span className="hidden md:inline text-[11px] font-mono font-bold text-amber-700 dark:text-amber-300">
                    {t(lang, 'practiceBadge')}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                {(room.status === 'lobby' || room.status === 'countdown') && (
                  <button
                    type="button"
                    onClick={() => setInviteQrCode(room.code)}
                    className="px-2.5 py-1.5 rounded-xl cartoon-btn-sky text-xs font-display font-black flex items-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{t(lang, 'inviteQrBtn')}</span>
                  </button>
                )}

                <span className="hidden md:inline text-xs font-mono text-slate-700 dark:text-slate-300 px-1.5">
                  <strong className="text-slate-950 dark:text-white">
                    {activeIdentity.username}
                  </strong>
                  {' · '}
                  <span
                    className={
                      activeIdentity.isGuest
                        ? 'text-amber-700 dark:text-amber-300 font-bold'
                        : 'text-sky-700 dark:text-sky-300 font-bold'
                    }
                  >
                    {activeIdentity.isGuest ? t(lang, 'guestLabel') : `${activeIdentity.elo} Elo`}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => setLang((l) => (l === 'tr' ? 'en' : 'tr'))}
                  aria-label="Toggle language"
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#172740] text-xs font-mono font-extrabold text-slate-900 dark:text-white cartoon-btn-white cursor-pointer"
                >
                  {lang.toUpperCase()}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playClick();
                    setSettingsOpen(true);
                  }}
                  aria-label={t(lang, 'settingsBtn')}
                  className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-white dark:bg-[#172740] text-xs font-display font-extrabold text-slate-900 dark:text-white cartoon-btn-white flex items-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-sky-600 dark:text-amber-300" />
                  <span className="hidden sm:inline">{t(lang, 'settingsBtn')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => updateSettings({ muted: !settings.muted })}
                  aria-label={settings.muted ? 'Unmute audio' : 'Mute audio'}
                  className="p-1.5 rounded-xl bg-white dark:bg-[#172740] text-slate-900 dark:text-white cartoon-btn-white cursor-pointer"
                >
                  {settings.muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </header>

          {serverError && (
            <div className="max-w-3xl mx-auto mt-3 px-4">
              <div className="px-4 py-2 rounded-xl bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-600 text-xs font-bold text-rose-800 dark:text-rose-200 text-center">
                {serverError}
              </div>
            </div>
          )}

          <main className="flex-1 p-3.5 md:p-5">
            {room.status === 'lobby' || room.status === 'countdown' ? (
              <RoomLobby
                lang={lang}
                room={room}
                myId={activeIdentity.id}
                onToggleReady={() => multiplayerClient.send({ type: 'toggle_ready' })}
                onStartMatch={() => multiplayerClient.send({ type: 'start_match' })}
                onCancelCountdown={() => multiplayerClient.send({ type: 'cancel_countdown' })}
                onChangeMap={(mapSelection) =>
                  multiplayerClient.send({ type: 'set_room_map', mapSelection })
                }
                onLeave={handleLeaveActiveRoom}
                onOpenInviteQr={(code) => setInviteQrCode(code)}
                onSendChat={handleSendChat}
                chatCooldownUntilMs={chatCooldownUntilMs}
              />
            ) : room.mode === 'quiz_race' && room.quiz ? (
              <QuizRaceMode
                lang={lang}
                theme={settings.theme}
                gridDensity={settings.gridDensity}
                room={room}
                myId={activeIdentity.id}
                onSubmit={(submission: QuizSubmission) =>
                  isPracticeActive
                    ? practiceSession.submitQuiz(submission)
                    : multiplayerClient.send({ type: 'quiz_submit', submission })
                }
                onSendChat={handleSendChat}
                chatCooldownUntilMs={chatCooldownUntilMs}
                onLeave={handleLeaveActiveRoom}
              />
            ) : room.mode === 'battleship' && room.battleship ? (
              <BattleshipMode
                lang={lang}
                theme={settings.theme}
                gridDensity={settings.gridDensity}
                room={room}
                myId={activeIdentity.id}
                onPlaceFleet={(equations) =>
                  isPracticeActive
                    ? practiceSession.placeBattleshipFleet(equations)
                    : multiplayerClient.send({ type: 'battleship_place', equations })
                }
                onFireShot={(x, y) =>
                  isPracticeActive
                    ? practiceSession.fireBattleshipShot(x, y)
                    : multiplayerClient.send({ type: 'battleship_fire', x, y })
                }
                onGuessEquation={(equation) =>
                  isPracticeActive
                    ? practiceSession.guessBattleshipEquation(equation)
                    : multiplayerClient.send({ type: 'battleship_guess', equation })
                }
                onSendChat={handleSendChat}
                chatCooldownUntilMs={chatCooldownUntilMs}
                onLeave={handleLeaveActiveRoom}
              />
            ) : room.mode === 'graph_wars' && room.graphWars ? (
              <GraphWarsMode
                lang={lang}
                theme={settings.theme}
                gridDensity={settings.gridDensity}
                particlesEnabled={settings.particlesEnabled}
                room={room}
                myId={activeIdentity.id}
                onLockShot={(
                  soldierId: string,
                  direction: FireDirection,
                  equation: string,
                  usedTytCards: boolean
                ) =>
                  isPracticeActive
                    ? practiceSession.lockGraphWarsShot(soldierId, direction, equation, usedTytCards)
                    : multiplayerClient.send({
                        type: 'graph_wars_lock',
                        soldierId,
                        direction,
                        equation,
                        usedTytCards,
                      })
                }
                onSendChat={handleSendChat}
                chatCooldownUntilMs={chatCooldownUntilMs}
                onLeave={handleLeaveActiveRoom}
              />
            ) : null}
          </main>

          {room.status === 'finished' && room.summary && (
            <MatchSummaryModal
              lang={lang}
              summary={room.summary}
              myId={activeIdentity.id}
              canRematch={
                isPracticeActive ||
                canRematchRoom({
                  status: room.status,
                  activePlayerCount: room.players.filter((p) => !p.disconnected).length,
                  minPlayers: room.minPlayers,
                })
              }
              onRematch={handleRematch}
              onClose={handleLeaveActiveRoom}
            />
          )}
        </div>
      )}

      {/* Lobby Modal Overlays: Leaderboard & Profile */}
      {(activeOverlay === 'leaderboard' || activeOverlay === 'profile') && (
        <div
          className="fixed inset-0 z-50 bg-[#04070D]/80 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setActiveOverlay('none')}
        >
          <div
            className="w-full max-w-4xl max-h-[88vh] overflow-y-auto cartoon-card bg-white dark:bg-[#101C2E] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setActiveOverlay('none')}
                aria-label={t(lang, 'closeSettings')}
                className="p-1.5 rounded-xl border-2 border-slate-900 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {activeOverlay === 'leaderboard' ? (
              <LeaderboardPanel
                lang={lang}
                isGuest={!isRegistered}
                currentUid={registeredProfile?.uid}
                entries={leaderboard}
                onSwitchToAuth={() => {
                  setActiveOverlay('none');
                  setAuthModalMode('register');
                  setAuthModalOpen(true);
                }}
              />
            ) : (
              <ProfilePanel
                lang={lang}
                isGuest={!isRegistered}
                guestName={guestNickname.trim() || t(lang, 'guestLabel')}
                guestTrack={guestTrack}
                avatarId={activeAvatarId}
                onChangeTrack={handleChangeTrack}
                profile={registeredProfile}
                history={matchHistory}
                onSwitchToAuth={() => {
                  setActiveOverlay('none');
                  setAuthModalMode('register');
                  setAuthModalOpen(true);
                }}
              />
            )}
          </div>
        </div>
      )}

      <AvatarSelectModal
        open={activeOverlay === 'avatars'}
        lang={lang}
        theme={settings.theme}
        selectedAvatarId={activeAvatarId}
        onSelectAvatar={handleSelectAvatar}
        onClose={() => setActiveOverlay('none')}
      />

      <HowToPlayModal
        open={activeOverlay === 'howto'}
        lang={lang}
        onClose={() => setActiveOverlay('none')}
      />

      <AuthModal
        open={authModalOpen}
        initialMode={authModalMode}
        lang={lang}
        defaultTrack={activeTrack}
        authError={authError}
        authBusy={authBusy}
        onClose={() => setAuthModalOpen(false)}
        onLoginEmail={handleLoginEmail}
        onRegisterEmail={handleRegisterEmail}
        onLoginGoogle={handleLoginGoogle}
        onResetPassword={handleResetPassword}
      />

      <InviteQrModal
        open={Boolean(inviteQrCode)}
        roomCode={inviteQrCode || ''}
        lang={lang}
        onClose={() => setInviteQrCode(null)}
      />

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        lang={lang}
        onChangeLang={setLang}
        settings={settings}
        onUpdateSettings={updateSettings}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TurquationApp />
    </ErrorBoundary>
  );
}
