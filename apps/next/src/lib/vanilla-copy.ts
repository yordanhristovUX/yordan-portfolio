/* ============================================================
   COPIED VERBATIM FROM index.html AND cv.html @ 2e84323 — fix upstream first.

   Every string below is on the vanilla site today and is NOT in
   content/dist/content.json. That is not an oversight in the corpus: it is
   where the corpus stops. `scripts/build-content.mjs` reads `content/profile.md`
   for the page frame — the <title> and og: strings, the bar's segments, the
   hero's two buttons, the section headings, the contact block, the footer —
   interpolates them into index.html and cv.html, and emits content.json for
   RETRIEVAL, which does not need a button label. So the second surface can get
   the corpus's words from the corpus and has exactly one honest way to get the
   frame's: copy it from the page that has it, and say so.

   THE RULE THIS FILE OBEYS. Not one sentence here was written for this app.
   Each is character-for-character what index.html or cv.html renders, at the
   commit named above. If a word on the vanilla site changes, this file is
   stale and the fix is to re-copy it — never to reword it here, and never to
   write a sentence the vanilla site does not have. (Copy is extracted, never
   rewritten: ARCHITECTURE.md, non-negotiable 1.)

   THE FIX THAT WOULD DELETE THIS FILE, for whoever owns content/ next: emit
   the `profile.md` frame into content.json — the meta block, `hero.titleLines`,
   `hero.actions`, `sections[]` titles and notes, `contactSection`, `footer`,
   and `cv.openSource.links`/`printUrls`. Every one of them already exists as a
   parsed field inside build-content.mjs; none of them reaches the artefact.
   Add them and this module becomes an import from src/lib/content.ts.

   ONE THING NO COPY CAN FIX, recorded here because it looks like an omission
   and is not. The corpus stores prose through `plain()`, which strips the
   `**bold**` that `inline()` renders into the pages. So a sentence that comes
   FROM content.json arrives here without its emphasis, and this app renders the
   same words with no <strong> in them. Copying the emphasised version into this
   file would fork the sentence, which is the one thing this file exists not to
   do. The fix is upstream too: publish the marked-up form beside the plain one.
   ============================================================ */

export interface Link {
  label: string;
  href: string;
  /** `"solid"` renders `.btn.btn--solid`; a plain button is `.btn`. */
  variant?: "solid";
  external?: boolean;
}

/* ---------- shared across pages ---------- */

/** The static label. js/theme.js replaces it on its first apply(). */
export const THEME_TOGGLE_LABEL =
  "Theme: auto, following your system setting. Activate to change the theme.";

export const MENU = {
  open: "Menu",
  title: "Menu",
  close: "Close",
  home: "Home",
} as const;

export const ASK = {
  label: "Ask my Bot",
  title: "Ask",
  note: "Answers are built from the same source as this page",
  close: "Close ✕",
} as const;

/* ---------- index.html ---------- */

export const INDEX_META = {
  title: "Yordan Hristov — Product Designer",
  description:
    "Senior Product Designer specialising in AI-ready design systems, platform-scale UX, and design-to-code workflows.",
  ogTitle: "Yordan Hristov — Product Designer",
  ogDescription:
    "AI-ready design systems. Platform-scale UX. Design-to-code workflows. A portfolio built on its own open-source design system.",
  ogType: "website",
} as const;

export const INDEX_BAR = {
  id: { label: "Yordan Hristov", href: "#top" },
  nav: [
    { label: "Work", href: "#work" },
    { label: "About", href: "#about" },
    { label: "Contact", href: "#contact" },
  ] as Link[],
  /* The clock's own markup is `, <time id="local-time">--:--</time>` inside a
     `.bar__clock` span — see components/SiteBar.tsx. */
  status: "Available for work — Sofia",
} as const;

