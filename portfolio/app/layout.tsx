import type { Metadata, Viewport } from "next";
import { DM_Mono, Manrope, Space_Grotesk } from "next/font/google";
import { SITE_URL, contact, profile } from "@/lib/portfolio";
import "./globals.css";

const space = Space_Grotesk({ subsets: ["latin"], variable: "--font-space", display: "swap" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono", display: "swap" });

const title = `${profile.name} | ${profile.role}`;
const shortDesc = "Full-Stack and Mobile Software Engineer building production web and React Native products.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title,
  description:
    "Sonu Bodat is a Full-Stack and Mobile Software Engineer building production web and React Native products with Next.js, TypeScript, Node.js, AWS, and Supabase.",
  keywords:
    "Sonu Bodat, software engineer, full-stack developer, mobile developer, React Native developer, Next.js developer, AWS engineer, Gujarat developer",
  authors: [{ name: profile.name }],
  alternates: { canonical: "/" },
  manifest: "/site.webmanifest",
  icons: { icon: { url: "/favicon.svg", type: "image/svg+xml" } },
  openGraph: {
    title,
    description: shortDesc,
    type: "website",
    url: SITE_URL + "/",
    siteName: "Sonu Bodat Portfolio",
    locale: "en_IN",
  },
  twitter: { card: "summary", title, description: "Full-Stack and Mobile Software Engineer building products from architecture to production." },
};

export const viewport: Viewport = { themeColor: "#07130f" };

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Person",
      "@id": `${SITE_URL}/#person`,
      name: profile.name,
      url: `${SITE_URL}/`,
      jobTitle: profile.role,
      description: shortDesc,
      email: `mailto:${contact.email}`,
      sameAs: [contact.linkedin.href, contact.github.href, `${SITE_URL}/`],
      knowsAbout: ["React Native", "Next.js", "TypeScript", "Node.js", "AWS", "DynamoDB", "Supabase", "Razorpay", "Three.js"],
      worksFor: [{ "@id": `${SITE_URL}/#streefi` }, { "@id": `${SITE_URL}/#triviq` }],
      alumniOf: { "@id": `${SITE_URL}/#pdeu` },
    },
    { "@type": "Organization", "@id": `${SITE_URL}/#streefi`, name: "Streefi Private Limited" },
    { "@type": "Organization", "@id": `${SITE_URL}/#triviq`, name: "Triviq", description: "Independent product and engineering studio.", founder: { "@id": `${SITE_URL}/#person` } },
    { "@type": "CollegeOrUniversity", "@id": `${SITE_URL}/#pdeu`, name: "Pandit Deendayal Energy University" },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: "Sonu Bodat Portfolio",
      description: "Portfolio and resume website for Sonu Bodat, Full-Stack and Mobile Software Engineer.",
      publisher: { "@id": `${SITE_URL}/#person` },
      inLanguage: "en-IN",
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${space.variable} ${manrope.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: "if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('hero-pre')" }} />
      </head>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
      </body>
    </html>
  );
}
