'use client';
import { useEffect, useRef } from 'react';

// Cinematic opening: an abstract CORE ignites while the city renderer prepares.
// Pure presentation — no data, coordinates or aircraft are represented.
interface Particle {
  angle: number;
  radius: number;
  speed: number;
  size: number;
  hue: 0 | 1 | 2;
  delay: number;
}
const palette = ['70, 232, 255', '155, 123, 255', '238, 243, 255'];
const ease = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);

export function IntroIgnition({ exiting }: { exiting: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const exitAt = useRef<number | null>(null);
  useEffect(() => {
    if (exiting && exitAt.current === null) exitAt.current = performance.now();
  }, [exiting]);
  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext('2d');
    if (!el || !ctx) return;
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);
    let w = 0,
      h = 0;
    const resize = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const count = w < 700 ? 520 : 1100;
    const particles: Particle[] = Array.from({ length: count }, (_, i) => ({
      angle: (i / count) * Math.PI * 2 * 7.3 + Math.random() * 0.6,
      radius: 0.55 + Math.random() * 0.6,
      speed: 0.6 + Math.random() * 1.4,
      size: 0.6 + Math.random() * 1.6,
      hue: (Math.random() < 0.62 ? 0 : Math.random() < 0.8 ? 1 : 2) as 0 | 1 | 2,
      delay: Math.random() * 0.5,
    }));
    const streaks = Array.from({ length: 140 }, () => ({
      angle: Math.random() * Math.PI * 2,
      start: 0.05 + Math.random() * 0.25,
      length: 0.08 + Math.random() * 0.35,
      speed: 0.5 + Math.random(),
    }));
    const start = performance.now();
    let frame = 0;
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const exit = exitAt.current === null ? 0 : (now - exitAt.current) / 1000;
      const cx = w / 2,
        cy = h * 0.46;
      const span = Math.hypot(w, h) * 0.55;
      const core = Math.min(w, h) * 0.075;
      // Motion-blur trails: translucent clear instead of a full wipe.
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = `rgba(5, 6, 13, ${t < 0.15 ? 1 : 0.24})`;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      // Accretion: particles spiral from the edges into the core.
      const gather = ease((t - 0.1) / 1.3);
      for (const p of particles) {
        const local = ease((t - p.delay * 0.6) / 1.2);
        const r = core * 1.15 + (p.radius * span - core) * (1 - local) * (1 - gather * 0.25);
        const a = p.angle + t * p.speed * (0.4 + local * 1.6);
        const x = cx + Math.cos(a) * r,
          y = cy + Math.sin(a) * r * 0.82;
        const alpha = Math.min(1, t * 2) * (0.35 + local * 0.65) * (1 - Math.min(1, exit * 2.2));
        ctx.fillStyle = `rgba(${palette[p.hue]}, ${alpha})`;
        ctx.fillRect(x, y, p.size, p.size);
      }
      // Core glow, breathing once ignition completes.
      const ignite = ease((t - 0.35) / 0.9);
      const pulse = 1 + Math.sin(t * 6) * 0.05 * ignite;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, core * 3.2 * pulse);
      glow.addColorStop(0, `rgba(238, 243, 255, ${0.9 * ignite})`);
      glow.addColorStop(0.18, `rgba(70, 232, 255, ${0.55 * ignite})`);
      glow.addColorStop(0.5, `rgba(155, 123, 255, ${0.16 * ignite})`);
      glow.addColorStop(1, 'rgba(5, 6, 13, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, core * 3.2 * pulse, 0, Math.PI * 2);
      ctx.fill();
      // Ion rings radiate from the core.
      for (let i = 0; i < 3; i++) {
        const phase = (t * 0.7 + i / 3) % 1;
        if (t < 0.6) break;
        ctx.strokeStyle = `rgba(124, 240, 255, ${(1 - phase) * 0.45 * ignite})`;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(
          cx,
          cy,
          core * (1.2 + phase * 5),
          core * (1.2 + phase * 5) * 0.82,
          0,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      }
      // Warp streaks once the core is lit.
      const warp = ease((t - 1.0) / 0.8) + exit * 3;
      if (warp > 0)
        for (const s of streaks) {
          const r0 = span * (s.start + warp * 0.35 * s.speed);
          const r1 = r0 + span * s.length * Math.min(1, warp);
          ctx.strokeStyle = `rgba(124, 240, 255, ${0.35 * Math.min(1, warp) * (1 - Math.min(1, exit * 1.6))})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(s.angle) * r0, cy + Math.sin(s.angle) * r0 * 0.82);
          ctx.lineTo(cx + Math.cos(s.angle) * r1, cy + Math.sin(s.angle) * r1 * 0.82);
          ctx.stroke();
        }
      // Shockwave + flash on hand-off to the 3D city.
      if (exit > 0) {
        const wave = ease(exit / 0.9);
        ctx.strokeStyle = `rgba(238, 243, 255, ${0.85 * (1 - wave)})`;
        ctx.lineWidth = 3 + 30 * (1 - wave);
        ctx.beginPath();
        ctx.ellipse(cx, cy, span * 1.4 * wave, span * 1.4 * wave * 0.82, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(200, 245, 255, ${Math.max(0, 0.5 - exit * 1.4)})`;
        ctx.fillRect(0, 0, w, h);
      }
      if (exit < 1.2) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    const visibility = () => {
      cancelAnimationFrame(frame);
      if (!document.hidden) frame = requestAnimationFrame(draw);
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  return (
    <canvas ref={canvas} className="intro-ignition" data-exiting={exiting} aria-hidden="true" />
  );
}
