/* ============================================================
   The scaffolds emit gate-passing artefacts.

   A scaffold that emits something the gates reject is worse than no
   scaffold: it hands you a broken starting point and the authority of
   having been generated. So this asserts the emitted bytes against
   the SAME rules the gates apply — and where a rule is a list that
   lives in a gate (the allowed `status` values, the allowed `since`
   phases, the closed set of section slugs), the list is read out of
   the gate rather than copied here. A copy would let the scaffold and
   the gate drift apart with the test agreeing with the wrong one.

   Both scaffolds are invoked as real processes with `--dry-run
   --json`, so nothing is written and what is asserted is exactly what
   the tool would have put on disk.
   ============================================================ */
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const at = (rel) => fileURLToPath(new URL(rel, root));
const read = (rel) => readFileSync(at(rel), "utf8");

/** Run a scaffold and return its parsed plan. */
function scaffold(script, args) {
  const res = spawnSync(process.execPath, [at(`scripts/${script}`), ...args, "--dry-run", "--json"], {
    encoding: "utf8",
  });
  return { ...res, plan: res.status === 0 ? JSON.parse(res.stdout) : null };
}
const fileIn = (plan, suffix) => plan.files.find((f) => f.path.endsWith(suffix));

/* ---------- lists owned by the gates, read from the gates ---------- */
function listFrom(source, name, where) {
  const m = source.match(new RegExp(`${name}\\s*=\\s*(?:new Set\\()?\\[([^\\]]*)\\]`));
  assert.ok(m, `could not find \`${name}\` in ${where} — the gate was refactored; re-derive this test, do not delete it`);
  return m[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

/* ============================================================
   new:component
   ============================================================ */
const buildMjs = read("design-system/scripts/build.mjs");
const STATUSES = listFrom(buildMjs, "STATUSES", "design-system/scripts/build.mjs");
const PHASES = listFrom(buildMjs, "PHASES", "design-system/scripts/build.mjs");

const COMPONENT_ID = "zz-scaffold-probe";
const component = scaffold("new-component.mjs", [COMPONENT_ID]);

/** The definition the scaffold writes — the source of everything below it. */
const definitionOf = (plan) => JSON.parse(fileIn(plan, "definition.json").contents);

test("new:component emits the four artefacts the coverage gate demands", () => {
  /* THE TRINITY IS A QUARTET, and the census is why. R4 gave components.css a
     census: a block is generated, or it is authored for a reason the build can
     find in it. A one-declaration scaffold has no combinator, no local custom
     property, no unnamed condition and no foreign selector — so there is no
     honest authored reason available to it, and generated is the only truthful
     thing to emit. definition.json is therefore not an extra: it is the source
     the CSS region is rendered from. */
  assert.equal(component.status, 0, component.stderr);
  const paths = component.plan.files.map((f) => f.path).sort();
  assert.deepEqual(paths, [
    `design-system/components/${COMPONENT_ID}/definition.json`,
    `design-system/components/${COMPONENT_ID}/spec.md`,
    "design-system/css/components.css",
    `design-system/stories/${COMPONENT_ID}.stories.js`,
  ]);
});

test("the scaffold registers the id in all three lists that must name it", () => {
  /* A component that is generated has to be in PILOT (or no emitter renders it),
     in build.mjs's `packaged` array (or nothing writes or byte-compares its
     .tsx) and in the package's `exports` (or the subpath is unreachable). A
     scaffold that half-registers is worse than one that refuses, so the tool
     dies on a missing anchor — and this asserts the set it claims to edit. */
  assert.deepEqual(
    component.plan.registers.map((r) => r.path).sort(),
    ["design-system/package.json", "design-system/scripts/build.mjs", "design-system/scripts/emit-css.mjs"]
  );
  for (const r of component.plan.registers) assert.equal(r.names, COMPONENT_ID);
});

test("the CSS the scaffold writes is an empty GENERATED region, not a block", () => {
  /* The banner now comes out of the definition's `block.title`, rendered by
     design-system/scripts/emit-css.mjs — which this tool runs as a process
     rather than imports, because scripts/check-boundaries.mjs refuses a root
     script reaching into the design system's internals. So what lands in
     components.css is the two markers and nothing between them; the body is the
     emitter's, and build.mjs --check byte-compares it against a fresh render. */
  const block = fileIn(component.plan, "components.css").contents;
  assert.match(block, new RegExp(`^/\\* ---- generated:${COMPONENT_ID} — do not edit, source: components/${COMPONENT_ID}/definition\\.json ---- \\*/$`, "m"));
  assert.match(block, new RegExp(`^/\\* ---- /generated:${COMPONENT_ID} ---- \\*/$`, "m"));
  assert.doesNotMatch(block, /@component/, "the banner belongs to the definition now, not to this file");

  /* And the definition carries what the banner will say. build.mjs's own BANNER
     regex reads `@component <id>` off the first line of the rendered banner, so
     the title has to be a single line and the id has to be the directory name. */
  const def = definitionOf(component.plan);
  assert.equal(def.id, COMPONENT_ID, "the definition's id must equal the directory name");
  assert.equal(def.root, `.${COMPONENT_ID}`, "the root is the component's own class");
  assert.match(def.block.title, /^[^\n]+$/);
});

test("the spec's frontmatter is valid and every value is one the build allows", () => {
  const spec = fileIn(component.plan, "spec.md").contents;
  const fm = spec.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  assert.ok(fm, "no JSON frontmatter block between --- delimiters");

  const front = JSON.parse(fm[1]);
  assert.equal(front.id, COMPONENT_ID, "frontmatter id must equal the directory name");
  assert.ok(STATUSES.includes(front.status), `status "${front.status}" is not one of ${STATUSES.join(" | ")}`);
  assert.ok(
    PHASES.includes(front.since),
    `since "${front.since}" is not one of ${PHASES.join(" | ")} — BUILD-LOG.md gained a phase and ` +
      `scripts/new-component.mjs still emits the old one`
  );
  assert.equal(typeof front.a11y, "string");
  assert.ok(front.a11y.trim().length > 0, "a11y must be a non-empty one-line string");
});

test("the spec's ## Tokens list is exactly the token set its CSS consumes", () => {
  /* The contract gate checks this in both directions and they mean different
     things: consumed-but-undeclared is the spec lying about what the component
     costs; declared-but-unconsumed is only a warning there, but for a scaffold
     it is simply a bug, so both are hard here. */
  const spec = fileIn(component.plan, "spec.md").contents;
  /* Read out of the DEFINITION rather than the CSS, because the CSS is now a
     region the emitter fills: a `{"token": "x"}` binding is what becomes
     `var(--x)`, and it is the form the build's own binding check reads. */
  const bindings = [];
  JSON.stringify(definitionOf(component.plan), (k, v) => {
    if (v && typeof v === "object" && typeof v.token === "string") bindings.push(`--${v.token}`);
    return v;
  });

  const uniq = (a) => [...new Set(a)].sort();
  const consumed = uniq(bindings);
  const section = (spec.split(/^## +Tokens *$/m)[1] ?? "").split(/^## /m)[0];
  const declared = uniq(
    [...section.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]).filter((s) => /^--[a-z0-9-]+$/.test(s))
  );

  assert.ok(consumed.length > 0, "the scaffolded block consumes no token — it would teach the wrong shape");
  assert.deepEqual(declared, consumed, "the ## Tokens list and the CSS block disagree");
});

test("every class the spec claims has a rule in the block it ships with", () => {
  /* design-system/README.md tells agents the canonical HTML "is not an example
     — it is THE pattern. Copy it." A class named there with no rule anywhere is
     the defect the contract gate was added for; a scaffold must not create one. */
  const spec = fileIn(component.plan, "spec.md").contents;
  /* Every selector the definition declares — the root, and any modifier or part
     it grows later. The scaffold ships one, and this is the set the emitter will
     put a rule under, so it is the honest thing to check a claim against. */
  const def = definitionOf(component.plan);
  const declared = [
    def.root,
    ...[...(def.variants ?? []), ...(def.sizes ?? []), ...(def.parts ?? [])].map((m) => m.selector).filter(Boolean),
  ];

  const claimed = new Set();
  for (const fence of spec.matchAll(/```html\r?\n([\s\S]*?)```/g)) {
    for (const attr of fence[1].matchAll(/class="([^"]*)"/g)) {
      attr[1].split(/\s+/).forEach((c) => c && claimed.add("." + c));
    }
  }
  for (const span of spec.matchAll(/`([^`\n]+)`/g)) {
    for (const m of span[1].matchAll(/(?<![\w.])\.([a-z][a-z0-9_-]*)/g)) claimed.add("." + m[1]);
  }

  assert.ok(claimed.size > 0, "the spec claims no class at all");
  const undefined_ = [...claimed].filter((c) => !declared.includes(c));
  assert.deepEqual(undefined_, [], `claimed but not defined: ${undefined_.join(" ")}`);
});

test("the story is a Storybook module in the house shape", () => {
  const story = fileIn(component.plan, ".stories.js").contents;
  assert.match(story, /^export default \{ title: "Components\/.+" \};/m);
  assert.match(story, new RegExp(`class="${COMPONENT_ID}"`), "the story must render the component's own class");
});

test("new:component refuses an id that already exists", () => {
  /* Silently overwriting components/button/spec.md is the one failure mode a
     scaffold must not have. */
  const taken = readdirSync(at("design-system/components"), { withFileTypes: true }).find((d) => d.isDirectory());
  const res = scaffold("new-component.mjs", [taken.name]);
  assert.notEqual(res.status, 0, `scaffolding over the existing "${taken.name}" component was allowed`);
  assert.match(res.stderr, new RegExp(taken.name));
});

test("new:component refuses an id that is not legal as class, file and directory", () => {
  for (const bad of ["Button", "1col", "my_thing", "a--b", "with space"]) {
    assert.notEqual(scaffold("new-component.mjs", [bad]).status, 0, `accepted "${bad}"`);
  }
});

/* ============================================================
   new:project
   ============================================================ */
const buildContent = read("scripts/build-content.mjs");
const KINDS = listFrom(buildContent, "KINDS", "scripts/build-content.mjs");

const PROJECT_ID = "zz-scaffold-probe";
const card = scaffold("new-project.mjs", [PROJECT_ID]);
const caseStudy = scaffold("new-project.mjs", [PROJECT_ID, "--case-study"]);

/** Frontmatter + section slugs, parsed the way build-content.mjs parses them. */
function parseProject(contents) {
  const m = contents.match(/^---\n([\s\S]*?)\n---\n?/);
  assert.ok(m, "no JSON frontmatter block between --- delimiters");
  const front = JSON.parse(m[1]);
  const body = contents.slice(m[0].length);
  const sections = [...body.matchAll(/^##\s+(.*?)\s*\{#([a-z-]+)\}\s*$/gm)].map((s) => ({
    heading: s[1],
    kind: s[2],
    index: s.index,
  }));
  return { front, body, sections };
}

test("new:project emits one file whose frontmatter and slugs the build accepts", () => {
  for (const [label, res] of [["card", card], ["case study", caseStudy]]) {
    assert.equal(res.status, 0, `${label}: ${res.stderr}`);
    assert.deepEqual(res.plan.files.map((f) => f.path), [`content/projects/${PROJECT_ID}.md`]);

    const { front, sections } = parseProject(res.plan.files[0].contents);
    assert.equal(front.id, PROJECT_ID, `${label}: frontmatter id must equal the file name`);
    assert.equal(typeof front.title, "string");

    const unknown = sections.map((s) => s.kind).filter((k) => !KINDS.includes(k));
    assert.deepEqual(unknown, [], `${label}: section slugs outside the closed set: ${unknown.join(", ")}`);
    assert.ok(sections.some((s) => s.kind === "summary"), `${label}: every project needs a {#summary}`);
  }
});

test("a card project carries what the card grid reads, and a case study what the index row reads", () => {
  const c = parseProject(card.plan.files[0].contents).front;
  assert.equal(c.hasCaseStudy, false);
  assert.equal(typeof c.order, "number", "card projects are sorted by `order`");
  assert.equal(typeof c.cardType, "string", "the card grid groups by `cardType`");

  const s = parseProject(caseStudy.plan.files[0].contents).front;
  assert.equal(s.hasCaseStudy, true);
  assert.equal(typeof s.index, "number", "case studies are sorted by `index` and print it as `02 / Client`");
  assert.equal(typeof s.client, "string");
  assert.ok(Array.isArray(s.tags) && s.tags.length, "js/case-studies.js reads tags unconditionally");
  assert.ok(Array.isArray(s.indexTags) && s.indexTags.length, "the work-index row reads indexTags unconditionally");
  /* Two assertions build-content.mjs makes by name. */
  assert.ok(s.tags.includes(s.accentTag), "accentTag must be a member of tags");
  assert.ok(s.indexTags.includes(s.indexAccentTag), "indexAccentTag must be a member of indexTags");
  assert.ok(
    parseProject(caseStudy.plan.files[0].contents).sections.some((x) => x.kind === "subtitle"),
    "a case study also needs a {#subtitle} — it is a different sentence from the summary"
  );
});

test("the {#summary} body starts with a paragraph, because the card body is blocks[0].text", () => {
  /* moreProjectsRegion() reads `section(p, "summary").blocks[0].text` with no
     guard, so a summary that opened with a list or a directive would emit
     `undefined` into the page rather than fail. */
  for (const [label, res] of [["card", card], ["case study", caseStudy]]) {
    const { body, sections } = parseProject(res.plan.files[0].contents);
    const summary = sections.find((s) => s.kind === "summary");
    const after = body.slice(summary.index).split("\n").slice(1);
    const first = after.find((l) => l.trim());
    assert.ok(first, `${label}: {#summary} has no body`);
    assert.doesNotMatch(first, /^-\s/, `${label}: {#summary} opens with a list`);
    assert.doesNotMatch(first, /^\{\{/, `${label}: {#summary} opens with a directive`);
  }
});

test("the emitted order/index does not collide with a project that already exists", () => {
  const dir = at("content/projects");
  if (!existsSync(dir)) return;
  const taken = { order: new Set(), index: new Set(), ids: new Set() };
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const m = readFileSync(`${dir}/${f}`, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) continue;
    const front = JSON.parse(m[1]);
    taken.ids.add(front.id);
    if (typeof front.order === "number") taken.order.add(front.order);
    if (typeof front.index === "number") taken.index.add(front.index);
  }
  assert.ok(!taken.ids.has(PROJECT_ID), "sanity: the probe id must not be a real project");
  const c = parseProject(card.plan.files[0].contents).front;
  const s = parseProject(caseStudy.plan.files[0].contents).front;
  assert.ok(!taken.order.has(c.order), `order ${c.order} is already used — a duplicate silently reorders the grid`);
  assert.ok(!taken.index.has(s.index), `index ${s.index} is already used — a duplicate silently reorders the work index`);
});

test("new:project refuses an id that already exists", () => {
  const dir = at("content/projects");
  const existingId = readdirSync(dir).find((f) => f.endsWith(".md"))?.replace(/\.md$/, "");
  const res = scaffold("new-project.mjs", [existingId]);
  assert.notEqual(res.status, 0, `overwriting content/projects/${existingId}.md was allowed`);
});

test("no scaffold emits raw HTML into content", () => {
  /* content/CLAUDE.md: "No content file may contain raw HTML." The markdown
     subset is the only path from a sentence to a tag. */
  for (const res of [card, caseStudy]) {
    assert.doesNotMatch(res.plan.files[0].contents, /<[a-z][^>]*>/i);
  }
});
