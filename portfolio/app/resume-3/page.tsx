import type { Metadata } from "next";
import ResumeDoc from "@/components/ResumeDoc";

// Unlisted (not private): noindex, no links, not in the sitemap. Metadata stays generic on purpose.
export const metadata: Metadata = {
  title: "Sonu Bodat - Resume",
  description:
    "Resume of Sonu Bodat, Full-Stack and Mobile Software Engineer. Experience across React Native, Next.js, AWS, payments, and production infrastructure.",
  alternates: { canonical: "/resume-3" },
  robots: { index: false, follow: false },
};

export default function Page() {
  return <ResumeDoc variant={3} />;
}
