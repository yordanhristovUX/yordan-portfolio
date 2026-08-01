#!/usr/bin/env node
/* The driver behind `npm run test:a11y:pages` — axe over the four SHIPPED PAGES.
 *
 *   node scripts/page-a11y.mjs
 *
 * WHY THIS EXISTS WHEN test:a11y ALREADY RUNS AXE OVER EVERY STORY. The story
 * gate exempts `landmark-no-duplicate-banner` and `landmark-unique` on five
 * matrix stories that deliberately render the bar two, three or six times —
 * those rules assert about a *document*, and a variant matrix is not one. The
 * exemption is correct, and its cost is that the single-banner assertion was
 * asserted nowhere. This gate is where it lives: the real pages, full default
 * ruleset, NO exemptions. A rule that is wrong here is a defect to fix on the
 * page, never a rule to disable — the five story-level exemptions exist
 * precisely so this file never needs one.
 *
 * What it does:
 *
 *   1. serves the REPO ROOT (not storybook-static/) on an ephemeral port with
 *      node:http, mirroring vercel.json's `cleanUrls: true` — `/cv` resolves
 *      to `cv.html` — so the URLs scanned are the URLs shipped;
 *   2. drives Chromium over every page in `PAGES`, in BOTH themes — the token
 *      contract says contrast is AA in light and dark, and the dark values are
 *      distinct tokens, so each theme is its own set of contrast checks;
 *   3. runs axe with its default ruleset and fails on any violation;
 *   4. on a page that ships the drawer, OPENS IT and scans again. The closed
 *      drawer is `visibility: hidden` — outside the accessibility tree, so
 *      outside axe's reach — and the open drawer is where the two-banner
 *      defect historically lived. A scan that only ever sees the closed state
 *      would be green over the exact regression this gate exists to catch.
 *
 * Reduced motion is emulated before load, on purpose: the entrance animations
 * start elements at opacity 0, and axe skips invisible nodes — a scan taken
 * mid-animation would silently cover less page. Under reduced motion the page
 * renders complete and still, which is the whole DOM, which is the point.
 *
 * NOT part of the root `npm run check`. That gate is offline, browser-free and
 * heavy-dep-free; this needs Chromium. It runs in the path-filtered pages-a11y
 * workflow instead (.github/workflows/pages-a11y.yml), and lives in
 * design-system/scripts/ because this package is where Playwright and axe are
 * already installed — the pages themselves are not this directory's to edit,
 * and a violation found here is fixed wherever the page's markup is authored.
 */

import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { getViolations, injectAxe } from "axe-playwright";

const HERE = dirname(fileURLToPath(import.meta.url));
/* Two levels up: this script belongs to design-system/, the pages to the repo. */
const SITE_ROOT = resolve(HERE, "..", "..");

/* The four shipped pages, by the clean URL they ship under. */
const PAGES = ["/", "/cv", "/mcp", "/evals"];
const THEMES = ["light", "dark"];

const VIEWPORT = { width: 1280, height: 800 };

/* ---------- a static server on an ephemeral port, cleanUrls included ---------- */

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
};

function serve(dir) {
  const server = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    let file = join(dir, normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, ""));
    if (!file.startsWith(dir + sep) && file !== dir) return res.writeHead(403).end();
    /* vercel.json says `cleanUrls: true`; this is that, for exactly this scan.
       The html file wins over a same-named directory — `/evals` is evals.html,
       not evals/index.html, and the repo has both names. */
    if (!extname(file) && existsSync(`${file}.html`)) file = `${file}.html`;
    else if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
    if (!existsSync(file)) return res.writeHead(404).end("not found");
    res.writeHead(200, {
      "content-type": MIME[extname(file)] ?? "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(file).pipe(res);
  });
  return new Promise((res) => {
    server.listen(0, "127.0.0.1", () => res({ server, port: server.address().port }));
  });
}

/* ---------- the scan ---------- */

function report(page, theme, violations) {
  console.error(`\n✗ ${page} [${theme}] — ${violations.length} violation(s)`);
  for (const v of violations) {
    console.error(`\n  ${v.id} (${v.impact}) — ${v.help}`);
    console.error(`  ${v.helpUrl}`);
    for (const node of v.nodes) {
      console.error(`    ${node.target.join(" ")}`);
      console.error(`      ${node.html.split("\n")[0].slice(0, 160)}`);
      const why = node.failureSummary?.split("\n").slice(0, 4).join("\n      ");
      if (why) console.error(`      ${why}`);
    }
  }
}

const { server, port } = await serve(SITE_ROOT);
const origin = `http://127.0.0.1:${port}`;
console.log(`serving ${SITE_ROOT} at ${origin}`);
console.log(`axe over ${PAGES.length} pages × ${THEMES.length} themes, default ruleset, no exemptions\n`);

const browser = await chromium.launch();
let failed = 0;
let scans = 0;

for (const path of PAGES) {
  for (const theme of THEMES) {
    /* A fresh context per scan: no localStorage carried over, so the pinned-
       theme inline script falls through to prefers-color-scheme, which is the
       emulated value — the same path a first-time visitor takes. */
    const context = await browser.newContext({
      viewport: VIEWPORT,
      colorScheme: theme,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const response = await page.goto(origin + path, { waitUntil: "networkidle" });
    /* A 404 body passed to axe would report the error page's violations, which
       reads as a page defect and is not one. A page that does not serve is its
       own failure, named as such. */
    if (!response || response.status() !== 200) {
      console.error(`✗ ${path} [${theme}] — HTTP ${response?.status() ?? "no response"}, not scanning`);
      failed += 1;
      await context.close();
      continue;
    }
    await page.evaluate(() => document.fonts.ready);
    await injectAxe(page);
    const violations = await getViolations(page);
    scans += 1;
    if (violations.length) {
      failed += violations.length;
      report(path, theme, violations);
    } else {
      console.log(`✓ ${path} [${theme}] — clean`);
    }

    /* The drawer-open state, where the page has one. Opened through the real
       trigger, not by writing `data-open` — the scan should cover the DOM the
       open path actually produces (aria-expanded, focus target and all). */
    const trigger = page.locator("[data-drawer-open]:visible").first();
    if (await trigger.count()) {
      await trigger.click();
      await page.locator("[data-drawer] .drawer__sheet").waitFor({ state: "visible" });
      const openViolations = await getViolations(page);
      scans += 1;
      if (openViolations.length) {
        failed += openViolations.length;
        report(`${path} +drawer`, theme, openViolations);
      } else {
        console.log(`✓ ${path} +drawer [${theme}] — clean`);
      }
    }

    await context.close();
  }
}

await browser.close();
server.close();

if (failed) {
  console.error(
    `\n${failed} violation(s) across the shipped pages. Fix the page — do not add an exemption here; this gate is the one place the document-scope rules are asserted.`
  );
  process.exit(1);
}
console.log(`\nall ${scans} scans clean`);
