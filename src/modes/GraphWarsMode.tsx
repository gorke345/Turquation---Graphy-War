import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Compass,
  Crosshair,
  Flame,
  Lock,
  Sparkles,
  Target,
} from 'lucide-react';
import { ArenaChat } from '../components/ArenaChat';
import { AvatarIllustration } from '../components/AvatarIllustration';
import { MathKeypad } from '../components/MathKeypad';
import { GridDensity, ThemeMode } from '../components/SettingsModal';
import {
  ArenaMapId,
  CharacterAvatar,
  DEFAULT_MAP_ID,
  drawAvatarSprite,
  drawThemedArenaBackground,
  drawThemedObstacle,
  getArenaMapById,
  getAvatarById,
} from '../engine/avatarsAndMaps';
import { getCountdownBeepParams } from '../engine/countdown';
import {
  buildTytCardEquation,
  FireDirection,
  getDefaultFireDirection,
  GW_HIT_RADIUS,
  GW_X_MAX,
  GW_X_MIN,
  GW_Y_MAX,
  GW_Y_MIN,
  traceAimPreview,
  TytCardFamily,
} from '../engine/graphWarsEngine';
import { compileMathFunction } from '../engine/mathParser';
import { soundEngine } from '../engine/sound';
import { Lang, t } from '../i18n/translations';
import { RoomFullState } from '../services/multiplayerTypes';

interface GraphWarsModeProps {
  lang: Lang;
  theme: ThemeMode;
  gridDensity: GridDensity;
  particlesEnabled: boolean;
  room: RoomFullState;
  myId: string;
  onLockShot: (
    soldierId: string,
    direction: FireDirection,
    equation: string,
    usedTytCards: boolean
  ) => void;
  onSendChat: (text: string) => void;
  chatCooldownUntilMs: number;
  onLeave: () => void;
}

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  shape: CharacterAvatar['burstShape'];
}

const MAX_PARTICLES = 180;
const TYT_FAMILIES: TytCardFamily[] = ['parabola', 'linear', 'abs', 'wave'];
const TYT_A_CARDS = [-0.15, -0.08, -0.04, 0.04, 0.08, 0.15];
const TYT_A_LINEAR_WAVE = [-1.5, -0.8, -0.4, 0.4, 0.8, 1.5];
const TYT_H_CARDS = [-12, -6, -2, 0, 2, 6, 12];

