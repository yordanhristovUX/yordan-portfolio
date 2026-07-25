#!/usr/bin/env node
/* ============================================================
   Module boundary gate — zero dependencies.

   Every boundary in every repo erodes within a month of being drawn, usually
   via one innocent convenience import. This asserts the direction of the graph
   in ARCHITECTURE.md: dependencies flow design-system → content → lib/knowledge
   → {api, evals}, and every crossing is a GENERATED ARTEFACT, never a code
   import of another slice's source.

   `node scripts/check-boundaries.mjs`
   ============================================================ */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/* Each rule: files under `slice` may not reference anything matching `banned`.
   `allow` names the generated artefact that is the legitimate way across. */
const RULES = [
  {
    slice: "lib/knowledge",
    banned: [/(^|\/)api\//, /(^|\/)js\//, /content\/[^"']*\.md/, /content\/(projects|experience)\//],
    why: "retrieval reads content/dist/content.json — never content/ source or a consumer",
  },
  {
    slice: "content",
    banned: [/(^|\/)lib\//, /(^|\/)api\//, /(^|\/)evals\//, /(^|\/)js\//],
    why: "content is a leaf: it emits artefacts, it never reads its consumers",
  },
  {
    slice: "api",
    banned: [/(^|\/)evals\//, /content\/[^"']*\.md/],
    why: "the API consumes lib/knowledge and content/dist, nothing else",
  },
  {
    slice: "scripts",
    banned: [/(^|\/)lib\//, /(^|\/)api\//, /(^|\/)evals\//],
    why: "the generators run before those slices exist and must not depend on them",
  },
  {
    /* The design system is the root of the graph and knows about nothing else.
       `..` escapes are the exception the counts gate and the stats emit need. */
    slice: "design-system/scripts",
    banned: [/(^|\/)lib\//, /(^|\/)api\//, /(^|\/)evals\//, /content\/(projects|experience|dist)\//],
    why: "the design system is the root of the graph — it knows about none of them",
  },
];

/* Nothing outside design-system/ may reach into its internals: the site and every
   other slice consume dist/ and css/, which are its published surface. */
const DS_INTERNALS = [/design-system\/(tokens|components|stories|scripts|figma)\//];
const DS_INTERNAL_ALLOWED = ["design-system", "ARCHITECTURE.md", "CLAUDE.md", "README.md", "content/CLAUDE.md"];

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "generated", "storybook-static", ".claude", "vendor"]);
const CODE = /\.(mjs|js|cjs|ts)$/;

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") && e.name !== ".gitattributes") continue;
    if (SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/* Only import/require specifiers count — a path inside a comment or a string of
   prose is documentation, not a dependency. */
const SPECIFIER = /(?:^|\s)(?:import\s[\s\S]*?from\s*|import\s*|export\s[\s\S]*?from\s*|require\s*\()\s*["']([^"']+)["']/g;

const problems = [];

for (const rule of RULES) {
  const dir = join(root, rule.slice);
  for (const file of walk(dir).filter((f) => CODE.test(f))) {
    const src = readFileSync(file, "utf8");
    for (const [, spec] of src.matchAll(SPECIFIER)) {
      if (!spec.startsWith(".") && !spec.startsWith("/")) continue; // bare = node builtin or dep
      for (const banned of rule.banned) {
        if (banned.test(spec.replace(/\\/g, "/"))) {
          problems.push(
            `${relative(root, file).split(sep).join("/")} imports "${spec}" — ${rule.why}`
          );
        }
      }
    }
  }
}

/* design-system internals, from anywhere else */
for (const file of walk(root).filter((f) => CODE.test(f))) {
  const rel = relative(root, file).split(sep).join("/");
  if (DS_INTERNAL_ALLOWED.some((p) => rel === p || rel.startsWith(p + "/"))) continue;
  const src = readFileSync(file, "utf8");
  for (const [, spec] of src.matchAll(SPECIFIER)) {
    if (!spec.startsWith(".") && !spec.startsWith("/")) continue;
    if (DS_INTERNALS.some((re) => re.test(spec.replace(/\\/g, "/")))) {
      problems.push(
        `${rel} imports "${spec}" — the design system publishes dist/ and css/; its internals are private`
      );
    }
  }
}

/* The generated artefacts that make the boundaries crossable must exist, or the
   graph is a diagram rather than an architecture. */
for (const artefact of [
  "design-system/dist/tokens.css",
  "design-system/dist/tokens.flat.json",
  "content/system.generated.json",
  "content/dist/content.json",
]) {
  const p = join(root, artefact);
  if (!existsSync(p) || !statSync(p).isFile()) {
    problems.push(`${artefact} is missing — it is the schema-bearing artefact for a boundary crossing`);
  }
}

if (problems.length) {
  console.error(`✗ boundary check failed:\n  - ${problems.join("\n  - ")}\n  See ARCHITECTURE.md.`);
  process.exit(1);
}
console.log(`✓ boundary check         (${RULES.length} slice rules, dependency direction intact)`);
