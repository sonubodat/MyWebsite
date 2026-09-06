# Portfolio Build Phases

## Phase 1 - Foundation and Core Portfolio
- Establish the visual system from `DESIGN_SYSTEM.md`.
- Build the responsive single-page portfolio in `index.html`, with presentation in `styles.css` and behavior in `script.js`.
- Add semantic navigation, hero, about, experience, achievements, projects, skills, publications, education, contact, and footer sections.
- Add the lightweight procedural hero canvas, responsive layout, and reduced-motion fallback.

## Phase 2 - Interaction and Experience Layer
- Add project filtering, mobile navigation, scroll progress, active navigation state, counters, card tilt, contact copy feedback, and the game portal modal.
- Add keyboard affordances including `G` for the game portal and the Konami-code easter egg.
- Keep all heavy effects optional so the page remains usable without WebGL or external dependencies.

## Phase 3 - Verification and Launch Polish
- Verify desktop and mobile layouts, keyboard navigation, reduced motion, modal focus behavior, and link destinations.
- Run a browser smoke test and inspect for clipping, overlap, unreadable text, or inert controls.
- Add real project imagery, OG image, favicon/PWA assets, and a dedicated `/game` route when those assets or the existing game become available.

## Hosting Target - Cloudflare Pages
- Keep the site dependency-free and deploy the repository root as the output directory.
- Build command: none.
- Framework preset: none / static HTML.
- Entry point: `index.html`.
- Add a real `/game/index.html` later when the existing game is brought into this repository.
