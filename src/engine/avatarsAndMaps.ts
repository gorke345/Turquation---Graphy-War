/**
 * Cartoon-Arcade Islands: Character Avatars & Themed Maps Engine.
 *
 * - 6 expressive cartoon characters with custom Canvas2D sprite renderers
 *   (used for all 3 units/soldiers on the Graph Wars battlefield) and
 *   character-specific projectile trail + burst VFX palettes.
 * - 4 distinct themed Cartoon-Arcade Island maps with themed arena backgrounds
 *   and custom themed obstacles drawn snugly around each obstacle's exact
 *   mathematical collision radius `obs.r`.
 */

import { GraphWarsObstacle } from './graphWarsEngine';

export type AvatarId =
  | 'ice_fox'
  | 'flame_knight'
  | 'astro_cat'
  | 'cactus_ranger'
  | 'ninja_frog'
  | 'cyber_owl';

export interface CharacterAvatar {
  id: AvatarId;
  nameTr: string;
  nameEn: string;
  titleTr: string;
  titleEn: string;
  fxLabelTr: string;
  fxLabelEn: string;
  primary: string;
  secondary: string;
  accent: string;
  cardBg: string;
  cardBgDark: string;
  trailColor: string;
  trailGlow: string;
  burstColors: [string, string, string];
  burstShape: 'diamond' | 'spark' | 'star' | 'needle' | 'shuriken' | 'bolt';
}

export const CHARACTER_AVATARS: CharacterAvatar[] = [
  {
    id: 'ice_fox',
    nameTr: 'Buz Tilkisi',
    nameEn: 'Frost Fox',
    titleTr: 'Kristal Nişancı',
    titleEn: 'Crystal Sniper',
    fxLabelTr: 'Buz Kristali Patlaması',
    fxLabelEn: 'Ice Crystal Shatter',
    primary: '#0EA5E9',
    secondary: '#BAE6FD',
    accent: '#0284C7',
    cardBg: '#E0F2FE',
    cardBgDark: '#0C253A',
    trailColor: '#0EA5E9',
    trailGlow: 'rgba(14, 165, 233, 0.35)',
    burstColors: ['#38BDF8', '#E0F2FE', '#0284C7'],
    burstShape: 'diamond',
  },
  {
    id: 'flame_knight',
    nameTr: 'Alev Şövalyesi',
    nameEn: 'Flame Knight',
    titleTr: 'Kızıl Parabolcü',
    titleEn: 'Crimson Caster',
    fxLabelTr: 'Alev Kıvılcım Dalgası',
    fxLabelEn: 'Blazing Spark Burst',
    primary: '#F97316',
    secondary: '#FDE047',
    accent: '#DC2626',
    cardBg: '#FFEDD5',
    cardBgDark: '#35180B',
    trailColor: '#F97316',
    trailGlow: 'rgba(249, 115, 22, 0.36)',
    burstColors: ['#F97316', '#FACC15', '#EF4444'],
    burstShape: 'spark',
  },
  {
    id: 'astro_cat',
    nameTr: 'Uzay Kedisi',
    nameEn: 'Astro Cat',
    titleTr: 'Yörünge Kaşifi',
    titleEn: 'Orbit Explorer',
    fxLabelTr: 'Kuyruklu Yıldız İzi',
    fxLabelEn: 'Comet Star Trail',
    primary: '#6366F1',
    secondary: '#C7D2FE',
    accent: '#38BDF8',
    cardBg: '#E0E7FF',
    cardBgDark: '#191B3A',
    trailColor: '#6366F1',
    trailGlow: 'rgba(99, 102, 241, 0.36)',
    burstColors: ['#818CF8', '#FDE047', '#38BDF8'],
    burstShape: 'star',
  },
  {
    id: 'cactus_ranger',
    nameTr: 'Kaktüs Nişancı',
    nameEn: 'Cactus Ranger',
    titleTr: 'Çöl Keskin Nişancısı',
    titleEn: 'Desert Marksman',
    fxLabelTr: 'Dikenli Yıldız Vuruşu',
    fxLabelEn: 'Spiky Star Volley',
    primary: '#22C55E',
    secondary: '#BBF7D0',
    accent: '#F43F5E',
    cardBg: '#DCFCE7',
    cardBgDark: '#0D2B1B',
    trailColor: '#16A34A',
    trailGlow: 'rgba(34, 197, 94, 0.36)',
    burstColors: ['#22C55E', '#A3E635', '#F43F5E'],
    burstShape: 'needle',
  },
  {
    id: 'ninja_frog',
    nameTr: 'Ninja Kurbağa',
    nameEn: 'Ninja Frog',
    titleTr: 'Gölge Sıçrayıcı',
    titleEn: 'Shadow Leaper',
    fxLabelTr: 'Şuriken Çarpışması',
    fxLabelEn: 'Shuriken Impact',
    primary: '#14B8A6',
    secondary: '#99F6E4',
    accent: '#E11D48',
    cardBg: '#CCFBF1',
    cardBgDark: '#0B2B29',
    trailColor: '#0D9488',
    trailGlow: 'rgba(20, 184, 166, 0.36)',
    burstColors: ['#14B8A6', '#FB7185', '#F8FAFC'],
    burstShape: 'shuriken',
  },
  {
    id: 'cyber_owl',
    nameTr: 'Siber Baykuş',
    nameEn: 'Cyber Owl',
    titleTr: 'Vektör Bilgesi',
    titleEn: 'Vector Sage',
    fxLabelTr: 'Şimşek Tüyü Patlaması',
    fxLabelEn: 'Volt Feather Flash',
    primary: '#F59E0B',
    secondary: '#FEF3C7',
    accent: '#06B6D4',
    cardBg: '#FEF3C7',
    cardBgDark: '#332208',
    trailColor: '#D97706',
    trailGlow: 'rgba(245, 158, 11, 0.36)',
    burstColors: ['#FBBF24', '#06B6D4', '#FEF08A'],
    burstShape: 'bolt',
  },
];

