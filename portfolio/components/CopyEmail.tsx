"use client";

import { useState } from "react";

export default function CopyEmail({ email }: { email: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setDone(true);
      setTimeout(() => setDone(false), 1800);
    } catch {}
  };
  return (
    <button type="button" className="copy-btn" onClick={copy}>
      <span aria-live="polite">{done ? "Copied" : "Copy email"}</span>
    </button>
  );
}
