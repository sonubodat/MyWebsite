import NextLink from "next/link";
import { contact, education, experience, profile, research, shortResume as r, span } from "@/lib/portfolio";
import PrintButton from "@/app/resume/PrintButton";
import "@/app/resume/resume.css";

/** /resume-5: the short resume. Same classes as ResumeDoc so print rules and look match. */
export default function ResumeShort({ pdf }: { pdf: string }) {
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
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
            <a href={contact.linkedin.href}>LinkedIn</a>
            <a href={contact.portfolio}>Portfolio</a>
            <a href={contact.github.href}>Github</a>
          </div>
        </header>

        <section>
          <h2>Summary</h2>
          <p>{r.summary}</p>
        </section>

        <section>
          <h2>Experience</h2>
          {r.roles.map((x) => {
            const e = experience.find((y) => y.company === (x.lookup ?? x.company))!;
            return (
              <div key={x.company}>
                <h3>{x.company}</h3>
                <div className="role-line">
                  <span>
                    <em>{x.role}</em>
                  </span>
                  <span>{[e.location, span(e, " - ")].filter(Boolean).join(" | ")}</span>
                </div>
                <ul>
                  {x.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>

        <section>
          <h2>Projects</h2>
          <ul>
            {r.projects.map((p) => (
              <li key={p.name}>
                <strong>{p.name}.</strong> {p.line}
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Skills</h2>
          {r.skills.map((g) => (
            <p className="competencies" key={g.label}>
              <strong>{g.label}:</strong> {g.items}
            </p>
          ))}
        </section>

        <section>
          <h2>Education</h2>
          {education.map((e) => (
            <p className="competencies" key={e.school}>
              <strong>{e.shortSchool ?? e.school}</strong>, {e.degree} · {e.years}
            </p>
          ))}
        </section>

        <section>
          <h2>Publications</h2>
          {research.map((p) => (
            <p className="competencies" key={p.title}>
              “{p.title}”, {p.resumeVenue.replace(/ · Nov\. 2024$/, "")}. DOI: <a href={`https://doi.org/${p.doi}`}>{p.doi}</a>
            </p>
          ))}
        </section>
      </article>
    </main>
  );
}
