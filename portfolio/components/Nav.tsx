"use client";

import { useEffect, useRef, useState } from "react";
import { navLinks } from "@/lib/portfolio";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState("");
  const [light, setLight] = useState(false); // pill sits over a light section => light glass
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let last = 0;
    const onScroll = () => {
      const y = scrollY;
      setScrolled(y > 50);
      setHidden(y > last && y > 180);
      last = y;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar.current) bar.current.style.width = `${max > 0 ? (y / max) * 100 : 0}%`;
      // Tone: look at the surface under the pill centre (skip the header itself).
      const under = document.elementsFromPoint(innerWidth / 2, 34).find((el) => !el.closest("header"));
      const sec = under?.closest("section");
      setLight(!!sec && sec.id !== "top" && !sec.classList.contains("dark"));
    };
    onScroll();
    addEventListener("scroll", onScroll, { passive: true });

    // Active link: owned here, independent of the reveal animation.
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-35% 0px -60% 0px" }, // the section crossing a thin band mid-viewport is active (tall sections never reach a % threshold)
    );
    document.querySelectorAll("[data-section]").forEach((s) => io.observe(s));
    return () => {
      removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <>
      <div className="progress-bar" ref={bar} aria-hidden="true" />
      <header className={`site-nav${scrolled ? " scrolled" : ""}${hidden && !open ? " hidden" : ""}${light && !open ? " on-light" : ""}`} aria-label="Primary navigation">
        <a className="brand" href="#top">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/sonu-avatar.webp" alt="" width={96} height={96} />
          <span>Sonu Bodat</span>
        </a>
        <nav className={`nav-links${open ? " open" : ""}`} aria-label="Portfolio sections">
          {navLinks.map((l) => (
            <a key={l.id} href={`#${l.id}`} className={active === l.id ? "active" : undefined} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#contact" className={active === "contact" ? "active" : undefined} onClick={() => setOpen(false)}>
            Contact
          </a>
        </nav>
        <button
          className="menu-toggle"
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          ☰
        </button>
      </header>
    </>
  );
}
