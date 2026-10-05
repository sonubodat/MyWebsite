import ContactModal from "@/components/ContactModal";
import HeroCanvas from "@/components/HeroCanvas";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import {
  education,
  em,
  experience,
  profile,
  projects,
  research,
  skillGroups,
  skillsIntro,
} from "@/lib/portfolio";

const Heading = ({ n, label, title, lede }: { n: string; label: string; title: string; lede: string }) => (
  <>
    <div className="section-label">
      {n} — {label}
    </div>
    <div className="section-heading">
      <h2>{title}</h2>
      <p>{lede}</p>
    </div>
  </>
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

      <main id="main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <HeroCanvas />
          <div className="hero-content reveal">
            <div className="eyebrow">{profile.title}</div>
            <h1 id="hero-title">
              {first} <span>{rest.join(" ")}.</span>
            </h1>
            <p className="hero-lede">{profile.tagline}</p>
            <div className="hero-meta">
              {profile.heroMeta.map((m) => (
                <span key={m}>{m}</span>
              ))}
            </div>
            <div className="cta-row">
              <a className="button" href="/resume">
                View resume <span aria-hidden="true">↗</span>
              </a>
              <a className="button ghost" href="mailto:sonubodat77@gmail.com" data-contact-trigger>
                Contact me <span aria-hidden="true">↘</span>
              </a>
            </div>
          </div>
          <div className="scroll-cue">
            <i /> Scroll to explore
          </div>
          <div className="hero-index">01 / 06 - {profile.role.toUpperCase()}</div>
        </section>

        <section className="section reveal" id="about" data-section>
          <div className="section-inner">
            <Heading n="01" label="About" title="About" lede={profile.aboutLede} />
            <div className="about-grid">
              <div className="about-copy">
                {profile.about.map((p) => (
                  <p key={p}>{p}</p>
                ))}
              </div>
              <div className="stats">
                {profile.stats.map((s) => (
                  <div className="stat" key={s.label}>
                    <span className="stat-number">{s.value}</span>
                    <span className="stat-label">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section reveal" id="experience" data-section>
          <div className="section-inner">
            <Heading
              n="02"
              label="Experience"
              title="Experience"
              lede="From first commit to production debugging, across product, platform, and growth infrastructure."
            />
            <div className="timeline">
              {experience.map((x) => (
                <article className="timeline-item" key={x.company}>
                  <div className="item-kicker">
                    {x.start} — {x.end} · {x.type}
                  </div>
                  <h3>{x.company}</h3>
                  <div className="item-role">{x.role}</div>
                  <div className="item-location">{x.location}</div>
                  <ul>
                    {x.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                  <div className="tags">
                    {x.tags.map((t) => (
                      <span className="tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section reveal" id="projects" data-section>
          <div className="section-inner">
            <Heading
              n="03"
              label="Projects"
              title="Projects"
              lede="Products and research where systems thinking meets a sharp user experience."
            />
            <div className="projects">
              {projects
                .filter((p) => !p.hidden)
                .map((p) => (
                  <article className="project-card" data-category={p.category} key={p.slug}>
                    <div className="item-kicker">{p.kicker}</div>
                    <h3>{p.title}</h3>
                    <p>{p.summary}</p>
                    <ul>
                      {p.bullets.map((b) => (
                        <li key={b}>{b}</li>
                      ))}
                    </ul>
                    <div className="project-footer">
                      <span>{p.stack}</span>
                      {p.link ? (
                        <a href={p.link.href} target="_blank" rel="noreferrer">
                          {p.link.label}
                        </a>
                      ) : (
                        <span>{p.note}</span>
                      )}
                    </div>
                  </article>
                ))}
            </div>
          </div>
        </section>

        <section className="section reveal" id="skills" data-section>
          <div className="section-inner">
            <Heading
              n="04"
              label="Skills"
              title="Skills"
              lede="A practical stack for turning product intent into resilient software."
            />
            <div className="skills-layout">
              <div className="skill-intro">
                <p>{skillsIntro}</p>
              </div>
              <div className="skill-groups">
                {skillGroups.map((g) => (
                  <div className="skill-group" key={g.title}>
                    <h3>{g.title}</h3>
                    <p>{g.items}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="section reveal" id="publications" data-section>
          <div className="section-inner">
            <Heading
              n="05"
              label="Publications"
              title="Research"
              lede="Curiosity gets more useful when it becomes something other people can build on."
            />
            <div className="publications">
              {research.map((r) => (
                <article className="publication" key={r.title}>
                  <small>{r.venue}</small>
                  <h3>{r.title}</h3>
                  <p>{r.summary}</p>
                  {r.role ? (
                    <span className="item-kicker">{r.role}</span>
                  ) : (
                    <a className="button ghost" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">
                      View DOI ↗
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section alt reveal" id="education" data-section>
          <div className="section-inner">
            <Heading
              n="06"
              label="Education"
              title="Education"
              lede="The formal side of the story: computer science, research, and a steady habit of learning."
            />
            <div className="education">
              {education.map((e) => (
                <article className="education-card" key={e.school}>
                  <strong>{em(e.years)}</strong>
                  <h3>{e.shortSchool ?? e.school}</h3>
                  <p>
                    {e.degree.replace(/-/g, "–")} · {e.place}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <span>© {new Date().getFullYear()} Sonu Bodat.</span>
        <span>Built with Next.js, TypeScript &amp; too much coffee.</span>
      </footer>
      <ContactModal />
    </>
  );
}
