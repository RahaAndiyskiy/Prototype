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
    eyebrow: "is natural",
    title: "FEAR\nDOUBT",
    text: "holds you back or drives you forward, carries momentum",
    align: "left",
  },
  {
    eyebrow: "is a choice",
    title: "DETERMI\nNATION",
    text: "built on the belief this is the right path",
    align: "right",
  },
] as const;

const wordItems = [
  { text: "Don't panic", left: "45%", top: "28%" },
  { text: "Stay composed", left: "58%", top: "34%" },
  { text: "Resist doubt", left: "38%", top: "44%" },
  { text: "Release fear", left: "62%", top: "50%" },
  { text: "Hold patience", left: "50%", top: "60%" },
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
  const [lightningEnabled, setLightningEnabled] = useState(true);
  const lightningEnabledRef = useRef(true);
  const rainFadeRef = useRef({ value: 1 });
  const rainAudioControlRef = useRef({ playbackRate: 1, volume: 0.14 });
  const [waveActive, setWaveActive] = useState(false);
  const [buttonPressed, setButtonPressed] = useState(false);

  const enableAudioPlayback = async (): Promise<boolean> => {
    if (audioEnabledRef.current) return true;
    const audio = rainAudioRef.current;
    if (!audio) return false;

    audio.muted = false;
    audio.loop = true;
    audio.currentTime = 0;
    audio.playbackRate = rainAudioControlRef.current.playbackRate;
    audio.volume = rainAudioControlRef.current.volume;

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
        smooth: 4.5, // Increased for a more cinematic, heavy-inertia feel
        effects: true,
        normalizeScroll: true,
      });

      gsap.set(".hero-title-left", {
        transformOrigin: "0% 50%",
      });

      gsap.set(".hero-title-right", {
        transformOrigin: "100% 50%",
      });

      gsap.set(".hero-subtitle", {
        opacity: 0,
        z: 0,
        scale: 1,
        transformPerspective: 1000,
      });

      gsap.set(".hero-subtitle-top", {
        yPercent: 24,
        opacity: 0,
        filter: "blur(8px)",
      });

      gsap.set(".hero-subtitle-bottom", {
        yPercent: -24,
        opacity: 0,
        filter: "blur(8px)",
      });

      gsap.set(".content-card", {
        opacity: 0,
      });

      gsap.set(".card-inner", {
        filter: "blur(10px)",
      });

      gsap.set(".word-reveal", {
        opacity: 0,
        y: 12,
        filter: "blur(8px)",
        display: "inline-block",
      });

      gsap.set(".word-phrase", {
        opacity: 0,
        y: 24,
        scale: 0.84,
        filter: "blur(6px)",
      });

      gsap.set(".hero-wave-riser", {
        yPercent: 100,
        opacity: 0,
      });

      gsap.set(".scroll-end-content", {
        xPercent: 40,
        opacity: 0,
        filter: "blur(12px)",
      });

      // Initial state: deep in space
      gsap.set(".content-grid", {
        z: -1500,
        scale: 0.4,
        opacity: 0,
      });

      let thunderAllowed = true;
      let flybyProgress = 1;

      const timeline = gsap.timeline({
        defaults: {
          ease: "none",
        },
        scrollTrigger: {
          trigger: ".hero-shell",
          start: "top top",
          end: "+=510%", // Extend the scroll range for the flyby and the dive transition
          scrub: 1.0,
          pin: true,
          anticipatePin: 1,
          onUpdate(self) {
            const shouldAllow = self.progress < flybyProgress;
            if (shouldAllow !== thunderAllowed) {
              thunderAllowed = shouldAllow;
              lightningEnabledRef.current = shouldAllow;
              setLightningEnabled(shouldAllow);
            }
          },
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
            scale: 1.42,
            y: -55,
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
        .addLabel("subtitle-enter", 0.25)
        .to(
          ".hero-subtitle",
          {
            opacity: 1,
            ease: "power1.out",
            duration: 0.5,
          },
          "subtitle-enter",
        )
        .to(
          ".hero-subtitle-top",
          {
            yPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
            ease: "power3.out",
            duration: 1,
          },
          "subtitle-enter",
        )
        .to(
          ".hero-subtitle-bottom",
          {
            yPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
            ease: "power3.out",
            duration: 1,
          },
          "subtitle-enter+=0.2",
        )
        .to(
          ".hero-subtitle",
          {
            z: -180,
            scale: 0.88,
            ease: "power1.out",
            duration: 0.6,
          },
          "subtitle-enter+=0.4",
        )
        .addLabel("cards-reveal", 2.4)
        .to(
          ".card-left",
          {
            scale: 1,
            rotateY: 10,
            z: 0,
            opacity: 1,
            duration: 0.8,
          },
          "cards-reveal",
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
          "cards-reveal",
        )
        .to(
          ".content-card",
          {
            opacity: 1,
            duration: 0.2,
          },
          "cards-reveal",
        )
        .addLabel("left-text", "cards-reveal+=0.24")
        .to(
          ".card-left .card-inner",
          {
            filter: "blur(0px)",
            duration: 1.08,
            ease: "power2.out",
          },
          "left-text",
        )
        .to(
          ".card-left .word-reveal",
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            ease: "power2.out",
            stagger: { each: 0.16, from: "start" },
            duration: 0.672,
          },
          "left-text+=0.1",
        )
        .addLabel("glitch", "left-text+=1.6")
        .call(playThunder, [], "glitch")
        .to(
          ".page-shell",
          {
            filter: "invert(1)",
            duration: 0.25,
            ease: "none",
          },
          "glitch",
        )
        .to(
          ".page-shell",
          {
            filter: "invert(0)",
            duration: 0.25,
            ease: "none",
            repeat: 3,
            yoyo: true,
          },
          "glitch+=0.26",
        )
        .addLabel("right-text", "glitch+=0.36")
        .to(
          ".card-right .card-inner",
          {
            filter: "blur(0px)",
            duration: 1.08,
            ease: "power2.out",
          },
          "right-text",
        )
        .to(
          ".card-right .word-reveal",
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            ease: "power2.out",
            stagger: { each: 0.16, from: "start" },
            duration: 1.05,
          },
          "right-text+=0.1",
        )
        .to({}, { duration: 1.4 }, "right-text+=1.15")
        .addLabel("flyby-start", "right-text+=2.55")
        .to(
          ".hero-stage",
          {
            scale: 1.62,
            y: -90,
            ease: "power1.inOut",
            duration: 1.8,
          },
          "flyby-start",
        )
        .to(
          ".card-left",
          {
            x: -170,
            y: -34,
            scale: 1.38,
            z: 640,
            rotateY: 28,
            opacity: 0,
            duration: 1.8,
            ease: "power2.inOut",
          },
          "flyby-start",
        )
        .to(
          ".card-right",
          {
            x: 170,
            y: -34,
            scale: 1.38,
            z: 640,
            rotateY: -28,
            opacity: 0,
            duration: 1.8,
            ease: "power2.inOut",
          },
          "flyby-start",
        )
        .to(
          ".hero-subtitle",
          {
            z: -660,
            scale: 0.8,
            y: -20,
            ease: "power2.out",
            duration: 1.8,
          },
          "flyby-start",
        )
        .to(
          ".hero-kicker",
          {
            opacity: 0,
            y: -16,
            duration: 1.2,
            ease: "power2.out",
          },
          "flyby-start+=0.18",
        )
        .to(
          ".hero-title",
          {
            opacity: 0,
            y: -32,
            scale: 0.92,
            duration: 1.2,
            ease: "power2.out",
          },
          "flyby-start+=0.18",
        )
        .addLabel("words-start", "flyby-start+=0.6")
        .to(
          ".word-phrase",
          {
            opacity: 1,
            scale: 1,
            y: 0,
            filter: "blur(0px)",
            ease: "power3.out",
            duration: 1.4,
            stagger: {
              each: 1.05,
              from: "start",
            },
          },
          "words-start",
        )
        .to(
          speedRef,
          {
            current: 9,
            duration: 1.2,
            ease: "power1.inOut",
          },
          "words-start",
        )
        .to(
          ".hero-wave-riser",
          {
            yPercent: -36,
            opacity: 1,
            duration: 2.4,
            ease: "power1.out",
          },
          "words-start",
        )
        .to(
          ".word-phrase",
          {
            scale: 1.02,
            ease: "power1.inOut",
            duration: 0.9,
            repeat: 1,
            yoyo: true,
          },
          "words-start+=1.5",
        )
        .addLabel("dive-start", "words-start+=5.6")
        .to(
          ".hero-stage",
          {
            y: 140,
            scale: 1.75,
            ease: "power1.inOut",
            duration: 2.2,
          },
          "dive-start",
        )
        .to(
          ".hero-wave-riser",
          {
            yPercent: -60,
            opacity: 1,
            duration: 2.2,
            ease: "power1.inOut",
          },
          "dive-start",
        )
        .to(
          ".hero-copy, .scene, .hero-word-cloud, .audio-switch",
          {
            opacity: 0,
            duration: 1.6,
            ease: "power1.out",
          },
          "dive-start+=0.4",
        )
        .to(
          ".scroll-end-content",
          {
            xPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 1.8,
            ease: "power1.out",
          },
          "dive-start+=0.4",
        )
        .to(rainFadeRef.current, {
          value: 0,
          duration: 2.2,
          ease: "power1.inOut",
        },
        "dive-start")
        .to(rainAudioControlRef.current, {
          playbackRate: 0.72,
          duration: 2.2,
          ease: "power1.out",
          onUpdate: () => {
            const audio = rainAudioRef.current;
            if (audio) audio.playbackRate = rainAudioControlRef.current.playbackRate;
          },
        },
        "dive-start")
        .to(rainAudioControlRef.current, {
          volume: 0,
          duration: 2.2,
          ease: "power1.out",
          onUpdate: () => {
            const audio = rainAudioRef.current;
            if (audio) audio.volume = rainAudioControlRef.current.volume;
          },
        },
        "dive-start+=0.4");

      const totalDuration = timeline.duration();
      flybyProgress = totalDuration ? (timeline.labels["flyby-start"] ?? 0) / totalDuration : 1;

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

  useEffect(() => {
    lightningEnabledRef.current = lightningEnabled;
    if (!lightningEnabled) {
      thunderAudioRef.current?.pause();
    }
  }, [lightningEnabled]);

  const playThunder = () => {
    if (!audioEnabledRef.current || !lightningEnabledRef.current) return;
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

  const renderWordSpans = (text: string) => {
    const lines = text.split(/\r?\n/);
    return lines.flatMap((line, lineIndex) => {
      const words = line.trim().split(/\s+/).filter(Boolean);
      const lineSpans = words.map((word, wordIndex) => (
        <span className="word-reveal" key={`${word}-${lineIndex}-${wordIndex}`}>
          {word}
          {wordIndex < words.length - 1 ? "\u00a0" : ""}
        </span>
      ));
      if (lineIndex < lines.length - 1) {
        lineSpans.push(<br key={`br-${lineIndex}`} />);
      }
      return lineSpans;
    });
  };

  return (
    <>
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
                  <RainCanvas
                    speedRef={speedRef}
                    onThunder={playThunder}
                    lightningEnabled={lightningEnabled}
                    rainFadeRef={rainFadeRef}
                  />
                </div>
                <div className="hero-wave-riser" aria-hidden="true">
                  <svg className="hero-wave-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 24 150 28" preserveAspectRatio="none" shapeRendering="auto">
                    <defs>
                      <path id="gentle-wave" d="M-160 44c30 0 58-2 88-2s 58 2 88 2 58-2 88-2 58 2 88 2 v44h-352z" />
                    </defs>
                    <g className="parallax">
                      <use xlinkHref="#gentle-wave" x="48" y="0" fill="rgba(255,255,255,0.9)" />
                      <use xlinkHref="#gentle-wave" x="48" y="1" fill="rgba(255,255,255,0.9)" />
                    </g>
                  </svg>
                </div>
                <div id="hero-anchor" className="hero-anchor" aria-hidden="true" />
                <div className="hero-word-cloud" aria-hidden="true">
                  {wordItems.map((item) => (
                    <span
                      key={item.text}
                      className="word-phrase"
                      style={{ left: item.left, top: item.top }}
                    >
                      {item.text}
                    </span>
                  ))}
                </div>
                <div className="hero-vignette" aria-hidden="true" />

                <header className="hero-copy">
                  <p className="hero-kicker">it doesn`t stop</p>
                  <h1 className="hero-title" aria-label="Through the Storm">
                    <span className="hero-title-left">Through</span>
                    <span className="hero-title-right">the Storm</span>
                  </h1>
                  <div className="hero-subtitle" aria-hidden="true">
                    <span className="hero-subtitle-top">KEEP</span>
                    <span className="hero-subtitle-bottom">MOVING</span>
                  </div>
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
                          <span className="content-eyebrow">{renderWordSpans(panel.eyebrow)}</span>
                          <h2>{renderWordSpans(panel.title)}</h2>
                          <p>{renderWordSpans(panel.text)}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
        <div id="scroll-end-point" className="scroll-end-point" />
      </div>
    </div>
    <div className="scroll-end-content" aria-hidden="true">
      <p className="scroll-end-text">Focus, take a deep breath, prepare for growth.</p>
    </div>
    </>
  );
}