export const DEFAULT_AVATAR_ID: AvatarId = 'ice_fox';

export function getAvatarById(id?: string | null): CharacterAvatar {
  return CHARACTER_AVATARS.find((a) => a.id === id) || CHARACTER_AVATARS[0];
}

// ============================================================================
// THEMED CARTOON-ARCADE ISLAND MAPS
// ============================================================================

export type ArenaMapId = 'cloud_temple' | 'glacier_peak' | 'volcano_crater' | 'desert_pyramid';
export type MapSelection = ArenaMapId | 'random';

export interface ArenaMapTheme {
  id: ArenaMapId;
  nameTr: string;
  nameEn: string;
  subtitleTr: string;
  subtitleEn: string;
  badgeColor: string;
  skyTopLight: string;
  skyBottomLight: string;
  skyTopDark: string;
  skyBottomDark: string;
  gridMajorLight: string;
  gridMinorLight: string;
  gridAxisLight: string;
  gridMajorDark: string;
  gridMinorDark: string;
  gridAxisDark: string;
  tickLight: string;
  tickDark: string;
  borderLight: string;
  borderDark: string;
  obstacleFill: string;
  obstacleHighlight: string;
  obstacleStroke: string;
  obstacleAccent: string;
}

export const ARENA_MAPS: ArenaMapTheme[] = [
  {
    id: 'cloud_temple',
    nameTr: 'Bulut Tapınağı',
    nameEn: 'Cloud Temple',
    subtitleTr: 'Güneşli gökyüzü & çimenli yüzen adalar',
    subtitleEn: 'Sunlit sky & grassy floating islands',
    badgeColor: '#0EA5E9',
    skyTopLight: '#DFF4FF',
    skyBottomLight: '#F7FDFF',
    skyTopDark: '#0C1E33',
    skyBottomDark: '#122943',
    gridMajorLight: 'rgba(14, 116, 144, 0.22)',
    gridMinorLight: 'rgba(14, 116, 144, 0.1)',
    gridAxisLight: 'rgba(15, 23, 42, 0.55)',
    gridMajorDark: 'rgba(125, 211, 252, 0.18)',
    gridMinorDark: 'rgba(125, 211, 252, 0.08)',
    gridAxisDark: 'rgba(56, 189, 248, 0.6)',
    tickLight: '#0369A1',
    tickDark: '#7DD3FC',
    borderLight: '#0F172A',
    borderDark: '#38BDF8',
    obstacleFill: '#B48256',
    obstacleHighlight: '#4ADE80',
    obstacleStroke: '#0F172A',
    obstacleAccent: '#16A34A',
  },
  {
    id: 'glacier_peak',
    nameTr: 'Buzul Zirvesi',
    nameEn: 'Glacier Peak',
    subtitleTr: 'Karlı ova & kristal buz kayalıkları',
    subtitleEn: 'Snowy ridge & faceted ice crystals',
    badgeColor: '#06B6D4',
    skyTopLight: '#E0F7FA',
    skyBottomLight: '#F8FAFC',
    skyTopDark: '#091B2C',
    skyBottomDark: '#102A42',
    gridMajorLight: 'rgba(2, 132, 199, 0.22)',
    gridMinorLight: 'rgba(2, 132, 199, 0.1)',
    gridAxisLight: 'rgba(12, 74, 110, 0.58)',
    gridMajorDark: 'rgba(103, 232, 249, 0.18)',
    gridMinorDark: 'rgba(103, 232, 249, 0.08)',
    gridAxisDark: 'rgba(34, 211, 238, 0.62)',
    tickLight: '#0E7490',
    tickDark: '#67E8F9',
    borderLight: '#0F172A',
    borderDark: '#22D3EE',
    obstacleFill: '#38BDF8',
    obstacleHighlight: '#E0F2FE',
    obstacleStroke: '#0F172A',
    obstacleAccent: '#0284C7',
  },
  {
    id: 'volcano_crater',
    nameTr: 'Volkan Krateri',
    nameEn: 'Volcano Crater',
    subtitleTr: 'Sıcak bazalt vadi & lav çatlaklı kayalar',
    subtitleEn: 'Ember basalt basin & glowing magma rocks',
    badgeColor: '#F97316',
    skyTopLight: '#FFF1E6',
    skyBottomLight: '#FFEDD5',
    skyTopDark: '#23100C',
    skyBottomDark: '#180B0B',
    gridMajorLight: 'rgba(194, 65, 12, 0.2)',
    gridMinorLight: 'rgba(194, 65, 12, 0.09)',
    gridAxisLight: 'rgba(124, 45, 18, 0.58)',
    gridMajorDark: 'rgba(251, 146, 60, 0.18)',
    gridMinorDark: 'rgba(251, 146, 60, 0.08)',
    gridAxisDark: 'rgba(249, 115, 22, 0.62)',
    tickLight: '#9A3412',
    tickDark: '#FDBA74',
    borderLight: '#0F172A',
    borderDark: '#F97316',
    obstacleFill: '#475569',
    obstacleHighlight: '#F97316',
    obstacleStroke: '#0F172A',
    obstacleAccent: '#FACC15',
  },
  {
    id: 'desert_pyramid',
    nameTr: 'Çöl Piramidi',
    nameEn: 'Desert Pyramid',
    subtitleTr: 'Altın kum tepeleri & kumtaşı antik bloklar',
    subtitleEn: 'Golden dunes & sandstone ruin monoliths',
    badgeColor: '#D97706',
    skyTopLight: '#FEF9C3',
    skyBottomLight: '#FFFBEB',
    skyTopDark: '#261D0D',
    skyBottomDark: '#1A140A',
    gridMajorLight: 'rgba(180, 83, 9, 0.2)',
    gridMinorLight: 'rgba(180, 83, 9, 0.09)',
    gridAxisLight: 'rgba(120, 53, 15, 0.56)',
    gridMajorDark: 'rgba(251, 191, 36, 0.18)',
    gridMinorDark: 'rgba(251, 191, 36, 0.08)',
    gridAxisDark: 'rgba(251, 191, 36, 0.6)',
    tickLight: '#92400E',
    tickDark: '#FDE68A',
    borderLight: '#0F172A',
    borderDark: '#FBBF24',
    obstacleFill: '#F59E0B',
    obstacleHighlight: '#FEF3C7',
    obstacleStroke: '#0F172A',
    obstacleAccent: '#D97706',
  },
];

