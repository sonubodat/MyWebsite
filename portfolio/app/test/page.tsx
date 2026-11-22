import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import CopyEmail from "./components/CopyEmail";
import MotionReel from "./components/MotionReel";
import NightMotion from "./components/NightMotion";
import NightNav from "./components/NightNav";
import SunsetHero from "@/components/SunsetHero";
import {
  capabilities,
  contact,
  education,
  em,
  experience,
  motion,
  profile,
  projects,
  qrFlow,
  qrRoles,
  research,
  skillsIntro,
  span,
} from "@/lib/portfolio";
import "./night.css";

// /test: the full home redesign (ink black, bone white and deep forest green, with GSAP scroll motion) (the live home at / is untouched, so the two can be compared).
// Same content, same data (lib/portfolio.ts); new look. Every style is scoped under .nt (app/test/night.css).
export const metadata: Metadata = {
  title: "Sonu Bodat | Night redesign (test)",
  robots: { index: false, follow: false },
};

// some link labels in lib/portfolio.ts already end in an arrow
const arrow = (l: string) => (l.trim().endsWith("↗") ? l : `${l} ↗`);

const Label = ({ children }: { children: React.ReactNode }) => (
  <p className="nt-label">
    <i aria-hidden="true" />
    {children}
  </p>
);


