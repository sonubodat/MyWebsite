import MotionReel from "@/components/MotionReel";
import CopyEmail from "@/components/CopyEmail";
import Image from "next/image";
import HeroIntro from "@/components/HeroIntro";
import HeroPortrait from "@/components/HeroPortrait";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import ScrollStory from "@/components/ScrollStory";
import {
  education,
  em,
  experience,
  motion,
  qrFlow,
  qrRoles,
  span,
  profile,
  projects,
  research,
  capabilities,
  contact,
  skillsIntro,
} from "@/lib/portfolio";

const Label = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <div className="section-label">
    {n} — {children}
  </div>
);

const [first, ...rest] = profile.name.split(" ");

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <Reveal />
      <HeroIntro />
      <ScrollStory />

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-grid" aria-hidden="true" />
          <h1 id="hero-title" className="hero-name">
            <span data-intro>{first}</span>{" "}
            <span data-intro>{rest.join(" ")}.</span>
          </h1>
          <HeroPortrait />
          {profile.heroCorners.map((c, i) => (
            <a
              key={c.n}
              className={`hero-corner c${i + 1}`}
              data-intro
              href={c.href}
            >
              <b>{c.n}</b>
              <small>{c.note}</small>
              <span>{c.label}</span>
            </a>
          ))}
          <div className="hero-copy">
            <div className="eyebrow" data-intro>{profile.heroTitle}</div>
            <p className="hero-lede" data-intro>{profile.tagline}</p>
            <div className="cta-row" data-intro>
              <a className="button" href="/resume">
                View resume <span aria-hidden="true">↗</span>
              </a>
              <a className="button ghost" href="#contact">
                Contact me <span aria-hidden="true">↘</span>
              </a>
            </div>
          </div>
          <div className="hero-strip" data-intro>
            <span className="hero-status">
              <i aria-hidden="true" /> {profile.heroStatus}
            </span>
            <span className="hero-tags">{profile.heroStrip.join(" · ")}</span>
            <span>{profile.heroLocation}</span>
          </div>
        </section>

        <section className="section about" id="about" data-section>
          <div className="section-inner">
            <Label n="01">About</Label>
            <h2 className="statement">{profile.statement}</h2>
            <ul className="domains">
              {profile.domains.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <div className="about-body">
              <p className="about-lede">{profile.aboutLede}</p>
              <div className="about-copy">
                {profile.about.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
            </div>
            <div className="stats">
              {profile.stats.map((st) => (
                <div className="stat" key={st.label}>
                  <span className="stat-number">{st.value}</span>
                  <span className="stat-label">{st.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section dark" id="experience" data-section>
          <div className="section-inner">
            <Label n="02">Experience</Label>
            <h2 className="section-title">Experience</h2>
            <p className="section-lede">
              From first commit to production debugging, across product, platform, and growth infrastructure.
            </p>
            <div className="roles">
              <i className="roles-progress" aria-hidden="true" />
              {experience.map((x, i) => (
                <article className="role" key={x.company}>
                  <i className="hairline" aria-hidden="true" />
                  <div className="role-meta">
                    <b>{String(i + 1).padStart(2, "0")}</b>
                    <span>
                      {span(x) || x.type}
                      {span(x) && (
                        <>
                          <br />
                          {x.type}
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <h3>{x.company}</h3>
                    <p className="role-title">{x.role}</p>
                    {x.location && <p className="role-loc">{x.location}</p>}
                    <ul>
                      {x.highlights.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                    {x.tags.length > 0 && <p className="role-tags">{x.tags.join(" · ")}</p>}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="projects" data-section>
          <div className="section-inner">
            <Label n="03">Projects</Label>
            <h2 className="section-title">Projects</h2>
            <p className="section-lede">Products where systems thinking meets a sharp user experience.</p>
            {projects
              .filter((p) => p.category !== "research")
              .map((p, i) => (
                <article className="project" key={p.slug}>
                  <div className="project-kicker mono">
                    {String(i + 1).padStart(2, "0")} / {p.kicker}
                  </div>
                  <h3>{p.title}</h3>
                  <p className="project-summary">{p.summary}</p>
                  {p.diagram === "qr-flow" && (
                    <div className="qr-flow">
                      <ol className="qr-steps">
                        {qrFlow.map((st, n) => (
                          <li key={st}>
                            <i className="qr-line" aria-hidden="true" />
                            <b>{String(n + 1).padStart(2, "0")}</b>
                            <span>{st}</span>
                          </li>
                        ))}
                      </ol>
                      <p className="qr-roles">
                        <span>Four role-based experiences over one API:</span> {qrRoles.join(" · ")}
                      </p>
                    </div>
                  )}
                  {p.media.length > 0 && (
                    <div className="project-media" data-n={p.media.length}>
                      {p.media.map((m) => (
                        <figure key={m.src}>
                          <Image src={m.src} alt={m.alt} width={m.w} height={m.h} unoptimized />
                        </figure>
                      ))}
                    </div>
                  )}
                  <dl className="project-meta">
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
                        {p.link ? (
                          <a href={p.link.href} target="_blank" rel="noreferrer">
                            {p.link.label}
                          </a>
                        ) : (
                          p.note
                        )}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
          </div>
        </section>

        <section className="section dark" id="skills" data-section>
          <div className="section-inner">
            <Label n="04">Skills</Label>
            <h2 className="section-title">What I build with.</h2>
            <p className="section-lede">{skillsIntro}</p>
            <div className="caps">
              {capabilities.map((c) => (
                <div className="cap" key={c.n}>
                  <span className="cap-n">{c.n}</span>
                  <h3>{c.title}</h3>
                  <ul className="cap-items">
                    {c.items.map((it) => (
                      <li key={it}>
                        {it}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section reveal" id="motion" data-section>
          <div className="section-inner">
            <Label n="05">Motion · Beginner</Label>
            <h2 className="section-title">Motion graphics.</h2>
            <p className="section-lede">
              Short reels I made for Untold while learning motion design. Early work, shown as it is.
            </p>
            <div className="reels">
              {motion.map((m) => (
                <figure className="reel" key={m.slug}>
                  <MotionReel slug={m.slug} title={m.title} />
                  <figcaption>
                    <b>{m.title}</b>
                    <span>
                      {m.note}
                      {m.tool ? ` · ${m.tool}` : ""} · {m.dur}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt reveal" id="publications" data-section>
          <div className="section-inner">
            <Label n="06">Lab / Research</Label>
            <h2 className="section-title">Lab / Research</h2>
            <p className="section-lede">
              Curiosity gets more useful when it becomes something other people can build on.
            </p>
            <div className="lab">
              {research.map((r, i) => {
                const proj = projects.find((p) => p.slug === r.projectSlug);
                return (
                  <article className="lab-item" key={r.title}>
                    <span className="lab-n">LAB_{String(i + 1).padStart(2, "0")}</span>
                    <div>
                      <div className="lab-kicker">{r.venue}</div>
                      <h3>{r.title}</h3>
                      <p>{r.summary}</p>
                      {proj && (
                        <ul className="lab-points">
                          {proj.bullets.map((b) => (
                            <li key={b}>{b}</li>
                          ))}
                        </ul>
                      )}
                      <div className="lab-foot">
                        {proj && <span>{proj.stack}</span>}
                        {r.role && <span>{r.role}</span>}
                        {!r.role && (
                          <a href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                            View DOI ↗
                          </a>
                        )}
                        {r.role && proj?.link && (
                          <a href={proj.link.href} target="_blank" rel="noreferrer">
                            {proj.link.label}
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section edu reveal" id="education" data-section>
          <div className="section-inner">
            <Label n="07">Education</Label>
            <h2 className="section-title">Education</h2>
            <ul className="edu-list">
              {education.map((e) => (
                <li className="edu-row" key={e.school}>
                  <span className="edu-years">{em(e.years)}</span>
                  <h3>{e.shortSchool ?? e.school}</h3>
                  <p>
                    {e.degree.replace(/-/g, "–")} · {e.place}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section className="section dark contact-section reveal" id="contact" data-section>
          <div className="section-inner">
            <Label n="08">Contact</Label>
            <p className="contact-status">
              <i aria-hidden="true" /> {profile.heroStatus}
            </p>
            <h2 className="section-title contact-title">Need something built?</h2>
            <p className="section-lede">{profile.contactBlurb}</p>
            <ul className="contact-list">
              <li className="contact-row">
                <span className="mono">Email</span>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
                <CopyEmail email={contact.email} />
              </li>
              <li className="contact-row">
                <span className="mono">LinkedIn</span>
                <a href={contact.linkedin.href} target="_blank" rel="noreferrer">
                  {contact.linkedin.label} ↗
                </a>
              </li>
              <li className="contact-row">
                <span className="mono">GitHub</span>
                <a href={contact.github.href} target="_blank" rel="noreferrer">
                  {contact.github.label} ↗
                </a>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer>
        <span>© {new Date().getFullYear()} Sonu Bodat.</span>
        <span>Built with Next.js, TypeScript &amp; too much coffee.</span>
      </footer>
    </>
  );
}
