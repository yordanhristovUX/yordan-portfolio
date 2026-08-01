/* ============================================================
   Next configuration — static export, no server anything.

   `output: "export"` is not a preference, it is the charter: this app is a
   consumer at the bottom of the dependency graph and renders from artefacts
   that are already generated when the build starts. Everything dynamic
   happens in the browser against the published corpus and the chat endpoint,
   exactly as js/ does it on the vanilla site. No route handlers, no server
   actions, no image optimiser — <img> with the markup the vanilla pages use.

   `trailingSlash: false` mirrors vercel.json, where ARCHITECTURE.md calls it
   "the single most load-bearing line of deploy config in the repo". Here it
   decides whether the export writes out/cv.html or out/cv/index.html; the
   first is what the vanilla deployment serves and what /cv must keep meaning.

   The sync runs at config load rather than only from `prebuild` so that a bare
   `npx next build` — the command the agent charter names as the exit gate —
   works from a clean checkout, where src/styles/site/ and public/fonts/ do not
   exist yet because they are gitignored copies.
   ============================================================ */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { sync } from "./scripts/sync-artifacts.mjs";

sync();

const here = dirname(fileURLToPath(import.meta.url));

/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: false,
  images: { unoptimized: true },
  reactStrictMode: true,
  /* THE PACKAGE SHIPS TSX SOURCE, DELIBERATELY, SO THIS APP COMPILES IT.

     @yordan/design-system's exports map resolves ./react/<id> to
     dist/react/<id>.tsx — generated files, not a build output. The package
     declares no dependencies and runs no build step of its own (its
     package.json says so in as many words), which is what keeps the design
     system framework-agnostic: it publishes a class map, a type and an
     element, and the consumer that wants React brings React. Without this
     line Next hands the .tsx to the default loader as node_modules
     JavaScript and the build fails on the first `<a>`. */
  transpilePackages: ["@yordan/design-system"],
  /* THE REPO ROOT, DELIBERATELY, AND IT IS NOT A WORKSPACE.

     Turbopack's "root" is the lowest directory the build may read from, not a
     declaration of ownership. Two of this app's four inputs live above it and
     have to: the design system arrives as a `file:../../design-system`
     package, which npm links as a junction whose real path is outside
     apps/next, and src/lib/content.ts reads content/dist/content.json four
     levels up. Pinned at `here`, Turbopack resolves both to a path outside its
     root and reports "module not found" — measured, not feared.

     Left unset it infers this same directory anyway (there are two lockfiles
     above, and it picks the repo's) and prints a warning asking to be told
     which was meant. This says so. It changes nothing about the standalone
     rule in .claude/agents/next-app.md: this app has its own package.json and
     its own lockfile, the root has no `workspaces` key, and what may cross the
     boundary is decided by scripts/check-boundaries.mjs — a textual gate over
     the source, which no bundler setting can widen. */
  turbopack: { root: resolve(here, "..", "..") },
};

export default nextConfig;