export default function TestPage() {
  const mainProjects = projects.filter((p) => p.category !== "research");
  const tools = capabilities.flatMap((c) => c.items);
  return (
    <div className="nt">
      <a className="nt-skip" href="#about">
        Skip to content
      </a>
      <NightMotion />
      <NightNav />
      <div id="top">
        <SunsetHero linkBase="" />
      </div>

      <main>
        {/* ------------------------------------------------ About (ink) */}
        <section className="nt-sec nt-first" id="about" data-theme="dark">
          <div className="nt-in">
            <Label>About</Label>
            <h2 className="nt-statement" data-split>
              {profile.statement}
            </h2>
            <ul className="nt-chips" data-stagger>
              {profile.domains.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <p className="nt-manifesto" data-scrub>
              {profile.aboutLede}
            </p>
            <div className="nt-copy" data-reveal>
              {profile.about.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
            <div className="nt-stats" data-stagger>
              {profile.stats.map((st) => (
                <div className="nt-stat" key={st.label}>
                  <b data-count>{st.value}</b>
                  <span>{st.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Experience (bone) */}
        <section className="nt-sec" id="experience" data-theme="light">
          <div className="nt-in">
            <Label>Experience</Label>
            <h2 className="nt-title" data-split>
              Where I have worked.
            </h2>
            <p className="nt-sub" data-reveal>
              What I owned, and what shipped.
            </p>
            <ol className="nt-timeline">
              <i className="nt-line" data-line aria-hidden="true" />
              {experience.map((x, i) => (
                <li className="nt-role" key={x.company}>
                  <span className="nt-dot" aria-hidden="true" />
                  <div className="nt-role-meta" data-reveal>
                    <b>{String(i + 1).padStart(2, "0")}</b>
                    <span>{span(x) || x.type}</span>
                    {span(x) && <span>{x.type}</span>}
                  </div>
                  <div className="nt-card" data-reveal>
                    <h3>{x.company}</h3>
                    <p className="nt-role-title">{x.role}</p>
                    {x.location && <p className="nt-muted">{x.location}</p>}
                    <ul>
                      {x.brief.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                    {x.tags.length > 0 && (
                      <p className="nt-tags">
                        {x.tags.map((t) => (
                          <span key={t}>{t}</span>
                        ))}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------ Projects (ink) */}
        <section className="nt-sec" id="projects" data-theme="dark">
          <div className="nt-in">
            <Label>Projects</Label>
            <h2 className="nt-title" data-split>
              Selected work.
            </h2>
            <p className="nt-sub" data-reveal>
              Role, stack and status for each build.
            </p>
            <div className="nt-projects">
              {mainProjects.map((p, i) => (
                <article className="nt-project" key={p.slug}>
                  <p className="nt-kicker" data-reveal>
                    {String(i + 1).padStart(2, "0")} / {p.kicker}
                  </p>
                  <h3 data-split>{p.title}</h3>
                  <p className="nt-project-sum" data-reveal>
                    {p.summary}
                  </p>
                  {p.diagram === "qr-flow" && (
                    <div className="nt-flow" data-reveal>
                      <ol>
                        {qrFlow.map((st, n) => (
                          <li key={st.step}>
                            <b>{String(n + 1).padStart(2, "0")}</b>
                            <strong>{st.step}</strong>
                            <span>{st.note}</span>
                            <em>{st.who}</em>
                          </li>
                        ))}
                      </ol>
                      <p className="nt-flow-roles">
                        <span>Four role-based experiences over one API:</span> {qrRoles.join(" · ")}
                      </p>
                    </div>
                  )}
                  {p.media.length > 0 && (
                    <div className="nt-media" data-n={p.media.length} data-kind={p.mediaKind}>
                      {p.media.map((m, n) => (
                        <figure key={m.src} data-parallax={p.mediaKind === "phones" ? [34, 70, 34][n % 3] : 24}>
                          <Image src={m.src} alt={m.alt} width={m.w} height={m.h} unoptimized />
                        </figure>
                      ))}
                    </div>
                  )}
                  <dl className="nt-meta" data-stagger>
                    <div>
                      <dt>Role</dt>
                      <dd>{p.role}</dd>
                    </div>
                    <div>
                      <dt>System</dt>
                      <dd>
                        <ul>
                          {p.bullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                    <div>
                      <dt>Stack</dt>
                      <dd>{p.stack}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>
                        {p.note}
                        {p.link && (
                          <>
                            {p.note && <br />}
                            <a href={p.link.href} target="_blank" rel="noreferrer">
                              {arrow(p.link.label)}
                            </a>
                          </>
                        )}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Skills (forest) */}
        <section className="nt-sec nt-skills" id="skills" data-theme="forest">
          <div className="nt-marquee" aria-hidden="true">
            <div className="nt-marquee-track">
              {[0, 1].map((k) => (
                <ul key={k}>
                  {tools.map((t) => (
                    <li key={`${k}-${t}`}>{t}</li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
          <div className="nt-in">
            <Label>Skills</Label>
            <h2 className="nt-title" data-split>
              What I build with.
            </h2>
            <p className="nt-sub" data-reveal>
              {skillsIntro}
            </p>
            <div className="nt-caps" data-stagger>
              {capabilities.map((c) => (
                <div className="nt-cap" key={c.n}>
                  <h3>{c.title}</h3>
                  <ul>
                    {c.items.map((it) => (
                      <li key={it}>{it}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Motion (ink, pinned horizontal strip) */}
        <section className="nt-sec nt-hs-sec" id="motion" data-theme="dark">
          <div className="nt-hs" data-hs>
            <div className="nt-hs-head">
              <Label>Motion · Beginner</Label>
              <h2 className="nt-title" data-split>
                Motion graphics.
              </h2>
              <p className="nt-sub">Early motion work for Untold. Keep scrolling.</p>
            </div>
            <div className="nt-track">
              {motion.map((m) => (
                <figure className="reel" key={m.slug}>
                  <MotionReel slug={m.slug} title={m.title} />
                  <figcaption>
                    <b>{m.title}</b>
                    <span>Untold reel · {m.dur}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------ Research (bone) */}
        <section className="nt-sec" id="research" data-theme="light">
          <div className="nt-in">
            <Label>Lab / Research</Label>
            <h2 className="nt-title" data-split>
              Published research.
            </h2>
            <p className="nt-sub" data-reveal>
              Two papers, as co-author.
            </p>
            <div className="nt-lab" data-stagger>
              {research.map((r, i) => {
                const proj = projects.find((p) => p.slug === r.projectSlug);
                return (
                  <article className="nt-lab-item" key={r.title}>
                    <span className="nt-lab-n">LAB_{String(i + 1).padStart(2, "0")}</span>
                    <p className="nt-kicker">{r.venue}</p>
                    <h3>{r.title}</h3>
                    <p className="nt-project-sum">{r.summary}</p>
                    {proj && (
                      <ul className="nt-points">
                        {proj.bullets.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    )}
                    <div className="nt-foot">
                      {proj && <span>{proj.stack}</span>}
                      {r.role && <span>{r.role}</span>}
                      {!r.role && (
                        <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                          View DOI ↗
                        </a>
                      )}
                      {r.role && proj?.link && (
                        <a href={proj.link.href} target="_blank" rel="noreferrer">
                          {arrow(proj.link.label)}
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <h2 className="nt-title nt-edu-title" data-split>
              Education.
            </h2>
            <ul className="nt-edu" data-stagger>
              {education.map((e) => (
                <li className="nt-edu-row" key={e.school}>
                  <span>{em(e.years)}</span>
                  <h3>{e.shortSchool ?? e.school}</h3>
                  <p>
                    {e.degree.replace(/-/g, "–")} · {e.place}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ------------------------------------------------ Contact (forest) */}
        <section className="nt-sec nt-contact" id="contact" data-theme="forest">
          <div className="nt-in">
            <Label>Contact</Label>
            <p className="nt-status" data-reveal>
              <i aria-hidden="true" /> {profile.heroStatus}
            </p>
            <h2 className="nt-statement nt-contact-title" data-split>
              Have something worth building?
            </h2>
            <p className="nt-sub" data-reveal>
              {profile.contactBlurb}
            </p>
            <ul className="nt-links" data-stagger>
              <li>
                <span>Email</span>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
                <CopyEmail email={contact.email} />
              </li>
              <li>
                <span>LinkedIn</span>
                <a href={contact.linkedin.href} target="_blank" rel="noreferrer">
                  {contact.linkedin.label} ↗
                </a>
              </li>
              <li>
                <span>GitHub</span>
                <a href={contact.github.href} target="_blank" rel="noreferrer">
                  {contact.github.label} ↗
                </a>
              </li>
            </ul>
            <div className="nt-cta" data-reveal>
              <a className="nt-btn" href="/resume">
                View resume <span aria-hidden="true">↗</span>
              </a>
              <Link className="nt-btn nt-btn-ghost" href="/">
                See the original home <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="nt-footer">
        <span>© {new Date().getFullYear()} Sonu Bodat.</span>
        <span>Built with Next.js, TypeScript &amp; too much coffee.</span>
      </footer>
    </div>
  );
}
