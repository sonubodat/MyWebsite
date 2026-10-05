"use client";

import { useEffect } from "react";

// Hero intro: one short timeline. The portrait is deliberately NOT hidden (it is the LCP element; WebGL has its own settle). Hidden state exists only while <html class="hero-pre"> (set by the inline
// script in layout.tsx, skipped for reduced motion). CSS failsafe un-hides everything if this never runs.
export default function HeroIntro() {
  useEffect(() => {
    const root = document.documentElement;
    if (!root.classList.contains("hero-pre")) return;
    let ctx: { revert: () => void } | undefined;
    let dead = false;
    // GSAP is fetched here (not in the page bundle) so it never delays hydration or the LCP image.
    import("gsap").then(({ default: gsap }) => {
      if (dead) return;
      ctx = gsap.context(() => {
        const q = gsap.utils.selector(".hero");
        const done = () => {
          gsap.set(q("[data-intro]"), { clearProps: "opacity,transform" });
          root.classList.remove("hero-pre");
        };
        const tl = gsap.timeline({ defaults: { ease: "power3.out" }, onComplete: done });
        tl.fromTo(q(".hero-name span"), { opacity: 0, y: 44 }, { opacity: 1, y: 0, duration: 0.95, stagger: 0.12 }, 0)
          .fromTo(q(".hero-copy > *"), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.09 }, 0.35)
          .fromTo(q(".hero-corner"), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08 }, 0.45)
          .fromTo(q(".hero-strip"), { opacity: 0 }, { opacity: 1, duration: 0.8 }, 0.7);
      });
    });
    return () => {
      dead = true;
      ctx?.revert();
      root.classList.remove("hero-pre");
    };
  }, []);
  return null;
}
