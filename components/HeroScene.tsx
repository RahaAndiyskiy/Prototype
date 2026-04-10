"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ScrollSmoother } from "gsap/ScrollSmoother";
import { useEffect, useRef } from "react";

import { RainCanvas } from "@/components/RainCanvas";

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

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

  useEffect(() => {
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
        filter: "blur(6px)",
        y: 40,
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
          scrub: 0.8,    // Slower scrub for more "weight"
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
          ".hero-title-left",
          {
            xPercent: -80,
            rotateY: 70,
            z: 800, // Make titles "fly" past the viewer
            opacity: 0,
            filter: "blur(20px)",
            duration: 1,
          },
          0.1,
        )
        .to(
          ".hero-title-right",
          {
            xPercent: 80,
            rotateY: -70,
            z: 800,
            opacity: 0,
            filter: "blur(20px)",
            duration: 1,
          },
          0.05,
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
            y: 0,
            ease: "power2.out",
            stagger: { each: 0.1, from: "center" },
            duration: 0.6,
          },
          0.6,
        );
    });
    return () => {
      smootherRef.current?.kill();
      smootherRef.current = null;
      ctx.revert();
    };
  }, []);

  return (
    <div id="smooth-wrapper">
      <div id="smooth-content">
        <main className="page-shell">
          <section className="hero-shell">
            <div className="hero-perspective">
              <div className="hero-stage">
                <div className="hero-rain-layer">
                  <RainCanvas speedRef={speedRef} />
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
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = (e.clientX - rect.left) / rect.width - 0.5;
                          const y = (e.clientY - rect.top) / rect.height - 0.5;
                          const baseRotation = panel.align === "left" ? 12 : -12;
                          gsap.to(e.currentTarget, {
                            rotateX: -y * 12,
                            rotateY: baseRotation + x * 12,
                            duration: 0.4,
                            ease: "power2.out",
                            overwrite: "auto"
                          });
                        }}
                        onMouseLeave={(e) => {
                          const baseRotation = panel.align === "left" ? 12 : -12;
                          gsap.to(e.currentTarget, {
                            rotateX: 0,
                            rotateY: baseRotation,
                            duration: 0.6,
                            ease: "elastic.out(1, 0.3)",
                            overwrite: "auto"
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