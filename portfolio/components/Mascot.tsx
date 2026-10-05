"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

// The tabby, living in the page. Six supplied emotes (public/mascot/*.webp, bottom-aligned on one canvas) are
// crossfaded by one small GSAP state machine: sleep -> wake (happy, then curious) -> pet / love -> play -> sleep.
// Reduced motion: static sleeping pose; a tap shows the love pose for a moment. Touch: tap to pet, no proximity wake.
const POSES = ["sleep", "happy", "curious", "pet", "love", "play"] as const;
type Pose = (typeof POSES)[number];

export default function Mascot() {
  const [ready, setReady] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const live = useRef<HTMLSpanElement>(null);

  // mount after idle: keeps the cat off the critical path
  useEffect(() => {
    const idle = window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 1500));
    const id = idle(() => setReady(true));
    return () => (window.cancelIdleCallback ?? clearTimeout)(id as number);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = root.current!;
    const bodyEl = body.current!;
    const btn = el.querySelector<HTMLButtonElement>(".mascot-btn")!;
    const imgs = Object.fromEntries(POSES.map((p) => [p, el.querySelector<HTMLImageElement>(`img[data-pose="${p}"]`)!])) as Record<Pose, HTMLImageElement>;
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const say = (t: string) => live.current && (live.current.textContent = t);
    let pose: Pose = "sleep";
    const show = (next: Pose, d = 0.18) => {
      if (next === pose) return;
      gsap.to(imgs[next], { opacity: 1, duration: d, overwrite: true });
      gsap.to(imgs[pose], { opacity: 0, duration: d, overwrite: true });
      pose = next;
    };
    gsap.set(Object.values(imgs), { opacity: 0 });
    gsap.set(imgs.sleep, { opacity: 1 });

    // show only once the hero is out of view
    const hero = document.getElementById("top");
    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      // sleeping pose first; the other five only once the cat is actually on screen and the browser is idle
      imgs.sleep.src = imgs.sleep.dataset.src!;
      const rest = () => POSES.forEach((p) => p !== "sleep" && (imgs[p].src = imgs[p].dataset.src!));
      (window.requestIdleCallback ?? ((f: () => void) => window.setTimeout(f, 300)))(rest);
    };
    const io = new IntersectionObserver(([e]) => {
      el.dataset.visible = String(!e.isIntersecting);
      if (!e.isIntersecting) load();
    });
    if (hero) io.observe(hero);
    else {
      el.dataset.visible = "true";
      load();
    }

    if (calm) {
      let t: number;
      const tap = () => {
        show("love", 0);
        say("The cat is happy.");
        clearTimeout(t);
        t = window.setTimeout(() => show("sleep", 0), 1600);
      };
      btn.addEventListener("click", tap);
      return () => (io.disconnect(), clearTimeout(t), btn.removeEventListener("click", tap));
    }

    let state: "sleep" | "awake" | "pet" | "play" = "sleep";
    const timers: gsap.core.Tween[] = [];
    const later = (s: number, f: () => void) => {
      const t = gsap.delayedCall(s, f);
      timers.push(t);
      return t;
    };
    let sleepT: gsap.core.Tween | undefined, calmT: gsap.core.Tween | undefined, idlePlayT: gsap.core.Tween | undefined;
    let petCount = 0, petWindow = 0, heartAt = 0, strokeDist = 0, lastX = 0, lastY = 0;
    const lx = gsap.quickTo(bodyEl, "x", { duration: 0.5, ease: "power3.out" });
    const lr = gsap.quickTo(bodyEl, "rotation", { duration: 0.5, ease: "power3.out" });

    const breathe = gsap.to(bodyEl, { scaleY: 1.03, scaleX: 0.995, transformOrigin: "50% 100%", duration: 2.6, ease: "sine.inOut", yoyo: true, repeat: -1 });
    const purr = gsap.to(bodyEl, { x: 0.9, duration: 0.045, yoyo: true, repeat: -1, paused: true, ease: "none" });

    const armSleep = () => (sleepT?.kill(), (sleepT = later(20, sleepNow)));
    const armPlay = () => (idlePlayT?.kill(), (idlePlayT = later(gsap.utils.random(12, 18), () => (state === "awake" && el.dataset.visible === "true" ? play() : armPlay()))));
    function sleepNow() {
      if (state === "pet" || state === "play") return armSleep();
      state = "sleep";
      el.dataset.state = "sleep";
      idlePlayT?.kill();
      lx(0); lr(0);
      show("sleep", 0.3);
      breathe.play();
    }
    function bounce() {
      gsap.fromTo(bodyEl, { scaleY: 1 }, { scaleY: 1.08, scaleX: 0.97, transformOrigin: "50% 100%", duration: 0.2, yoyo: true, repeat: 1, ease: "power2.out" });
    }
    function wake() {
      if (state !== "sleep") return armSleep();
      state = "awake";
      el.dataset.state = "awake";
      breathe.pause();
      gsap.to(bodyEl, { scaleY: 1, scaleX: 1, duration: 0.2 });
      show("happy", 0.15);
      bounce();
      say("The cat wakes up.");
      later(1.3, () => state === "awake" && show("curious", 0.25));
      armSleep();
      armPlay();
    }
    const hearts = () => {
      const now = performance.now();
      if (now - heartAt < 380 || el.querySelectorAll(".mascot-heart").length > 6) return;
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
    function pet() {
      if (state === "play") return;
      const wasSleep = state === "sleep";
      const now = performance.now();
      petCount = now - petWindow < 3000 ? petCount + 1 : 1;
      petWindow = now;
      if (state !== "pet") {
        state = "pet";
        el.dataset.state = "pet";
        breathe.pause();
        gsap.to(bodyEl, { scaleY: 1, scaleX: 1, rotation: 0, x: 0, duration: 0.2 });
        purr.play();
        say("The cat purrs.");
      }
      if (petCount >= 5) {
        if (pose !== "love") say("The cat loves it.");
        show("love");
      } else show("pet");
      gsap.fromTo(bodyEl, { scaleY: 0.96 }, { scaleY: 1, transformOrigin: "50% 100%", duration: 0.35, ease: "elastic.out(1,0.5)" });
      hearts();
      calmT?.kill();
      calmT = later(1.7, () => {
        purr.pause();
        gsap.set(bodyEl, { x: 0 });
        petCount = 0;
        state = "awake";
        el.dataset.state = "awake";
        if (wasSleep) return sleepNow();
        show("curious", 0.25);
        armSleep();
        armPlay();
      });
    }
    function play() {
      if (state === "play") return;
      if (state === "sleep") wake();
      if (state === "pet") {   // a double-click is a pet + pet: let play take over
        calmT?.kill();
        purr.pause();
        gsap.set(bodyEl, { x: 0 });
        petCount = 0;
      }
      state = "play";
      el.dataset.state = "play";
      sleepT?.kill();
      idlePlayT?.kill();
      show("play", 0.15);
      say("The cat plays with yarn.");
      gsap
        .timeline({ onComplete: () => { state = "awake"; el.dataset.state = "awake"; show("curious", 0.25); armSleep(); armPlay(); } })
        .to(bodyEl, { y: -10, scaleY: 1.05, duration: 0.18, yoyo: true, repeat: 7, ease: "power1.out", transformOrigin: "50% 100%" }, 0)
        .to(bodyEl, { rotation: 2.5, duration: 0.3, yoyo: true, repeat: 5, transformOrigin: "50% 100%" }, 0.1)
        .set(bodyEl, { rotation: 0, y: 0 });
    }

    const onMoveBtn = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      strokeDist += Math.hypot(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX; lastY = e.clientY;
      if (strokeDist > 40) { strokeDist = 0; if (el.dataset.visible === "true") pet(); }
    };
    const onEnter = (e: PointerEvent) => ((lastX = e.clientX), (lastY = e.clientY), (strokeDist = 0));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      pet();
    };
    const onWin = (e: PointerEvent) => {
      if (!fine || e.pointerType !== "mouse" || el.dataset.visible !== "true") return;
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width * 0.5), dy = e.clientY - (r.top + r.height * 0.5);
      if (Math.hypot(dx, dy) < 200) wake();
      if (state === "awake" && pose === "curious") {
        const k = Math.max(-1, Math.min(1, dx / 400));
        lx(k * 4); lr(k * 3);   // leans toward the pointer
      }
    };
    const onClick = () => pet();
    btn.addEventListener("click", onClick);
    btn.addEventListener("dblclick", play);
    btn.addEventListener("pointermove", onMoveBtn);
    btn.addEventListener("pointerenter", onEnter);
    btn.addEventListener("keydown", onKey);
    window.addEventListener("pointermove", onWin, { passive: true });

    return () => {
      io.disconnect();
      btn.removeEventListener("click", onClick);
      btn.removeEventListener("dblclick", play);
      btn.removeEventListener("pointermove", onMoveBtn);
      btn.removeEventListener("pointerenter", onEnter);
      btn.removeEventListener("keydown", onKey);
      window.removeEventListener("pointermove", onWin);
      [breathe, purr, ...timers].forEach((t) => t.kill());
      gsap.killTweensOf([bodyEl, ...Object.values(imgs)]);
      el.querySelectorAll(".mascot-heart").forEach((h) => h.remove());
    };
  }, [ready]);

  if (!ready) return null;
  return (
    <div className="mascot" ref={root} data-state="sleep" data-visible="false">
      <div className="mascot-body" ref={body}>
        <button type="button" className="mascot-btn" aria-label="Pet the cat">
          {POSES.map((p) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={p} data-pose={p} data-src={`/mascot/${p}.webp`} alt="" width={560} height={537} decoding="async" draggable={false} />
          ))}
        </button>
      </div>
      <span className="sr-only" aria-live="polite" ref={live} />
    </div>
  );
}