export const INDEX_MENU_NAV: Link[] = [
  { label: "Work", href: "#work" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

export const HERO = {
  /* profile.hero.titleLines — two rows, each its own rising word. */
  titleLines: ["YORDAN", "HRISTOV"],
  actions: [
    { label: "See the work ↓", href: "#work", variant: "solid" },
    { label: "Get in touch", href: "mailto:yhristov.xyz@gmail.com" },
  ] as Link[],
} as const;

/** Section headings and their notes, in page order. */
export const INDEX_SECTIONS = {
  capabilities: { id: "about", title: "What I do" },
  work: { id: "work", title: "Selected work", note: "Click a project for the full case study" },
  notable: { id: "notable", title: "Notable Projects" },
  background: { id: "background", title: "Background" },
  skills: { title: "Skills & tools" },
  facts: { id: "unexpected", title: "Unexpected facts" },
  contact: { id: "contact", title: "Contact" },
} as const;

export const CONTACT = {
  kicker: "Have a system to build, a surface to audit, or a handoff gap to close?",
  bigLines: ["LET'S WORK", "TOGETHER"],
  links: [
    { label: "Email", href: "mailto:yhristov.xyz@gmail.com" },
    { label: "+359 884 614 579", href: "tel:+359884614579" },
    { label: "LinkedIn ↗", href: "https://www.linkedin.com/in/yordan-hristov/", external: true },
    { label: "CV →", href: "cv.html" },
    { label: "Retrieval evaluation →", href: "evals.html" },
    { label: "MCP server →", href: "mcp.html" },
  ] as Link[],
} as const;

/** `{{year}}` is the live year — js/main.js writes it into `#year`. */
export const FOOTER = {
  copyright: ["© ", " Yordan Hristov — Sofia, Bulgaria"],
  fallbackYear: "2026",
  index: {
    label: "Built by hand, with machines that help — view source ↗",
    href: "https://github.com/yordanhristovUX/yordan-portfolio",
    external: true,
  } as Link,
  cv: { label: "← Back to the portfolio", href: "index.html" } as Link,
} as const;

/* The drawer's own words. Hand-authored in index.html end to end: "nothing
   here has a content: region because none of its words come from content/".
   Kept here so the chat client that lands in them is a client component and
   nothing else. */
export const CHAT = {
  placeholder: "Ask about the work, the roles, or this design system",
  inputLabel: "Ask a question about Yordan's work",
  send: "Ask →",
  threadLabel: "Conversation",
  suggestions: [
    { ask: "What has he shipped?", label: "What has he shipped?" },
    { ask: "What accessibility work has he done?", label: "Accessibility work?" },
    { ask: "Where is he based and is he available?", label: "Where is he based?" },
    { ask: "How is this site and its design system built?", label: "How is this built?" },
  ],
  status:
    "Every answer is built from Yordan's own written record, cited to the passage it came from — or it says so.",
} as const;

/* ---------- cv.html ---------- */

export const CV_META = {
  title: "Yordan Hristov — CV",
  description:
    "CV of Yordan Hristov, Senior Product Designer: AI-ready design systems, design engineering, and seven years of research practice.",
  ogTitle: "Yordan Hristov — CV",
  ogDescription:
    "Senior Product Designer. AI-ready design systems, design engineering, research practice.",
  ogType: "profile",
} as const;

export const CV_BAR = {
  id: { label: "← Home", href: "/" },
  nav: [
    { label: "Experience", href: "#experience" },
    { label: "Skills", href: "#skills" },
  ] as Link[],
  print: "Print / PDF",
} as const;

export const CV_MENU_NAV: Link[] = [
  { label: "Home", href: "/" },
  { label: "Experience", href: "#experience" },
  { label: "Skills", href: "#skills" },
];

export const CV_SECTIONS = {
  openSource: { id: "open-source", title: "AI-ready design system", note: "Open source" },
  experience: { id: "experience", title: "Experience" },
  skills: { id: "skills", title: "Skills" },
  education: { id: "education", title: "Education & languages" },
  facts: { id: "unexpected", title: "Unexpected facts" },
} as const;

export const CV_OPEN_SOURCE = {
  links: [
    { label: "GitHub repo ↗", href: "https://github.com/yordanhristovUX/yordan-portfolio", external: true },
    { label: "Storybook ↗", href: "https://yordan-design-system.vercel.app", external: true },
  ] as Link[],
  /* Paper can't be clicked: the buttons above are replaced by their URLs in print. */
  printUrls: "github.com/yordanhristovUX/yordan-portfolio · yordan-design-system.vercel.app",
} as const;

/* ---------- work/<id>.html ---------- */

export const WORK_BAR = {
  id: { label: "← Work", href: "/#work" },
  nav: [
    { label: "All work", href: "/#work" },
    { label: "Contact", href: "/#contact" },
  ] as Link[],
} as const;

export const WORK_MENU_NAV: Link[] = [
  { label: "Home", href: "/" },
  { label: "All work", href: "/#work" },
  { label: "Contact", href: "/#contact" },
];

export const WORK_PAGER = { prev: "← Previous", next: "Next →" } as const;

/** The touch trigger on a Notable Projects card — build-content.mjs's own. */
export const CARD_MORE = "Tap for details";

/** The peek sheet's one control. Its title and note are the tapped card's. */
export const PEEK = { close: "Close" } as const;

/** The right-hand column of a work index row. */
export const INDEX_ROW_GO = "View →";
