# Final Launch Checklist

## Content
- [x] Hero shows Sonu Bodat and the full job title immediately.
- [x] Hero links to the simple HTML resume and contact section.
- [x] Main page uses standard recruiter-facing section names.
- [x] Web Development Intern removed from the main page.
- [x] Achievements section removed from the main page to avoid duplicated content.
- [x] Game links and game modal removed from the recruiter-facing flow.
- [x] Project cards use text-first layouts without repeated placeholder imagery.
- [x] Supplied LaTeX resume preserved as `resume.tex` source.

## Technical
- [x] Static entry point is `index.html`.
- [x] Presentation is separated into `styles.css`.
- [x] Behavior is separated into `script.js`.
- [x] Resume preview uses `resume.html` and `resume.css`.
- [x] Game fallback remains isolated at `game/index.html`.
- [x] `404.html`, `robots.txt`, `sitemap.xml`, `site.webmanifest`, `favicon.svg`, and `_headers` exist.
- [x] No build command or package installation is required.

## Verification
- [x] HTML, CSS, JavaScript, and resume source report no workspace diagnostics.
- [x] JavaScript syntax check passes.
- [x] Manifest JSON and sitemap XML validate.
- [x] Desktop layout has no horizontal overflow.
- [x] Mobile layout has no horizontal overflow.
- [x] Mobile navigation opens as a full-screen panel.
- [x] Reduced-motion mode reveals content without waiting for animation.
- [x] Resume route loads and displays supplied resume sections.

## Before Publishing
- [ ] Add the final approved resume PDF if a PDF download is required.
- [x] Add `https://sonubodat.dpdns.org/` as the canonical domain in page metadata.
- [x] Add absolute sitemap and robots URLs for `sonubodat.dpdns.org`.
- [x] Add Person, WebSite, organization, education, profile, publication, and skill structured data.
- [ ] Submit `https://sonubodat.dpdns.org/sitemap.xml` in Google Search Console.
- [ ] Submit the site and sitemap in Bing Webmaster Tools.
- [ ] Add real external backlinks from LinkedIn, GitHub profile, Streefi profile, PDEU profile, and publication pages where you control or can request them.
- [ ] Add approved OG image and project screenshots if available.
- [ ] Replace the game fallback with the real game files if they are ready.
- [ ] Configure Cloudflare Pages with the repository root and no build command.
