"use client";

import { useEffect, useRef } from "react";

type RainCanvasProps = {
  speedRef: React.MutableRefObject<number>;
};

type Drop = {
  x: number;
  y: number;
  z: number;
  len: number;
  speed: number; // px / s
  vx: number;
  vy: number;
  width: number;
  alpha: number;
  shadow: number;
  angle: number;
  ox: number; // tail offset x (precomputed)
  oy: number; // tail offset y (precomputed)
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function RainCanvas({ speedRef }: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dropsRef = useRef<Drop[]>([]);
  const rafRef = useRef<number | null>(null);
  const scrollRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Config
    const BASE_DROPS = 240; // reduced base count
    const MAX_DROPS = 420; // hard cap
    const MIN_DROPS = 120; // allow much lower counts on weak devices
    const BASE_ANGLE = 12; // degrees (10-15)
    const MAX_DPR = 1.0; // cap DPR aggressively for performance
    const PERF_SAMPLES = 30; // rolling window for FPS estimation

    let dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
    let w = window.innerWidth;
    let h = window.innerHeight;

    const setSize = () => {
      dpr = Math.min(MAX_DPR, Math.max(1, window.devicePixelRatio || 1));
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setSize();
    window.addEventListener("resize", setSize);

    // Pre-allocate drops (avoid allocating during animation)
    const drops: Drop[] = new Array(MAX_DROPS).fill(null).map(() => {
      const z = Math.random();
      const angle = ((BASE_ANGLE + (Math.random() - 0.5) * 4) * Math.PI) / 180;
      const len = lerp(8, 110, z);
      const speed = lerp(320, 1400, z);
      const vx = Math.sin(angle) * speed;
      const vy = Math.cos(angle) * speed;
      return {
        x: Math.random() * (w + 400) - 200,
        y: Math.random() * h,
        z,
        len,
        speed,
        vx,
        vy,
        width: lerp(0.12, 1.0, z), // much thinner
        alpha: lerp(0.02, 0.22, z), // dimmer, no bright glow
        shadow: 0, // disable shadows for perf
        angle,
        ox: -Math.sin(angle) * len,
        oy: -Math.cos(angle) * len,
      } as Drop;
    });
    dropsRef.current = drops;

    // Wind (small lateral movement) — will drift slowly
    let wind = (Math.random() - 0.5) * 40;
    let windTarget = wind;
    let windTimer = 0;

    const onScroll = () => {
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const p = docH > 0 ? window.scrollY / docH : 0;
      scrollRef.current = clamp(p, 0, 1);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Perf tracking (ring buffer)
    const perfBuf = new Array(PERF_SAMPLES).fill(0);
    let perfIdx = 0;
    let perfCount = 0;
    let perfSum = 0;

    let last = performance.now();
    let activeCount = BASE_DROPS;

    const resetDrop = (drop: Drop, spawnTop = true) => {
      const z = Math.random();
      const angle = ((BASE_ANGLE + (Math.random() - 0.5) * 4) * Math.PI) / 180;
      const len = lerp(8, 110, z);
      const speed = lerp(320, 1400, z);
      drop.z = z;
      drop.angle = angle;
      drop.speed = speed;
      drop.vx = Math.sin(angle) * speed;
      drop.vy = Math.cos(angle) * speed;
      drop.len = len;
      drop.width = lerp(0.12, 1.0, z);
      drop.alpha = lerp(0.02, 0.22, z);
      drop.shadow = 0;
      drop.ox = -Math.sin(angle) * len;
      drop.oy = -Math.cos(angle) * len;
      drop.x = Math.random() * (w + 400) - 200;
      drop.y = spawnTop ? -Math.random() * (h * 0.35) - drop.len : Math.random() * h;
    };

    const render = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // subtle drifting wind target
      windTimer += dt;
      if (windTimer > 2.5) {
        windTimer = 0;
        windTarget = (Math.random() - 0.5) * 60 * (0.5 + scrollRef.current * 1.2);
      }
      wind += (windTarget - wind) * dt * 0.5;

      // performance tracking (ring buffer)
      perfSum -= perfBuf[perfIdx];
      perfBuf[perfIdx] = dt;
      perfSum += dt;
      perfIdx = (perfIdx + 1) % PERF_SAMPLES;
      perfCount = Math.min(perfCount + 1, PERF_SAMPLES);
      const avgDt = perfSum / perfCount || dt;
      const avgFps = avgDt > 0 ? 1 / avgDt : 60;
      const perfScale = clamp(avgFps / 55, 0.35, 1); // <1 when FPS drops

      // stronger fade to quickly remove trails and reduce visible brightness
      const fadeAlpha = 0.18;
      ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
      ctx.fillRect(0, 0, w, h);

      // adjust density with scroll (no allocations)
      const densityMult = 1 + scrollRef.current * 0.2;
      activeCount = clamp(Math.round(BASE_DROPS * densityMult * perfScale), MIN_DROPS, MAX_DROPS);

      // speed multiplier: fixed local multiplier (ignore external speedRef)
      const globalSpeedMult = (0.7 + perfScale * 0.3);

      // no additive glow — use source-over
      ctx.globalCompositeOperation = "source-over";

      // cache often-used values
      const dropsLocal = dropsRef.current;
      const windLocal = wind;
      for (let i = 0; i < activeCount; i++) {
        const d = dropsLocal[i];

        // update position (px per second * dt)
        d.x += (d.vx + windLocal) * dt * globalSpeedMult;
        d.y += d.vy * dt * globalSpeedMult;

        // if off-screen -> recycle
        if (d.y - d.len > h + 40 || d.x < -300 || d.x > w + 300) {
          resetDrop(d, true);
        }

        // draw streak from precomputed tail offset -> head
        const tailX = d.x + d.ox;
        const tailY = d.y + d.oy;

        ctx.lineWidth = d.width;
        const alpha = clamp(d.alpha * (0.7 + scrollRef.current * 0.15) * perfScale, 0.01, 0.45);
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = "#ffffff";

        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(d.x, d.y);
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", setSize);
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [speedRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: -1,
      }}
    />
  );
}