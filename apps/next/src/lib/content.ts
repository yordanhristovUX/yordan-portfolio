/* ============================================================
   The corpus, read once at build time.

   `content/dist/content.json` is the published artefact the whole architecture
   turns on: `lib/knowledge/` retrieves from it, `js/answer-render.js` renders
   citations from it, and this app draws every word it can from the same file.
   That is the "one source, many surfaces" claim, and it is only worth
   something if this surface reads the ARTEFACT rather than the content/
   sources behind it. It never touches content/*.md, content/projects/ or
   content/experience/ — scripts/check-boundaries.mjs enforces that, and the
   crossing below is pinned in its CROSSINGS list.

   BUILD TIME ONLY. `server-only` is the mechanism, not a comment: importing
   this module from a client component is a build error rather than a bundle
   that happens to be 200 KB heavier. The browser gets its own copy of the same
   file from /corpus/content.json (synced into public/ by
   scripts/sync-artifacts.mjs) when the chat client lands — the same URL-fetched
   corpus js/answer-render.js uses.

   THE SHAPE IS ASSERTED, NOT ASSUMED. src/lib/types.ts is a hand-typed claim
   about a file this app does not own, and a hand-typed claim with no check is
   a comment. `expect()` below turns a corpus that has changed shape into a
   failed build naming the field, instead of `undefined` rendering as an empty
   section that nobody notices for a month.
   ============================================================ */
import "server-only";

import corpusJson from "../../../../content/dist/content.json";

import type {
  Capability,
  Corpus,
  Education,
  ExperienceEntry,
  Fact,
  Profile,
  Project,
  SkillGroupSurface,
  Skills,
  SystemCounts,
} from "./types";

/* WHY AN IMPORT AND NOT readFileSync, since the charter says readFileSync.

   Both are a build-time read of the same published artefact, and only one of
   them survives the bundler. Turbopack rewrites `new URL("…", import.meta.url)`
   into a reference to an EMITTED ASSET: measured here, the URL came back as
   `/_next/static/media/content.08_tpk9ua85_y.json` and the read failed on
   `C:\_next\static\media\…`. Nor can the path be rebuilt from `import.meta.url`
   by hand — after bundling that is the chunk's location under .next/server/,
   not this file's. The remaining options were `process.cwd()` plus a join,
   which scripts/check-boundaries.mjs deliberately does not resolve and which
   would therefore make this crossing INVISIBLE to the gate that pins it, and a
   plain import, which the gate reads as a reference and resolves exactly as
   written. The pinned literal is preserved character for character; what
   changed is the verb.

   Four levels up from src/lib/ is the repo root. `server-only` above keeps
   the whole thing on the build side. */

function expect<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(
      `content/dist/content.json: expected ${what}.\n` +
        `  The corpus has changed shape under apps/next. Re-read the artefact and correct ` +
        `src/lib/types.ts and this file — never loosen the type to make the build pass.`
    );
  }
  return value;
}

function load(): Corpus {
  const raw = corpusJson as unknown as Corpus;
  expect(raw.profile?.identity?.name, "profile.identity.name");
  expect(raw.profile?.prose?.heroLede, "profile.prose.heroLede");
  expect(raw.capabilities?.length, "a non-empty capabilities[]");
  expect(raw.projects?.length, "a non-empty projects[]");
  expect(raw.experience?.length, "a non-empty experience[]");
  expect(raw.skills?.order?.site?.length, "skills.order.site[]");
  expect(raw.skills?.order?.cv?.length, "skills.order.cv[]");
  expect(raw.education?.education?.length, "education.education[]");
  expect(raw.facts?.length, "a non-empty facts[]");
  expect(raw.system?.components, "system.components");
  return raw;
}

const corpus: Corpus = load();

export const system: SystemCounts = corpus.system;
export const profile: Profile = corpus.profile;
export const capabilities: Capability[] = corpus.capabilities;
export const education: Education = corpus.education;
export const facts: Fact[] = corpus.facts;
export const experience: ExperienceEntry[] = corpus.experience;

/* ---------- projects ----------
   One array carries two kinds of thing, told apart by `hasCaseStudy`: the five
   case studies that own a page at /work/<id>, and the nine Notable Projects
   that are a card and a summary. `index` orders the first, `order` the second;
   neither is an array position, so both are sorted explicitly. */
export const caseStudies: Project[] = corpus.projects
  .filter((p) => p.hasCaseStudy)
  .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

export const notableProjects: Project[] = corpus.projects
  .filter((p) => !p.hasCaseStudy)
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

export function projectById(id: string): Project | undefined {
  return caseStudies.find((p) => p.id === id);
}

/** Previous and next case study, for the pager at the foot of a work page. */
export function neighbours(id: string): { prev?: Project; next?: Project } {
  const i = caseStudies.findIndex((p) => p.id === id);
  if (i === -1) return {};
  return { prev: caseStudies[i - 1], next: caseStudies[i + 1] };
}

/* The plates are named by DERIVATION, not by URL: build-content.mjs writes
   `content/assets/notable/<id>.svg` and a project with no file there simply
   shows a card with no plate. sync-artifacts.mjs copies that directory to
   public/assets/notable/, so the derivation holds with one prefix changed. */
export const notablePlate = (id: string): string => `/assets/notable/${id}.svg`;

/* ---------- skills ----------
   ONE list of groups, two orderings, two vocabularies: the site's "Frontend"
   and the CV's "Engineering" are the same group. Asking for a surface a group
   does not have is a corpus error, not an empty row. */
export function skillRows(surface: "site" | "cv"): SkillGroupSurface[] {
  const skills: Skills = corpus.skills;
  return skills.order[surface].map((id) =>
    expect(skills.groups[id]?.[surface], `skills.groups.${id}.${surface}`)
  );
}

/* ---------- the assistant's address ----------
   The chat API is a function on the VANILLA deployment, and it stays there
   whatever origin this app is served from — the same reasoning the MCP page
   uses for its endpoint. So the default is the corpus's own site, not
   `siteUrl`: pointing at this app's origin would be pointing at a static
   export with no /api anything.

   Cross-origin by construction, therefore. api/chat.js reflects an allowed
   Origin from CHAT_ALLOWED_ORIGINS and sends no `Allow-Credentials`, which is
   why this client sends no credentials either.

   `NEXT_PUBLIC_CHAT_ENDPOINT` overrides it, and a same-origin development run
   NEEDS that: `next dev` on localhost has no /api/chat of its own, so point it
   at a deployment (or at a mock) rather than at itself. */
export const chatEndpoint: string =
  process.env.NEXT_PUBLIC_CHAT_ENDPOINT || `${profile.contact.site.replace(/\/$/, "")}/api/chat`;

/* ---------- the site's own address ----------
   The canonical origin is the owner's, and it is IN the corpus — so the second
   surface does not get to invent one, and a deploy that lives somewhere else
   says so through the environment rather than through a literal in here. */
export const siteUrl: string = (
  process.env.NEXT_PUBLIC_SITE_URL || profile.contact.site
).replace(/\/$/, "");
