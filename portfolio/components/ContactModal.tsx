"use client";

import { useEffect, useRef, useState } from "react";
import { contact, profile } from "@/lib/portfolio";

const links = [
  { label: "Email", text: contact.email, href: `mailto:${contact.email}`, ext: false },
  { label: "LinkedIn", text: contact.linkedin.label, href: contact.linkedin.href, ext: true },
  { label: "GitHub", text: contact.github.label, href: contact.github.href, ext: true },
];

export default function ContactModal() {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  // Any [data-contact-trigger] opens the modal (href is a mailto: fallback without JS).
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = (e.target as Element).closest("[data-contact-trigger]");
      if (!t) return;
      e.preventDefault();
      opener.current = t;
      setOpen(true);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    if (open) closeBtn.current?.focus();
    else (opener.current as HTMLElement | null)?.focus?.();
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(false), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  const copy = async (e: React.MouseEvent, text: string) => {
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(text);
      setToast(true);
    } catch {}
  };

  return (
    <>
      <div className={`toast${toast ? " show" : ""}`} role="status" aria-live="polite">
        Copied to clipboard
      </div>
      <div className={`modal${open ? " open" : ""}`} onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
        <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="contact-modal-title">
          <button ref={closeBtn} className="modal-close" type="button" aria-label="Close contact dialog" onClick={() => setOpen(false)}>
            &times;
          </button>
          <div className="section-label">Contact</div>
          <h2 id="contact-modal-title">Let&apos;s talk</h2>
          <p>{profile.contactBlurb}</p>
          <div className="contact-links">
            {links.map((l) => (
              <a
                key={l.label}
                className="contact-link"
                href={l.href}
                {...(l.ext ? { target: "_blank", rel: "noreferrer" } : {})}
                onContextMenu={(e) => copy(e, l.text)}
              >
                <span>{l.label}</span>
                <strong>{l.text} ↗</strong>
              </a>
            ))}
          </div>
          <div className="cta-row">
            <a className="button" href={`mailto:${contact.email}`}>
              Send an email ↗
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
