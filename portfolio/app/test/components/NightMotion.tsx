"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

// All scroll motion for /test, driven by data attributes in page.tsx so the markup stays server-rendered and fully visible
// without JS. Everything lives inside gsap.matchMedia(): reduced-motion users get the static page, and every tween,
// ScrollTrigger and SplitText is reverted automatically when the query stops matching or the page unmounts.
//
//   data-split          heading: lines rise out of a mask
//   data-scrub          paragraph: words light up from grey as you scroll (the signature moment)
//   data-reveal         block fades up      data-stagger  its children fade up one after another
//   data-count          number counts up    data-parallax image drifts against the scroll (value = px of travel)
//   data-line           timeline rail draws   data-hs  pinned section whose .nt-track scrolls sideways
export default function NightMotion() {
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger, SplitText);
    const root = document.querySelector<HTMLElement>(".nt");
    if (!root) return;
    const q = <T extends HTMLElement = HTMLElement>(sel: string) => gsap.utils.toArray<T>(sel, root);
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      // reading progress
      if (bar.current) gsap.fromTo(bar.current, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: document.documentElement, start: "top top", end: "bottom bottom", scrub: 0.25 } });

      // headings: lines rise out of a mask
      q("[data-split]").forEach((el) => {
        SplitText.create(el, {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) => gsap.from(self.lines, { yPercent: 108, duration: 1.1, ease: "power4.out", stagger: 0.09, scrollTrigger: { trigger: el, start: "top 88%", once: true } }),
        });
      });

      // the signature: words light up as the paragraph crosses the screen
      q("[data-scrub]").forEach((el) => {
        SplitText.create(el, {
          type: "words",
          autoSplit: true,
          onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.16 }, { opacity: 1, ease: "none", stagger: 0.12, scrollTrigger: { trigger: el, start: "top 82%", end: "bottom 48%", scrub: 0.6 } }),
        });
      });

      q("[data-reveal]").forEach((el) => gsap.from(el, { y: 44, autoAlpha: 0, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } }));
      q("[data-stagger]").forEach((el) => gsap.from(Array.from(el.children), { y: 36, autoAlpha: 0, duration: 0.9, ease: "power3.out", stagger: 0.09, scrollTrigger: { trigger: el, start: "top 86%", once: true } }));

      // stats count up (keeps any suffix such as "+")
      q("[data-count]").forEach((el) => {
        const raw = el.textContent ?? "";
        const num = parseFloat(raw);
        if (!Number.isFinite(num)) return;
        const suffix = raw.replace(/^[\d.]+/, "");
        const o = { v: 0 };
        el.textContent = `0${suffix}`;
        gsap.to(o, { v: num, duration: 1.8, ease: "power2.out", onUpdate: () => (el.textContent = `${Math.round(o.v)}${suffix}`), scrollTrigger: { trigger: el, start: "top 90%", once: true } });
      });

      // experience rail draws itself; each stop pops as the rail reaches it
      q("[data-line]").forEach((rail) => {
        const wrap = rail.parentElement!;
        gsap.fromTo(rail, { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: wrap, start: "top 65%", end: "bottom 65%", scrub: true } });
        gsap.utils.toArray<HTMLElement>(".nt-dot", wrap).forEach((d) => gsap.from(d, { scale: 0, duration: 0.5, ease: "back.out(2.4)", scrollTrigger: { trigger: d, start: "top 70%", once: true } }));
      });

      // media: scale up on entry, then drift against the scroll
      q("[data-parallax]").forEach((el) => {
        const d = Number(el.dataset.parallax) || 40;
        gsap.fromTo(el, { scale: 0.93 }, { scale: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 98%", end: "top 55%", scrub: true } });
        gsap.fromTo(el, { yPercent: d / 4 }, { yPercent: -d / 4, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
      });

      // magnetic buttons (fine pointers only)
      if (matchMedia("(hover: hover) and (pointer: fine)").matches) {
        q(".nt-btn").forEach((b) => {
          const x = gsap.quickTo(b, "x", { duration: 0.5, ease: "power3" });
          const y = gsap.quickTo(b, "y", { duration: 0.5, ease: "power3" });
          const move = (e: PointerEvent) => {
            const r = b.getBoundingClientRect();
            x((e.clientX - (r.left + r.width / 2)) * 0.28);
            y((e.clientY - (r.top + r.height / 2)) * 0.4);
          };
          const leave = () => (x(0), y(0));
          b.addEventListener("pointermove", move);
          b.addEventListener("pointerleave", leave);
        });
      }
    });

    // desktop only: the reels strip pins and scrolls sideways (small screens keep the plain grid)
    mm.add("(min-width: 901px) and (prefers-reduced-motion: no-preference)", () => {
      q("[data-hs]").forEach((pin) => {
        const track = pin.querySelector<HTMLElement>(".nt-track");
        if (!track) return;
        const dist = () => Math.max(0, track.scrollWidth - pin.clientWidth + 2 * parseFloat(getComputedStyle(pin).paddingLeft));
        gsap.to(track, { x: () => -dist(), ease: "none", scrollTrigger: { trigger: pin, start: "top top", end: () => `+=${dist()}`, pin: true, scrub: 0.8, anticipatePin: 1, invalidateOnRefresh: true } });
      });
    });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("load", refresh);
    document.fonts?.ready.then(refresh);
    return () => {
      window.removeEventListener("load", refresh);
      mm.revert();
    };
  }, []);

  return <div ref={bar} className="nt-progress" aria-hidden="true" />;
}
