#!/usr/bin/env node
/* ============================================================
   Placeholder plates for the Notable Projects cards.

   `node scripts/make-placeholders.mjs`

   WHY THESE EXIST AND WHAT THEY ARE NOT. The nine notable projects have no
   photography yet. The options were a grey box, a stock image, or something
   drawn from the system itself; the first reads as broken, the second is a lie
   about work that exists, and the third is what this does. Each plate is the
   site's own graph paper with the project's initials set in the display face,
   so a card looks deliberate while it waits and nobody mistakes it for the
   finished thing.

   THEY ARE MEANT TO BE REPLACED. Dropping a real file at the same path with
   the same name is the whole migration — `content/projects/*.md` names the
   file, `build-content.mjs` emits whatever is named, and nothing here is
   referenced by id anywhere else.

   NO NETWORK, NO BINARY. SVG, generated deterministically from the project
   list, so the repo stays diffable and `npm run build` stays offline. The
   colours are the design system's own, written as literals HERE and only here:
   an SVG in content/assets is a static asset, not a stylesheet, and it cannot
   read a custom property. Both values are the raw ramp steps `--chrome-grid`
   and `--chrome-label` alias, and the header of tokens.json is the source.
   ============================================================ */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(root, "content", "assets", "notable");

/* The lattice, and the two inks. 24 is --space-6 at a 16px root; the greys are
   slate-500 and slate-400, which is what --chrome-grid and --chrome-label
   resolve to. Kept in step with tokens.json by hand, and cheap to check: the
   plate is decoration behind a card, and a drift here is invisible rather than
   wrong. */
const CELL = 24;
const W = 640;
const H = 400;

const projects = readdirSync(join(root, "content", "projects"))
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const src = readFileSync(join(root, "content", "projects", f), "utf8");
    const fm = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const get = (k) => fm?.[1].match(new RegExp(`"${k}"\\s*:\\s*"([^"]*)"`))?.[1] ?? "";
    return { file: f, id: get("id"), title: get("title"), cardType: get("cardType"), hasCaseStudy: /"hasCaseStudy"\s*:\s*true/.test(fm?.[1] ?? "") };
  })
  .filter((p) => p.id && !p.hasCaseStudy);

/* Initials: first letter of up to two significant words. "Tax Advice — USD
   Accounts" gives TA, "Spetema" gives S. Punctuation-only words are skipped so
   an em dash cannot become a letter. */
const initials = (title) =>
  title
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z0-9]/g, ""))
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");

mkdirSync(OUT, { recursive: true });

let n = 0;
for (const p of projects) {
  const label = initials(p.title);
  /* One diagonal per plate, at an angle derived from the id, so nine cards do
     not look like nine copies. Deterministic: same id, same plate, every run. */
  const seed = [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const y1 = CELL * (2 + (seed % 6));
  const y2 = CELL * (8 + ((seed >> 2) % 6));

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Placeholder plate for ${p.title}">\n` +
    `  <title>${p.title} — placeholder</title>\n` +
    `  <defs>\n` +
    `    <pattern id="g" width="${CELL}" height="${CELL}" patternUnits="userSpaceOnUse">\n` +
    `      <path d="M ${CELL} 0 L 0 0 0 ${CELL}" fill="none" stroke="#64748b" stroke-opacity="0.16" stroke-width="1"/>\n` +
    `    </pattern>\n` +
    `  </defs>\n` +
    `  <rect width="${W}" height="${H}" fill="none"/>\n` +
    `  <rect width="${W}" height="${H}" fill="url(#g)"/>\n` +
    `  <path d="M0 ${y1} L${W} ${y2}" stroke="#94a3b8" stroke-opacity="0.5" stroke-width="1" fill="none"/>\n` +
    `  <text x="${W / 2}" y="${H / 2}" text-anchor="middle" dominant-baseline="central"\n` +
    `        font-family="Archivo, Arial Black, sans-serif" font-weight="900" font-size="${CELL * 4}"\n` +
    `        fill="#94a3b8" fill-opacity="0.55" letter-spacing="-2">${label}</text>\n` +
    `</svg>\n`;

  writeFileSync(join(OUT, `${p.id}.svg`), svg);
  n++;
}

console.log(`✓ content/assets/notable  (${n} placeholder plates — replace with real files at the same paths)`);
