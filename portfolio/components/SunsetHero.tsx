"use client";

import { useEffect, useRef, useState } from "react";
import { profile } from "@/lib/portfolio";
import type { SunsetHandle } from "@/lib/sunsetGL";
import { DEFAULT_PARAMS, SCROLL_T0, type SunsetParams } from "@/lib/sunsetTime";

// Hero (home + /test): a night-time 2.5D Three.js scene (sunset-to-night is still available via ?t= and lib/sunsetTime.ts). Sky, ocean, ridge+figures, tree and foreground rocks are five depth planes.
// The page sits at deep night (t = 1; scroll does not move time while SCROLL_T0 = SCROLL_T1). Inspect any moment with ?t=0 (sunset),
// ?t=0.5 (twilight), ?t=1 (night), and add ?tune=1 for the slider overlay. All the art-direction knobs are in lib/sunsetTime.ts.
// The static CSS gradient + the two silhouette PNGs are first paint and the fallback when WebGL is unavailable.
const SLIDERS: { key: keyof SunsetParams; label: string; max: number }[] = [
  { key: "stars", label: "stars", max: 2 },
  { key: "milkyWay", label: "milky way", max: 2 },
  { key: "moon", label: "moon", max: 2 },
  { key: "chop", label: "wave chop", max: 2 },
  { key: "foam", label: "foam", max: 2 },
];

