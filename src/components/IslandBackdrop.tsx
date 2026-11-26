import React, { useEffect, useRef, useState } from 'react';
import { GridDensity, ThemeMode } from './SettingsModal';

interface IslandBackdropProps {
  theme: ThemeMode;
  gridDensity: GridDensity;
  paused?: boolean;
}

interface CloudItem {
  x: number;
  y: number;
  scale: number;
  speed: number;
}

interface FloatingIsland {
  xFrac: number;
  yFrac: number;
  width: number;
  bobPhase: number;
  variant: 'meadow' | 'ice' | 'desert';
}

/**
 * Bright, sunlit "Canlı Çizgi-Arcade Adaları" sky & floating islands backdrop.
 * - Supports optional user video (`/bg-gameplay.mp4`) if placed in `/public`.
 * - Automatic Canvas2D fallback renders drifting cartoon clouds, distant floating
 *   islands, and a faint cheerful parabola arc — keeping foreground UI razor sharp.
 * - Pauses cleanly when inside a match so GPU/CPU go 100% to the arena canvas.
 */
export const IslandBackdrop: React.FC<IslandBackdropProps> = ({
  theme,
  gridDensity,
  paused = false,
}) => {
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const gridRef = useRef(gridDensity);
  gridRef.current = gridDensity;

  useEffect(() => {
    if (videoReady) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let rafId = 0;
    let timerId = 0;
    let disposed = false;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.max(1, Math.floor(width));
      canvas.height = Math.max(1, Math.floor(height));
    };
    resize();
    window.addEventListener('resize', resize);

    const clouds: CloudItem[] = [
      { x: width * 0.1, y: height * 0.14, scale: 1.15, speed: 9 },
      { x: width * 0.42, y: height * 0.09, scale: 0.9, speed: 6 },
      { x: width * 0.78, y: height * 0.16, scale: 1.25, speed: 7.5 },
      { x: width * 0.24, y: height * 0.34, scale: 0.78, speed: 5.5 },
      { x: width * 0.88, y: height * 0.38, scale: 0.85, speed: 8 },
    ];

    const islands: FloatingIsland[] = [
      { xFrac: 0.09, yFrac: 0.78, width: 130, bobPhase: 0.4, variant: 'meadow' },
      { xFrac: 0.89, yFrac: 0.74, width: 145, bobPhase: 2.1, variant: 'ice' },
      { xFrac: 0.52, yFrac: 0.92, width: 110, bobPhase: 4.0, variant: 'desert' },
    ];

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    let lastTime = performance.now();

    const drawIsland = (isl: FloatingIsland, timeSec: number, isDark: boolean) => {
      const cx = width * isl.xFrac;
      const cy = height * isl.yFrac + Math.sin(timeSec * 0.9 + isl.bobPhase) * 6;
      const hw = isl.width * 0.5;
      const depth = isl.width * 0.44;
      const ink = isDark ? '#020617' : '#0F172A';

      ctx.save();
      ctx.globalAlpha = isDark ? 0.55 : 0.82;

      // Floating rocky cone underside
      ctx.fillStyle =
        isl.variant === 'ice'
          ? isDark
            ? '#0E4A6F'
            : '#38BDF8'
          : isl.variant === 'desert'
            ? isDark
              ? '#78350F'
              : '#D97706'
            : isDark
              ? '#4B3222'
              : '#B47B49';
      ctx.beginPath();
      ctx.moveTo(cx - hw, cy);
      ctx.lineTo(cx + hw, cy);
      ctx.lineTo(cx + hw * 0.45, cy + depth * 0.72);
      ctx.lineTo(cx, cy + depth);
      ctx.lineTo(cx - hw * 0.5, cy + depth * 0.68);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Top cap (grass / snow / golden sand)
      ctx.fillStyle =
        isl.variant === 'ice'
          ? '#E0F2FE'
          : isl.variant === 'desert'
            ? '#FDE047'
            : '#4ADE80';
      ctx.beginPath();
      ctx.ellipse(cx, cy, hw + 4, 14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    };

    const drawFrame = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.08);
      lastTime = now;
      const timeSec = now / 1000;
      const isDark = themeRef.current === 'dark';

      // 1. Vibrant Sky Gradient (Sunlit Day Island vs Starry Twilight Island)
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        sky.addColorStop(0, '#071122');
        sky.addColorStop(0.55, '#0D1E38');
        sky.addColorStop(1, '#132B4D');
      } else {
        sky.addColorStop(0, '#5EC6FF');
        sky.addColorStop(0.52, '#A5E3FF');
        sky.addColorStop(1, '#E6F8FF');
      }
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);

      // 2. Subtle sunlit glow or starry night sky
      if (!isDark) {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.55)';
        ctx.beginPath();
        ctx.arc(width * 0.14, height * 0.15, 58, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FEF08A';
        ctx.beginPath();
        ctx.arc(width * 0.14, height * 0.15, 34, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(254, 240, 138, 0.65)';
        for (let i = 0; i < 24; i++) {
          const sx = ((i * 197) % 100) * 0.01 * width;
          const sy = ((i * 83) % 58) * 0.01 * height;
          const sr = i % 3 === 0 ? 2.2 : 1.4;
          ctx.beginPath();
          ctx.arc(sx, sy, sr, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Faint coordinate graph blueprint pattern across the sky
      const step = gridRef.current === 'minimal' ? 96 : 56;
      ctx.strokeStyle = isDark ? 'rgba(125, 211, 252, 0.06)' : 'rgba(255, 255, 255, 0.24)';
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 4. Drifting Fluffy Cartoon Clouds
      ctx.fillStyle = isDark ? 'rgba(186, 230, 253, 0.1)' : 'rgba(255, 255, 255, 0.88)';
      for (const c of clouds) {
        if (!prefersReducedMotion && !paused) {
          c.x += c.speed * dt;
          if (c.x - 90 * c.scale > width) c.x = -90 * c.scale;
        }
        const s = c.scale;
        ctx.beginPath();
        ctx.arc(c.x, c.y, 26 * s, 0, Math.PI * 2);
        ctx.arc(c.x + 24 * s, c.y - 8 * s, 22 * s, 0, Math.PI * 2);
        ctx.arc(c.x + 48 * s, c.y + 2 * s, 20 * s, 0, Math.PI * 2);
        ctx.arc(c.x - 24 * s, c.y + 4 * s, 19 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Distant Floating Cartoon Islands (bottom corners for depth)
      for (const isl of islands) {
        drawIsland(isl, paused ? 0 : timeSec, isDark);
      }

      // 6. Cheerful dashed parabola arc connecting left and right floating islands
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(56, 189, 248, 0.22)' : 'rgba(2, 132, 199, 0.22)';
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 8]);
      ctx.beginPath();
      ctx.moveTo(width * 0.09, height * 0.76);
      ctx.quadraticCurveTo(width * 0.5, height * 0.26, width * 0.89, height * 0.72);
      ctx.stroke();
      ctx.restore();

      if (!prefersReducedMotion && !paused) {
        timerId = window.setTimeout(() => {
          if (!disposed) rafId = requestAnimationFrame(drawFrame);
        }, 55);
      }
    };

    const handleResizeRedraw = () => {
      resize();
      drawFrame(performance.now());
    };
    window.removeEventListener('resize', resize);
    window.addEventListener('resize', handleResizeRedraw);

    rafId = requestAnimationFrame(drawFrame);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
      window.removeEventListener('resize', handleResizeRedraw);
    };
  }, [videoReady, paused, theme, gridDensity]);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      {!videoFailed && (
        <video
          autoPlay
          loop
          muted
          playsInline
          onCanPlay={() => setVideoReady(true)}
          onError={() => setVideoFailed(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            videoReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <source src="/bg-gameplay.webm" type="video/webm" />
          <source src="/bg-gameplay.mp4" type="video/mp4" />
        </video>
      )}

      {!videoReady && <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />}
    </div>
  );
};
