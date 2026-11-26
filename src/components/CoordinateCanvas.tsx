import React, { useEffect, useRef, useState } from 'react';
import { compileMathFunction, Point2D } from '../engine/mathParser';
import { GridDensity, ThemeMode } from './SettingsModal';

export interface PlottedCurve {
  equation: string;
  color: string;
  dashed?: boolean;
  domainMin?: number | null;
  domainMax?: number | null;
  label?: string;
}

export interface PlottedMarker {
  x: number;
  y: number;
  kind: 'hit' | 'miss' | 'point' | 'vertex' | 'lattice';
  label?: string;
  color?: string;
}

interface CoordinateCanvasProps {
  range?: number; // grid extends [-range, range]
  curves?: PlottedCurve[];
  markers?: PlottedMarker[];
  interactive?: boolean;
  theme?: ThemeMode;
  gridDensity?: GridDensity;
  onLatticeClick?: (x: number, y: number) => void;
  className?: string;
  testId?: string;
}

export const CoordinateCanvas: React.FC<CoordinateCanvasProps> = ({
  range = 7,
  curves = [],
  markers = [],
  interactive = false,
  theme = 'light',
  gridDensity = 'full',
  onLatticeClick,
  className = '',
  testId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [hoverPt, setHoverPt] = useState<Point2D | null>(null);

  const screenToLattice = (clientX: number, clientY: number): Point2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const pad = 26;
    const scale = (Math.min(rect.width, rect.height) - pad * 2) / (range * 2);
    const gx = Math.round((clientX - rect.left - cx) / scale);
    const gy = Math.round((cy - (clientY - rect.top)) / scale);
    if (gx < -range || gx > range || gy < -range || gy > range) return null;
    return { x: gx, y: gy };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const w = rect.width;
      const h = rect.height;
      const cx = w / 2;
      const cy = h / 2;
      const pad = 26;
      const scale = (Math.min(w, h) - pad * 2) / (range * 2);
      const isDark = theme === 'dark';

      const toScreen = (x: number, y: number) => ({
        px: cx + x * scale,
        py: cy - y * scale,
      });

      // Background
      ctx.fillStyle = isDark ? '#0A1019' : '#FFFFFF';
      ctx.fillRect(0, 0, w, h);

      // Grid lines
      ctx.lineWidth = 1;
      for (let i = -range; i <= range; i++) {
        if (gridDensity === 'minimal' && i !== 0 && i % 2 !== 0) continue;
        const { px } = toScreen(i, 0);
        const { py } = toScreen(0, i);

        ctx.strokeStyle =
          i === 0
            ? isDark
              ? 'rgba(148, 163, 184, 0.5)'
              : 'rgba(15, 23, 42, 0.45)'
            : isDark
              ? 'rgba(148, 163, 184, 0.1)'
              : 'rgba(148, 163, 184, 0.25)';

        ctx.beginPath();
        ctx.moveTo(px, pad * 0.4);
        ctx.lineTo(px, h - pad * 0.4);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(pad * 0.4, py);
        ctx.lineTo(w - pad * 0.4, py);
        ctx.stroke();
      }

      // Axis labels
      ctx.fillStyle = isDark ? '#64748B' : '#475569';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      for (let i = -range; i <= range; i++) {
        if (i === 0) continue;
        if (range > 8 && i % 2 !== 0) continue;
        const { px } = toScreen(i, 0);
        ctx.fillText(String(i), px, cy + 5);
      }
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      for (let i = -range; i <= range; i++) {
        if (i === 0) continue;
        if (range > 8 && i % 2 !== 0) continue;
        const { py } = toScreen(0, i);
        ctx.fillText(String(i), cx - 6, py);
      }

      ctx.fillStyle = isDark ? '#94A3B8' : '#0F172A';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('x', w - 10, cy - 8);
      ctx.textAlign = 'left';
      ctx.fillText('y', cx + 8, 14);

      // Plot function curves
      for (const curve of curves) {
        const compiled = compileMathFunction(curve.equation);
        if (!compiled.fn) continue;
        const dMin =
          curve.domainMin !== null && curve.domainMin !== undefined ? curve.domainMin : -range - 0.5;
        const dMax =
          curve.domainMax !== null && curve.domainMax !== undefined ? curve.domainMax : range + 0.5;

        ctx.save();
        ctx.strokeStyle =
          !isDark && curve.color === '#22D3EE' ? '#0284C7' : curve.color;
        ctx.lineWidth = 2.6;
        if (curve.dashed) ctx.setLineDash([6, 5]);
        ctx.beginPath();
        let started = false;
        const steps = 260;
        for (let i = 0; i <= steps; i++) {
          const x = dMin + (i / steps) * (dMax - dMin);
          const y = compiled.fn(x);
          if (!Number.isFinite(y) || y < -range - 1.5 || y > range + 1.5) {
            started = false;
            continue;
          }
          const { px, py } = toScreen(x, y);
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
        }
        ctx.stroke();
        ctx.restore();

        if (curve.domainMin !== null && curve.domainMin !== undefined) {
          const y0 = compiled.fn(curve.domainMin);
          if (Number.isFinite(y0)) {
            const p0 = toScreen(curve.domainMin, y0);
            ctx.fillStyle = !isDark && curve.color === '#22D3EE' ? '#0284C7' : curve.color;
            ctx.beginPath();
            ctx.arc(p0.px, p0.py, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        if (curve.domainMax !== null && curve.domainMax !== undefined) {
          const y1 = compiled.fn(curve.domainMax);
          if (Number.isFinite(y1)) {
            const p1 = toScreen(curve.domainMax, y1);
            ctx.fillStyle = !isDark && curve.color === '#22D3EE' ? '#0284C7' : curve.color;
            ctx.beginPath();
            ctx.arc(p1.px, p1.py, 4.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Plot markers
      for (const m of markers) {
        const { px, py } = toScreen(m.x, m.y);
        if (m.kind === 'hit') {
          ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
          ctx.beginPath();
          ctx.arc(px, py, 10, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#059669';
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
        } else if (m.kind === 'miss') {
          ctx.strokeStyle = isDark ? '#64748B' : '#94A3B8';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - 4.5, py - 4.5);
          ctx.lineTo(px + 4.5, py + 4.5);
          ctx.moveTo(px + 4.5, py - 4.5);
          ctx.lineTo(px - 4.5, py + 4.5);
          ctx.stroke();
        } else if (m.kind === 'vertex') {
          ctx.fillStyle = '#D97706';
          ctx.beginPath();
          ctx.arc(px, py, 5.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (m.kind === 'lattice') {
          ctx.fillStyle = !isDark && m.color === '#22D3EE' ? '#0284C7' : m.color || '#0284C7';
          ctx.beginPath();
          ctx.arc(px, py, 3.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = !isDark && m.color === '#22D3EE' ? '#0284C7' : m.color || '#0284C7';
          ctx.beginPath();
          ctx.arc(px, py, 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Interactive hover reticle
      if (interactive && hoverPt) {
        const { px, py } = toScreen(hoverPt.x, hoverPt.y);
        const accent = isDark ? '#22D3EE' : '#0284C7';
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, 9, 0, Math.PI * 2);
        ctx.stroke();

        const tag = `[${hoverPt.x}, ${hoverPt.y}]`;
        ctx.font = '600 11px "JetBrains Mono", monospace';
        const tw = ctx.measureText(tag).width + 12;
        const bx = Math.min(w - tw - 6, Math.max(6, px + 10));
        const by = Math.max(6, py - 24);
        ctx.fillStyle = isDark ? '#121926' : '#FFFFFF';
        ctx.fillRect(bx, by, tw, 20);
        ctx.strokeStyle = accent;
        ctx.strokeRect(bx, by, tw, 20);
        ctx.fillStyle = accent;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(tag, bx + 6, by + 10);
      }
    };

    render();
    const ro = new ResizeObserver(render);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [range, curves, markers, interactive, hoverPt, theme, gridDensity]);

  return (
    <canvas
      ref={canvasRef}
      data-testid={testId}
      onMouseMove={(e) => {
        if (!interactive) return;
        setHoverPt(screenToLattice(e.clientX, e.clientY));
      }}
      onMouseLeave={() => setHoverPt(null)}
      onClick={(e) => {
        if (!interactive || !onLatticeClick) return;
        const pt = screenToLattice(e.clientX, e.clientY);
        if (pt) onLatticeClick(pt.x, pt.y);
      }}
      className={`w-full h-full rounded-xl border border-slate-200 dark:border-slate-800 block ${
        interactive ? 'cursor-crosshair' : ''
      } ${className}`}
    />
  );
};
