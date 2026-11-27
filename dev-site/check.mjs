// Post-build: move links under /dev, place the home page and security.txt, then check.
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { site, apps } from './src/site.ts';

const PUB = '../portfolio/public';
const fail = [];
if (!site.email) fail.push('CONTACT_EMAIL is not set: copy .env.example to .env and fill it in');

renameSync(`${PUB}/dev/index.html`, `${PUB}/dev.html`); // so /dev answers without a redirect

const pages = [`${PUB}/dev.html`, ...readdirSync(`${PUB}/dev`, { recursive: true }).filter(f => f.endsWith('.html')).map(f => `${PUB}/dev/${f}`)];
const has = p => (p.includes('.') && existsSync(`${PUB}${p}`)) || existsSync(`${PUB}${p}.html`);

const expires = new Date(Date.now() + 360 * 864e5).toISOString();
mkdirSync(`${PUB}/.well-known`, { recursive: true });
writeFileSync(`${PUB}/.well-known/security.txt`, `Contact: mailto:${site.email}\nExpires: ${expires}\nPreferred-Languages: en, hi\n`);

for (const file of pages) {
  // Pages are written as if at the domain root.
  const html = readFileSync(file, 'utf8')
    .replace(/href="\/(?=["#?])/g, 'href="/dev')
    .replace(/href="\/(?!\/|dev["\/#?])/g, 'href="/dev/');
  writeFileSync(file, html);
  if (/TODO|\{\{|\[OWNER|\[LEGAL|APP_NAME/.test(html)) fail.push(`placeholder in ${file}`);
  // Store and ad bots may not run JavaScript: every page must be complete static HTML.
  if (/<script/i.test(html) || !/<h1/.test(html)) fail.push(`not plain static HTML: ${file}`);
  for (const [, href] of html.matchAll(/href="(\/[^"#?]*)/g)) if (!has(href)) fail.push(`broken link ${href} in ${file}`);
}

const required = [
  ...['', '/404', '/about', '/contact', '/support', '/privacy-policy', '/terms', '/delete-account', '/refund-policy', '/grievance-officer'].map(p => `/dev${p}`),
  ...apps.filter(a => a.legal).flatMap(a => ['', '/privacy-policy', '/terms', '/delete-account', '/support'].map(d => `/dev/${a.slug}${d}`)),
  '/dev/sitemap.xml', '/app-ads.txt', '/ads.txt', '/.well-known/security.txt',
];
for (const p of required) if (!has(p)) fail.push(`missing ${p}`);

if (fail.length) { console.error(fail.join('\n')); process.exit(1); }
console.log(`check ok: ${required.length} required routes`);
