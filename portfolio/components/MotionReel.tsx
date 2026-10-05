"use client";

import { useEffect, useRef, useState } from "react";

// Lazy motion reel: nothing downloads until it nears the viewport; plays only while visible; never autoplays for
// reduced-motion / data-saver users (poster + play button instead). Muted, inline, no audio track.
export default function MotionReel({ slug, title, w = 540, h = 960 }: { slug: string; title: string; w?: number; h?: number }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [armed, setArmed] = useState(false); // src attached
  const frame = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const v = ref.current!;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches || !!conn?.saveData;
    if (calm) frame.current!.dataset.calm = "";
    const near = new IntersectionObserver(([e]) => e.isIntersecting && (setArmed(true), near.disconnect()), { rootMargin: "400px" });
    near.observe(v);
    const vis = new IntersectionObserver(
      ([e]) => {
        if (calm) return;
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.35 },
    );
    vis.observe(v);
    return () => {
      near.disconnect();
      vis.disconnect();
    };
  }, []);

  const toggle = () => {
    const v = ref.current!;
    setArmed(true);
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  return (
    <div className="reel-frame" ref={frame}>
      <video
        ref={ref}
        src={armed ? `/motion/${slug}.mp4` : undefined}
        poster={`/motion/${slug}.webp`}
        width={w}
        height={h}
        muted
        loop
        playsInline
        preload="none"
        aria-label={`${title} (motion graphic, no audio)`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button type="button" className="reel-play" onClick={toggle} aria-label={`${playing ? "Pause" : "Play"} ${title}`}>
        {playing ? "Pause" : "Play"}
      </button>
    </div>
  );
}
