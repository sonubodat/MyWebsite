"use client";

import { useEffect } from "react";

// Scroll storytelling: hero exit, About, Experience, Projects (+QR flow), Skills, Motion, Lab, Education. One timeline per block (no per-element triggers).
// GSAP + plugins load after mount (dynamic import) so they stay off the critical path. Reduced motion => nothing runs.
// Content is visible by default; GSAP only sets hidden states when it runs, so no-JS / failure leaves everything readable.
export default function ScrollStory() {
  useEffect(() => {
    let off: (() => void) | undefined;
    let dead = false;
    (async () => {
      const [{ default: gsap }, { ScrollTrigger }, { SplitText }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
        import("gsap/SplitText"),
      ]);
      await document.fonts.ready;
      if (dead) return;
      gsap.registerPlugin(ScrollTrigger, SplitText);
      const all = <T extends Element>(sel: string, root: ParentNode = document) => Array.from(root.querySelectorAll<T>(sel));
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const at = (trigger: Element | string, start = "top 80%") => ({ trigger, start, once: true });
        const clear = { clearProps: "opacity,transform,clipPath" };

        // ABOUT
        SplitText.create(".about .statement", {
          type: "lines",
          mask: "lines",
          autoSplit: true,
          onSplit: (self) =>
            gsap.from(self.lines, { yPercent: 110, duration: 1.05, ease: "power4.out", stagger: 0.09, scrollTrigger: at(".about .statement", "top 85%") }),
        });
        gsap.from(".domains li", { opacity: 0, y: 14, duration: 0.7, stagger: 0.07, ease: "power3.out", scrollTrigger: at(".domains", "top 88%"), ...clear });
        gsap.from(".about-body > *", { opacity: 0, y: 32, duration: 0.9, stagger: 0.12, ease: "power3.out", scrollTrigger: at(".about-body", "top 80%"), ...clear });
        gsap.from(".stat", { opacity: 0, y: 26, duration: 0.8, stagger: 0.1, ease: "power3.out", scrollTrigger: at(".stats", "top 85%"), ...clear });
        all<HTMLElement>(".stat-number").forEach((el) => {
          const m = /^(\d+)(.*)$/.exec(el.textContent ?? "");
          if (!m) return;
          const n = Number(m[1]), tail = m[2], o = { v: 0 };
          gsap.to(o, {
            v: n, duration: 1.4, ease: "power2.out", snap: { v: 1 },
            onUpdate: () => (el.textContent = `${o.v}${tail}`),
            onComplete: () => (el.textContent = `${n}${tail}`),
            scrollTrigger: at(".stats", "top 85%"),
          });
        });

        // EXPERIENCE: progress line scrubs with scroll; each role draws its hairline then settles in
        gsap.fromTo(".roles-progress", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".roles", start: "top 65%", end: "bottom 60%", scrub: 0.4 } });
        all(".role").forEach((role) => {
          gsap
            .timeline({ scrollTrigger: at(role, "top 82%") })
            .fromTo(role.querySelector(".hairline"), { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: "power3.inOut" })
            .from(all(".role-meta, h3, .role-title, .role-loc, li, .role-tags", role), { opacity: 0, y: 24, duration: 0.8, stagger: 0.06, ease: "power3.out", ...clear }, 0.15);
        });

        // PROJECTS: title mask, media clip reveal, meta
        all(".project").forEach((p) => {
          const h3 = p.querySelector("h3");
          if (h3)
            SplitText.create(h3, {
              type: "lines",
              mask: "lines",
              autoSplit: true,
              onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1, ease: "power4.out", stagger: 0.08, scrollTrigger: at(p, "top 80%") }),
            });
          gsap.from(all(".project-kicker, .project-summary", p), { opacity: 0, y: 22, duration: 0.8, stagger: 0.1, ease: "power3.out", scrollTrigger: at(p, "top 78%"), ...clear });
          const figs = all("figure", p);
          if (figs.length) {
            const media = p.querySelector(".project-media")!;
            gsap.fromTo(figs, { clipPath: "inset(100% 0% 0% 0% round 28px)" }, { clipPath: "inset(0% 0% 0% 0% round 28px)", duration: 1.25, ease: "power4.inOut", stagger: 0.14, scrollTrigger: at(media, "top 85%"), ...clear });
            gsap.from(all("img", media), { scale: 1.14, duration: 1.7, ease: "power3.out", stagger: 0.14, scrollTrigger: at(media, "top 85%"), ...clear });
          }
          gsap.from(p.querySelector(".project-meta"), { opacity: 0, y: 24, duration: 0.8, ease: "power3.out", scrollTrigger: at(p.querySelector(".project-meta")!, "top 92%"), ...clear });
        });

        // SKILLS: rows rise in; the row nearest the viewport centre is "active"
        all(".cap").forEach((cap) => {
          gsap
            .timeline({ scrollTrigger: at(cap, "top 86%") })
            .from(all(".cap-n, h3", cap), { opacity: 0, y: 26, duration: 0.8, stagger: 0.08, ease: "power3.out", ...clear })
            .from(all(".cap-items li", cap), { opacity: 0, y: 12, duration: 0.6, stagger: 0.025, ease: "power3.out", ...clear }, 0.15);
          ScrollTrigger.create({ trigger: cap, start: "top 62%", end: "bottom 38%", toggleClass: { targets: cap, className: "is-active" } });
        });

        // HERO EXIT (scrub): name lifts away, portrait lags (parallax) and the copy fades; wrappers only (intro owns the children)
        gsap
          .timeline({ defaults: { ease: "none" }, scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: 0.5 } })
          .to(".hero-name", { yPercent: -16, opacity: 0.25 }, 0)
          .to(".hero-portrait", { y: 110, scale: 1.04, transformOrigin: "50% 100%" }, 0)
          .to(".hero-copy", { y: -50, opacity: 0 }, 0)
          .to(".hero-grid", { opacity: 0 }, 0);

        // SECTION TITLES: one consistent line-mask reveal
        all(".section-title").forEach((t) =>
          SplitText.create(t, {
            type: "lines",
            mask: "lines",
            autoSplit: true,
            onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 0.95, ease: "power4.out", stagger: 0.08, scrollTrigger: at(t, "top 88%") }),
          }),
        );

        // QR FLOW: connectors draw left to right, steps follow
        gsap
          .timeline({ scrollTrigger: at(".qr-flow", "top 82%") })
          .fromTo(".qr-line", { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power3.inOut", stagger: 0.12 })
          .from(".qr-steps li > b, .qr-steps li > span", { opacity: 0, y: 14, duration: 0.6, stagger: 0.04, ease: "power3.out", ...clear }, 0.1)
          .from(".qr-roles", { opacity: 0, y: 12, duration: 0.6, ease: "power3.out", ...clear }, 0.9);

        // MOTION REELS: clip reveal, staggered
        gsap.fromTo(".reel-frame", { clipPath: "inset(100% 0% 0% 0% round 24px)" }, { clipPath: "inset(0% 0% 0% 0% round 24px)", duration: 1.15, ease: "power4.inOut", stagger: 0.12, scrollTrigger: at(".reels", "top 85%"), ...clear });
        gsap.from(".reel figcaption", { opacity: 0, y: 14, duration: 0.7, stagger: 0.12, ease: "power3.out", scrollTrigger: at(".reels", "top 80%"), ...clear });

        // LAB + EDUCATION rows
        gsap.from(".lab-item", { opacity: 0, y: 36, duration: 0.9, stagger: 0.14, ease: "power3.out", scrollTrigger: at(".lab", "top 82%"), ...clear });
        gsap.from(".edu-row", { opacity: 0, y: 18, duration: 0.7, stagger: 0.1, ease: "power3.out", scrollTrigger: at(".edu-list", "top 88%"), ...clear });

        // CONTACT rows
        gsap.from(".contact-row", { opacity: 0, y: 24, duration: 0.8, stagger: 0.12, ease: "power3.out", scrollTrigger: at(".contact-list", "top 88%"), ...clear });

        // late layout shifts (fonts, lazy images): re-measure once everything has loaded
        const refresh = () => ScrollTrigger.refresh();
        if (document.readyState === "complete") refresh();
        else window.addEventListener("load", refresh, { once: true });
      });

      off = () => mm.revert();
    })();
    return () => {
      dead = true;
      off?.();
    };
  }, []);
  return null;
}