export const GraphWarsMode: React.FC<GraphWarsModeProps> = ({
  lang,
  theme,
  gridDensity,
  particlesEnabled,
  room,
  myId,
  onLockShot,
  onSendChat,
  chatCooldownUntilMs,
  onLeave,
}) => {
  const gw = room.graphWars!;
  const players = Array.isArray(room.players) ? room.players : [];
  const activeMapId: ArenaMapId = gw.mapId || room.mapId || DEFAULT_MAP_ID;
  const activeMapMeta = getArenaMapById(activeMapId);
  const me = players.find((p) => p.id === myId);
  const canUseTytCards = me?.levelTrack === 'TYT';
  const myAliveSoldiers = useMemo(
    () => (Array.isArray(me?.soldiers) ? me.soldiers : []).filter((s) => s && s.alive),
    [me?.soldiers]
  );
  const enemySoldiers = useMemo(
    () =>
      players
        .filter((p) => p && p.id !== myId)
        .flatMap((p) => (Array.isArray(p.soldiers) ? p.soldiers : [])),
    [players, myId]
  );

  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedSoldierId, setSelectedSoldierId] = useState<string>('');
  const [direction, setDirection] = useState<FireDirection>(1);
  const [equation, setEquation] = useState('-0.04*x^2 + 0.35*x');
  const [useTytCards, setUseTytCards] = useState(false);
  const [tytFamily, setTytFamily] = useState<TytCardFamily>('parabola');
  const [cardA, setCardA] = useState(-0.04);
  const [cardH, setCardH] = useState(0);
  const [eqError, setEqError] = useState<string | null>(null);
  const [multiKillBanner, setMultiKillBanner] = useState<{
    shooter: string;
    count: number;
  } | null>(null);

  useEffect(() => {
    if (myAliveSoldiers.length === 0) return;
    const stillAlive = myAliveSoldiers.some((s) => s.id === selectedSoldierId);
    if (!stillAlive) {
      const first = myAliveSoldiers[0];
      setSelectedSoldierId(first.id);
      setDirection(getDefaultFireDirection(first, enemySoldiers));
    }
  }, [myAliveSoldiers, selectedSoldierId, enemySoldiers]);

  const activeSoldier = useMemo(
    () =>
      myAliveSoldiers.find((s) => s.id === selectedSoldierId) ||
      myAliveSoldiers[0] ||
      null,
    [myAliveSoldiers, selectedSoldierId]
  );

  const handleSelectTytFamily = (fam: TytCardFamily) => {
    setTytFamily(fam);
    if (fam === 'parabola') {
      if (!TYT_A_CARDS.includes(cardA)) setCardA(-0.04);
    } else {
      if (!TYT_A_LINEAR_WAVE.includes(cardA)) setCardA(0.4);
    }
  };

  const activeEquation =
    useTytCards && canUseTytCards
      ? buildTytCardEquation({ family: tytFamily, a: cardA, h: cardH })
      : equation;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const eqInputRef = useRef<HTMLInputElement | null>(null);
  const transformRef = useRef({ cx: 450, cy: 260, scale: 14 });
  const roomRef = useRef(room);
  roomRef.current = room;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const gridRef = useRef(gridDensity);
  gridRef.current = gridDensity;
  const particlesRef = useRef(particlesEnabled);
  particlesRef.current = particlesEnabled;
  const activeEqRef = useRef(activeEquation);
  activeEqRef.current = activeEquation;
  const activeSoldierRef = useRef(activeSoldier);
  activeSoldierRef.current = activeSoldier;
  const directionRef = useRef(direction);
  directionRef.current = direction;

  const animRef = useRef({
    firingStartMs: 0,
    lastRoundPhase: '',
    hitstop: 0,
    trauma: 0,
    triggeredHits: new Set<string>(),
    particles: Array.from(
      { length: MAX_PARTICLES },
      (): Particle => ({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        color: '#0EA5E9',
        size: 3.5,
        shape: 'diamond',
      })
    ),
    particleCursor: 0,
  });

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Accelerating & louder warning beep in the final 8 seconds of aim phase if shot not locked yet
  useEffect(() => {
    if (gw.phase !== 'aim' || me?.shotLocked || !me?.alive) return;
    let timerId: number | null = null;
    let cancelled = false;

    const scheduleNext = () => {
      if (cancelled) return;
      const rem = gw.endsAt - Date.now();
      if (rem <= 0) return;
      if (rem > 8_000) {
        timerId = window.setTimeout(scheduleNext, Math.min(500, rem - 7_950));
        return;
      }
      const params = getCountdownBeepParams(rem, 8_000);
      if (params.active) {
        soundEngine.playUrgentBeep(params);
        timerId = window.setTimeout(scheduleNext, params.intervalMs);
      }
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (timerId !== null) clearTimeout(timerId);
    };
  }, [gw.phase, gw.endsAt, gw.round, me?.shotLocked, me?.alive]);

  useEffect(() => {
    const key = `${gw.round}_${gw.phase}`;
    if (animRef.current.lastRoundPhase !== key) {
      animRef.current.lastRoundPhase = key;
      if (gw.phase === 'firing') {
        animRef.current.firingStartMs = performance.now();
        animRef.current.triggeredHits.clear();
        soundEngine.playLaunch();

        const safeTrajs = Array.isArray(gw.trajectories) ? gw.trajectories : [];
        const bestMulti = safeTrajs.reduce<{ shooter: string; count: number } | null>(
          (best, tr) => {
            const hits = Array.isArray(tr?.hits) ? tr.hits : [];
            if (hits.length >= 2 && (!best || hits.length > best.count)) {
              const p = players.find((pl) => pl.id === tr.playerId);
              return { shooter: p?.username || 'Player', count: hits.length };
            }
            return best;
          },
          null
        );
        setMultiKillBanner(bestMulti);
      } else {
        setMultiKillBanner(null);
      }
    }
  }, [gw.round, gw.phase, gw.trajectories, room.players]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (gw.phase !== 'aim' || me?.shotLocked || myAliveSoldiers.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const { cx, cy, scale } = transformRef.current;

    let closestId: string | null = null;
    let closestDist = 32;
    for (const s of myAliveSoldiers) {
      const px = cx + s.x * scale;
      const py = cy - s.y * scale;
      const dist = Math.hypot(clickX - px, clickY - py);
      if (dist < closestDist) {
        closestDist = dist;
        closestId = s.id;
      }
    }

    if (closestId) {
      const chosen = myAliveSoldiers.find((s) => s.id === closestId);
      if (chosen) {
        soundEngine.playClick();
        setSelectedSoldierId(chosen.id);
        setDirection(getDefaultFireDirection(chosen, enemySoldiers));
      }
    }
  };

  // Isolated 60 FPS Canvas2D Themed Map + Character Units Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let timerId = 0;
    let disposed = false;
    let lastNow = performance.now();

    const spawnBurst = (
      wx: number,
      wy: number,
      colors: string[],
      shape: CharacterAvatar['burstShape'],
      count: number
    ) => {
      if (!particlesRef.current) return;
      const anim = animRef.current;
      const safeColors = Array.isArray(colors) && colors.length > 0 ? colors : ['#F97316'];
      for (let i = 0; i < count; i++) {
        const p = anim.particles[anim.particleCursor];
        anim.particleCursor = (anim.particleCursor + 1) % MAX_PARTICLES;
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.45;
        const speed = 2.6 + Math.random() * 7.2;
        p.active = true;
        p.x = wx;
        p.y = wy;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0;
        p.maxLife = 0.48 + Math.random() * 0.42;
        p.color = safeColors[i % safeColors.length] || '#F97316';
        p.size = 3 + Math.random() * 3.2;
        p.shape = shape;
      }
    };

    let viewW = 920;
    let viewH = 540;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      viewW = Math.max(1, rect.width);
      viewH = Math.max(1, rect.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.max(1, Math.floor(viewW * dpr));
      canvas.height = Math.max(1, Math.floor(viewH * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const renderFrame = (now: number) => {
      const rawDt = (now - lastNow) / 1000;
      lastNow = now;
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      const anim = animRef.current;
      const currentRoom = roomRef.current;
      const currentGw = currentRoom.graphWars;
      if (!currentGw) {
        rafId = requestAnimationFrame(renderFrame);
        return;
      }

      const isDark = themeRef.current === 'dark';
      const minimalGrid = gridRef.current === 'minimal';
      const mapId: ArenaMapId = currentGw.mapId || currentRoom.mapId || DEFAULT_MAP_ID;
      const mapTheme = getArenaMapById(mapId);

      if (anim.hitstop > 0) {
        anim.hitstop = Math.max(0, anim.hitstop - dt);
      }
      const simDt = anim.hitstop > 0 ? 0 : dt;
      anim.trauma = Math.max(0, anim.trauma - dt * 2.4);

      const w = viewW;
      const h = viewH;
      const pad = 26;
      const scaleX = (w - pad * 2) / (GW_X_MAX - GW_X_MIN);
      const scaleY = (h - pad * 2) / (GW_Y_MAX - GW_Y_MIN);
      const scale = Math.min(scaleX, scaleY);
      const cx = w / 2;
      const cy = h / 2;
      transformRef.current = { cx, cy, scale };

      const shakeMag = anim.trauma * anim.trauma * 9;
      const shakeX = (Math.random() - 0.5) * 2 * shakeMag;
      const shakeY = (Math.random() - 0.5) * 2 * shakeMag;

      const toScreen = (x: number, y: number) => ({
        px: cx + x * scale + shakeX,
        py: cy - y * scale + shakeY,
      });

      // 1. Themed Cartoon-Arcade Island Arena Background
      drawThemedArenaBackground(ctx, mapId, w, h, isDark);

      // Arena boundary box [-25, 25] x [-15, 15]
      const topLeft = toScreen(GW_X_MIN, GW_Y_MAX);
      const botRight = toScreen(GW_X_MAX, GW_Y_MIN);
      ctx.strokeStyle = isDark ? mapTheme.borderDark : mapTheme.borderLight;
      ctx.lineWidth = 2;
      ctx.strokeRect(
        topLeft.px,
        topLeft.py,
        botRight.px - topLeft.px,
        botRight.py - topLeft.py
      );

      // 2. Coordinate Grid Lines (themed & razor readable)
      const gridStep = minimalGrid ? 5 : 2.5;
      ctx.lineWidth = 1;
      for (let gx = GW_X_MIN; gx <= GW_X_MAX; gx += gridStep) {
        const isAxis = Math.abs(gx) < 1e-6;
        const isMajor = Math.abs(gx % 5) < 1e-6;
        const { px } = toScreen(gx, 0);
        ctx.strokeStyle = isAxis
          ? isDark
            ? mapTheme.gridAxisDark
            : mapTheme.gridAxisLight
          : isMajor
            ? isDark
              ? mapTheme.gridMajorDark
              : mapTheme.gridMajorLight
            : isDark
              ? mapTheme.gridMinorDark
              : mapTheme.gridMinorLight;
        ctx.lineWidth = isAxis ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(px, topLeft.py);
        ctx.lineTo(px, botRight.py);
        ctx.stroke();
      }

      for (let gy = GW_Y_MIN; gy <= GW_Y_MAX; gy += gridStep) {
        const isAxis = Math.abs(gy) < 1e-6;
        const isMajor = Math.abs(gy % 5) < 1e-6;
        const { py } = toScreen(0, gy);
        ctx.strokeStyle = isAxis
          ? isDark
            ? mapTheme.gridAxisDark
            : mapTheme.gridAxisLight
          : isMajor
            ? isDark
              ? mapTheme.gridMajorDark
              : mapTheme.gridMajorLight
            : isDark
              ? mapTheme.gridMinorDark
              : mapTheme.gridMinorLight;
        ctx.lineWidth = isAxis ? 1.8 : 1;
        ctx.beginPath();
        ctx.moveTo(topLeft.px, py);
        ctx.lineTo(botRight.px, py);
        ctx.stroke();
      }

      // Numeric tick labels every 5 units
      ctx.fillStyle = isDark ? mapTheme.tickDark : mapTheme.tickLight;
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let gx = GW_X_MIN; gx <= GW_X_MAX; gx += 5) {
        if (gx === 0) continue;
        const { px } = toScreen(gx, 0);
        ctx.fillText(String(gx), px, cy + 5 + shakeY);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let gy = GW_Y_MIN; gy <= GW_Y_MAX; gy += 5) {
        if (gy === 0) continue;
        const { py } = toScreen(0, gy);
        ctx.fillText(String(gy), cx - 6 + shakeX, py);
      }

      // 3. Themed Cartoon-Outlined Obstacles (snug to exact mathematical collision radius obs.r!)
      const safeObstacles = currentGw.obstacles || [];
      for (const obs of safeObstacles) {
        const { px, py } = toScreen(obs.x, obs.y);
        const rad = obs.r * scale;
        drawThemedObstacle(ctx, mapId, obs, px, py, rad, isDark);
      }

      // 4. Impact Craters
      for (const crater of currentGw.craters || []) {
        const { px, py } = toScreen(crater.x, crater.y);
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(px, py, Math.max(3.2, 0.34 * scale), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#F97316';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // 5. Short directional auto-aligned aim preview (~4.6 units) ONLY during aim phase
      const mySoldier = activeSoldierRef.current;
      if (currentGw.phase === 'aim' && mySoldier && mySoldier.alive) {
        const previewRes = traceAimPreview(
          activeEqRef.current,
          mySoldier,
          directionRef.current
        );
        const previewPts = Array.isArray(previewRes?.points) ? previewRes.points : [];
        if (previewRes.ok && previewPts.length >= 2) {
          const selfPlayer = (Array.isArray(currentRoom.players) ? currentRoom.players : []).find(
            (p) => p.id === myId
          );
          const selfAvatar = getAvatarById(selfPlayer?.avatarId);
          ctx.save();
          ctx.strokeStyle = selfPlayer?.color || selfAvatar.trailColor;
          ctx.lineWidth = 3.2;
          ctx.setLineDash([7, 4]);
          ctx.beginPath();
          previewPts.forEach((pt, idx) => {
            const { px, py } = toScreen(pt.x, pt.y);
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();

          const lastPt = previewPts[previewPts.length - 1];
          const tipScr = toScreen(lastPt.x, lastPt.y);
          ctx.setLineDash([]);
          ctx.fillStyle = '#FACC15';
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.arc(tipScr.px, tipScr.py, 4.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }

      // 6. Simultaneous Firing Animation (character-themed curve trail + impact bursts)
      if (currentGw.phase === 'firing') {
        const elapsed = (now - anim.firingStartMs) / 1000;
        const progress = Math.min(1, elapsed / 3.0);

        const safeRoomPlayers = Array.isArray(currentRoom.players) ? currentRoom.players : [];
        for (const traj of Array.isArray(currentGw.trajectories) ? currentGw.trajectories : []) {
          const pts = traj?.path;
          if (!Array.isArray(pts) || pts.length < 2) continue;
          const shooterPlayer = safeRoomPlayers.find((pl) => pl.id === traj.playerId);
          const avatar = getAvatarById(traj.avatarId || shooterPlayer?.avatarId);
          const maxIdx = Math.max(2, Math.floor(pts.length * progress));

          ctx.save();
          // Outer soft trail ribbon
          ctx.strokeStyle = avatar.trailGlow;
          ctx.lineWidth = 9;
          ctx.lineCap = 'round';
          ctx.beginPath();
          for (let i = 0; i < maxIdx; i++) {
            const { px, py } = toScreen(pts[i].x, pts[i].y);
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.stroke();

          // Core comic curve stroke
          ctx.strokeStyle = traj.color || avatar.trailColor;
          ctx.lineWidth = 3.4;
          ctx.stroke();

          // Leading projectile head
          const tip = pts[Math.min(pts.length - 1, maxIdx - 1)];
          const tipScr = toScreen(tip.x, tip.y);
          ctx.fillStyle = '#FFFFFF';
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(tipScr.px, tipScr.py, 5.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          if (traj.stopReason === 'obstacle' && traj.impactPoint && progress >= 0.92) {
            const cKey = `crater_${traj.playerId}_${traj.soldierId}`;
            if (!anim.triggeredHits.has(cKey)) {
              anim.triggeredHits.add(cKey);
              spawnBurst(
                traj.impactPoint.x,
                traj.impactPoint.y,
                avatar.burstColors,
                avatar.burstShape,
                16
              );
            }
          }

          for (const hit of traj.hits || []) {
            const hKey = `hit_${traj.playerId}_${hit.soldierId}`;
            if (anim.triggeredHits.has(hKey)) continue;
            const hitRatio =
              pts.length > 1
                ? Math.min(
                    0.96,
                    Math.max(
                      0.15,
                      Math.abs(hit.point.x - pts[0].x) /
                        Math.max(1, Math.abs(pts[pts.length - 1].x - pts[0].x))
                    )
                  )
                : 0.7;
            if (progress >= hitRatio) {
              anim.triggeredHits.add(hKey);
              spawnBurst(
                hit.point.x,
                hit.point.y,
                avatar.burstColors,
                avatar.burstShape,
                28
              );
              if (particlesRef.current) {
                anim.hitstop = 0.05;
                anim.trauma = 0.85;
              }
              soundEngine.playHit();
            }
          }
        }
      }

      // 7. Draw All Players' Units with Compact Crisp Sizing, Selected-On-Top Ordering & Collision-Avoiding Labels
      const soldierPxRadius = Math.min(13.5, Math.max(9.5, GW_HIT_RADIUS * scale * 0.8));

      interface RenderSoldierItem {
        id: string;
        ownerId: string;
        username: string;
        avatarId: CharacterAvatar['id'];
        teamColor: string;
        soldierNumber: number;
        x: number;
        y: number;
        px: number;
        py: number;
        alive: boolean;
        isSelected: boolean;
        showLabel: boolean;
      }

      const renderItems: RenderSoldierItem[] = [];
      for (const pl of Array.isArray(currentRoom.players) ? currentRoom.players : []) {
        if (!pl) continue;
        const isSelf = pl.id === myId;
        const avatar = getAvatarById(pl.avatarId);
        const teamColor = pl.color || avatar.primary;
        const soldiers = Array.isArray(pl.soldiers) ? pl.soldiers : [];
        const firstAliveIdx = soldiers.findIndex((item) => item && item.alive);
        const hasSelected = isSelf && soldiers.some((item) => item && item.alive && item.id === activeSoldierRef.current?.id);

        for (let idx = 0; idx < soldiers.length; idx++) {
          const s = soldiers[idx];
          if (!s) continue;
          const { px, py } = toScreen(s.x, s.y);
          const isSelected = isSelf && activeSoldierRef.current?.id === s.id;
          // Show owner nameplate on selected soldier (for self) or first alive unit (for others)
          const showLabel = isSelected || (!hasSelected && idx === firstAliveIdx);
          renderItems.push({
            id: s.id,
            ownerId: pl.id,
            username: pl.username || 'Oyuncu',
            avatarId: avatar.id,
            teamColor,
            soldierNumber: idx + 1,
            x: s.x,
            y: s.y,
            px,
            py,
            alive: s.alive,
            isSelected,
            showLabel,
          });
        }
      }

      // 7a. Dead soldier X markers underneath
      for (const item of renderItems) {
        if (item.alive) continue;
        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(148, 163, 184, 0.45)' : 'rgba(71, 85, 105, 0.5)';
        ctx.lineWidth = 2.2;
        ctx.beginPath();
        ctx.moveTo(item.px - 5, item.py - 5);
        ctx.lineTo(item.px + 5, item.py + 5);
        ctx.moveTo(item.px + 5, item.py - 5);
        ctx.lineTo(item.px - 5, item.py + 5);
        ctx.stroke();
        ctx.restore();
      }

      // 7b. Alive soldiers: draw non-selected first, active selected unit last so it's always crisp on top
      const aliveItems = renderItems
        .filter((item) => item.alive)
        .sort((a, b) => Number(a.isSelected) - Number(b.isSelected));

      for (const item of aliveItems) {
        drawAvatarSprite(ctx, item.avatarId, item.px, item.py, soldierPxRadius, item.teamColor, {
          isSelected: item.isSelected,
          soldierNumber: item.soldierNumber,
          isDark,
        });
      }

      // 7c. Collision-avoiding high-contrast pill labels drawn above sprites so nearby units stay 100% readable
      const placedLabelRects: Array<{ x: number; y: number; w: number; h: number }> = [];
      for (const item of aliveItems) {
        if (!item.showLabel) continue;
        const safeName = item.username || 'Oyuncu';
        const shortName = safeName.length > 12 ? `${safeName.slice(0, 11)}…` : safeName;
        const label = item.isSelected ? `${shortName} [${item.x},${item.y}]` : shortName;

        ctx.save();
        ctx.font = '800 10px "JetBrains Mono", monospace';
        const textW = ctx.measureText(label).width;
        const pillW = textW + 10;
        const pillH = 16;
        const clampedX = Math.max(
          topLeft.px + 4,
          Math.min(botRight.px - pillW - 4, item.px - pillW / 2)
        );

        const belowY = item.py + soldierPxRadius + 7;
        const aboveY = item.py - soldierPxRadius - pillH - 9;

        const rectOverlapsOther = (rx: number, ry: number) => {
          if (ry < topLeft.py + 2 || ry + pillH > botRight.py - 2) return true;
          const cxRect = rx + pillW / 2;
          const cyRect = ry + pillH / 2;
          const hitsSoldier = aliveItems.some(
            (other) =>
              other.id !== item.id &&
              Math.abs(other.px - cxRect) < pillW / 2 + soldierPxRadius + 2 &&
              Math.abs(other.py - cyRect) < pillH / 2 + soldierPxRadius + 2
          );
          if (hitsSoldier) return true;
          return placedLabelRects.some(
            (r) =>
              rx < r.x + r.w + 2 &&
              rx + pillW + 2 > r.x &&
              ry < r.y + r.h + 2 &&
              ry + pillH + 2 > r.y
          );
        };

        let chosenY = belowY;
        if (rectOverlapsOther(clampedX, belowY) && !rectOverlapsOther(clampedX, aboveY)) {
          chosenY = aboveY;
        } else if (belowY + pillH > botRight.py - 2) {
          chosenY = aboveY;
        }

        placedLabelRects.push({ x: clampedX, y: chosenY, w: pillW, h: pillH });

        ctx.fillStyle = isDark ? 'rgba(9, 18, 34, 0.92)' : 'rgba(255, 255, 255, 0.92)';
        ctx.strokeStyle = item.isSelected
          ? '#FACC15'
          : isDark
            ? 'rgba(148, 163, 184, 0.65)'
            : '#0F172A';
        ctx.lineWidth = item.isSelected ? 1.8 : 1.2;
        ctx.beginPath();
        ctx.roundRect(clampedX, chosenY, pillW, pillH, 5);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, clampedX + pillW / 2, chosenY + pillH / 2 + 0.5);
        ctx.restore();
      }

      // 8. Draw Character-Specific Impact Burst Particles
      if (particlesRef.current) {
        for (const p of anim.particles) {
          if (!p.active) continue;
          p.life += simDt;
          if (p.life >= p.maxLife) {
            p.active = false;
            continue;
          }
          p.x += p.vx * simDt;
          p.y += p.vy * simDt;
          const alpha = 1 - p.life / p.maxLife;
          const { px, py } = toScreen(p.x, p.y);

          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          ctx.strokeStyle = '#0F172A';
          ctx.lineWidth = 1.2;

          if (p.shape === 'diamond' || p.shape === 'shuriken') {
            ctx.beginPath();
            ctx.moveTo(px, py - p.size * 1.3);
            ctx.lineTo(px + p.size * 1.1, py);
            ctx.lineTo(px, py + p.size * 1.3);
            ctx.lineTo(px - p.size * 1.1, py);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          } else if (p.shape === 'needle' || p.shape === 'bolt') {
            ctx.translate(px, py);
            ctx.rotate(Math.atan2(-p.vy, p.vx));
            ctx.beginPath();
            ctx.rect(-p.size * 1.4, -p.size * 0.45, p.size * 2.8, p.size * 0.9);
            ctx.fill();
            ctx.stroke();
          } else {
            ctx.beginPath();
            ctx.arc(px, py, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
          ctx.restore();
        }
      }

      if (currentGw.phase === 'firing') {
        rafId = requestAnimationFrame(renderFrame);
      } else {
        timerId = window.setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(renderFrame);
        }, 50);
      }
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      ro.disconnect();
    };
  }, [myId]);

  const secondsLeft = Math.max(0, Math.ceil((gw.endsAt - nowMs) / 1000));
  const compiledCheck = useMemo(() => compileMathFunction(activeEquation), [activeEquation]);

  const handleLock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!me?.alive || me?.shotLocked || gw.phase !== 'aim' || !activeSoldier) return;
    if (!compiledCheck.fn) {
      setEqError(t(lang, 'errInvalidEq'));
      return;
    }
    setEqError(null);
    soundEngine.playClick();
    onLockShot(activeSoldier.id, direction, activeEquation, useTytCards && canUseTytCards);
  };

  const aCards = tytFamily === 'parabola' ? TYT_A_CARDS : TYT_A_LINEAR_WAVE;

  return (
    <div className="max-w-[1380px] mx-auto space-y-3.5">
      {/* Compact Cartoon-Arcade Arena HUD */}
      <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 px-4 sm:px-5 py-2.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-display font-black text-sky-700 dark:text-amber-300 flex items-center gap-1.5">
            <Flame className="w-4 h-4" />
            GRAPH WARS
          </span>
          <span
            data-testid="gw-active-map-badge"
            className="px-2.5 py-0.5 rounded-lg bg-sky-100 dark:bg-sky-950/70 border-2 border-slate-900 dark:border-sky-400 text-xs font-display font-extrabold text-sky-950 dark:text-sky-200 flex items-center gap-1"
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{lang === 'tr' ? activeMapMeta.nameTr : activeMapMeta.nameEn}</span>
          </span>
          <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300 tabular-nums">
            {t(lang, 'roundLabel')} {gw.round}/{gw.totalRounds} ·{' '}
            {gw.phase === 'aim' ? t(lang, 'aimPhase') : t(lang, 'firingPhase')}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {multiKillBanner && gw.phase === 'firing' && (
            <div className="px-3 py-1 rounded-xl bg-rose-500 border-2 border-slate-900 text-white font-display font-black text-xs animate-countdown-pop">
              {t(lang, 'multiKillLabel')} ×{multiKillBanner.count} ({multiKillBanner.shooter})
            </div>
          )}

          <div className="px-3 py-1 rounded-xl bg-amber-100 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-600 flex items-center gap-1.5 font-mono text-sm font-black tabular-nums">
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-300" />
            <span
              className={
                secondsLeft <= 7
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-950 dark:text-white'
              }
            >
              {secondsLeft}s
            </span>
          </div>

          <button
            type="button"
            onClick={onLeave}
            className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#172740] text-xs font-display font-black text-slate-800 dark:text-slate-100 cartoon-btn-white cursor-pointer"
          >
            {t(lang, 'leaveRoom')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-stretch">
        {/* Main Themed Island Arena Canvas + Firing Controls */}
        <div className="lg:col-span-9 space-y-3">
          <div className="w-full aspect-[5/3] max-h-[540px] min-h-[340px] cartoon-card overflow-hidden relative bg-sky-100 dark:bg-[#091829]">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              data-testid="graph-wars-canvas"
              className="w-full h-full block cursor-crosshair"
            />
          </div>

          {/* Firing / Unit Selector / Direction / Equation Dock */}
          <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-3">
                {/* 3 Unit Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-mono font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1">
                    <Target className="w-3.5 h-3.5 text-sky-600 dark:text-amber-300" />
                    {t(lang, 'selectSoldierLabel')}:
                  </span>
                  {(me?.soldiers || []).map((s, idx) => {
                    const selected = activeSoldier?.id === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!s.alive || me?.shotLocked || gw.phase !== 'aim'}
                        onClick={() => {
                          soundEngine.playClick();
                          setSelectedSoldierId(s.id);
                          setDirection(getDefaultFireDirection(s, enemySoldiers));
                        }}
                        data-testid={`soldier-btn-${idx + 1}`}
                        className={`px-2.5 py-1 rounded-xl font-mono text-xs font-extrabold border-2 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                          selected
                            ? 'border-slate-900 bg-amber-300 text-slate-950 shadow-[0_2px_0_#0f172a]'
                            : 'border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-[#0B1524] text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        #{idx + 1} {s.alive ? `[${s.x},${s.y}]` : '✕'}
                      </button>
                    );
                  })}
                </div>

                {/* Left / Right Fire Direction */}
                <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-700">
                  <button
                    type="button"
                    disabled={me?.shotLocked || !me?.alive || gw.phase !== 'aim'}
                    onClick={() => {
                      soundEngine.playClick();
                      setDirection(-1);
                    }}
                    data-testid="fire-dir-left"
                    className={`px-2.5 py-1 rounded-lg text-xs font-display font-black flex items-center gap-1 cursor-pointer ${
                      direction === -1
                        ? 'bg-sky-500 text-white border border-slate-900'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t(lang, 'fireLeft')}</span>
                  </button>
                  <button
                    type="button"
                    disabled={me?.shotLocked || !me?.alive || gw.phase !== 'aim'}
                    onClick={() => {
                      soundEngine.playClick();
                      setDirection(1);
                    }}
                    data-testid="fire-dir-right"
                    className={`px-2.5 py-1 rounded-lg text-xs font-display font-black flex items-center gap-1 cursor-pointer ${
                      direction === 1
                        ? 'bg-sky-500 text-white border border-slate-900'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>{t(lang, 'fireRight')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* TYT-Only Curve Cards Toggle */}
              {canUseTytCards ? (
                <button
                  type="button"
                  disabled={me?.shotLocked || gw.phase !== 'aim'}
                  onClick={() => setUseTytCards((prev) => !prev)}
                  data-testid="tyt-cards-toggle"
                  className={`px-3 py-1.5 rounded-xl text-xs font-display font-black border-2 flex items-center gap-1.5 cursor-pointer ${
                    useTytCards
                      ? 'border-slate-900 bg-amber-300 text-slate-950'
                      : 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-[#0B1524] text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t(lang, 'tytCardsToggle')}</span>
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  {t(lang, 'tytOnlyNotice')}
                </span>
              )}
            </div>

            {useTytCards && canUseTytCards && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border-2 border-slate-900 dark:border-amber-500/40 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-amber-900 dark:text-amber-300 font-bold">
                    {t(lang, 'tytEloWarning')}
                  </p>
                  <div className="flex items-center gap-1">
                    {TYT_FAMILIES.map((fam) => (
                      <button
                        key={fam}
                        type="button"
                        onClick={() => handleSelectTytFamily(fam)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-display font-black border-2 cursor-pointer ${
                          tytFamily === fam
                            ? 'border-slate-900 bg-amber-400 text-slate-950'
                            : 'border-amber-300 dark:border-amber-600 bg-white dark:bg-[#0B1524] text-amber-900 dark:text-amber-200'
                        }`}
                      >
                        {fam === 'parabola'
                          ? t(lang, 'tytFamilyParabola')
                          : fam === 'linear'
                            ? t(lang, 'tytFamilyLinear')
                            : fam === 'abs'
                              ? t(lang, 'tytFamilyAbs')
                              : t(lang, 'tytFamilyWave')}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      {t(lang, 'cardDirection')}
                    </span>
                    <div className="grid grid-cols-6 gap-1">
                      {aCards.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCardA(val)}
                          className={`py-1 rounded-lg font-mono text-[11px] border-2 cursor-pointer text-center ${
                            cardA === val
                              ? 'border-slate-900 bg-amber-300 text-slate-950 font-black'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1524] text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-700 dark:text-slate-300 font-bold">
                      {t(lang, 'cardShiftH')}
                    </span>
                    <div className="grid grid-cols-7 gap-1">
                      {TYT_H_CARDS.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCardH(val)}
                          className={`py-1 rounded-lg font-mono text-[11px] border-2 cursor-pointer text-center ${
                            cardH === val
                              ? 'border-slate-900 bg-amber-300 text-slate-950 font-black'
                              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1524] text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <form
              onSubmit={handleLock}
              className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2.5"
            >
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label
                    htmlFor="gw-eq"
                    className="text-xs font-display font-extrabold text-slate-700 dark:text-slate-200"
                  >
                    {t(lang, 'equationInputLabel')}
                  </label>
                  <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400">
                    {t(lang, 'autoAlignHint')}
                  </span>
                </div>
                <input
                  ref={eqInputRef}
                  id="gw-eq"
                  data-testid="gw-equation-input"
                  type="text"
                  disabled={
                    me?.shotLocked ||
                    !me?.alive ||
                    gw.phase !== 'aim' ||
                    (useTytCards && canUseTytCards)
                  }
                  value={activeEquation}
                  onChange={(e) => setEquation(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-sky-50/70 dark:bg-[#0B1524] border-2 border-slate-900 dark:border-slate-500 font-mono text-sm font-bold text-sky-900 dark:text-amber-300 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
                />
              </div>

              <button
                type="submit"
                data-testid="gw-lock-btn"
                disabled={
                  me?.shotLocked ||
                  !me?.alive ||
                  gw.phase !== 'aim' ||
                  !compiledCheck.fn ||
                  !activeSoldier
                }
                className="px-6 py-2.5 rounded-xl cartoon-btn-green disabled:opacity-50 disabled:cursor-not-allowed font-display font-black text-sm flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Crosshair className="w-4 h-4" />
                <span>{me?.shotLocked ? t(lang, 'shotLocked') : t(lang, 'lockShot')}</span>
              </button>
            </form>

            {!(useTytCards && canUseTytCards) && (
              <MathKeypad
                lang={lang}
                variant="graph_wars"
                value={equation}
                onChange={setEquation}
                inputRef={eqInputRef}
                disabled={me?.shotLocked || !me?.alive || gw.phase !== 'aim'}
              />
            )}

            {eqError && <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{eqError}</p>}
          </div>
        </div>

        {/* Right Sidebar: Character Avatar Roster + Live Arena Chat */}
        <div className="lg:col-span-3 flex flex-col gap-3.5">
          <div className="cartoon-card bg-white/96 dark:bg-[#101C2E]/96 p-3.5 space-y-2">
            <h3 className="text-xs font-display font-black text-slate-900 dark:text-white uppercase tracking-wider">
              {t(lang, 'playersCount')} ({players.length})
            </h3>
            <div className="space-y-1.5 text-xs">
              {players.map((p) => {
                const pSoldiers = Array.isArray(p.soldiers) ? p.soldiers : [];
                const aliveCount = pSoldiers.filter((s) => s && s.alive).length;
                const totalSoldiers = pSoldiers.length || gw.soldiersPerPlayer;
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between py-1.5 px-2.5 rounded-xl bg-sky-50/80 dark:bg-[#0B1524] border-2 border-slate-900/80 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg border-2 border-slate-900 flex items-center justify-center shrink-0"
                        style={{ backgroundColor: p.alive ? p.color : '#94A3B8' }}
                      >
                        <AvatarIllustration avatarId={p.avatarId} className="w-6 h-6" />
                      </div>
                      <span
                        className={`truncate font-display font-extrabold ${
                          p.alive
                            ? 'text-slate-950 dark:text-white'
                            : 'text-slate-400 dark:text-slate-500 line-through'
                        }`}
                      >
                        {p.username || 'Oyuncu'}
                      </span>
                      {p.disconnected && (
                        <span className="text-[9px] font-mono font-bold text-rose-500">DC</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 font-mono font-extrabold tabular-nums shrink-0 text-[11px]">
                      {p.shotLocked && gw.phase === 'aim' && (
                        <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                      )}
                      <span className="text-slate-600 dark:text-slate-300">
                        {aliveCount}/{totalSoldiers}
                      </span>
                      <span className="text-rose-600 dark:text-amber-300">
                        {p.kills ?? 0}K
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-h-[280px]">
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
