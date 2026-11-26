import React from 'react';
import { ArenaMapId, AvatarId, MapSelection } from '../engine/avatarsAndMaps';

interface AvatarIllustrationProps {
  avatarId: AvatarId;
  className?: string;
}

/**
 * Hand-crafted, bold ink-outlined Cartoon-Arcade SVG portraits for all 6 playable
 * characters. Matches the exact visual identity rendered on the Graph Wars canvas.
 */
export const AvatarIllustration: React.FC<AvatarIllustrationProps> = ({
  avatarId,
  className = 'w-16 h-16',
}) => {
  switch (avatarId) {
    case 'ice_fox':
      return (
        <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
          {/* Soft frost backdrop */}
          <circle cx="48" cy="50" r="40" fill="#BAE6FD" stroke="#0F172A" strokeWidth="3.5" />
          {/* Fox ears */}
          <path
            d="M22 44 L17 12 L42 29 Z"
            fill="#0EA5E9"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M24 37 L22 20 L36 30 Z" fill="#E0F2FE" />
          <path
            d="M74 44 L79 12 L54 29 Z"
            fill="#0EA5E9"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path d="M72 37 L74 20 L60 30 Z" fill="#E0F2FE" />
          {/* Head */}
          <ellipse cx="48" cy="54" rx="29" ry="26" fill="#0EA5E9" stroke="#0F172A" strokeWidth="3.5" />
          {/* Frost scarf */}
          <path
            d="M28 73 Q48 84 68 73 L64 83 Q48 90 32 83 Z"
            fill="#0284C7"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* White cheeks & muzzle */}
          <path
            d="M22 57 Q34 52 48 61 Q62 52 74 57 Q72 75 48 77 Q24 75 22 57 Z"
            fill="#F8FAFC"
            stroke="#0F172A"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          {/* Forehead crystal mark */}
          <polygon points="48,33 53,41 48,47 43,41" fill="#E0F2FE" stroke="#0F172A" strokeWidth="2.2" />
          {/* Expressive eyes */}
          <circle cx="36" cy="52" r="4.8" fill="#0F172A" />
          <circle cx="34.5" cy="50.2" r="1.8" fill="#FFFFFF" />
          <circle cx="60" cy="52" r="4.8" fill="#0F172A" />
          <circle cx="58.5" cy="50.2" r="1.8" fill="#FFFFFF" />
          {/* Nose & smirk */}
          <ellipse cx="48" cy="61" rx="4.5" ry="3.2" fill="#0F172A" />
          <path d="M43 66 Q48 71 53 66" fill="none" stroke="#0F172A" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      );

    case 'flame_knight':
      return (
        <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
          <circle cx="48" cy="50" r="40" fill="#FED7AA" stroke="#0F172A" strokeWidth="3.5" />
          {/* Blazing plume crest */}
          <path
            d="M36 28 C33 12 46 8 48 5 C55 12 65 14 60 29 Z"
            fill="#FACC15"
            stroke="#0F172A"
            strokeWidth="3.2"
            strokeLinejoin="round"
          />
          <path d="M43 27 C42 18 48 15 51 12 C54 18 55 21 53 27 Z" fill="#F97316" />
          {/* Helmet dome */}
          <path
            d="M21 52 C21 31 32 23 48 23 C64 23 75 31 75 52 L73 74 C66 80 57 83 48 83 C39 83 30 80 23 74 Z"
            fill="#F97316"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Helmet shine */}
          <path d="M30 34 Q38 28 48 28" fill="none" stroke="#FDE68A" strokeWidth="4" strokeLinecap="round" />
          {/* Side rivets */}
          <circle cx="26" cy="54" r="3" fill="#FDE047" stroke="#0F172A" strokeWidth="2" />
          <circle cx="70" cy="54" r="3" fill="#FDE047" stroke="#0F172A" strokeWidth="2" />
          {/* Steel visor slit */}
          <rect
            x="27"
            y="45"
            width="42"
            height="17"
            rx="7"
            fill="#0F172A"
            stroke="#0F172A"
            strokeWidth="2"
          />
          {/* Glowing determined eyes */}
          <path d="M34 52 L44 54 L36 58 Z" fill="#FDE047" />
          <path d="M62 52 L52 54 L60 58 Z" fill="#FDE047" />
          {/* Chin guard vents */}
          <line x1="40" y1="70" x2="40" y2="76" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
          <line x1="48" y1="69" x2="48" y2="77" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
          <line x1="56" y1="70" x2="56" y2="76" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case 'astro_cat':
      return (
        <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
          <circle cx="48" cy="50" r="40" fill="#C7D2FE" stroke="#0F172A" strokeWidth="3.5" />
          {/* Space helmet glass dome */}
          <circle cx="48" cy="49" r="33" fill="#E0F2FE" stroke="#0F172A" strokeWidth="3.5" />
          {/* Cat ears inside helmet */}
          <path
            d="M29 44 L31 24 L44 35 Z"
            fill="#6366F1"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M67 44 L65 24 L52 35 Z"
            fill="#6366F1"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Cat face */}
          <ellipse cx="48" cy="53" rx="22" ry="19" fill="#6366F1" stroke="#0F172A" strokeWidth="3" />
          {/* Starry yellow eyes */}
          <circle cx="39" cy="51" r="4.8" fill="#FEF08A" stroke="#0F172A" strokeWidth="2" />
          <circle cx="38" cy="50" r="1.8" fill="#0F172A" />
          <circle cx="57" cy="51" r="4.8" fill="#FEF08A" stroke="#0F172A" strokeWidth="2" />
          <circle cx="56" cy="50" r="1.8" fill="#0F172A" />
          {/* Cute cat nose & whiskers */}
          <polygon points="48,57 45,54 51,54" fill="#FB7185" />
          <path d="M44 60 Q48 63 52 60" fill="none" stroke="#E0E7FF" strokeWidth="2.2" strokeLinecap="round" />
          {/* Collar ring */}
          <rect x="27" y="73" width="42" height="10" rx="5" fill="#38BDF8" stroke="#0F172A" strokeWidth="3" />
          {/* Helmet glass glare */}
          <path d="M26 36 Q32 24 44 22" fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" opacity="0.85" />
        </svg>
      );

    case 'cactus_ranger':
      return (
        <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
          <circle cx="48" cy="50" r="40" fill="#FEF08A" stroke="#0F172A" strokeWidth="3.5" />
          {/* Cactus arms */}
          <path
            d="M21 64 C14 64 13 54 17 48 C21 44 26 48 26 55"
            fill="#22C55E"
            stroke="#0F172A"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          <path
            d="M75 64 C82 64 83 54 79 48 C75 44 70 48 70 55"
            fill="#22C55E"
            stroke="#0F172A"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Cactus body/head */}
          <rect
            x="24"
            y="28"
            width="48"
            height="54"
            rx="24"
            fill="#22C55E"
            stroke="#0F172A"
            strokeWidth="3.5"
          />
          {/* Vertical cactus ribs */}
          <line x1="38" y1="34" x2="38" y2="76" stroke="#15803D" strokeWidth="2.2" opacity="0.45" />
          <line x1="58" y1="34" x2="58" y2="76" stroke="#15803D" strokeWidth="2.2" opacity="0.45" />
          {/* Desert blossom on top */}
          <circle cx="41" cy="24" r="7" fill="#F43F5E" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="55" cy="24" r="7" fill="#F43F5E" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="48" cy="18" r="7" fill="#FB7185" stroke="#0F172A" strokeWidth="2.5" />
          <circle cx="48" cy="24" r="5" fill="#FDE047" stroke="#0F172A" strokeWidth="2.2" />
          {/* Bandana */}
          <path
            d="M26 67 Q48 77 70 67 L66 78 Q48 86 30 78 Z"
            fill="#EF4444"
            stroke="#0F172A"
            strokeWidth="2.8"
          />
          {/* Confident eyes & grin */}
          <circle cx="38" cy="49" r="4.6" fill="#0F172A" />
          <circle cx="36.8" cy="47.5" r="1.6" fill="#FFFFFF" />
          <circle cx="58" cy="49" r="4.6" fill="#0F172A" />
          <circle cx="56.8" cy="47.5" r="1.6" fill="#FFFFFF" />
          <path d="M41 59 Q48 65 55 59" fill="none" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case 'ninja_frog':
      return (
        <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
          <circle cx="48" cy="50" r="40" fill="#99F6E4" stroke="#0F172A" strokeWidth="3.5" />
          {/* Headband fluttering tail */}
          <path
            d="M72 44 L88 37 L84 49 L90 56 L72 52 Z"
            fill="#E11D48"
            stroke="#0F172A"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
          {/* Frog face */}
          <ellipse cx="48" cy="57" rx="29" ry="24" fill="#14B8A6" stroke="#0F172A" strokeWidth="3.5" />
          {/* Light belly chin */}
          <ellipse cx="48" cy="68" rx="19" ry="10" fill="#CCFBF1" />
          {/* Big frog eyes on top */}
          <circle cx="33" cy="34" r="12" fill="#14B8A6" stroke="#0F172A" strokeWidth="3.5" />
          <circle cx="63" cy="34" r="12" fill="#14B8A6" stroke="#0F172A" strokeWidth="3.5" />
          <circle cx="33" cy="34" r="7.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
          <circle cx="63" cy="34" r="7.5" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2.4" />
          <circle cx="34.5" cy="34" r="3.4" fill="#0F172A" />
          <circle cx="61.5" cy="34" r="3.4" fill="#0F172A" />
          {/* Crimson ninja headband + metal plate */}
          <rect x="20" y="42" width="56" height="12" rx="5" fill="#E11D48" stroke="#0F172A" strokeWidth="3" />
          <rect x="40" y="44" width="16" height="8" rx="2" fill="#E2E8F0" stroke="#0F172A" strokeWidth="2" />
          {/* Ninja smirk */}
          <path d="M36 64 Q48 71 60 64" fill="none" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );

    case 'cyber_owl':
    default:
      return (
        <svg viewBox="0 0 96 96" className={className} aria-hidden="true">
          <circle cx="48" cy="50" r="40" fill="#FEF3C7" stroke="#0F172A" strokeWidth="3.5" />
          {/* Owl ear tufts */}
          <path
            d="M24 38 L18 16 L39 27 Z"
            fill="#D97706"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M72 38 L78 16 L57 27 Z"
            fill="#D97706"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          {/* Owl body/head */}
          <ellipse cx="48" cy="54" rx="28" ry="27" fill="#F59E0B" stroke="#0F172A" strokeWidth="3.5" />
          {/* Chest feathers */}
          <path d="M32 67 Q48 80 64 67 Q59 79 48 80 Q37 79 32 67 Z" fill="#FEF3C7" />
          {/* Cyber goggle strap */}
          <rect x="19" y="42" width="58" height="10" rx="4" fill="#1E293B" stroke="#0F172A" strokeWidth="2.5" />
          {/* Twin cyan tech lenses */}
          <circle cx="36" cy="47" r="11" fill="#06B6D4" stroke="#0F172A" strokeWidth="3.2" />
          <circle cx="60" cy="47" r="11" fill="#06B6D4" stroke="#0F172A" strokeWidth="3.2" />
          <circle cx="36" cy="47" r="5" fill="#CFFAFE" />
          <circle cx="60" cy="47" r="5" fill="#CFFAFE" />
          <circle cx="33" cy="43" r="2.2" fill="#FFFFFF" />
          <circle cx="57" cy="43" r="2.2" fill="#FFFFFF" />
          {/* Golden beak */}
          <polygon
            points="48,54 41,62 48,70 55,62"
            fill="#FDE047"
            stroke="#0F172A"
            strokeWidth="2.8"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};

