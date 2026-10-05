import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found | Sonu Bodat",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main className="nf">
      <div className="nf-inner">
        <div className="eyebrow">404 / Not found</div>
        <h1>
          Wrong <span>turn.</span>
        </h1>
        <p className="hero-lede">That page does not exist, but the portfolio is still right this way.</p>
        <div className="cta-row">
          <Link className="button" href="/">
            Back to portfolio ↗
          </Link>
        </div>
      </div>
    </main>
  );
}
