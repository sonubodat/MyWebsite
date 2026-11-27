import { site, apps } from '../site';

const files = Object.keys(import.meta.glob('../content/legal/*/*.md'));

export function GET() {
  const paths = ['', ...apps.filter(a => a.legal).map(a => a.slug)];
  for (const file of files) {
    const [folder, name] = file.split('/').slice(-2);
    if (folder !== '_template') paths.push(folder === 'site' ? name.slice(0, -3) : `${folder}/${name.slice(0, -3)}`);
  }
  const urls = paths.map(p => `<url><loc>${p ? `${site.url}/${p}` : site.url}</loc></url>`).join('');
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
}