export const DEFAULT_MAP_ID: ArenaMapId = 'cloud_temple';

export function getArenaMapById(id?: string | null): ArenaMapTheme {
  return ARENA_MAPS.find((m) => m.id === id) || ARENA_MAPS[0];
}

export function resolveArenaMap(selection: MapSelection | undefined, seed: number): ArenaMapId {
  if (selection && selection !== 'random') {
    const valid = ARENA_MAPS.find((m) => m.id === selection);
    if (valid) return valid.id;
  }
  const idx = Math.abs(Math.floor(seed)) % ARENA_MAPS.length;
  return ARENA_MAPS[idx].id;
}

// ============================================================================
// CANVAS2D RENDERERS — THEMED ARENA BACKGROUNDS, OBSTACLES & CHARACTER UNITS
// ============================================================================

export function drawThemedArenaBackground(
  ctx: CanvasRenderingContext2D,
  mapId: ArenaMapId,
  w: number,
  h: number,
  isDark: boolean
): void {
  const theme = getArenaMapById(mapId);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isDark ? theme.skyTopDark : theme.skyTopLight);
  grad.addColorStop(1, isDark ? theme.skyBottomDark : theme.skyBottomLight);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  if (mapId === 'cloud_temple') {
    // Soft puffy sunlit clouds in far background (low contrast so math grid stays razor clear)
    ctx.fillStyle = isDark ? 'rgba(186, 230, 253, 0.06)' : 'rgba(255, 255, 255, 0.72)';
    const clouds = [
      { x: w * 0.14, y: h * 0.18, s: 1.0 },
      { x: w * 0.52, y: h * 0.12, s: 0.85 },
      { x: w * 0.84, y: h * 0.22, s: 1.1 },
      { x: w * 0.28, y: h * 0.84, s: 0.9 },
      { x: w * 0.74, y: h * 0.86, s: 0.95 },
    ];
    for (const c of clouds) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 26 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x + 24 * c.s, c.y - 6 * c.s, 20 * c.s, 0, Math.PI * 2);
      ctx.arc(c.x - 22 * c.s, c.y + 4 * c.s, 18 * c.s, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (mapId === 'glacier_peak') {
    // Crisp distant snow mountain silhouettes along bottom horizon
    ctx.fillStyle = isDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(186, 230, 253, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w * 0.15, h * 0.76);
    ctx.lineTo(w * 0.32, h * 0.9);
    ctx.lineTo(w * 0.54, h * 0.7);
    ctx.lineTo(w * 0.75, h * 0.88);
    ctx.lineTo(w * 0.9, h * 0.74);
    ctx.lineTo(w, h * 0.86);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  } else if (mapId === 'volcano_crater') {
    // Distant volcanic peaks + subtle ember glow at bottom
    ctx.fillStyle = isDark ? 'rgba(249, 115, 22, 0.09)' : 'rgba(251, 146, 60, 0.16)';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.lineTo(w * 0.2, h * 0.78);
    ctx.lineTo(w * 0.36, h * 0.88);
    ctx.lineTo(w * 0.62, h * 0.75);
    ctx.lineTo(w * 0.85, h * 0.89);
    ctx.lineTo(w, h * 0.8);
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  } else if (mapId === 'desert_pyramid') {
    // Distant golden pyramids & soft desert sun
    ctx.fillStyle = isDark ? 'rgba(251, 191, 36, 0.09)' : 'rgba(253, 224, 71, 0.4)';
    ctx.beginPath();
    ctx.arc(w * 0.86, h * 0.16, 36, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isDark ? 'rgba(217, 119, 6, 0.1)' : 'rgba(245, 158, 11, 0.16)';
    ctx.beginPath();
    ctx.moveTo(w * 0.06, h);
    ctx.lineTo(w * 0.22, h * 0.74);
    ctx.lineTo(w * 0.38, h);
    ctx.moveTo(w * 0.58, h);
    ctx.lineTo(w * 0.76, h * 0.7);
    ctx.lineTo(w * 0.94, h);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * Draws a themed cartoon-outlined obstacle that visually matches its exact
 * circular collision boundary `rad = obs.r * scale`.
 */
export function drawThemedObstacle(
  ctx: CanvasRenderingContext2D,
  mapId: ArenaMapId,
  obs: GraphWarsObstacle,
  px: number,
  py: number,
  rad: number,
  isDark: boolean
): void {
  const theme = getArenaMapById(mapId);
  const ink = isDark ? '#020617' : '#0F172A';

  ctx.save();
  // Subtle comic drop shadow
  ctx.fillStyle = isDark ? 'rgba(0,0,0,0.42)' : 'rgba(15,23,42,0.16)';
  ctx.beginPath();
  ctx.arc(px + 2.5, py + 3.5, rad, 0, Math.PI * 2);
  ctx.fill();

  if (mapId === 'cloud_temple') {
    // Floating grassy meadow island boulder
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.clip();

    // Warm earth rock base
    ctx.fillStyle = '#B47B49';
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);

    // Lower rock shading
    ctx.fillStyle = '#8C5A32';
    ctx.beginPath();
    ctx.arc(px + rad * 0.18, py + rad * 0.38, rad * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Lush green grassy cap across upper half
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.arc(px, py - rad * 0.42, rad * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Bright grass highlight tuft
    ctx.fillStyle = '#86EFAC';
    ctx.beginPath();
    ctx.ellipse(px - rad * 0.25, py - rad * 0.45, rad * 0.38, rad * 0.18, -0.25, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mapId === 'glacier_peak') {
    // Faceted glacier ice boulder with crisp crystal shine
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.clip();

    const iceGrad = ctx.createLinearGradient(px - rad, py - rad, px + rad, py + rad);
    iceGrad.addColorStop(0, '#E0F2FE');
    iceGrad.addColorStop(0.45, '#38BDF8');
    iceGrad.addColorStop(1, '#0284C7');
    ctx.fillStyle = iceGrad;
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);

    // Crystal facet polygons
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.beginPath();
    ctx.moveTo(px - rad * 0.7, py - rad * 0.2);
    ctx.lineTo(px - rad * 0.1, py - rad * 0.78);
    ctx.lineTo(px + rad * 0.32, py - rad * 0.18);
    ctx.lineTo(px - rad * 0.2, py + rad * 0.15);
    ctx.closePath();
    ctx.fill();

    // Snow cap arc
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.ellipse(px - rad * 0.22, py - rad * 0.48, rad * 0.42, rad * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.stroke();
  } else if (mapId === 'volcano_crater') {
    // Cracked obsidian volcanic boulder with glowing lava veins
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#334155';
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);

    // Dark basalt shadow
    ctx.fillStyle = '#1E293B';
    ctx.beginPath();
    ctx.arc(px + rad * 0.24, py + rad * 0.28, rad * 0.92, 0, Math.PI * 2);
    ctx.fill();

    // Glowing magma cracks
    ctx.strokeStyle = '#F97316';
    ctx.lineWidth = Math.max(2, rad * 0.14);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(px - rad * 0.55, py - rad * 0.15);
    ctx.lineTo(px - rad * 0.05, py + rad * 0.08);
    ctx.lineTo(px + rad * 0.48, py - rad * 0.32);
    ctx.moveTo(px - rad * 0.05, py + rad * 0.08);
    ctx.lineTo(px + rad * 0.18, py + rad * 0.58);
    ctx.stroke();

    ctx.strokeStyle = '#FDE047';
    ctx.lineWidth = Math.max(1, rad * 0.06);
    ctx.stroke();

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // Desert Pyramid: carved sandstone relic boulder
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(px - rad, py - rad, rad * 2, rad * 2);

    ctx.fillStyle = '#D97706';
    ctx.beginPath();
    ctx.arc(px + rad * 0.25, py + rad * 0.3, rad * 0.95, 0, Math.PI * 2);
    ctx.fill();

    // Ancient stone block lines
    ctx.strokeStyle = 'rgba(120, 53, 15, 0.45)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px - rad, py - rad * 0.2);
    ctx.lineTo(px + rad, py - rad * 0.2);
    ctx.moveTo(px - rad, py + rad * 0.3);
    ctx.lineTo(px + rad, py + rad * 0.3);
    ctx.moveTo(px, py - rad * 0.2);
    ctx.lineTo(px, py + rad * 0.3);
    ctx.stroke();

    // Sunlit sandstone highlight
    ctx.fillStyle = 'rgba(254, 243, 199, 0.55)';
    ctx.beginPath();
    ctx.ellipse(px - rad * 0.26, py - rad * 0.45, rad * 0.35, rad * 0.16, -0.35, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    ctx.save();
    ctx.strokeStyle = theme.obstacleStroke;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(px, py, rad, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Draws one of the 6 expressive Cartoon-Arcade character sprites directly on
 * the Graph Wars HTML5 Canvas at `(px, py)` with a crisp high-contrast team
 * color ring so friend & foe are unmistakably readable at a glance.
 */
export function drawAvatarSprite(
  ctx: CanvasRenderingContext2D,
  avatarId: AvatarId | string | undefined,
  px: number,
  py: number,
  radius: number,
  teamColor: string,
  options: {
    isSelected?: boolean;
    soldierNumber?: number;
    isDark?: boolean;
  } = {}
): void {
  const avatar = getAvatarById(avatarId);
  const r = Math.max(10, radius);
  const ink = '#0F172A';

  ctx.save();

  // Active firing unit halo + golden target crown ring
  if (options.isSelected) {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.26)';
    ctx.beginPath();
    ctx.arc(px, py, r + 6.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = options.isDark ? '#FACC15' : '#0F172A';
    ctx.lineWidth = 2.6;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.arc(px, py, r + 5.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Team color outer collar ring (ensures instant team identification!)
  ctx.fillStyle = teamColor;
  ctx.beginPath();
  ctx.arc(px, py, r + 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Inner character badge background
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(px, py, r - 1.2, 0, Math.PI * 2);
  ctx.fill();

  // Character-specific cartoon head / ears / helmet
  const hr = r * 0.82;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (avatar.id === 'ice_fox') {
    // Pointed frosty fox ears
    ctx.fillStyle = '#38BDF8';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(px - hr * 0.72, py - hr * 0.15);
    ctx.lineTo(px - hr * 0.85, py - hr * 0.98);
    ctx.lineTo(px - hr * 0.12, py - hr * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(px + hr * 0.72, py - hr * 0.15);
    ctx.lineTo(px + hr * 0.85, py - hr * 0.98);
    ctx.lineTo(px + hr * 0.12, py - hr * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Fox head
    ctx.fillStyle = '#0EA5E9';
    ctx.beginPath();
    ctx.arc(px, py + hr * 0.08, hr * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // White fox cheeks
    ctx.fillStyle = '#F0F9FF';
    ctx.beginPath();
    ctx.ellipse(px, py + hr * 0.34, hr * 0.54, hr * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes & tiny nose
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(px - hr * 0.28, py + hr * 0.04, hr * 0.13, 0, Math.PI * 2);
    ctx.arc(px + hr * 0.28, py + hr * 0.04, hr * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px, py + hr * 0.24, hr * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.id === 'flame_knight') {
    // Fiery plume crest
    ctx.fillStyle = '#FACC15';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px - hr * 0.28, py - hr * 0.52);
    ctx.lineTo(px, py - hr * 1.08);
    ctx.lineTo(px + hr * 0.34, py - hr * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Orange knight helmet
    ctx.fillStyle = '#F97316';
    ctx.beginPath();
    ctx.arc(px, py + hr * 0.08, hr * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Dark steel visor slit
    ctx.fillStyle = '#0F172A';
    ctx.beginPath();
    ctx.roundRect(px - hr * 0.55, py - hr * 0.12, hr * 1.1, hr * 0.36, 3);
    ctx.fill();

    // Glowing yellow eyes inside visor
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(px - hr * 0.24, py + hr * 0.06, hr * 0.12, 0, Math.PI * 2);
    ctx.arc(px + hr * 0.24, py + hr * 0.06, hr * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.id === 'astro_cat') {
    // Space helmet dome
    ctx.fillStyle = '#E0E7FF';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py + hr * 0.02, hr * 0.88, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cat ears inside/on dome
    ctx.fillStyle = '#6366F1';
    ctx.beginPath();
    ctx.moveTo(px - hr * 0.52, py - hr * 0.16);
    ctx.lineTo(px - hr * 0.45, py - hr * 0.72);
    ctx.lineTo(px - hr * 0.08, py - hr * 0.42);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(px + hr * 0.52, py - hr * 0.16);
    ctx.lineTo(px + hr * 0.45, py - hr * 0.72);
    ctx.lineTo(px + hr * 0.08, py - hr * 0.42);
    ctx.closePath();
    ctx.fill();

    // Cat face
    ctx.fillStyle = '#6366F1';
    ctx.beginPath();
    ctx.arc(px, py + hr * 0.12, hr * 0.58, 0, Math.PI * 2);
    ctx.fill();

    // Cute starry eyes
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.arc(px - hr * 0.22, py + hr * 0.08, hr * 0.13, 0, Math.PI * 2);
    ctx.arc(px + hr * 0.22, py + hr * 0.08, hr * 0.13, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.id === 'cactus_ranger') {
    // Round cactus head
    ctx.fillStyle = '#22C55E';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py + hr * 0.1, hr * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Pink desert flower on top!
    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.arc(px, py - hr * 0.68, hr * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FDE047';
    ctx.beginPath();
    ctx.arc(px, py - hr * 0.68, hr * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Eyes & happy smile
    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(px - hr * 0.26, py + hr * 0.06, hr * 0.12, 0, Math.PI * 2);
    ctx.arc(px + hr * 0.26, py + hr * 0.06, hr * 0.12, 0, Math.PI * 2);
    ctx.fill();
  } else if (avatar.id === 'ninja_frog') {
    // Frog head
    ctx.fillStyle = '#14B8A6';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py + hr * 0.12, hr * 0.78, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Crimson ninja headband
    ctx.fillStyle = '#E11D48';
    ctx.fillRect(px - hr * 0.74, py - hr * 0.28, hr * 1.48, hr * 0.34);
    ctx.strokeRect(px - hr * 0.74, py - hr * 0.28, hr * 1.48, hr * 0.34);

    // Big frog eyes peeking over headband
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(px - hr * 0.34, py - hr * 0.42, hr * 0.26, 0, Math.PI * 2);
    ctx.arc(px + hr * 0.34, py - hr * 0.42, hr * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(px - hr * 0.34, py - hr * 0.42, hr * 0.11, 0, Math.PI * 2);
    ctx.arc(px + hr * 0.34, py - hr * 0.42, hr * 0.11, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Cyber Owl: amber round head + cyan tech goggles + beak
    ctx.fillStyle = '#F59E0B';
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(px, py + hr * 0.08, hr * 0.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Cyan cyber goggles
    ctx.fillStyle = '#06B6D4';
    ctx.beginPath();
    ctx.arc(px - hr * 0.3, py - hr * 0.02, hr * 0.27, 0, Math.PI * 2);
    ctx.arc(px + hr * 0.3, py - hr * 0.02, hr * 0.27, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Beak
    ctx.fillStyle = '#FEF08A';
    ctx.beginPath();
    ctx.moveTo(px - hr * 0.16, py + hr * 0.22);
    ctx.lineTo(px + hr * 0.16, py + hr * 0.22);
    ctx.lineTo(px, py + hr * 0.48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Tiny crisp soldier number badge in bottom-right corner
  if (options.soldierNumber !== undefined) {
    const bx = px + r * 0.72;
    const by = py - r * 0.72;
    ctx.fillStyle = options.isSelected ? '#FACC15' : teamColor;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '800 8px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(options.soldierNumber), bx, by + 0.5);
  }

  ctx.restore();
}
