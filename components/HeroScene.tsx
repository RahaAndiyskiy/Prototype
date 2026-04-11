"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { useEffect, useRef, useState } from "react";

import { RainCanvas } from "@/components/RainCanvas";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const panels = [
  {
    eyebrow: "Trajectory",
    title: "Shifting focus through the weather",
    text: "Two perspective-weighted content planes rise out of the dark and settle into alignment while the scene keeps pushing forward.",
    align: "left",
  },
  {
    eyebrow: "Depth",
    title: "Rain, parallax and controlled collapse",
    text: "The headline splits in half, dissolves in motion and leaves the eye to lock onto the foreground blocks as the scroll progresses.",
    align: "right",
  },
] as const;

export function HeroScene() {
  const speedRef = useRef(1);
  const smootherRef = useRef<ScrollSmoother | null>(null);
  const rainAudioRef = useRef<HTMLAudioElement | null>(null);
  const thunderAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioEnabledRef = useRef(false);
  const audioUnlockedRef = useRef(false);
  const waveTimeoutRef = useRef<number | null>(null);
  const pointerDownRef = useRef(false);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [waveActive, setWaveActive] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);

  const enableAudioPlayback = async (): Promise<boolean> => {
    if (audioEnabledRef.current) return true;
    const audio = rainAudioRef.current;
    if (!audio) return false;

    audio.muted = false;
    audio.loop = true;
    audio.currentTime = 0;

    try {
      await audio.play();
      audioEnabledRef.current = true;
      setAudioEnabled(true);
      return true;
    } catch (error) {
      console.warn("Audio playback failed", error);
      return false;
    }
  };

  const disableAudioPlayback = () => {
    audioEnabledRef.current = false;
    setAudioEnabled(false);
    rainAudioRef.current?.pause();
    thunderAudioRef.current?.pause();
  };

  const unlockAudioPlayback = async (): Promise<void> => {
    if (audioUnlockedRef.current) return;
    const audio = rainAudioRef.current;
    if (!audio) return;

    audio.muted = false;
    audio.loop = true;
    audio.currentTime = 0;

    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      audioUnlockedRef.current = true;
    } catch (error) {
      console.warn("Audio unlock failed", error);
    }
  };

  useEffect(() => {
    let applySplit: () => void = () => {};
    const ctx = gsap.context(() => {
      smootherRef.current = ScrollSmoother.create({
        wrapper: "#smooth-wrapper",
        content: "#smooth-content",
        smooth: 2.5, // Increased for a more cinematic, heavy-inertia feel
        effects: true,
        normalizeScroll: true,
      });

      gsap.set(".hero-title-left", {
        transformOrigin: "0% 50%",
      });

      gsap.set(".hero-title-right", {
        transformOrigin: "100% 50%",
      });

      gsap.set(".content-card", {
        opacity: 0,
        filter: "blur(10px)",
      });

      // Initial state: deep in space
      gsap.set(".content-grid", {
        z: -1500,
        scale: 0.4,
        opacity: 0,
      });

      const timeline = gsap.timeline({
        defaults: {
          ease: "none",
        },
        scrollTrigger: {
          trigger: ".hero-shell",
          start: "top top",
          end: "+=160%", // Increase end for longer travel feeling
          scrub: true,    // continuous scrub for a more immediate forward feel
          pin: true,
          anticipatePin: 1,
        },
      });

      // 1. Immediate motion from the start
      timeline
        .to(
          ".content-grid",
          {
            z: 160,
            scale: 1,
            opacity: 1,
            duration: 1.2,
          },
          0,
        )
        .to(
          ".hero-stage",
          {
            scale: 1.3,
            y: -40,
            ease: "none",
            duration: 1.6, // extend so scale/translate persist longer during scroll
          },
          0,
        )
        .to(
          speedRef,
          {
            current: 4.5,
            duration: 0.8,
          },
          0,
        )
        .to(
          ".card-left",
          {
            scale: 1,
            rotateY: 10,
            z: 0,
            opacity: 1,
            duration: 0.8,
          },
          0.4,
        )
        .to(
          ".card-right",
          {
            scale: 1,
            rotateY: -10,
            z: 0,
            opacity: 1,
            duration: 0.8,
          },
          0.4,
        )
        // Crossfade blur and final approach
        .to(
          ".content-card",
          {
            filter: "blur(0px)",
            opacity: 1,
            ease: "power4.out",
            stagger: { each: 0.16, from: "center" },
            duration: 1.6,
          },
          0.5,
        );

      // --- Smoothed split progress for the title ---
      // Keep the ScrollTrigger / scrub but smooth the progress used specifically
      // for the split so a sudden scroll won't instantly snap the titles away.
      const st = timeline.scrollTrigger as any;
      let targetProgress = 0;
      let smoothProgress = 0;
      const LERP = 0.08; // smoothing factor
      const MAX_DELTA = 0.03; // max change per tick
      // Map the overall scroll progress into the split segment (early in the timeline)
      const SPLIT_START = 0.05;
      const SPLIT_END = 0.18;

      applySplit = () => {
        const raw = st?.progress ?? 0;
        targetProgress = raw;
        let delta = (targetProgress - smoothProgress) * LERP;
        if (delta > MAX_DELTA) delta = MAX_DELTA;
        if (delta < -MAX_DELTA) delta = -MAX_DELTA;
        smoothProgress += delta;

        const t = clamp((smoothProgress - SPLIT_START) / (SPLIT_END - SPLIT_START), 0, 1);

        // interpolate values
        const leftX = lerp(0, -200, t);
        const leftRY = lerp(0, 25, t);
        const leftA = lerp(1, 0, t);
        const leftBlur = lerp(0, 6, t);

        const rightX = lerp(0, 200, t);
        const rightRY = lerp(0, -25, t);
        const rightA = lerp(1, 0, t);
        const rightBlur = lerp(0, 6, t);

        gsap.set(".hero-title-left", {
          x: leftX,
          rotateY: leftRY,
          opacity: leftA,
          filter: `blur(${leftBlur}px)`,
        });

        gsap.set(".hero-title-right", {
          x: rightX,
          rotateY: rightRY,
          opacity: rightA,
          filter: `blur(${rightBlur}px)`,
        });
      };

      gsap.ticker.add(applySplit);
    });
    return () => {
      gsap.ticker.remove(applySplit);
      smootherRef.current?.kill();
      smootherRef.current = null;
      ctx.revert();
    };
  }, []);

  useEffect(() => {
    rainAudioRef.current = new Audio("/rain-loop.mp3");
    rainAudioRef.current.loop = true;
    rainAudioRef.current.volume = 0.14;
    rainAudioRef.current.preload = "auto";

    thunderAudioRef.current = new Audio("/thunder-hit.mp3");
    thunderAudioRef.current.volume = 0.28;
    thunderAudioRef.current.preload = "auto";

    return () => {
      rainAudioRef.current?.pause();
      thunderAudioRef.current?.pause();
      rainAudioRef.current = null;
      thunderAudioRef.current = null;
      if (waveTimeoutRef.current) {
        window.clearTimeout(waveTimeoutRef.current);
      }
    };
  }, []);

  const playThunder = () => {
    if (!audioEnabledRef.current) return;
    const thunder = thunderAudioRef.current;
    if (!thunder) return;
    thunder.currentTime = 0;
    thunder.volume = 0.3;
    thunder.play().catch(() => {
      // ignore playback block
    });
  };

  const toggleAudioEnabled = async () => {
    if (!audioUnlockedRef.current && !audioEnabledRef.current) {
      await unlockAudioPlayback();
    }

    if (audioEnabledRef.current) {
      disableAudioPlayback();
    } else {
      await enableAudioPlayback();
    }

    if (waveTimeoutRef.current) {
      window.clearTimeout(waveTimeoutRef.current);
    }
    setWaveActive(true);
    waveTimeoutRef.current = window.setTimeout(() => {
      setWaveActive(false);
      waveTimeoutRef.current = null;
    }, 1200);
  };

  const handleAudioPointerDown = () => {
    pointerDownRef.current = true;
    setButtonPressed(true);
  };

  const handleAudioPointerUp = () => {
    pointerDownRef.current = false;
    setButtonPressed(false);
  };

  const handleAudioPointerCancel = () => {
    pointerDownRef.current = false;
    setButtonPressed(false);
  };

  const handleAudioKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter" || event.key === "Spacebar") {
      setButtonPressed(true);
    }
  };

  const handleAudioKeyUp = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === " " || event.key === "Enter" || event.key === "Spacebar") {
      setButtonPressed(false);
    }
  };

  const updateSpotlight = (target: HTMLElement, clientX: number, clientY: number) => {
    const rect = target.getBoundingClientRect();
    const x = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
    const y = clamp(((clientY - rect.top) / rect.height) * 100, 0, 100);
    target.style.setProperty("--mouse-x", `${x}%`);
    target.style.setProperty("--mouse-y", `${y}%`);
  };

  return (
    <div id="smooth-wrapper">
      <div id="smooth-content">
        <main className="page-shell">
          <section className="hero-shell">
            <div className="hero-perspective">
              <div className="hero-stage">
                <div className="audio-switch">
                  <button
                    type="button"
                    className={`trigger ${buttonPressed ? "pressed" : ""}`}
                    aria-label={audioEnabled ? "Звук включён" : "Звук выключён"}
                    aria-pressed={audioEnabled}
                    onClick={toggleAudioEnabled}
                    onPointerDown={handleAudioPointerDown}
                    onPointerUp={handleAudioPointerUp}
                    onPointerLeave={handleAudioPointerCancel}
                    onPointerCancel={handleAudioPointerCancel}
                    onKeyDown={handleAudioKeyDown}
                    onKeyUp={handleAudioKeyUp}
                  >
                    <span className="trigger-label">{audioEnabled ? "mute" : "sound"}</span>
                  </button>
                  <div className={`dots ${waveActive ? "wave-active" : ""}`}>
                    <span className="dot" />
                  </div>
                </div>
                <div className="hero-rain-layer">
                  <RainCanvas speedRef={speedRef} onThunder={playThunder} />
                </div>
                <div className="hero-vignette" aria-hidden="true" />

                <header className="hero-copy">
                  <p className="hero-kicker">Minimal cinematic scroll sequence</p>
                  <h1 className="hero-title" aria-label="Through the Storm">
                    <span className="hero-title-left">Through</span>
                    <span className="hero-title-right">the Storm</span>
                  </h1>
                </header>

                <div className="scene">
                  <div className="scene-inner">
                    {panels.map((panel) => (
                      <article
                        key={panel.title}
                        className={`content-card ${panel.align === "left" ? "card-left" : "card-right"}`}
                        onMouseMove={(e) => {
                          const target = e.currentTarget as HTMLElement;
                          const rect = target.getBoundingClientRect();
                          const x = (e.clientX - rect.left) / rect.width - 0.5;
                          const y = (e.clientY - rect.top) / rect.height - 0.5;
                          const baseRotation = panel.align === "left" ? 12 : -12;
                          updateSpotlight(target, e.clientX, e.clientY);
                          // smoother, less aggressive response: smaller multiplier + longer duration
                          gsap.to(target, {
                            rotateX: -y * 8,
                            rotateY: baseRotation + x * 8,
                            duration: 1.2,
                            ease: "power3.out",
                            overwrite: "auto",
                          });
                        }}
                        onMouseLeave={(e) => {
                          const target = e.currentTarget as HTMLElement;
                          const baseRotation = panel.align === "left" ? 12 : -12;
                          // smooth return without elastic bounce
                          gsap.to(target, {
                            rotateX: 0,
                            rotateY: baseRotation,
                            duration: 1.0,
                            ease: "power2.out",
                            overwrite: "auto",
                          });
                        }}
                      >
                        <div className="card-inner">
                          <span className="content-eyebrow">{panel.eyebrow}</span>
                          <h2>{panel.title}</h2>
                          <p>{panel.text}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}