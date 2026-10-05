"use client";

import { useEffect, useRef, useState } from "react";

// Static dither raster = first paint, mobile, reduced-motion and failed-WebGL fallback.
// On capable desktops WebGL mounts after idle and takes over the same silhouette.
export default function HeroPortrait() {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
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

  return (
    <div className={`hero-portrait${gl ? " is-gl" : ""}`} ref={host} aria-hidden="true">
      {/* Separate mobile raster (finer dots, no lime pooling). Fixed aspect ratio => no CLS. */}
      <picture>
        <source media="(max-width: 900px)" srcSet="/hero/portrait-raster-m.png" />
        <img src="/hero/portrait-raster.png" alt="" width={900} height={1245} fetchPriority="high" decoding="async" />
      </picture>
      <canvas ref={canvas} className="hero-gl" />
    </div>
  );
}