export default function SunsetHero({ linkBase = "/" }: { linkBase?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const host = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const gh = useRef<SunsetHandle | null>(null);
  const [gl, setGl] = useState(false);
  const [tune, setTune] = useState(false);
  const [time, setTime] = useState<number | null>(null);
  const [vals, setVals] = useState<SunsetParams>(DEFAULT_PARAMS);

  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const probe = document.createElement("canvas");
      if (!(probe.getContext("webgl2") || probe.getContext("webgl"))) return;
      const { mountSunset } = await import("@/lib/sunsetGL");
      if (cancelled || !host.current || !canvas.current) return;
      const qs = new URLSearchParams(window.location.search);
      const tq = qs.get("t");
      const t0 = tq !== null && tq !== "" && Number.isFinite(Number(tq)) ? Math.min(1, Math.max(0, Number(tq))) : null;
      if (t0 !== null) setTime(t0);
      if (qs.get("tune")) setTune(true);
      const h = await mountSunset(
        host.current,
        canvas.current,
        { ridge: "/hero/ridge-subject.png", tree: "/hero/tree-front.png", ridgeColor: "/hero/subject-color.png", treeColor: "/hero/tree-color.png", grassMid: "/hero/grass-mid.png", grassFront: "/hero/grass-front.png", grassMidColor: "/hero/grass-mid-color.png", grassFrontColor: "/hero/grass-front-color.png", rocks: "/hero/rocks.webp", terrain: "/hero/terrain.webp" },
        { onReady: () => setGl(true), onFail: () => setGl(false) },
        { time: t0 },
      );
      if (cancelled) h.destroy();
      else {
        gh.current = h;
        off = h.destroy;
      }
    })();
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);

  // scroll progress through the tall wrapper drives the camera push-in and the text fade
  useEffect(() => {
    const el = wrap.current;
    const hostEl = host.current;
    if (!el || !hostEl) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const span = Math.max(1, r.height - window.innerHeight);
      const p = Math.min(1, Math.max(0, -r.top / span));
      hostEl.style.setProperty("--p", p.toFixed(3));
      gh.current?.setScroll(p);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const pin = (t: number | null) => {
    setTime(t);
    gh.current?.setTime(t);
  };
  const tweak = (key: keyof SunsetParams, v: number) => {
    setVals((p) => ({ ...p, [key]: v }));
    gh.current?.setParams({ [key]: v });
  };

  const eyebrow = profile.heroTitle.replace(/\s*·\s*/g, " • ");

  return (
    <div ref={wrap} className="sh-wrap">
      <section ref={host} className={`sh${gl ? " is-gl" : ""}`} aria-label="Introduction">
        <canvas ref={canvas} className="sh-canvas" aria-hidden="true" />

        <header className="sh-bar">
          <nav className="sh-nav" aria-label="Sections">
            {profile.heroCorners.map((c) => (
              <a key={c.n} href={`${linkBase}${c.href}`}>
                <b>{c.n}</b> {c.label}
              </a>
            ))}
          </nav>
        </header>

        <div className="sh-copy">
          <p className="sh-eyebrow">{eyebrow}</p>
          <h1 className="sh-name">{profile.name}</h1>
          <p className="sh-sub">{profile.tagline}</p>
        </div>

        {tune && (
          <div className="sh-tune" role="group" aria-label="Scene tuning">
            <label>
              time {time === null ? "(scroll)" : time.toFixed(2)}
              <input type="range" min={0} max={1} step={0.005} value={time ?? SCROLL_T0} onChange={(e) => pin(Number(e.target.value))} />
            </label>
            <div className="sh-tune-jump">
              <button onClick={() => pin(0)}>sunset</button>
              <button onClick={() => pin(0.3)}>dusk</button>
              <button onClick={() => pin(0.55)}>blue hour</button>
              <button onClick={() => pin(1)}>night</button>
              <button onClick={() => pin(null)}>scroll</button>
            </div>
            {SLIDERS.map((sl) => (
              <label key={sl.key}>
                {sl.label} {vals[sl.key].toFixed(2)}
                <input type="range" min={0} max={sl.max} step={0.05} value={vals[sl.key]} onChange={(e) => tweak(sl.key, Number(e.target.value))} />
              </label>
            ))}
          </div>
        )}

        <style>{`
          .sh-tune{position:fixed;z-index:10;right:12px;bottom:12px;width:210px;display:grid;gap:7px;padding:10px 12px;border-radius:8px;background:rgba(8,10,16,.78);backdrop-filter:blur(8px);font-family:var(--mono);font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;color:rgba(248,245,240,.85)}
          .sh-tune label{display:grid;gap:3px}
          .sh-tune input{width:100%}
          .sh-tune-jump{display:flex;flex-wrap:wrap;gap:4px}
          .sh-tune-jump button{font:inherit;letter-spacing:inherit;text-transform:inherit;padding:3px 6px;border:1px solid rgba(248,245,240,.3);border-radius:4px;background:transparent;color:inherit;cursor:pointer}
          .sh-tune-jump button:hover{border-color:#ffcb77;color:#ffcb77}
          .sh-wrap{position:relative;height:190svh}
          .sh{position:sticky;top:0;height:100svh;min-height:520px;overflow:hidden;--p:0;color:#f8f5f0;isolation:isolate;
            background:
              url(/hero/tree-front.png) 50% 100%/cover no-repeat,
              url(/hero/ridge-subject.png) 50% 100%/cover no-repeat,
              linear-gradient(180deg,#070d1c 0%,#0b1428 30%,#131d3a 50%,#1b2a45 57.8%,#0a1020 58.2%,#04070f 100%)}
          .sh-canvas{position:absolute;inset:0;width:100%;height:100%;display:block;opacity:0}
          .sh.is-gl{background:#0b0c10}
          .sh.is-gl .sh-canvas{opacity:1}

          .sh-bar{position:absolute;z-index:3;top:0;left:0;right:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:clamp(16px,2.4svh,26px) clamp(20px,4vw,64px);opacity:calc(1 - var(--p) * 2.2)}
          .sh-nav{display:flex;gap:clamp(14px,2vw,32px);font-family:var(--mono);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase}
          .sh-nav a{color:rgba(248,245,240,.82);transition:color .2s}
          .sh-nav a:hover{color:#ffcb77}
          .sh-nav b{font-weight:400;color:rgba(248,245,240,.48);margin-right:3px}

          .sh-copy{position:absolute;z-index:2;left:clamp(20px,4vw,64px);top:clamp(92px,13svh,150px);opacity:calc(1 - var(--p) * 1.8);transform:translateY(calc(var(--p) * -26px));will-change:opacity,transform}
          .sh-eyebrow{margin:0 0 14px;font-family:var(--mono);font-size:.7rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(248,245,240,.72)}
          .sh-name{margin:0;font-family:var(--serif);font-weight:400;font-size:clamp(2.9rem,6.2vw,6.2rem);line-height:.94;letter-spacing:-.045em;color:#f8f5f0;text-shadow:0 2px 36px rgba(11,12,16,.45)}
          .sh-sub{margin:18px 0 0;max-width:460px;font-size:clamp(.96rem,1.2vw,1.12rem);line-height:1.55;color:rgba(248,245,240,.84);text-shadow:0 1px 18px rgba(11,12,16,.55)}

          @media(prefers-reduced-motion:reduce){.sh-wrap{height:100svh}}
          @media(max-width:760px){
            .sh-bar{flex-direction:column;align-items:flex-start;gap:10px;padding-top:16px}
            .sh-nav{gap:12px;font-size:.62rem}
                  .sh-copy{top:128px}
            .sh-sub{max-width:min(460px,88vw)}
          }
        `}</style>
      </section>
    </div>
  );
}
