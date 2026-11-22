"use client";

import { useEffect } from "react";

// Visual reveal only (no nav logic). Content is visible by default in SSR;
// `.motion-ready` is what enables the hidden initial state, so no JS => nothing hidden.
export default function Reveal() {
  useEffect(() => {
    const root = document.documentElement;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const inView = els.filter((el) => el.getBoundingClientRect().top < innerHeight); // batch reads, then write (no forced reflow)
    inView.forEach((el) => el.classList.add("visible"));
    root.classList.add("motion-ready");
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("visible");
          io.unobserve(e.target);
        }),
      { threshold: 0.16 },
    );
    els.filter((el) => !el.classList.contains("visible")).forEach((el) => io.observe(el));
    return () => {
      io.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);
  return null;
}
