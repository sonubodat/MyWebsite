import type { Metadata } from "next";
import SunsetHero from "@/components/SunsetHero";
import { profile } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "Hero test | Sonu Bodat",
  robots: { index: false, follow: false },
};

export default function TestPage() {
  return (
    <main>
      <SunsetHero />
      <section style={{ minHeight: "70svh", display: "grid", placeItems: "center", padding: "12vh 6vw", background: "#0b0c10", color: "#eef2ff", textAlign: "center" }}>
        <p style={{ margin: 0, maxWidth: "22ch", fontFamily: "var(--serif)", fontSize: "clamp(2rem,5vw,4rem)", lineHeight: 1.05, letterSpacing: "-.03em" }}>{profile.statement}</p>
      </section>
    </main>
  );
}
