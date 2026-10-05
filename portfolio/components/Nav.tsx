"use client";

import { useEffect, useRef, useState } from "react";
import { navLinks } from "@/lib/portfolio";

export default function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [active, setActive] = useState("");
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
    };
    addEventListener("scroll", onScroll, { passive: true });

    // Active link: owned here, independent of the reveal animation.
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { threshold: 0.16 },
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
      <header className={`site-nav${scrolled ? " scrolled" : ""}${hidden && !open ? " hidden" : ""}`} aria-label="Primary navigation">
        <a className="brand" href="#top" aria-label="Sonu Bodat home">
          <span className="brand-mark">SB</span>
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
