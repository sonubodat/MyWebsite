// Prints public/sonu-bodat-resume-{1..4}.pdf from the BUILT pages in out/ and checks each result.
// Usage: pnpm build && pnpm resumes && pnpm build   (the second build copies the PDFs into out/)
// Needs Google Chrome and poppler (pdfinfo, pdftotext). Fails non-zero on any broken check.
import { createServer } from "node:http";
import { execFile, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "out");
const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".webp": "image/webp", ".svg": "image/svg+xml", ".png": "image/png" };
// Every string a correct resume must contain, whatever the variant.
const MUST = ["Sonu Bodat", "Parth Institute", "81.5%", "Alembic School", "78%", "Pandit Deendayal Energy University", "sonubodat77@gmail.com"];

if (!existsSync(join(out, "resume-1.html"))) throw new Error("out/ is missing: run pnpm build first");
if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME=...)`);

// Static server over out/: fonts live at /_next/static/..., so file:// would print with fallback fonts.
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  const file = [join(out, path), join(out, `${path}.html`)].find((f) => existsSync(f) && statSync(f).isFile());
  if (!file) return res.writeHead(404).end();
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const port = server.address().port;

let failed = false;
const fail = (n, msg) => ((failed = true), console.error(`resume-${n}: FAIL ${msg}`));
try {
  for (let n = 1; n <= 4; n++) {
    const pdf = join(root, "public", `sonu-bodat-resume-${n}.pdf`);
    // async on purpose: a sync exec would block this process, and with it the server Chrome is fetching from
    await run(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", "--virtual-time-budget=8000", `--print-to-pdf=${pdf}`, `http://127.0.0.1:${port}/resume-${n}`], { timeout: 60000 });

    const pages = Number(/^Pages:\s+(\d+)/m.exec(execFileSync("pdfinfo", [pdf], { encoding: "utf8" }))?.[1]);
    const size = /^Page size:.*\(A4\)/m.test(execFileSync("pdfinfo", [pdf], { encoding: "utf8" }));
    const text = execFileSync("pdftotext", ["-layout", pdf, "-"], { encoding: "utf8" });
    const html = execFileSync("pdftotext", ["-htmlmeta", "-nopgbrk", pdf, "-"], { encoding: "utf8" });
    const links = (execFileSync("pdfinfo", ["-url", pdf], { encoding: "utf8" }).match(/https?:\/\/|mailto:/g) ?? []).length;

    if (pages !== 1) fail(n, `${pages} pages, expected 1`);
    if (!size) fail(n, "page size is not A4");
    for (const s of MUST) if (!text.includes(s)) fail(n, `text missing "${s}"`);
    if (!links) fail(n, "no clickable links");
    if (!html) fail(n, "no selectable text");
    console.log(`resume-${n}: ${pages} page, A4=${size}, ${links} links, ${text.length} chars`);
  }
} finally {
  server.close();
}
process.exit(failed ? 1 : 0);
