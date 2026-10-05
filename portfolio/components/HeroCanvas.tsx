"use client";

import { useEffect, useRef } from "react";

// TEMPORARY compatibility hero — ported 1:1 from script.js; replaced by the portrait hero in a later phase.
export default function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let particles: { x: number; y: number; r: number; vx: number; vy: number }[] = [];
    let pointer = { x: 0, y: 0 };
    let raf = 0;

    const resize = () => {
      const ratio = Math.min(devicePixelRatio, 1.5);
      canvas.width = innerWidth * ratio;
      canvas.height = innerHeight * ratio;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = innerWidth < 700 ? 55 : 115;
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * innerWidth,
        y: Math.random() * innerHeight,
        r: Math.random() * 2 + 0.5,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      particles.forEach((p, i) => {
        if (!reduced) {
          p.x += p.vx;
          p.y += p.vy;
        }
        if (p.x < 0 || p.x > innerWidth) p.vx *= -1;
        if (p.y < 0 || p.y > innerHeight) p.vy *= -1;
        const dx = p.x - pointer.x;
        const dy = p.y - pointer.y;
        const d = Math.max(80, Math.hypot(dx, dy));
        p.x += (dx / d) * 0.03;
        p.y += (dy / d) * 0.03;
        ctx.fillStyle = i % 5 === 0 ? "rgba(217,182,87,.7)" : "rgba(185,216,91,.35)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!reduced) raf = requestAnimationFrame(draw);
    };

    const onMove = (e: PointerEvent) => (pointer = { x: e.clientX, y: e.clientY });
    resize();
    draw();
    addEventListener("resize", resize);
    addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
      removeEventListener("pointermove", onMove);
    };
  }, []);

  return <canvas id="hero-canvas" ref={ref} aria-hidden="true" />;
}
