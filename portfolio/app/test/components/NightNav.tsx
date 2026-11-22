"use client";

import { useEffect, useState } from "react";
import { profile } from "@/lib/portfolio";

const LINKS = [
  { id: "about", label: "About" },
  { id: "experience", label: "Experience" },
  { id: "projects", label: "Projects" },
  { id: "skills", label: "Skills" },
  { id: "motion", label: "Motion" },
  { id: "research", label: "Research" },
  { id: "contact", label: "Contact" },
];

// Compact dark-blue bar for the redesigned home (/test). The hero carries its own nav, so this one only appears once the hero
// has scrolled away, and highlights the section being read.
export default function NightNav() {
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState("");

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 1.2);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    LINKS.forEach((l) => {
      const el = document.getElementById(l.id);
      if (el) io.observe(el);
    });
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <nav className={`nt-nav${shown ? " is-shown" : ""}`} aria-label="Sections" aria-hidden={!shown}>
      <a className="nt-nav-brand" href="#top" tabIndex={shown ? 0 : -1}>
        {profile.name}
      </a>
      <div className="nt-nav-links">
        {LINKS.map((l) => (
          <a key={l.id} href={`#${l.id}`} className={active === l.id ? "is-active" : undefined} tabIndex={shown ? 0 : -1}>
            {l.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
