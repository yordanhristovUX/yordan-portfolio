/* ============================================================
   source of truth: lib/knowledge/schema.js + content/dist/content.json —
   hand-typed, verify on schema change.

   These interfaces describe ONLY the parts of the published corpus this app
   actually renders. They are hand-written on purpose: the alternative is to
   import a type from the slice that produces the file, which is the code
   import across a boundary that ARCHITECTURE.md exists to forbid. A hand-typed
   contract is a claim this app makes about a file it does not own, and
   src/lib/content.ts checks the claim at build time — a corpus that has
   changed shape fails the build here rather than rendering an `undefined`
   somewhere on the page.

   Where the shape is really decided: `scripts/build-content.mjs` emits this
   file from `content/**`; `lib/knowledge/tools.js` is the other consumer of
   it, and `lib/knowledge/schema.js` describes the ANSWER schema whose blocks
   reference these ids. If any of those move, the failure surfaces as a thrown
   assertion in content.ts, and the fix is to re-read the artefact and correct
   this file — never to loosen it to `any`.

   TWO THINGS THE CORPUS DOES NOT CARRY, both of which the vanilla pages do:

   1. INLINE EMPHASIS. `build-content.mjs` renders `**bold**` into the pages
      with `inline()` and stores the SAME string through `plain()` here, so
      `heroLede` arrives as text with the markers stripped. The words are
      identical; the <strong> spans are not reconstructible from this file.
   2. THE HAND-AUTHORED FRAME. Section titles, the footer, the hero's two
      button labels, the contact block's kicker and link grid, and the page
      <title>/og: strings all live in `content/profile.md` and are interpolated
      into the pages without ever reaching content.json. They are reproduced
      verbatim in src/lib/vanilla-copy.ts, which names its source file and
      commit; see the header there.
   ============================================================ */

export interface SystemCounts {
  tokens: number;
  values: number;
  components: number;
  light: number;
  dark: number;
  print: number;
  wide: number;
}

export interface ProfileRow {
  term: string;
  value: string;
  /** `"ok"` renders `.is-ok` on the definition — the availability line. */
  status?: string;
}

export interface Profile {
  identity: {
    name: string;
    role: string;
    disciplines: string[];
    location: { city: string; country: string; full: string; timezone: string };
  };
  availability: { term: string; value: string; status?: string };
  contact: {
    email: string;
    phone: string;
    phoneHref: string;
    site: string;
    linkedin: string;
    linkedinLabel: string;
    repo: string;
    storybook: string;
  };
  rows: ProfileRow[];
  prose: {
    heroLede: string;
    cvSummary: string;
    background: { prose: string; statement: string };
    openSource: string[];
    openSourceFacts: string;
  };
}

export interface Capability {
  id: string;
  title: string;
  body: string;
}

/** One skills row, in whichever of the two taxonomies asked for it. */
export interface SkillGroupSurface {
  term: string;
  text: string;
}

export interface Skills {
  /** Ordered group ids, per surface. The site shows 6 rows, the CV 5. */
  order: { site: string[]; cv: string[] };
  groups: Record<string, { site?: SkillGroupSurface; cv?: SkillGroupSurface }>;
}

export interface Education {
  labels: { education: string; languages: string };
  education: { qualification: string; institution: string }[];
  languages: { language: string; level: string }[];
}

export interface Fact {
  id: string;
  title: string;
  label: string;
  /** The CV may substitute its own label for the same fact. */
  cv?: { label?: string };
}

export interface ProjectLink {
  label: string;
  href: string;
  variant?: string;
  external?: boolean;
}

export interface ProjectMetric {
  value: string;
  label: string;
  kind?: string;
}

export interface ProjectMedia {
  slot: string;
  type?: string;
  src?: string;
  caption: string;
}

export interface ProjectSection {
  kind: string;
  heading: string;
  text: string;
}

export interface Project {
  id: string;
  /** 1-based position among the case studies; `null` on a notable card. */
  index: number | null;
  /** Position within the Notable Projects grid; `null` on a case study. */
  order: number | null;
  title: string;
  client: string | null;
  indexClient: string | null;
  indexTitle: string | null;
  /** The eyebrow on a notable card — `null` on a case study. */
  cardType: string | null;
  hasCaseStudy: boolean;
  tags: string[];
  accentTag: string | null;
  indexTags: string[];
  metrics: ProjectMetric[];
  links: ProjectLink[];
  media: ProjectMedia[];
  summary: string;
  subtitle: string;
  sections: ProjectSection[];
}

export interface ExperienceEntry {
  id: string;
  role: string;
  org: string;
  descriptor: string | null;
  period: { start: string; end: string | null; location?: string; mode?: string };
  /** Pre-formatted by the generator — never assembled from `period` here. */
  span: string;
  projects?: string[];
  bullets?: string[];
}

export interface Corpus {
  version: number;
  system: SystemCounts;
  profile: Profile;
  capabilities: Capability[];
  skills: Skills;
  education: Education;
  facts: Fact[];
  projects: Project[];
  experience: ExperienceEntry[];
}
