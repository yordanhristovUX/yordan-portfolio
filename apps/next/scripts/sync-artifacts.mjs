#!/usr/bin/env node
/* ============================================================
   Artefact sync — zero dependencies.

   apps/next is a CONSUMER at the bottom of the graph (ARCHITECTURE.md). It
   reaches the rest of the repo in exactly two ways: the design system as an
   npm package (`@yordan/design-system`, `file:../../design-system`), and this
   script, which COPIES published files in at build time. Nothing under src/
   ever reads outside apps/next except src/lib/content.ts, which reads the
   published corpus.

   Copying rather than importing is the point. A stylesheet or a font is not a
   module; `next build` can only fingerprint what lives under the app root, and
   a relative `../../../css/style.css` in an import would put another slice's
   source inside this app's dependency graph. A copy is auditable, is
   re-takeable in one command, and — because every destination below is
   gitignored — cannot be edited into a fork by accident. IF A SYNCED FILE IS
   WRONG, THE FIX IS UPSTREAM, in the slice that owns it, and then re-sync.

   WHAT IS COPIED, AND WHERE FROM

     ../../../css/{style,cv,mcp,evals}.css   →  src/styles/site/
         The page stylesheets. Imported as global CSS by the layouts, AFTER
         the design system's tokens.css and components.css — the same cascade
         order the vanilla pages' <link> tags establish.

     ../../../css/fonts/*                    →  public/fonts/
         fonts.css and the vendored woff2 files, TOGETHER and unchanged, so
         that fonts.css's own `url("./ibm-plex-…woff2")` still resolves against
         the directory it sits in. This is why fonts.css is <link>ed from
         /fonts/fonts.css rather than imported: an import would move it to a
         hashed URL under /_next/static/css/ and every relative url() in it
         would resolve against that directory instead.

     ../../../content/dist/content.json      →  public/corpus/content.json
         The published corpus, served to the browser. Not what the pages
         render from — that is src/lib/content.ts, at build time — but what
         the citation resolver and the chat client will fetch, exactly as
         js/answer-render.js fetches it on the vanilla site.

     ../../../content/assets/notable/*.svg   →  public/assets/notable/
     ../../../content/assets/pipeline.svg    →  public/assets/
         The plates the Notable Projects cards and the portfolio-system case
         study reference. content.json names them by derivation
         (`notable/<project id>.svg`) rather than by URL, so the shape of this
         copy is part of the contract; see src/lib/content.ts.

     ../node_modules/@yordan/design-system/assets/avatar.svg  →  public/assets/
         Through the PACKAGE, not through the repo path. `assets/` is in the
         design system's `files` and deliberately not in its `exports` — its
         package.json says so in as many words: "avatar.svg is fetched by URL
         from markup, never resolved as a module". Fetched by URL is exactly
         what this app does with it; it just needs a URL of its own first.

   URL() REWRITING: NONE, AND THAT IS CHECKED RATHER THAN ASSUMED.

   The only url() references anywhere in css/ are the @font-face src lines in
   css/fonts/fonts.css, and the fonts are copied whole beside it, so they still
   resolve. The four page stylesheets contain none at all. Rather than trust
   that, assertNoUrls() below reads every stylesheet it copies into
   src/styles/site/ and FAILS the build if one grows a url() — because such a
   reference would be relative to css/ upstream and would silently 404 (or,
   worse, be resolved by webpack against apps/next/src/styles/site/) down here.
   If that fires, the fix is a decision — sync the referenced asset into
   public/ and rewrite the reference mechanically HERE, never by hand in a
   copy — not a licence to edit the copy.

   `node scripts/sync-artifacts.mjs` runs it; next.config.mjs also calls
   sync() at config load, so `next build` and `next dev` are self-sufficient
   and the exit gate in .claude/agents/next-app.md works from a clean tree.
   ============================================================ */
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

/* Every crossing this app makes, written as a literal so that
   scripts/check-boundaries.mjs can see it. It resolves each one against THIS
   file's directory — apps/next/scripts/ — so `../../../css/style.css` is the
   repo's css/ and `../node_modules/…` is this app's own. */
