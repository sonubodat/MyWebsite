"use client";

import dynamic from "next/dynamic";

// Mascot (and the GSAP it pulls in) is a separate chunk that is fetched after the page is interactive.
const Mascot = dynamic(() => import("./Mascot"), { ssr: false });

export default function LazyMascot() {
  return <Mascot />;
}
