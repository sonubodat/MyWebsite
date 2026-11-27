# Developer website

Support and legal pages for all apps. Static Astro site on Cloudflare Workers.

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill in the public contact address.
3. `npm run build` (builds, then checks routes, links and placeholders).
4. `npx wrangler login` once, then `npm run deploy`.
5. Put the real address in `url` in `src/site.ts` and deploy again.

## Add an app
1. Add one entry to `apps` in `src/site.ts` with `legal: true`.
2. Copy `src/content/legal/_template` to `src/content/legal/<slug>` and write the text from what the code does.

Extra pages (for example `disclaimer.md`) in that folder appear automatically.