interface MapPreviewSvgProps {
  mapId: MapSelection;
  className?: string;
}

/**
 * Compact Cartoon-Arcade Island map thumbnail for the Lobby and RoomLobby selectors.
 */
export const MapPreviewSvg: React.FC<MapPreviewSvgProps> = ({
  mapId,
  className = 'w-full h-16',
}) => {
  if (mapId === 'random') {
    return (
      <svg viewBox="0 0 120 68" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect x="0" y="0" width="60" height="34" fill="#BAE6FD" />
        <rect x="60" y="0" width="60" height="34" fill="#FED7AA" />
        <rect x="0" y="34" width="60" height="34" fill="#A5F3FC" />
        <rect x="60" y="34" width="60" height="34" fill="#FEF08A" />
        <line x1="60" y1="0" x2="60" y2="68" stroke="#0F172A" strokeWidth="2.5" />
        <line x1="0" y1="34" x2="120" y2="34" stroke="#0F172A" strokeWidth="2.5" />
        <circle cx="60" cy="34" r="16" fill="#FFFFFF" stroke="#0F172A" strokeWidth="3" />
        <text
          x="60"
          y="40"
          textAnchor="middle"
          fontSize="18"
          fontWeight="900"
          fill="#0F172A"
          fontFamily="Outfit, sans-serif"
        >
          ?
        </text>
      </svg>
    );
  }

  const m: ArenaMapId = mapId;
  if (m === 'cloud_temple') {
    return (
      <svg viewBox="0 0 120 68" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="120" height="68" fill="#BAE6FD" />
        <circle cx="24" cy="18" r="11" fill="#FFFFFF" opacity="0.9" />
        <circle cx="36" cy="18" r="9" fill="#FFFFFF" opacity="0.9" />
        <circle cx="96" cy="16" r="10" fill="#FFFFFF" opacity="0.85" />
        <circle cx="42" cy="44" r="14" fill="#B47B49" stroke="#0F172A" strokeWidth="2.4" />
        <path d="M29 41 Q42 29 55 41 Z" fill="#22C55E" stroke="#0F172A" strokeWidth="2" />
        <circle cx="84" cy="38" r="11" fill="#B47B49" stroke="#0F172A" strokeWidth="2.4" />
        <path d="M74 36 Q84 26 94 36 Z" fill="#4ADE80" stroke="#0F172A" strokeWidth="2" />
        <path d="M12 52 Q60 12 108 46" fill="none" stroke="#0284C7" strokeWidth="2.6" strokeDasharray="4 3" />
      </svg>
    );
  }

  if (m === 'glacier_peak') {
    return (
      <svg viewBox="0 0 120 68" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="120" height="68" fill="#E0F7FA" />
        <polygon points="0,68 28,28 56,68" fill="#BAE6FD" />
        <polygon points="48,68 84,20 120,68" fill="#7DD3FC" />
        <circle cx="46" cy="40" r="13" fill="#38BDF8" stroke="#0F172A" strokeWidth="2.4" />
        <polygon points="40,36 46,29 52,36 46,42" fill="#FFFFFF" opacity="0.85" />
        <circle cx="86" cy="44" r="10" fill="#0EA5E9" stroke="#0F172A" strokeWidth="2.4" />
        <path d="M14 54 Q62 10 108 38" fill="none" stroke="#0369A1" strokeWidth="2.6" strokeDasharray="4 3" />
      </svg>
    );
  }

  if (m === 'volcano_crater') {
    return (
      <svg viewBox="0 0 120 68" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <rect width="120" height="68" fill="#FFEDD5" />
        <polygon points="0,68 30,26 62,68" fill="#FDBA74" />
        <polygon points="56,68 92,22 120,68" fill="#FB923C" />
        <circle cx="44" cy="42" r="13" fill="#334155" stroke="#0F172A" strokeWidth="2.4" />
        <path d="M37 42 L45 45 L51 37" fill="none" stroke="#F97316" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="84" cy="36" r="11" fill="#475569" stroke="#0F172A" strokeWidth="2.4" />
        <path d="M78 37 L86 34 L89 41" fill="none" stroke="#FACC15" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12 52 Q60 12 108 48" fill="none" stroke="#EA580C" strokeWidth="2.6" strokeDasharray="4 3" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 68" className={className} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <rect width="120" height="68" fill="#FEF9C3" />
      <circle cx="98" cy="16" r="10" fill="#FACC15" />
      <polygon points="8,68 38,24 68,68" fill="#FCD34D" />
      <polygon points="54,68 88,28 118,68" fill="#F59E0B" opacity="0.55" />
      <circle cx="48" cy="42" r="13" fill="#F59E0B" stroke="#0F172A" strokeWidth="2.4" />
      <line x1="36" y1="42" x2="60" y2="42" stroke="#92400E" strokeWidth="1.8" />
      <circle cx="84" cy="44" r="10" fill="#D97706" stroke="#0F172A" strokeWidth="2.4" />
      <path d="M12 52 Q60 12 108 42" fill="none" stroke="#B45309" strokeWidth="2.6" strokeDasharray="4 3" />
    </svg>
  );
};
