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
        smooth: 1.1,
        effects: false,
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
      });

      const timeline = gsap.timeline({
        defaults: {
          ease: "none",
        },
        scrollTrigger: {
          trigger: ".hero-shell",
          start: "top top",
          end: "+=220%",
          scrub: true,
          pin: true,
          anticipatePin: 1,
        },
      });

      timeline
        .to(
          ".hero-stage",
          {
            scale: 1.22,
            z: 220,
          },
          0,
        )
        .to(
          ".hero-vignette",
          {
            opacity: 0.88,
          },
          0,
        )
        .to(
          ".hero-rain-layer",
          {
            scale: 1.12,
          },
          0,
        )
        .to(
          ".hero-title-left",
          {
            xPercent: -55,
            rotateY: 54,
            opacity: 0,
            filter: "blur(18px)",
          },
          0.08,
        )
        .to(
          ".hero-title-right",
          {
            xPercent: 55,
            rotateY: -54,
            opacity: 0,
            filter: "blur(18px)",
          },
          0.08,
        )
        .to(
          speedRef,
          {
            current: 2.8,
          },
          0,
        )
        .to(
          ".card-left",
          {
            scale: 1,
            rotateY: 11,
            xPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
          },
          0.24,
        )
        .to(
          ".card-right",
          {
            scale: 1,
            rotateY: -11,
            xPercent: 0,
            opacity: 1,
            filter: "blur(0px)",
          },
          0.32,
        )
        .to(
          ".content-grid",
          {
            z: 160,
            scale: 1.02,
          },
          0.24,
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

                <div className="content-grid">
                  {panels.map((panel) => (
                    <article
                      key={panel.title}
                      className={`content-card ${panel.align === "left" ? "card-left" : "card-right"}`}
                    >
                      <span className="content-eyebrow">{panel.eyebrow}</span>
                      <h2>{panel.title}</h2>
                      <p>{panel.text}</p>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}