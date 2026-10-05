"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

// Static dither raster = first paint, mobile, reduced-motion and failed-WebGL fallback.
// On capable desktops WebGL mounts after idle and takes over the same silhouette.
export default function HeroPortrait() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const orig = useRef<HTMLImageElement>(null);
  const [gl, setGl] = useState(false);

  useEffect(() => {
    if (!matchMedia("(min-width: 901px) and (prefers-reduced-motion: no-preference)").matches) return;
    let off: (() => void) | undefined;
    let cancelled = false;
    const start = async () => {
      const probe = document.createElement("canvas");
      if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;
      const { mountPortrait } = await import("@/lib/portraitGL");
      if (cancelled || !host.current || !canvas.current) return;
      const h = await mountPortrait(host.current, canvas.current, "/hero/portrait-raster.png", {
        onReady: () => setGl(true),
        onFail: () => setGl(false),
      });
      if (cancelled) h.destroy();
      else off = h.destroy;
    };
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 300));
    const id = idle(() => void start());
    return () => {
      cancelled = true;
      (window.cancelIdleCallback ?? clearTimeout)(id as number);
      off?.();
    };
  }, []);

  // Hover reveal: the real cutout shows through a soft circular aperture that follows the pointer, only while
  // the pointer is over the figure itself. Fine-pointer desktop, no reduced motion. GSAP drives x/y/radius/opacity.
  useEffect(() => {
    if (!matchMedia("(hover: hover) and (pointer: fine) and (min-width: 901px) and (prefers-reduced-motion: no-preference)").matches) return;
    const el = host.current!;
    const s = { x: 0, y: 0, r: 0, v: 0 };
    const apply = () => {
      el.style.setProperty("--px", `${s.x}px`);
      el.style.setProperty("--py", `${s.y}px`);
      el.style.setProperty("--pr", `${s.r}px`);
      el.style.setProperty("--pv", `${s.v}`);
    };
    let alpha: Uint8ClampedArray | null = null;
    const AW = 90, AH = 124;
    // Cutout is only needed on hover: fetch it after idle so it never competes with first paint.
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1200));
    const idleId = idle(() => {
      const img = new Image();
      img.src = "/hero/portrait-cutout.webp";
      img.decode().then(() => {
        const c = document.createElement("canvas");
        c.width = AW;
        c.height = AH;
        const ctx = c.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(img, 0, 0, AW, AH);
        alpha = ctx.getImageData(0, 0, AW, AH).data;
        if (orig.current) orig.current.src = img.src;
      }).catch(() => {});
    });
    const over = (lx: number, ly: number, w: number, h: number) => {
      if (!alpha || lx < 0 || ly < 0 || lx > w || ly > h) return false;
      const i = (Math.min(AH - 1, Math.floor((ly / h) * AH)) * AW + Math.min(AW - 1, Math.floor((lx / w) * AW))) * 4 + 3;
      return alpha[i] > 40;
    };
    const qx = gsap.quickTo(s, "x", { duration: 0.35, ease: "power3.out", onUpdate: apply });
    const qy = gsap.quickTo(s, "y", { duration: 0.35, ease: "power3.out", onUpdate: apply });
    let active = false;
    const enter = (lx: number, ly: number, w: number) => {
      active = true;
      gsap.killTweensOf(s, "r,v");
      s.x = lx;
      s.y = ly;
      if (s.v < 0.05) s.r = w * 0.1;
      gsap.to(s, { v: 1, r: w * 0.22, duration: 0.5, ease: "power3.out", onUpdate: apply });
    };
    const leave = (w: number) => {
      active = false;
      gsap.killTweensOf(s, "r,v");
      gsap.to(s, { v: 0, r: w * 0.07, duration: 0.6, ease: "power2.inOut", onUpdate: apply });
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const b = el.getBoundingClientRect();
      const lx = e.clientX - b.left, ly = e.clientY - b.top;
      const inside = over(lx, ly, b.width, b.height);
      if (inside && !active) enter(lx, ly, b.width);
      else if (!inside && active) leave(b.width);
      if (inside) {
        qx(lx);
        qy(ly);
      }
    };
    const onLeaveDoc = () => active && leave(el.clientWidth);
    addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveDoc);
    return () => {
      (window.cancelIdleCallback ?? clearTimeout)(idleId as number);
      removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeaveDoc);
      gsap.killTweensOf(s);
    };
  }, []);

  return (
    <div className={`hero-portrait${gl ? " is-gl" : ""}`} ref={host} aria-hidden="true">
      {/* Separate mobile raster (finer dots, no lime pooling). Fixed aspect ratio => no CLS. */}
      <picture>
        <source media="(max-width: 900px)" srcSet="/hero/portrait-raster-m.png" />
        <img src="/hero/portrait-raster.png" alt="" width={900} height={1245} fetchPriority="high" decoding="async" />
      </picture>
      <canvas ref={canvas} className="hero-gl" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={orig} className="hero-orig" alt="" width={900} height={1245} decoding="async" />
    </div>
  );
}
