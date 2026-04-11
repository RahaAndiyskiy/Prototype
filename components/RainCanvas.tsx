"use client";

import { useEffect, useRef } from "react";

type RainCanvasProps = {
  speedRef: React.MutableRefObject<number>;
  onThunder?: () => void;
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
  mx: number; // mid-point horizontal offset for imperfect streaks
  my: number; // mid-point vertical offset for imperfect streaks
  midRatio: number; // where along the line the bend occurs
  alphaPhase: number;
  alphaFreq: number;
  widthPhase: number;
  widthFreq: number;
  burstTime: number;
  burstDuration: number;
  burstStrength: number;
  burstPhase: number;
  burstActive: boolean;
  layer: "far" | "mid" | "near";
};

type Lightning = {
  path: Array<{ x: number; y: number }>;
  branch?: Array<{ x: number; y: number }>;
  alpha: number;
  life: number;
  maxLife: number;
  width: number;
  glow: number;
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export function RainCanvas({ speedRef, onThunder }: RainCanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dropsRef = useRef<Drop[]>([]);
  const rafRef = useRef<number | null>(null);
  const scrollRef = useRef(0);
  const thunderCallbackRef = useRef(onThunder);

  useEffect(() => {
    thunderCallbackRef.current = onThunder;
  }, [onThunder]);

  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    if (!bgCanvas) return;

    // Ensure we have a foreground canvas appended to <body> so it can
    // reliably sit above the page content (avoid ancestor transform stacking contexts).
    let fgCanvas = fgCanvasRef.current;
    let createdFg = false;
    if (!fgCanvas) {
      fgCanvas = document.createElement("canvas");
      fgCanvas.setAttribute("aria-hidden", "true");
      Object.assign(fgCanvas.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: "9999",
      });
      document.body.appendChild(fgCanvas);
      fgCanvasRef.current = fgCanvas;
      createdFg = true;
    }

    const bgCtx = bgCanvas.getContext("2d");
    const fgCtx = fgCanvas.getContext("2d");
    if (!bgCtx || !fgCtx) {
      if (createdFg && fgCanvas && fgCanvas.parentNode) {
        fgCanvas.parentNode.removeChild(fgCanvas);
        fgCanvasRef.current = null;
      }
      return;
    }

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
      bgCanvas.width = Math.floor(w * dpr);
      bgCanvas.height = Math.floor(h * dpr);
      bgCanvas.style.width = `${w}px`;
      bgCanvas.style.height = `${h}px`;
      bgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

      if (fgCanvas) {
        fgCanvas.width = Math.floor(w * dpr);
        fgCanvas.height = Math.floor(h * dpr);
        fgCanvas.style.width = `${w}px`;
        fgCanvas.style.height = `${h}px`;
        fgCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const lightningBolts: Lightning[] = [];
    let nextLightningTime = performance.now() + randomRange(10, 12) * 1000;

    const scheduleLightning = (now: number) => {
      nextLightningTime = now + randomRange(10, 12) * 1000;
    };

    const createLightningBolt = (): Lightning => {
      const path: Array<{ x: number; y: number }> = [];
      const steps = 6 + Math.floor(Math.random() * 3);
      let px = Math.random() * w;
      let py = 0;
      path.push({ x: px, y: py });
      const targetY = h * (0.88 + Math.random() * 0.08);
      for (let i = 1; i <= steps; i += 1) {
        py = (targetY / steps) * i;
        px += (Math.random() - 0.5) * w * 0.06;
        path.push({ x: clamp(px, 0, w), y: py });
      }

      let branch: Array<{ x: number; y: number }> | undefined;
      if (Math.random() < 0.35) {
        const branchStart = 1 + Math.floor(Math.random() * Math.max(1, steps - 2));
        const base = path[branchStart];
        const branchLen = targetY - base.y;
        const bx = clamp(base.x + (Math.random() - 0.5) * w * 0.08, 0, w);
        const by = base.y + branchLen * (0.35 + Math.random() * 0.15);
        branch = [
          { x: base.x, y: base.y },
          { x: bx, y: by },
          { x: clamp(bx + (Math.random() - 0.5) * 30, 0, w), y: Math.min(h, by + branchLen * 0.15) },
        ];
      }

      return {
        path,
        branch,
        alpha: 1,
        life: 0,
        maxLife: 2.8 + Math.random() * 0.4,
        width: 1.8 + Math.random() * 1.0,
        glow: 16 + Math.random() * 10,
      };
    };

    const igniteLightning = (now: number) => {
      lightningBolts.push(createLightningBolt());
      if (Math.random() < 0.2) {
        const secondBolt = createLightningBolt();
        secondBolt.maxLife *= 0.75;
        secondBolt.glow *= 0.7;
        secondBolt.width *= 0.8;
        lightningBolts.push(secondBolt);
      }
      thunderCallbackRef.current?.();
      scheduleLightning(now);
    };

    setSize();
    window.addEventListener("resize", setSize);

    // Pre-allocate drops into three layer pools (far / mid / near)
    const FAR_POOL = Math.round(MAX_DROPS * 0.6);
    const MID_POOL = Math.round(MAX_DROPS * 0.3);
    const NEAR_POOL = Math.max(1, MAX_DROPS - FAR_POOL - MID_POOL);

    const createLayerDrop = (layer: "far" | "mid" | "near") => {
      const z = Math.random();
      // layer-specific angle and speed ranges
      let angleDeg = BASE_ANGLE;
      let len = lerp(8, 110, z);
      let speed = lerp(320, 1400, z);
      let width = lerp(0.12, 1.0, z);
      let alpha = lerp(0.02, 0.22, z);

      if (layer === "far") {
        angleDeg = 5 + (Math.random() - 0.5) * 2; // ~5deg
        speed = lerp(120, 360, z); // much slower for stronger parallax
        len = lerp(6, 80, z);
        width = lerp(0.06, 0.26, z);
        alpha = lerp(0.008, 0.07, z);
      } else if (layer === "mid") {
        angleDeg = BASE_ANGLE + (Math.random() - 0.5) * 3; // current feel
        speed = lerp(380, 980, z);
        len = lerp(10, 110, z);
        width = lerp(0.12, 1.0, z);
        alpha = lerp(0.02, 0.22, z);
      } else {
        // near
        angleDeg = 9 + (Math.random() - 0.5) * 2; // ~8-10deg for a more consistent fall
        speed = lerp(620, 1400, z); // slower, gentler front drops
        len = lerp(18, 150, z);
        width = lerp(0.18, 1.5, z);
        alpha = lerp(0.06, 0.42, z);
      }

      const angle = (angleDeg * Math.PI) / 180;
      const vx = Math.sin(angle) * speed;
      const vy = Math.cos(angle) * speed;
      const perpX = Math.cos(angle);
      const perpY = -Math.sin(angle);
      const wobble = (Math.random() - 0.5) * (layer === "near" ? 12 : layer === "mid" ? 10 : 8);
      const mx = perpX * wobble;
      const my = perpY * wobble;
      const midRatio = layer === "near" ? 0.28 + Math.random() * 0.14 : 0.32 + Math.random() * 0.24;
      const alphaPhase = Math.random() * Math.PI * 2;
      const alphaFreq = 1.0 + Math.random() * 1.4;
      const widthPhase = Math.random() * Math.PI * 2;
      const widthFreq = 0.8 + Math.random() * 1.2;
      const burstPhase = Math.random() * Math.PI * 2;

      return {
        x: Math.random() * (w + 400) - 200,
        y: Math.random() * h,
        z,
        len,
        speed,
        vx,
        vy,
        width,
        alpha,
        shadow: 0,
        angle,
        ox: -Math.sin(angle) * len,
        oy: -Math.cos(angle) * len,
        mx,
        my,
        midRatio,
        alphaPhase,
        alphaFreq,
        widthPhase,
        widthFreq,
        burstTime: 0,
        burstDuration: 0,
        burstStrength: 1,
        burstPhase,
        burstActive: false,
        layer,
      } as Drop;
    };

    const farDrops: Drop[] = new Array(FAR_POOL).fill(null).map(() => createLayerDrop("far"));
    const midDrops: Drop[] = new Array(MID_POOL).fill(null).map(() => createLayerDrop("mid"));
    const nearDrops: Drop[] = new Array(NEAR_POOL).fill(null).map(() => createLayerDrop("near"));
    dropsRef.current = [...farDrops, ...midDrops, ...nearDrops];

    // impact drops removed — near-layer only drawn as regular drops

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

    bgCtx.lineCap = "round";
    bgCtx.lineJoin = "round";
    fgCtx.lineCap = "round";
    fgCtx.lineJoin = "round";

    // Perf tracking (ring buffer)
    const perfBuf = new Array(PERF_SAMPLES).fill(0);
    let perfIdx = 0;
    let perfCount = 0;
    let perfSum = 0;

    let last = performance.now();
    let activeCount = BASE_DROPS;

    const resetDrop = (drop: Drop, spawnTop = true) => {
      // Recreate properties matching the drop's layer
      const layer = drop.layer || "mid";
      const template = createLayerDrop(layer);
      drop.z = template.z;
      drop.len = template.len;
      drop.speed = template.speed;
      drop.vx = template.vx;
      drop.vy = template.vy;
      drop.width = template.width;
      drop.alpha = template.alpha;
      drop.shadow = template.shadow;
      drop.angle = template.angle;
      drop.ox = template.ox;
      drop.oy = template.oy;
      drop.mx = template.mx;
      drop.my = template.my;
      drop.midRatio = template.midRatio;
      drop.alphaPhase = template.alphaPhase;
      drop.alphaFreq = template.alphaFreq;
      drop.widthPhase = template.widthPhase;
      drop.widthFreq = template.widthFreq;
      drop.burstTime = template.burstTime;
      drop.burstDuration = template.burstDuration;
      drop.burstStrength = template.burstStrength;
      drop.burstPhase = template.burstPhase;
      drop.burstActive = template.burstActive;
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

      // background canvas: fade previous frame so the underlying page shows through
      const fadeAlpha = 0.18;
      bgCtx.globalCompositeOperation = "destination-out";
      bgCtx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
      bgCtx.fillRect(0, 0, w, h);
      bgCtx.globalCompositeOperation = "source-over";

      // foreground canvas: clear each frame so overlay does not darken content
      fgCtx.clearRect(0, 0, w, h);

      // lightning logic
      if (now >= nextLightningTime) {
        igniteLightning(now);
      }

      const drawLightning = (bolt: Lightning) => {
        const brightPhase = bolt.life < 1.0;
        const mainAlpha = brightPhase ? bolt.alpha * 0.9 : bolt.alpha * 0.22;
        const outlineAlpha = brightPhase ? bolt.alpha * 0.55 : bolt.alpha * 0.14;
        const branchAlpha = brightPhase ? bolt.alpha * 0.35 : bolt.alpha * 0.09;
        const glowStrength = brightPhase ? bolt.glow * 0.85 : bolt.glow * 0.28;

        bgCtx.save();
        bgCtx.globalCompositeOperation = "lighter";
        bgCtx.lineCap = "round";
        bgCtx.lineJoin = "round";

        bgCtx.strokeStyle = `rgba(255,255,255,${mainAlpha})`;
        bgCtx.shadowColor = "rgba(220, 235, 255, 0.28)";
        bgCtx.shadowBlur = glowStrength;
        bgCtx.lineWidth = bolt.width * (brightPhase ? 0.85 : 0.55);
        bgCtx.beginPath();
        bolt.path.forEach((point, index) => {
          if (index === 0) bgCtx.moveTo(point.x, point.y);
          else bgCtx.lineTo(point.x, point.y);
        });
        bgCtx.stroke();

        bgCtx.strokeStyle = `rgba(236,248,255,${outlineAlpha})`;
        bgCtx.shadowBlur = 0;
        bgCtx.lineWidth = Math.max(1, bolt.width * (brightPhase ? 0.45 : 0.3));
        bgCtx.beginPath();
        bolt.path.forEach((point, index) => {
          if (index === 0) bgCtx.moveTo(point.x, point.y);
          else bgCtx.lineTo(point.x, point.y);
        });
        bgCtx.stroke();

        if (bolt.branch) {
          bgCtx.strokeStyle = `rgba(255,255,255,${branchAlpha})`;
          bgCtx.lineWidth = bolt.width * (brightPhase ? 0.4 : 0.25);
          bgCtx.beginPath();
          bolt.branch.forEach((point, index) => {
            if (index === 0) bgCtx.moveTo(point.x, point.y);
            else bgCtx.lineTo(point.x, point.y);
          });
          bgCtx.stroke();
        }

        bgCtx.restore();
      };

      for (let i = lightningBolts.length - 1; i >= 0; i -= 1) {
        const bolt = lightningBolts[i];
        bolt.life += dt;
        bolt.alpha = 1 - bolt.life / bolt.maxLife;
        if (bolt.alpha <= 0) {
          lightningBolts.splice(i, 1);
          continue;
        }
        drawLightning(bolt);
      }

      // adjust density with scroll (no allocations)
      const densityMult = 1 + scrollRef.current * 0.18;
      activeCount = clamp(Math.round(BASE_DROPS * densityMult * perfScale), MIN_DROPS, MAX_DROPS);

      // speed multiplier: small scroll-based boost (~+12% max)
      const scrollSpeedBoost = 1 + scrollRef.current * 0.12;
      const speedBoost = clamp(0.9 + Math.min(speedRef.current, 4.5) * 0.15, 0.9, 1.6);
      const globalSpeedMult = (0.75 + perfScale * 0.35) * scrollSpeedBoost * speedBoost;

      // no additive glow — use source-over
      bgCtx.globalCompositeOperation = "source-over";
      fgCtx.globalCompositeOperation = "source-over";

      // decide per-layer counts (ratios)
      const totalDesired = activeCount;
      const farDraw = clamp(Math.round(totalDesired * 0.6), 0, farDrops.length);
      const midDraw = clamp(Math.round(totalDesired * 0.3), 0, midDrops.length);
      let nearDraw = totalDesired - farDraw - midDraw;
      if (nearDraw < 0) nearDraw = 0;
      nearDraw = Math.min(nearDraw, nearDrops.length);

      const windLocal = wind;
      const t = now * 0.001;

      // draw far layer (almost vertical, slow, faint) into background ctx
      for (let i = 0; i < farDraw; i++) {
        const d = farDrops[i];
        d.x += (d.vx + windLocal) * dt * globalSpeedMult;
        d.y += d.vy * dt * globalSpeedMult;
        if (d.y - d.len > h + 40 || d.x < -300 || d.x > w + 300) resetDrop(d, true);
        const tailX = d.x + d.ox;
        const tailY = d.y + d.oy;
        const midX = tailX + (d.x - tailX) * d.midRatio + d.mx * 0.25;
        const midY = tailY + (d.y - tailY) * d.midRatio + d.my * 0.25;
        const pulse = 0.92 + Math.sin(t * d.widthFreq + d.widthPhase) * 0.06;
        const alphaPulse = 0.92 + Math.sin(t * d.alphaFreq + d.alphaPhase) * 0.08;
        const baseAlpha = clamp(d.alpha * (0.7 + scrollRef.current * 0.12) * perfScale * alphaPulse, 0.005, 0.18);
        bgCtx.strokeStyle = "#ffffff";

        bgCtx.lineWidth = d.width * 1.25 * pulse;
        bgCtx.globalAlpha = baseAlpha * 0.22;
        bgCtx.beginPath();
        bgCtx.moveTo(tailX, tailY);
        bgCtx.lineTo(midX, midY);
        bgCtx.stroke();

        bgCtx.lineWidth = d.width * 0.9 * pulse;
        bgCtx.globalAlpha = clamp(baseAlpha * 1.08, 0, 0.3);
        bgCtx.beginPath();
        bgCtx.moveTo(midX, midY);
        bgCtx.lineTo(d.x, d.y);
        bgCtx.stroke();
      }

      // draw mid layer (main) into background ctx
      for (let i = 0; i < midDraw; i++) {
        const d = midDrops[i];
        d.x += (d.vx + windLocal) * dt * globalSpeedMult;
        d.y += d.vy * dt * globalSpeedMult;
        if (d.y - d.len > h + 40 || d.x < -300 || d.x > w + 300) resetDrop(d, true);
        const tailX = d.x + d.ox;
        const tailY = d.y + d.oy;
        const midX = tailX + (d.x - tailX) * d.midRatio + d.mx * 0.35;
        const midY = tailY + (d.y - tailY) * d.midRatio + d.my * 0.35;
        const pulse = 0.9 + Math.sin(t * d.widthFreq + d.widthPhase) * 0.07;
        const alphaPulse = 0.9 + Math.sin(t * d.alphaFreq + d.alphaPhase) * 0.08;
        const baseAlpha = clamp(d.alpha * (0.75 + scrollRef.current * 0.15) * perfScale * alphaPulse, 0.01, 0.35);
        bgCtx.strokeStyle = "#ffffff";

        bgCtx.lineWidth = d.width * 1.4 * pulse;
        bgCtx.globalAlpha = baseAlpha * 0.2;
        bgCtx.beginPath();
        bgCtx.moveTo(tailX, tailY);
        bgCtx.lineTo(midX, midY);
        bgCtx.stroke();

        bgCtx.lineWidth = d.width * 0.95 * pulse;
        bgCtx.globalAlpha = clamp(baseAlpha * 1.1, 0, 0.42);
        bgCtx.beginPath();
        bgCtx.moveTo(midX, midY);
        bgCtx.lineTo(d.x, d.y);
        bgCtx.stroke();
      }

      // draw near layer (sparse, faster, brighter) into foreground ctx (overlay)
      for (let i = 0; i < nearDraw; i++) {
        const d = nearDrops[i];

        if (!d.burstActive && Math.random() < dt * 0.004) {
          d.burstActive = true;
          d.burstTime = 0;
          d.burstDuration = 0.22 + Math.random() * 0.18;
          d.burstStrength = 1.18 + Math.random() * 0.16;
          d.burstPhase = Math.random() * Math.PI * 2;
        }

        if (d.burstActive) {
          d.burstTime += dt;
          if (d.burstTime >= d.burstDuration) {
            d.burstActive = false;
          }
        }

        const burstFactor = d.burstActive ? 1 + (d.burstStrength - 1) * (1 - d.burstTime / d.burstDuration) : 1;
        d.x += (d.vx + windLocal * 1.05) * dt * globalSpeedMult;
        d.y += d.vy * dt * globalSpeedMult * burstFactor;
        if (d.y - d.len > h + 40 || d.x < -300 || d.x > w + 300) resetDrop(d, true);
        const tailX = d.x + d.ox;
        const tailY = d.y + d.oy;
        const midX = tailX + (d.x - tailX) * d.midRatio + d.mx * 0.45;
        const midY = tailY + (d.y - tailY) * d.midRatio + d.my * 0.45;
        const pulse = 0.9 + Math.sin(t * d.widthFreq + d.widthPhase) * 0.08;
        const alphaPulse = 0.88 + Math.sin(t * d.alphaFreq + d.alphaPhase) * 0.12;
        const baseAlpha = clamp(d.alpha * (0.95 + scrollRef.current * 0.24) * perfScale * alphaPulse, 0.03, 0.62);
        fgCtx.strokeStyle = "#ffffff";

        fgCtx.lineWidth = d.width * 1.8 * pulse;
        fgCtx.globalAlpha = baseAlpha * 0.15;
        fgCtx.beginPath();
        fgCtx.moveTo(tailX, tailY);
        fgCtx.lineTo(midX, midY);
        fgCtx.stroke();

        fgCtx.lineWidth = d.width * 1.05 * pulse;
        fgCtx.globalAlpha = clamp(baseAlpha * 1.12, 0, 0.7);
        fgCtx.beginPath();
        fgCtx.moveTo(midX, midY);
        fgCtx.lineTo(d.x, d.y);
        fgCtx.stroke();
      }

      // impact drops removed — no special spawn logic

      // impact drops removed — nothing to update here

      bgCtx.globalAlpha = 1;
      bgCtx.globalCompositeOperation = "source-over";
      fgCtx.globalAlpha = 1;
      fgCtx.globalCompositeOperation = "source-over";

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", setSize);
      window.removeEventListener("scroll", onScroll);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      // remove programmatically created foreground canvas if we added one
      if (createdFg && fgCanvasRef.current && fgCanvasRef.current.parentNode) {
        try {
          fgCanvasRef.current.parentNode.removeChild(fgCanvasRef.current);
        } catch (e) {
          /* ignore */
        }
        fgCanvasRef.current = null;
      }
    };
  }, [speedRef]);

  return (
    <canvas
      ref={bgCanvasRef}
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 1,
      }}
    />
  );
}