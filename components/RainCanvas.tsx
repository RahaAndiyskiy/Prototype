"use client";

import { useEffect, useRef } from "react";

type RainCanvasProps = {
  speedRef: React.MutableRefObject<number>;
};

type Drop = {
  x: number;
  y: number;
  length: number;
  speed: number;
  thickness: number;
  alpha: number;
};

const ANGLE = Math.PI * 0.2;
const FAR_COLOR = "rgba(170, 196, 255, 0.14)";
const NEAR_COLOR = "rgba(215, 228, 255, 0.32)";

function createDrop(width: number, height: number, near: boolean): Drop {
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    length: near ? 28 + Math.random() * 32 : 16 + Math.random() * 18,
    speed: near ? 520 + Math.random() * 260 : 250 + Math.random() * 140,
    thickness: near ? 1.4 + Math.random() * 1.2 : 0.6 + Math.random() * 0.8,
    alpha: near ? 0.2 + Math.random() * 0.24 : 0.08 + Math.random() * 0.12,
  };
}

export function RainCanvas({ speedRef }: RainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    let width = 0;
    let height = 0;
    let animationFrame = 0;
    let lastTime = 0;
    let farDrops: Drop[] = [];
    let nearDrops: Drop[] = [];

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      farDrops = Array.from({ length: Math.max(80, Math.floor(width * 0.08)) }, () =>
        createDrop(width, height, false),
      );
      nearDrops = Array.from({ length: Math.max(46, Math.floor(width * 0.045)) }, () =>
        createDrop(width, height, true),
      );
    };

    const resetDrop = (drop: Drop, near: boolean) => {
      drop.x = Math.random() * (width + 180) - 120;
      drop.y = -drop.length - Math.random() * height * 0.35;
      drop.length = near ? 28 + Math.random() * 32 : 16 + Math.random() * 18;
      drop.speed = near ? 520 + Math.random() * 260 : 250 + Math.random() * 140;
      drop.thickness = near ? 1.4 + Math.random() * 1.2 : 0.6 + Math.random() * 0.8;
      drop.alpha = near ? 0.2 + Math.random() * 0.24 : 0.08 + Math.random() * 0.12;
    };

    const drawLayer = (drops: Drop[], near: boolean, deltaSeconds: number) => {
      const speedMultiplier = speedRef.current;

      context.strokeStyle = near ? NEAR_COLOR : FAR_COLOR;
      context.lineCap = "round";

      for (const drop of drops) {
        const velocity = drop.speed * speedMultiplier * deltaSeconds;
        drop.y += velocity;
        drop.x -= velocity * 0.34;

        if (drop.y - drop.length > height || drop.x < -220) {
          resetDrop(drop, near);
          drop.y = height + Math.random() * 60;
        }

        const offsetX = Math.sin(ANGLE) * drop.length;
        const offsetY = Math.cos(ANGLE) * drop.length;

        context.globalAlpha = drop.alpha;
        context.lineWidth = drop.thickness;
        context.beginPath();
        context.moveTo(drop.x, drop.y);
        context.lineTo(drop.x + offsetX, drop.y + offsetY);
        context.stroke();
      }
    };

    const render = (time: number) => {
      if (!lastTime) {
        lastTime = time;
      }

      const deltaSeconds = Math.min((time - lastTime) / 1000, 0.033);
      lastTime = time;

      context.clearRect(0, 0, width, height);
      drawLayer(farDrops, false, deltaSeconds);
      drawLayer(nearDrops, true, deltaSeconds);
      context.globalAlpha = 1;

      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener("resize", resize);
    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      window.cancelAnimationFrame(animationFrame);
    };
  }, [speedRef]);

  return <canvas ref={canvasRef} className="rain-canvas" aria-hidden="true" />;
}