const SOURCES = {
  corpus: new URL("../../../content/dist/content.json", import.meta.url),
  style: new URL("../../../css/style.css", import.meta.url),
  cv: new URL("../../../css/cv.css", import.meta.url),
  mcp: new URL("../../../css/mcp.css", import.meta.url),
  evals: new URL("../../../css/evals.css", import.meta.url),
  fonts: new URL("../../../css/fonts", import.meta.url),
  notable: new URL("../../../content/assets/notable", import.meta.url),
  pipeline: new URL("../../../content/assets/pipeline.svg", import.meta.url),
  avatar: new URL("../node_modules/@yordan/design-system/assets/avatar.svg", import.meta.url),
};

const DEST = {
  siteCss: new URL("../src/styles/site", import.meta.url),
  fonts: new URL("../public/fonts", import.meta.url),
  corpus: new URL("../public/corpus", import.meta.url),
  assets: new URL("../public/assets", import.meta.url),
  notable: new URL("../public/assets/notable", import.meta.url),
};

const p = (u) => fileURLToPath(u);
const label = (u) => p(u).replace(/\\/g, "/").split("/apps/next/").pop() ?? p(u);

let copied = 0;
let skipped = 0;

/** Copy when the destination is missing or differs in size or mtime. */
function copy(from, to) {
  const src = p(from);
  const dst = p(to);
  if (!existsSync(src)) throw new Error(`sync-artifacts: missing source ${src}`);
  const a = statSync(src);
  if (existsSync(dst)) {
    const b = statSync(dst);
    if (b.size === a.size && b.mtimeMs >= a.mtimeMs) {
      skipped++;
      return;
    }
  }
  mkdirSync(p(new URL(".", to)), { recursive: true });
  copyFileSync(src, dst);
  copied++;
}

/** Copy a whole directory, flat — none of the sources below is nested. */
function copyDir(from, to, filter = () => true) {
  const dir = p(from);
  if (!existsSync(dir)) throw new Error(`sync-artifacts: missing source directory ${dir}`);
  mkdirSync(p(to), { recursive: true });
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isFile() || !filter(entry.name)) continue;
    copy(new URL(`${from.href}/${entry.name}`), new URL(`${to.href}/${entry.name}`));
  }
}

/* A stylesheet that grows a url() has grown a dependency on the directory it
   was written in, and this copy is not in that directory. See the header. */
function assertNoUrls(files) {
  const offenders = [];
  for (const file of files) {
    const css = readFileSync(p(file), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of css.matchAll(/url\(\s*["']?([^"')]+)/g)) offenders.push(`${label(file)}: url(${m[1]})`);
  }
  if (offenders.length) {
    throw new Error(
      `sync-artifacts: a synced page stylesheet references an asset by relative URL:\n  - ${offenders.join("\n  - ")}\n` +
        `  Those paths are relative to css/ upstream and resolve nowhere from src/styles/site/.\n` +
        `  Sync the asset into public/ and rewrite the reference in THIS script — never edit the copy.`
    );
  }
}

export function sync() {
  /* README.md documents the fonts for a human reading css/fonts/; it is not an
     artefact and has no business in a public/ directory. */
  copyDir(SOURCES.fonts, DEST.fonts, (name) => name !== "README.md");
  copyDir(SOURCES.notable, DEST.notable, (name) => name.endsWith(".svg"));

  copy(SOURCES.corpus, new URL(`${DEST.corpus.href}/content.json`));
  copy(SOURCES.pipeline, new URL(`${DEST.assets.href}/pipeline.svg`));
  copy(SOURCES.avatar, new URL(`${DEST.assets.href}/avatar.svg`));

  for (const [name, from] of [
    ["style.css", SOURCES.style],
    ["cv.css", SOURCES.cv],
    ["mcp.css", SOURCES.mcp],
    ["evals.css", SOURCES.evals],
  ]) {
    copy(from, new URL(`${DEST.siteCss.href}/${name}`));
  }

  assertNoUrls([SOURCES.style, SOURCES.cv, SOURCES.mcp, SOURCES.evals]);
  return { copied, skipped };
}

/** `--clean` removes every synced destination — the copies are disposable. */
function clean() {
  for (const dir of [DEST.siteCss, DEST.fonts, DEST.corpus, DEST.assets]) {
    rmSync(p(dir), { recursive: true, force: true });
  }
}

if (process.argv[1] && p(new URL(import.meta.url)) === process.argv[1]) {
  if (process.argv.includes("--clean")) {
    clean();
    console.log("✓ artefact sync         (cleaned)");
  } else {
    const { copied: c, skipped: s } = sync();
    console.log(`✓ artefact sync         (${c} copied, ${s} already current)`);
  }
}
