"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

// The cat from the photo, living in the page. Sprite = the supplied art (cut out of its green plate);
// everything else (open eyes, blush, hearts, zzz, toy) is an SVG/DOM overlay driven by one small GSAP state machine.
// states: sleep (breathing + zzz) -> awake (eyes follow the pointer, blinks) -> pet (purr + hearts) / play (chases a ball).
// Reduced motion: static sprite; a tap just shows blush + one heart. Touch: tap to pet, no proximity wake.
const VB = "33 281 1193 816";
const EYES = [
  { cx: 723, cy: 712 },
  { cx: 971, cy: 768 },
];

export default function Mascot() {
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLSpanElement>(null);

  // mount after idle: keeps the cat entirely off the critical path
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
    const id = idle(() => setReady(true));
    return () => (window.cancelIdleCallback ?? clearTimeout)(id as number);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = root.current!;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const q = <T extends Element>(s: string) => el.querySelector<T>(s)!;
    const qa = <T extends Element>(s: string) => Array.from(el.querySelectorAll<T>(s));
    const say = (t: string) => live.current && (live.current.textContent = t);

    // show only once the hero is out of view (the hero has its own bottom corners)
    const hero = document.getElementById("top");
    const io = new IntersectionObserver(([e]) => (el.dataset.visible = String(!e.isIntersecting)));
    if (hero) io.observe(hero);
    else el.dataset.visible = "true";

    if (calm) {
      let t: number;
      const tap = () => {
        el.classList.add("calm-pet");
        say("The cat purrs.");
        clearTimeout(t);
        t = window.setTimeout(() => el.classList.remove("calm-pet"), 1600);
      };
      q<HTMLButtonElement>(".mascot-btn").addEventListener("click", tap);
      return () => {
        io.disconnect();
        clearTimeout(t);
      };
    }

    const eyes = q("#m-eyes"), blush = q("#m-blush"), zs = qa(".mascot-z"), ball = q(".mascot-toy"), btn = q<HTMLButtonElement>(".mascot-btn");
    const pupils = qa<SVGGElement>(".m-pupil");
    const bodyEl = body.current!;
    let state: "sleep" | "awake" | "pet" | "play" = "sleep";
    let calmTimer: gsap.core.Tween | undefined, blinkTimer: gsap.core.Tween | undefined, sleepTimer: gsap.core.Tween | undefined;
    let heartAt = 0, strokeDist = 0, lastX = 0, lastY = 0;
    const px = pupils.map((p) => gsap.quickTo(p, "x", { duration: 0.25, ease: "power3.out" }));
    const py = pupils.map((p) => gsap.quickTo(p, "y", { duration: 0.25, ease: "power3.out" }));
    const look = (dx: number, dy: number) => {
      const m = Math.hypot(dx, dy) || 1, k = Math.min(1, m / 220);
      pupils.forEach((_, i) => (px[i]((dx / m) * 9 * k), py[i]((dy / m) * 8 * k)));
    };

    // sleeping loops
    const breathe = gsap.to(bodyEl, { scaleY: 1.035, scaleX: 0.995, transformOrigin: "50% 100%", duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
    const zzz = gsap.timeline({ repeat: -1 });
    zs.forEach((z, i) => zzz.fromTo(z, { opacity: 0, y: 0, x: 0, scale: 0.7 }, { opacity: 1, y: -26, x: 10, scale: 1.1, duration: 2.2, ease: "sine.out", yoyo: true, repeat: 1, repeatDelay: 0 }, i * 0.9));

    const armSleep = () => {
      sleepTimer?.kill();
      sleepTimer = gsap.delayedCall(20, sleepNow);
    };
    const blink = () => {
      blinkTimer?.kill();
      blinkTimer = gsap.delayedCall(gsap.utils.random(3, 6), () => {
        if (state === "awake") EYES.forEach((e, i) => gsap.fromTo(pupils[i], { scaleY: 1 }, { scaleY: 0.08, svgOrigin: `${e.cx} ${e.cy}`, duration: 0.08, yoyo: true, repeat: 1 }));
        blink();
      });
    };
    function sleepNow() {
      if (state === "pet" || state === "play") return armSleep();
      state = "sleep";
      el.dataset.state = "sleep";
      blinkTimer?.kill();
      gsap.to(eyes, { opacity: 0, duration: 0.3 });
      gsap.to(blush, { opacity: 0, duration: 0.4 });
      gsap.to(ball, { opacity: 0, duration: 0.3 });
      zzz.play();
      breathe.play();
    }
    function wake() {
      if (state !== "sleep") return armSleep();
      state = "awake";
      el.dataset.state = "awake";
      breathe.pause();
      gsap.to(bodyEl, { scaleY: 1, scaleX: 1, duration: 0.25 });
      zzz.pause();
      gsap.to(zs, { opacity: 0, duration: 0.2 });
      gsap.to(eyes, { opacity: 1, duration: 0.25 });
      gsap.to(ball, { opacity: 1, duration: 0.3 });
      gsap.fromTo(bodyEl, { scaleY: 1 }, { scaleY: 1.07, scaleX: 0.97, transformOrigin: "50% 100%", duration: 0.22, yoyo: true, repeat: 1, ease: "power2.out" });
      say("The cat wakes up.");
      blink();
      armSleep();
    }

    const hearts = () => {
      const now = performance.now();
      if (now - heartAt < 380 || qa(".mascot-heart").length > 6) return;
      heartAt = now;
      const h = document.createElement("span");
      h.className = "mascot-heart";
      h.setAttribute("aria-hidden", "true");
      h.textContent = "♥";
      h.style.left = `${gsap.utils.random(34, 66)}%`;
      el.appendChild(h);
      gsap.fromTo(h, { y: 0, scale: 0.5, opacity: 0 }, { y: -64, x: gsap.utils.random(-16, 16), scale: gsap.utils.random(0.9, 1.3), opacity: 1, duration: 0.5, ease: "power2.out" });
      gsap.to(h, { opacity: 0, y: "-=26", duration: 0.9, delay: 0.5, onComplete: () => h.remove() });
    };
    const purr = gsap.to(bodyEl, { x: 0.9, duration: 0.045, yoyo: true, repeat: -1, paused: true, ease: "none" });
    function pet() {
      const prev = state === "sleep" ? "sleep" : "awake";
      if (state !== "pet") {
        if (state === "play") return;
        state = "pet";
        el.dataset.state = "pet";
        breathe.pause();
        gsap.to(bodyEl, { scaleY: 1, scaleX: 1, duration: 0.2 });
        gsap.to(eyes, { opacity: 0, duration: 0.15 }); // happy squint = the sprite's own closed eyes
        gsap.to(blush, { opacity: 1, duration: 0.25 });
        purr.play();
        say("The cat purrs.");
      }
      gsap.fromTo(bodyEl, { scaleY: 0.96 }, { scaleY: 1, transformOrigin: "50% 100%", duration: 0.35, ease: "elastic.out(1,0.5)" });
      hearts();
      calmTimer?.kill();
      calmTimer = gsap.delayedCall(1.6, () => {
        purr.pause();
        gsap.set(bodyEl, { x: 0 });
        gsap.to(blush, { opacity: 0, duration: 0.5 });
        state = "awake";
        el.dataset.state = "awake";
        if (prev === "sleep") sleepNow();
        else {
          gsap.to(eyes, { opacity: 1, duration: 0.3 });
          blink();
          armSleep();
        }
      });
      if (prev === "awake") armSleep();
    }

    function play() {
      if (state === "sleep") wake();
      if (state === "pet" || state === "play") return;
      state = "play";
      el.dataset.state = "play";
      sleepTimer?.kill();
      say("The cat chases the ball.");
      pupils.forEach((_, i) => (px[i](-9), py[i](3)));
      gsap
        .timeline({ onComplete: () => { state = "awake"; el.dataset.state = "awake"; pupils.forEach((_, i) => (px[i](0), py[i](0))); armSleep(); } })
        .to(ball, { x: -120, rotation: -540, duration: 0.8, ease: "power2.out" }, 0)
        .to(bodyEl, { y: -12, scaleY: 1.06, duration: 0.18, yoyo: true, repeat: 3, ease: "power1.out", transformOrigin: "50% 100%" }, 0.15)
        .to(ball, { x: -40, rotation: -180, duration: 0.9, ease: "bounce.out" }, 1.1)
        .to(bodyEl, { rotation: 3, duration: 0.2, yoyo: true, repeat: 3, transformOrigin: "50% 100%" }, 1.2)
        .set(bodyEl, { rotation: 0, y: 0 }, 2.3);
    }

    // input
    const onClick = () => pet();
    const onDbl = () => play();
    const onMoveBtn = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      strokeDist += Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
      if (strokeDist > 40) {
        strokeDist = 0;
        if (el.dataset.visible === "true") pet();
      }
    };
    const onEnter = (e: PointerEvent) => ((lastX = e.clientX), (lastY = e.clientY), (strokeDist = 0));
    const onKey = (e: KeyboardEvent) => e.key === "Enter" || e.key === " " ? (e.preventDefault(), pet()) : undefined;
    const onWin = (e: PointerEvent) => {
      if (!fine || e.pointerType !== "mouse" || el.dataset.visible !== "true") return;
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width * 0.62), dy = e.clientY - (r.top + r.height * 0.5);
      if (Math.hypot(dx, dy) < 190) wake();
      if (state === "awake") look(dx, dy);
    };
    btn.addEventListener("click", onClick);
    btn.addEventListener("dblclick", onDbl);
    btn.addEventListener("pointermove", onMoveBtn);
    btn.addEventListener("pointerenter", onEnter);
    btn.addEventListener("keydown", onKey);
    ball.addEventListener("click", play);
    window.addEventListener("pointermove", onWin, { passive: true });
    gsap.set(eyes, { opacity: 0 });
    gsap.set(blush, { opacity: 0 });
    gsap.set(ball, { opacity: 0 });

    return () => {
      io.disconnect();
      btn.removeEventListener("click", onClick);
      btn.removeEventListener("dblclick", onDbl);
      btn.removeEventListener("pointermove", onMoveBtn);
      btn.removeEventListener("pointerenter", onEnter);
      btn.removeEventListener("keydown", onKey);
      ball.removeEventListener("click", play);
      window.removeEventListener("pointermove", onWin);
      [breathe, zzz, purr, calmTimer, blinkTimer, sleepTimer].forEach((t) => t?.kill());
      gsap.killTweensOf([bodyEl, eyes, blush, ball, ...pupils, ...zs]);
      qa(".mascot-heart").forEach((h) => h.remove());
    };
  }, [ready]);

  if (!ready) return null;
  return (
    <div className="mascot" ref={root} data-state="sleep" data-visible="false">
      <div className="mascot-body" ref={body}>
        <button type="button" className="mascot-btn" aria-label="Pet the cat">
          <svg viewBox={VB} aria-hidden="true" focusable="false">
            <defs>
              <filter id="m-soft" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="9" />
              </filter>
            </defs>
            <image href="/mascot/cat.webp" x="33" y="281" width="1193" height="816" />
            <g id="m-blush" filter="url(#m-soft)" fill="#ee8f8f" opacity="0">
              <ellipse cx="660" cy="838" rx="52" ry="28" />
              <ellipse cx="1062" cy="856" rx="48" ry="26" />
            </g>
            <g id="m-eyes" opacity="0">
              <g filter="url(#m-soft)" fill="#f8eedd">
                <circle cx="724" cy="712" r="58" />
                <ellipse cx="971" cy="768" rx="64" ry="42" transform="rotate(-4 971 768)" />
              </g>
              {EYES.map((e, i) => (
                <g key={i} className="m-pupil">
                  <ellipse cx={e.cx} cy={e.cy} rx="25" ry="33" fill="#2a1710" />
                  <circle cx={e.cx + 9} cy={e.cy - 12} r="8.5" fill="#fff" />
                  <circle cx={e.cx - 8} cy={e.cy + 13} r="4" fill="#fff" opacity=".8" />
                </g>
              ))}
            </g>
          </svg>
        </button>
      </div>
      <span className="mascot-zzz" aria-hidden="true">
        <b className="mascot-z">z</b>
        <b className="mascot-z">z</b>
        <b className="mascot-z">Z</b>
      </span>
      <button type="button" className="mascot-toy" aria-label="Play with the cat" tabIndex={-1} />
      <svg className="mascot-heart-static" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.5 3.1 5 6.6 5c2 0 3.7 1.1 5.4 3 1.7-1.9 3.4-3 5.4-3 3.5 0 5.4 3.5 4.1 6.8C19.5 16.4 12 21 12 21z" />
      </svg>
      <span className="sr-only" aria-live="polite" ref={live} />
    </div>
  );
}
