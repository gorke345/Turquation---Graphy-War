import React, { useState } from 'react';
import { Check, Compass, Copy, Play, QrCode, Users } from 'lucide-react';
import { ARENA_MAPS, getArenaMapById, MapSelection } from '../engine/avatarsAndMaps';
import { soundEngine } from '../engine/sound';
import { Lang, t } from '../i18n/translations';
import { RoomFullState } from '../services/multiplayerTypes';
import { ArenaChat } from './ArenaChat';
import { AvatarIllustration, MapPreviewSvg } from './AvatarIllustration';
import { MatchCountdownOverlay } from './MatchCountdownOverlay';

interface RoomLobbyProps {
  lang: Lang;
  room: RoomFullState;
  myId: string;
  onToggleReady: () => void;
  onStartMatch: () => void;
  onCancelCountdown?: () => void;
  onChangeMap?: (mapSelection: MapSelection) => void;
  onLeave: () => void;
  onOpenInviteQr: (code: string) => void;
  onSendChat: (text: string) => void;
  chatCooldownUntilMs: number;
}

const ROOM_MAP_CHOICES: MapSelection[] = [
  'random',
  'cloud_temple',
  'glacier_peak',
  'volcano_crater',
  'desert_pyramid',
];

export const RoomLobby: React.FC<RoomLobbyProps> = ({
  lang,
  room,
  myId,
  onToggleReady,
  onStartMatch,
  onCancelCountdown,
  onChangeMap,
  onLeave,
  onOpenInviteQr,
  onSendChat,
  chatCooldownUntilMs,
}) => {
  const [copied, setCopied] = useState(false);
  const isHost = room.hostId === myId;
  const me = room.players.find((p) => p.id === myId);
  const isCountingDown = room.status === 'countdown' && Boolean(room.countdown);
  const hasEnoughPlayers = room.players.length >= room.minPlayers;
  const canStart = hasEnoughPlayers && !isCountingDown;
  const activeMap = getArenaMapById(room.mapId);
  const currentMapSelection: MapSelection = room.mapSelection || room.mapId;

  const modeName =
    room.mode === 'quiz_race'
      ? t(lang, 'modeQuizTitle')
      : room.mode === 'battleship'
        ? t(lang, 'modeBattleshipTitle')
        : t(lang, 'modeGraphWarsTitle');

  const handleCopy = () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.searchParams.set('room', room.code);
    navigator.clipboard?.writeText(url.toString()).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      <div className="lg:col-span-7 cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-5 sm:p-6 space-y-5">
        {/* Top Room Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-slate-200 dark:border-slate-700 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-display font-black tracking-tight text-slate-950 dark:text-white">
                {modeName}
              </h2>
              <span className="px-2.5 py-0.5 rounded-lg bg-amber-300 border-2 border-slate-900 text-slate-950 text-[10px] font-mono font-extrabold uppercase">
                {room.isRanked ? t(lang, 'ranked') : t(lang, 'unranked')}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div
              data-testid="room-code-display"
              className="px-3.5 py-2 rounded-xl bg-sky-100 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-sky-400 font-mono text-base font-black tracking-[0.2em] text-sky-950 dark:text-amber-300 tabular-nums"
            >
              {room.code}
            </div>
            <button
              type="button"
              onClick={handleCopy}
              title={t(lang, 'copyInviteLink')}
              aria-label={t(lang, 'copyInviteLink')}
              className="p-2.5 rounded-xl bg-white dark:bg-[#172740] text-slate-800 dark:text-white cartoon-btn-white cursor-pointer"
            >
              {copied ? (
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
            <button
              type="button"
              onClick={() => onOpenInviteQr(room.code)}
              data-testid="room-invite-qr-btn"
              className="px-3.5 py-2 rounded-xl cartoon-btn-sky font-display font-black text-xs flex items-center gap-1.5 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>{t(lang, 'inviteQrBtn')}</span>
            </button>
          </div>
        </div>

        {/* Active Arena Map Card (Host can switch maps directly in lobby!) */}
        {room.mode === 'graph_wars' && (
          <div className="p-3.5 rounded-2xl bg-sky-50/90 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-sky-700 dark:text-amber-300" />
                <span className="text-xs font-display font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  {t(lang, 'mapSelectorTitle')}:
                </span>
                <span className="text-xs font-display font-black text-sky-700 dark:text-amber-300">
                  {lang === 'tr' ? activeMap.nameTr : activeMap.nameEn}
                </span>
              </div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
                {lang === 'tr' ? activeMap.subtitleTr : activeMap.subtitleEn}
              </span>
            </div>

            {isHost && onChangeMap && !isCountingDown ? (
              <div className="grid grid-cols-5 gap-1.5">
                {ROOM_MAP_CHOICES.map((mId) => {
                  const selected = currentMapSelection === mId;
                  const meta = mId === 'random' ? null : ARENA_MAPS.find((m) => m.id === mId);
                  const lbl =
                    mId === 'random'
                      ? t(lang, 'mapRandomLabel')
                      : lang === 'tr'
                        ? meta!.nameTr.split(' ')[0]
                        : meta!.nameEn.split(' ')[0];
                  return (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => {
                        soundEngine.playClick();
                        onChangeMap(mId);
                      }}
                      className={`rounded-xl overflow-hidden border-2 cursor-pointer transition-transform ${
                        selected
                          ? 'border-slate-900 dark:border-amber-300 shadow-[0_2px_0_#0f172a] -translate-y-0.5 ring-2 ring-amber-400'
                          : 'border-slate-300 dark:border-slate-700 opacity-85 hover:opacity-100'
                      }`}
                    >
                      <MapPreviewSvg mapId={mId} className="w-full h-10 block" />
                      <div
                        className={`py-0.5 text-[10px] font-display font-extrabold text-center truncate ${
                          selected
                            ? 'bg-amber-300 text-slate-950'
                            : 'bg-white dark:bg-[#101C2E] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {lbl}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-28 rounded-xl overflow-hidden border-2 border-slate-900 shrink-0">
                  <MapPreviewSvg mapId={room.mapId} className="w-full h-12 block" />
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {lang === 'tr' ? activeMap.subtitleTr : activeMap.subtitleEn}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Real Connected Players with Cartoon Avatar Portraits */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
            <span className="flex items-center gap-1.5 font-display font-black text-slate-900 dark:text-white">
              <Users className="w-4 h-4 text-sky-600 dark:text-amber-300" />
              <span>
                {t(lang, 'playersCount')}:{' '}
                <span className="font-mono tabular-nums">
                  {room.players.length}/{room.maxPlayers}
                </span>
              </span>
            </span>
            <span className="font-mono text-[11px] font-bold">
              {isCountingDown
                ? t(lang, 'countdownTitle')
                : hasEnoughPlayers
                  ? lang === 'tr'
                    ? 'Başlamaya Hazır'
                    : 'Ready to Start'
                  : t(lang, 'needMinPlayers', { n: room.minPlayers })}
            </span>
          </div>

          <div className="space-y-2">
            {room.players.map((p) => (
              <div
                key={p.id}
                className="px-3.5 py-2.5 rounded-2xl bg-sky-50/75 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-700 flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-11 h-11 rounded-xl border-2 border-slate-900 flex items-center justify-center shrink-0"
                    style={{ backgroundColor: p.color }}
                  >
                    <AvatarIllustration avatarId={p.avatarId} className="w-9 h-9" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-display font-black text-slate-950 dark:text-white">
                        {p.username}
                      </span>
                      {p.id === room.hostId && (
                        <span className="px-1.5 py-0.5 rounded-md bg-amber-300 border border-slate-900 text-[10px] font-mono font-extrabold text-slate-950">
                          {t(lang, 'hostBadge')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-mono font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {p.isGuest ? t(lang, 'guestLabel') : `${p.elo} Elo`} ·{' '}
                      {p.levelTrack === '11_AYT' ? '11/AYT' : 'TYT'}
                    </div>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-lg border-2 text-xs font-mono font-extrabold shrink-0 ${
                    p.ready
                      ? 'bg-emerald-100 dark:bg-emerald-950/70 border-slate-900 dark:border-emerald-400 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {p.ready ? t(lang, 'readyToggle') : t(lang, 'notReady')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Lobby Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <button
            type="button"
            onClick={onLeave}
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-[#172740] text-xs font-display font-black text-slate-800 dark:text-slate-100 cartoon-btn-white cursor-pointer"
          >
            {t(lang, 'leaveRoom')}
          </button>

          <div className="flex items-center gap-2.5">
            {!isHost && (
              <button
                type="button"
                disabled={isCountingDown}
                onClick={onToggleReady}
                className={`px-4 py-2.5 rounded-xl text-xs font-display font-black cursor-pointer disabled:opacity-50 ${
                  me?.ready
                    ? 'cartoon-btn-green'
                    : 'bg-white dark:bg-[#172740] text-slate-900 dark:text-white cartoon-btn-white'
                }`}
              >
                {me?.ready ? t(lang, 'readyToggle') : t(lang, 'notReady')}
              </button>
            )}

            {isHost && (
              <button
                type="button"
                disabled={!canStart}
                onClick={onStartMatch}
                data-testid="start-match-btn"
                className={`px-6 py-2.5 rounded-xl font-display font-black text-sm flex items-center gap-2 cursor-pointer ${
                  canStart
                    ? 'cartoon-btn-green'
                    : 'bg-slate-200 dark:bg-slate-800 border-2 border-slate-400 text-slate-500 cursor-not-allowed'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{t(lang, 'startMatch')}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Chat in GRAPH WARS Lobby (or Room Info) */}
      <div className="lg:col-span-5 h-[440px]">
        {room.mode === 'graph_wars' ? (
          <ArenaChat
            lang={lang}
            messages={room.chat}
            myId={myId}
            onSend={onSendChat}
            cooldownUntilMs={chatCooldownUntilMs}
          />
        ) : (
          <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-5 space-y-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <h3 className="text-sm font-display font-black text-slate-950 dark:text-white">
              {t(lang, 'waitingPlayers')}
            </h3>
            <p>
              {lang === 'tr'
                ? `Bu oda %100 gerçek oyuncularla çalışır. Davet & QR butonuna tıklayıp bağlantıyı arkadaşınla paylaş veya ikinci bir tarayıcı sekmesinden ?room=${room.code} ile katıl.`
                : `This room runs strictly with 100% real players (zero bots). Click Invite & QR to share the link or join from another tab/device via ?room=${room.code}.`}
            </p>
          </div>
        )}
      </div>

      {/* Synchronized Match Launch Countdown Overlay */}
      {isCountingDown && room.countdown && (
        <MatchCountdownOverlay
          lang={lang}
          room={room}
          countdown={room.countdown}
          isHost={isHost}
          onCancel={onCancelCountdown}
        />
      )}
    </div>
  );
};
