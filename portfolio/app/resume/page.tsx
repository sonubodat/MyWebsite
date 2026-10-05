import type { Metadata } from "next";
import NextLink from "next/link";
import { achievements, competencies, contact, education, experience, profile, research, span } from "@/lib/portfolio";
import PrintButton from "./PrintButton";
import "./resume.css";

export const metadata: Metadata = {
  title: "Sonu Bodat - Resume",
  description:
    "Resume of Sonu Bodat, Full-Stack and Mobile Software Engineer. Experience across React Native, Next.js, AWS, payments, and production infrastructure.",
  alternates: { canonical: "/resume" },
};

const Link = ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>;

export default function ResumePage() {
  return (
    <div className="resume-page">
      <div className="resume-actions">
        <NextLink href="/">← Portfolio</NextLink>
        <a href={contact.resumePdf} download>
          Download PDF
        </a>
        <PrintButton />
      </div>
      <article className="resume">
        <header className="resume-header">
          <div>
            <h1>{profile.name}</h1>
            <p className="resume-title">{profile.title}</p>
          </div>
          <div className="resume-contact">
            <Link href={`mailto:${contact.email}`}>{contact.email}</Link>
            <Link href={contact.linkedin.href}>LinkedIn</Link>
            <Link href={contact.portfolio}>Portfolio</Link>
            <Link href={contact.github.href}>Github</Link>
          </div>
        </header>

        <section>
          <h2>Professional Summary</h2>
          <p>{profile.summary}</p>
        </section>

        <section>
          <h2>Experience</h2>
          {experience.map((x) => (
            <div key={x.company}>
              <h3>{x.company}</h3>
              <div className="role-line">
                <span>
                  <em>{x.role}</em>
                </span>
                <span>{[x.location, span(x, " - ")].filter(Boolean).join(" | ")}</span>
              </div>
              <ul>
                {x.details.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section>
          <h2>Key Achievements</h2>
          <ul>
            {achievements.map((a) => (
              <li key={a.title}>
                <strong>{a.title}</strong> — {a.text}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Core Competencies</h2>
          <p className="competencies">{competencies}</p>
        </section>

        <section>
          <h2>Education</h2>
          {education.map((e) => (
            <div key={e.school}>
              <h3>{e.school}</h3>
              <div className="role-line">
                <span>
                  {e.degree} | {e.score}
                </span>
                <span>
                  {e.place} | {e.years}
                </span>
              </div>
            </div>
          ))}
        </section>

        <section>
          <h2>Publications</h2>
          {research.map((r) => (
            <div key={r.title}>
              <h3>“{r.title}”</h3>
              <p>
                {r.resumeVenue}
                <br />
                DOI: <a href={`https://doi.org/${r.doi}`}>{r.doi}</a>
                <br />
                {r.resumeSummary}
              </p>
            </div>
          ))}
        </section>
      </article>
    </div>
  );
}
