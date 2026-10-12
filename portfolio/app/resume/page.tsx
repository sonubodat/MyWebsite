import type { Metadata } from "next";
import ResumeDoc from "@/components/ResumeDoc";

export const metadata: Metadata = {
  title: "Sonu Bodat - Resume",
  description:
    "Resume of Sonu Bodat, Full-Stack and Mobile Software Engineer. Experience across React Native, Next.js, AWS, payments, and production infrastructure.",
  alternates: { canonical: "/resume" },
};

export default function ResumePage() {
  return <ResumeDoc />;
}
