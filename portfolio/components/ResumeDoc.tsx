import NextLink from "next/link";
import { competencies, contact, education, experience, profile, research, resumeVariants, span, variantStreefiRole } from "@/lib/portfolio";
import PrintButton from "@/app/resume/PrintButton";
import "@/app/resume/resume.css";

const Link = ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>;

/** variant = 1..4 for the unlisted role resumes; omitted = the general /resume. */
export default function ResumeDoc({ variant }: { variant?: number }) {
  const v = variant ? resumeVariants[variant - 1] : undefined;
  const pdf = variant ? `/sonu-bodat-resume-${variant}.pdf` : contact.resumePdf;

  return (
    <main className="resume-page">
      <div className="resume-actions">
        <NextLink href="/">← Portfolio</NextLink>
        <a href={pdf} download>
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
          <p>{v ? v.summary : profile.summary}</p>
        </section>

        <section>
          <h2>Experience</h2>
          {experience.map((x) => (
            <div key={x.company}>
              <h3>{x.company}</h3>
              <div className="role-line">
                <span>
                  <em>{v && x === experience[0] ? variantStreefiRole : x.role}</em>
                </span>
                <span>{[x.location, span(x, " - ")].filter(Boolean).join(" | ")}</span>
              </div>
              <ul>
                {(v && x === experience[0] ? v.streefi : x.highlights).map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section>
          <h2>Core Competencies</h2>
          {v ? (
            v.skills.map((g) => (
              <p className="competencies" key={g.label}>
                <strong>{g.label}:</strong> {g.items.join(", ")}
              </p>
            ))
          ) : (
            <p className="competencies">{competencies}</p>
          )}
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
                {r.resumeVenue} · DOI: <a href={`https://doi.org/${r.doi}`}>{r.doi}</a>
              </p>
            </div>
          ))}
        </section>
      </article>
    </main>
  );
}
