#!/usr/bin/env node
/* ============================================================
   Contract diff — zero dependencies.

   WHAT THIS IS FOR. `build.mjs` guarantees that dist/ is a true description of
   tokens/ and css/. It says nothing about whether the change that produced it
   is safe for somebody who already depends on it. Those are different
   questions, and only the second one is semver's.

   So the published contract is SNAPSHOTTED, in RELEASED.json, beside the
   version it was published as. This script diffs the current dist/ against
   that snapshot, classifies every difference, and asserts the version delta
   covers it:

     additive        new token, new component, new class   → MINOR
     value change    same name, different value            → PATCH
     removal/rename  a name a consumer could be using      → MAJOR

   `node scripts/contract-diff.mjs`            print the diff, exit 0
   `node scripts/contract-diff.mjs --check`    fail if the version does not cover it
   `node scripts/contract-diff.mjs --release`  bump, re-snapshot, write CHANGELOG.md

   It reads dist/, so run `node scripts/build.mjs` first — otherwise it is
   comparing the previous build against the snapshot and will agree with
   itself. `npm run check` at the repo root runs the build immediately before
   this, which is why the ordering is not enforced here: enforcing it would
   mean this script rebuilding, and a checker that regenerates its own input
   is the exact failure `build.mjs`'s four older dist files already have.

   WHAT IS IN THE SNAPSHOT, AND WHAT IS DELIBERATELY NOT.

   · Tokens: the AUTHORED value and its mode variants (dark / print / wide),
     not the resolved ones. tokens.flat.json publishes both, and the resolved
     values are a pure function of the authored graph — snapshotting them too
     would report one edit to `stone-100` as fifteen changed tokens and bury
     the one that was chosen under fourteen that followed.

   · Components: the class list and the status. `elements` and `variants` in
     components.json are suffix projections of `classes` (`__foot`, `--tint`),
     so they cannot move without it; the same argument as above.

   · Not the prose. A `description` is judgement and rewording it is not a
     release. `build.mjs`'s doc-arithmetic gate is what keeps prose honest.

   · Definitions (phase R3): the RESOLVED projection, keyed by selector —
     `{ kind, declarations }` per rule, with token bindings kept as `{token}`
     references and the property map SORTED. Three deliberate choices there.
     Resolved, so introducing an `aliases` construct is not a contract change:
     the two rules were always identical and now say so once. Keyed by
     selector with the `kind` in the signature, because moving `small` from
     `sizes` to `variants` leaves the CSS identical and changes the React API
     from `size="small"` to `variant="small"` — that is breaking, and only the
     kind records it. Sorted, because regrouping declarations changes no
     computed value and should not read as a change. NOT the raw file: a `$doc`
     is prose, and a definition is now where most of this system's prose lives.

   · The EXPORTS map (phase R3). Five subpaths were added in R2a and nothing
     noticed — the gate watched tokens and components and had no opinion about
     the surface a consumer actually imports through. A subpath is a name
     somebody can depend on, so it gets the same three classes as any other.

   A SURFACE ABSENT FROM THE SNAPSHOT IS "NOT YET TRACKED", NOT "EMPTY", and
   the difference is the whole reason this file can grow a surface without
   lying about history. Diffing eleven exports against `{}` would classify all
   eleven as added at the next version, recording `tokens.css` — published
   since 1.0.0 — as new. So an absent surface is skipped, reported by name,
   and recorded by `--release`; from the release after, it classifies normally.
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAll, definitionPath, partSelector, selectorOf, POSITION_SUFFIX } from "./emit-css.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const FLAGS = ["--check", "--release"];
const args = process.argv.slice(2);
const unknown = args.filter((a) => !FLAGS.includes(a));
if (unknown.length) {
  console.error(
    `✗ usage: node scripts/contract-diff.mjs [--check | --release]\n` +
      `  \`${unknown[0]}\` is not a flag this script takes.`
  );
  process.exit(1);
}
const CHECK = args.includes("--check");
const RELEASE = args.includes("--release");
if (CHECK && RELEASE) {
  console.error(
    `✗ --check and --release do opposite things: one refuses a version that does not cover the\n` +
      `  change, the other makes the version cover it. Pick one.`
  );
  process.exit(1);
}

const read = (rel, what) => {
  const path = join(root, rel);
  if (!existsSync(path)) {
    console.error(
      `✗ ${rel} is missing — ${what}.\n` +
        `  Run \`node design-system/scripts/build.mjs\` first; this script compares its output.`
    );
    process.exit(1);
  }
  return readFileSync(path, "utf8");
};
const readJson = (rel, what) => {
  try {
    return JSON.parse(read(rel, what));
  } catch (e) {
    console.error(`✗ ${rel} is not valid JSON — ${e.message}`);
    process.exit(1);
  }
};

/* ---------- the current contract, out of dist/ ---------- */
const flat = readJson("dist/tokens.flat.json", "it is the published token contract");
const comps = readJson("dist/components.json", "it is the published component contract");
const pkgText = read("package.json", "it carries the version the contract is published as");
const pkg = JSON.parse(pkgText);

const tokenSig = (e) => ({
  cssVar: e.cssVar,
  value: e.value,
  ...(e.dark !== undefined ? { dark: e.dark } : {}),
  ...(e.print !== undefined ? { print: e.print } : {}),
  ...(e.wide !== undefined ? { wide: e.wide } : {}),
});

/* ---------- the definitions surface ----------
   Read through the same loader both emitters use, so what is snapshotted is
   what is rendered — aliases resolved, schema already enforced. */
const { defs, errors: defErrors } = loadAll();
if (defErrors.length) {
  console.error(
    `✗ a component definition is invalid, so the contract cannot be read:\n  - ${defErrors.join("\n  - ")}\n` +
      `  Run \`node design-system/scripts/build.mjs --check\`, which is the gate that owns this.`
  );
  process.exit(1);
}

/* A term is a structural literal, a token binding or a computed expression, and
   the snapshot keeps each in the form that names its BINDINGS rather than the
   form that resolves them: `{space-3}` and `calc({space-3} - 2px)` both say
   which token they depend on, which is what a diff of this file is for. An
   unrecognised term THROWS rather than stringifying to "[object Object]" or
   "{undefined}" — a value form this file has not been taught is a value form
   whose changes it would silently report as identical. */
const termOf = (t) => {
  if (typeof t === "string") return t;
  if (t && typeof t.token === "string") return `{${t.token}}`;
  if (t && typeof t.expr === "string") return t.expr;
  throw new Error(
    `scripts/contract-diff.mjs does not know the value form ${JSON.stringify(t)}. A construct added to ` +
      `components/definition.schema.json has to be taught to this file in the same commit, or the published ` +
      `contract stops describing what a definition actually says.`
  );
};
const valueOf = (v) => (Array.isArray(v) ? v.map(termOf).join(" ") : termOf(v));
/** A rule's declarations as a sorted property map — order is presentation, not contract. */
const declOf = (declarations) => {
  const flatMap = {};
  for (const g of declarations ?? []) for (const [prop, v] of Object.entries(g.set)) flatMap[prop] = valueOf(v);
  return Object.fromEntries(Object.keys(flatMap).sort().map((k) => [k, flatMap[k]]));
};

const definitionSurface = {};
for (const def of defs) {
  const put = (kind, selector, rule, publishOwn = true) => {
    if (publishOwn) definitionSurface[`${def.id} ${selector}`] = { kind, declarations: declOf(rule.declarations) };
    for (const s of rule.states ?? []) {
      definitionSurface[`${def.id} ${selector}${s.suffix}`] = { kind: `${kind} state`, declarations: declOf(s.declarations) };
    }
    /* A CONTAINS applies on the strength of what the consumer's markup holds,
       which makes it the most published of the three: `.ph:has(img)` fires the
       moment somebody drops an <img> in, with nothing on either side asking
       for it. The argument is in the key because `:has(img)` and `:has(.x)`
       are two rules and only the argument says which. */
    for (const c of rule.contains ?? []) {
      definitionSurface[`${def.id} ${selector}:has(${c.element ?? c.class})`] = {
        kind: `${kind} contains`,
        declarations: declOf(c.declarations),
      };
    }
    /* A position is a rule a consumer's markup can land on without asking for
       it — `.case-body h3:first-child` applies to whatever the content pipeline
       emits first — so it is as much a published rule as a state is. */
    for (const p of rule.positions ?? []) {
      definitionSurface[`${def.id} ${selector}${POSITION_SUFFIX[p.at]}`] = { kind: `${kind} position`, declarations: declOf(p.declarations) };
    }
    /* An IN-PLACE condition is as published as a foot one — it applies to a
       consumer's markup at a viewport — and it is keyed the same way, with the
       condition in the key because moving the same declarations to a different
       breakpoint changes what ships without changing any selector. The KIND
       records which of the two shapes of `at` it is, so a rule that migrates
       between them reads as the API change it is rather than as nothing. */
    for (const a of rule.at ?? []) {
      definitionSurface[`${def.id} ${selector} @${a.condition}`] = {
        kind: `${kind} at ${a.condition}`,
        declarations: declOf(a.declarations),
      };
    }
  };
  /* `base` is optional since case-body, whose root is a scope with no rule. */
  if (def.base) put("base", def.root, def.base);
  for (const m of def.variants ?? []) put("variant", m.selector, m);
  for (const m of def.sizes ?? []) put("size", m.selector, m);
  /* A scoped part's selector is built, not written — through the same function
     both emitters use, so the contract names the selector that actually ships. */
  for (const p of def.parts ?? []) put(p.within ? "scoped part" : "part", partSelector(p), p);
  /* A conditional rule is a published rule: it applies to a consumer's markup at
     a viewport, and the CONDITION is part of its identity — moving the same
     declarations to a different breakpoint changes what ships without changing
     any selector, and only the key records that. */
  for (const block of def.at ?? []) {
    for (const o of block.rules) {
      /* An override that declares nothing DIRECTLY publishes no rule of its own,
         only the positions under it — `profile` restates one column and, of
         `.profile > div`, nothing but its odd-child gutter. An entry with an
         empty declaration map would claim a rule that ships no bytes. The
         effect-only MODIFIER is the opposite case and keeps its empty entry:
         `.sec--tint` declares nothing and its name is still `variant="tint"`,
         so the name is the published thing. */
      put(`at ${block.condition}`, `${selectorOf(def, o.of)} @${block.condition}`, o, Boolean(o.declarations));
    }
  }
}

/* ---------- the package surface ----------
   Only the subpath and what it resolves to. `files`, `version` and the rest of
   package.json are not a contract a consumer imports through. */
const exportsSurface = Object.fromEntries(
  Object.entries(pkg.exports ?? {}).map(([subpath, target]) => [subpath, { target }])
);

const current = {
  version: pkg.version,
  tokens: Object.fromEntries(
    Object.entries(flat)
      .filter(([k]) => !k.startsWith("$"))
      .map(([k, e]) => [k, tokenSig(e)])
  ),
  components: Object.fromEntries(
    (comps.components ?? []).map((c) => [c.id, { status: c.status, classes: c.classes }])
  ),
  definitions: definitionSurface,
  exports: exportsSurface,
};

/* ---------- the released contract ---------- */
const releasedPath = join(root, "RELEASED.json");
/* A missing snapshot must never read as "nothing changed" — that is the one
   failure that would make every gate below green while checking nothing. So
   --check refuses outright, and only --release may create it, by declaring
   the current contract to BE the baseline at the version package.json states.
   That is a claim a person makes, not one a checker infers. */
const BOOTSTRAP = !existsSync(releasedPath);
if (BOOTSTRAP && !RELEASE) {
  console.error(
    `✗ RELEASED.json is missing — it is the snapshot every version claim is measured against.\n` +
      `  Without it this script cannot tell an addition from a removal. Create it with\n` +
      `  \`node design-system/scripts/contract-diff.mjs --release\`, which declares the current dist/\n` +
      `  to be the contract of version ${pkg.version} — do that only if it is.`
  );
  process.exit(1);
}
const released = BOOTSTRAP
  ? { version: pkg.version, ...current }
  : JSON.parse(readFileSync(releasedPath, "utf8"));

/* ---------- classification ---------- */
const RANK = { none: 0, patch: 1, minor: 2, major: 3 };
const changes = [];
const add = (rank, subject, text) => changes.push({ rank, subject, text });

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* A signature with the name stripped out. Two tokens that differ only in their
   name are a RENAME, and saying so is worth the extra pass: "removed + added"
   is technically the same classification but sends a reader looking for a
   deletion that never happened. */
const anonymous = (sig) => JSON.stringify({ ...sig, cssVar: undefined });

function diffMap(kind, was, now, describe) {
  const removed = Object.keys(was).filter((k) => !(k in now));
  const added = Object.keys(now).filter((k) => !(k in was));
  const renamedFrom = new Set();
  const renamedTo = new Set();

  for (const from of removed) {
    const to = added.find((a) => !renamedTo.has(a) && anonymous(now[a]) === anonymous(was[from]));
    if (!to) continue;
    renamedFrom.add(from);
    renamedTo.add(to);
    add("major", `${kind} \`${from}\``, `renamed to \`${to}\` — every consumer of the old name breaks`);
  }
  for (const k of removed) {
    if (renamedFrom.has(k)) continue;
    add("major", `${kind} \`${k}\``, `removed — ${describe.removal(was[k])}`);
  }
  for (const k of added) {
    if (renamedTo.has(k)) continue;
    add("minor", `${kind} \`${k}\``, `added`);
  }
  for (const k of Object.keys(was)) {
    if (!(k in now) || same(was[k], now[k])) continue;
    for (const line of describe.changed(was[k], now[k])) add(line.rank, `${kind} \`${k}\``, line.text);
  }
}

const q = (v) => (v === undefined ? "(none)" : JSON.stringify(v));

/* A surface the snapshot has never held is NOT an empty one. Skipping it here
   and recording it at --release is what lets this file grow a surface without
   reporting everything already published as newly added. It is reported by
   name in every mode, because a gate that quietly checks nothing is the
   failure this whole directory is organised against. */
const newlyTracked = [];
const track = (key, kind, describe) => {
  if (released[key] === undefined) {
    newlyTracked.push(`${key} (${Object.keys(current[key]).length} entries)`);
    return;
  }
  diffMap(kind, released[key], current[key], describe);
};

track("tokens", "token", {
  removal: (sig) => `a consumer's \`var(${sig.cssVar})\` resolves to nothing`,
  changed: (was, now) => {
    const out = [];
    for (const field of ["cssVar", "value", "dark", "print", "wide"]) {
      if (was[field] === now[field]) continue;
      /* A mode variant appearing or disappearing is still a value change: the
         token resolves to something different in that mode, and nothing a
         consumer wrote stops working. */
      out.push({ rank: "patch", text: `${field} ${q(was[field])} → ${q(now[field])}` });
    }
    return out;
  },
});

track("components", "component", {
  removal: () => `the markup pattern and its classes are gone`,
  changed: (was, now) => {
    const out = [];
    const wasClasses = was.classes ?? [];
    const nowClasses = now.classes ?? [];
    const gone = wasClasses.filter((c) => !nowClasses.includes(c));
    const fresh = nowClasses.filter((c) => !wasClasses.includes(c));
    if (gone.length) out.push({ rank: "major", text: `no longer defines ${gone.map((c) => `\`${c}\``).join(", ")}` });
    if (fresh.length) out.push({ rank: "minor", text: `now defines ${fresh.map((c) => `\`${c}\``).join(", ")}` });
    if (was.status !== now.status) out.push({ rank: "patch", text: `status ${q(was.status)} → ${q(now.status)}` });
    return out;
  },
});

/* A definition rule is a name in TWO APIs at once: the class a page writes and
   the prop a React consumer passes. So a removal is breaking on both surfaces,
   and a change of KIND — `sizes` to `variants` — is breaking on the second
   while leaving the first byte-identical, which is exactly the change nobody
   would look for. */
track("definitions", "definition", {
  removal: (sig) => `the ${sig.kind} is gone — its class and, for a modifier, its React prop value with it`,
  changed: (was, now) => {
    const out = [];
    if (was.kind !== now.kind) {
      out.push({
        rank: "major",
        text:
          `is a ${now.kind} and was a ${was.kind} — the CSS is unchanged and the React API is not: ` +
          `a modifier that moves between \`variants\` and \`sizes\` moves between props`,
      });
    }
    const wasDecl = was.declarations ?? {};
    const nowDecl = now.declarations ?? {};
    for (const prop of Object.keys(wasDecl)) {
      if (!(prop in nowDecl)) out.push({ rank: "patch", text: `no longer sets \`${prop}\` (was ${q(wasDecl[prop])})` });
      else if (wasDecl[prop] !== nowDecl[prop]) out.push({ rank: "patch", text: `\`${prop}\` ${q(wasDecl[prop])} → ${q(nowDecl[prop])}` });
    }
    for (const prop of Object.keys(nowDecl)) {
      if (!(prop in wasDecl)) out.push({ rank: "patch", text: `now sets \`${prop}\`: ${q(nowDecl[prop])}` });
    }
    return out;
  },
});

/* The subpath map is the contract in the vocabulary a package manager
   understands, and until R3 nothing compared it. Removing one is not a
   deprecation a consumer can work around — the import stops resolving. */
track("exports", "export", {
  removal: (sig) => `a consumer importing that subpath stops resolving — it pointed at ${q(sig.target)}`,
  changed: (was, now) => [{ rank: "patch", text: `resolves to ${q(now.target)}, was ${q(was.target)}` }],
});

const requiredRank = changes.reduce((r, c) => Math.max(r, RANK[c.rank]), 0);
const required = Object.keys(RANK).find((k) => RANK[k] === requiredRank);

/* ---------- versions ---------- */
function parseVersion(v, where) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v ?? ""));
  if (!m) {
    console.error(
      `✗ ${where} carries the version ${JSON.stringify(v)}, which is not a plain MAJOR.MINOR.PATCH.\n` +
        `  Pre-release and build-metadata suffixes are refused rather than guessed at: this repo has\n` +
        `  never used one, and comparing them wrongly would be worse than not comparing them.`
    );
    process.exit(1);
  }
  return [+m[1], +m[2], +m[3]];
}
const from = parseVersion(released.version, "RELEASED.json");
const to = parseVersion(pkg.version, "package.json");

/** How the version itself moved: none / patch / minor / major / backwards. */
function versionDelta(a, b) {
  for (let i = 0; i < 3; i++) {
    if (b[i] > a[i]) return ["major", "minor", "patch"][i];
    if (b[i] < a[i]) return "backwards";
  }
  return "none";
}
const delta = versionDelta(from, to);
const bump = (v, kind) =>
  kind === "major" ? [v[0] + 1, 0, 0] : kind === "minor" ? [v[0], v[1] + 1, 0] : [v[0], v[1], v[2] + 1];
const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
const fmt = (v) => v.join(".");

/* ---------- report ---------- */
const ORDER = { major: 0, minor: 1, patch: 2 };
const sorted = [...changes].sort((a, b) => ORDER[a.rank] - ORDER[b.rank] || a.subject.localeCompare(b.subject));
const LABEL = { major: "BREAKING", minor: "additive", patch: "value   " };
const bullet = (c) => `  · ${LABEL[c.rank]}  ${c.subject} ${c.text}`;

const SIZES = () =>
  `${Object.keys(current.tokens).length} tokens, ${Object.keys(current.components).length} components, ` +
  `${Object.keys(current.definitions).length} definition rules, ${Object.keys(current.exports).length} exports`;

if (newlyTracked.length) {
  console.log(
    `  ! newly tracked, recorded but NOT classified: ${newlyTracked.join(", ")}.\n` +
      `    RELEASED.json has no baseline for ${newlyTracked.length === 1 ? "it" : "them"}, and diffing against an empty\n` +
      `    map would report everything already published as newly added. \`--release\` records the baseline;\n` +
      `    from the next release ${newlyTracked.length === 1 ? "it classifies" : "they classify"} like every other surface.`
  );
}

if (!RELEASE) {
  if (!changes.length) {
    console.log(`✓ semver check           (${SIZES()} — identical to RELEASED.json at ${fmt(from)})`);
  } else if (!CHECK) {
    console.log(
      `  contract diff vs RELEASED.json ${fmt(from)} — ${changes.length} change(s), requires a ${required.toUpperCase()} bump:\n` +
        sorted.map(bullet).join("\n")
    );
  }
}

/* ---------- --check ----------
   The question is only ever "does the version delta cover the change class".
   It is NOT "has RELEASED.json been re-snapshotted": bumping by hand and
   leaving the snapshot at the last released version is the normal state of an
   unreleased change, and a gate that failed on it would make every pull
   request run --release. --release is what records the snapshot. */
if (CHECK) {
  if (delta === "backwards") {
    console.error(
      `✗ semver check failed — package.json is ${fmt(to)} and RELEASED.json is ${fmt(from)}.\n` +
        `  The version went BACKWARDS. A published version is a promise about a specific contract;\n` +
        `  reusing a lower number republishes a different contract under a name somebody already has.`
    );
    process.exit(1);
  }
  if (changes.length && RANK[delta] < RANK[required]) {
    const want = fmt(bump(from, required));
    console.error(
      `✗ semver check failed — the version does not cover the change.\n` +
        `  RELEASED.json is ${fmt(from)}, package.json is ${fmt(to)} (${delta === "none" ? "no bump" : `a ${delta} bump`}), ` +
        `and the contract needs a ${required.toUpperCase()} bump because:\n` +
        sorted.map(bullet).join("\n") +
        `\n  Set design-system/package.json to ${want}, or run \`node design-system/scripts/contract-diff.mjs --release\`\n` +
        `  to bump, re-snapshot RELEASED.json and write the CHANGELOG entry in one step.`
    );
    process.exit(1);
  }
  if (changes.length) {
    console.log(
      `✓ semver check           (${changes.length} change(s) needing a ${required.toUpperCase()} bump, ` +
        `covered by ${fmt(from)} → ${fmt(to)}; run --release to record the snapshot)\n` +
        sorted.map(bullet).join("\n")
    );
  } else if (delta !== "none") {
    console.log(`  (package.json is ${fmt(to)}, a ${delta} bump with no contract change — allowed)`);
  }
}

/* ---------- --release ---------- */
if (RELEASE) {
  if (delta === "backwards") {
    console.error(`✗ package.json ${fmt(to)} is behind RELEASED.json ${fmt(from)} — fix that by hand first.`);
    process.exit(1);
  }
  /* "No classified change" is not "nothing to do" when a surface is newly
     tracked: the snapshot has to gain its baseline or the next release will
     skip it again, forever. */
  if (!BOOTSTRAP && !changes.length && delta === "none" && !newlyTracked.length) {
    console.log(`  nothing to release — the contract is identical to RELEASED.json at ${fmt(from)}.`);
    process.exit(0);
  }

  /* The smallest version that satisfies the diff, unless the author already
     chose a larger one — a deliberate 2.0.0 for a merely additive change is a
     judgement this script has no business overruling. */
  const need = changes.length ? bump(from, required) : to;
  const target = cmp(to, need) > 0 ? to : need;

  if (fmt(target) !== pkg.version) {
    const next = pkgText.replace(/("version"\s*:\s*")\d+\.\d+\.\d+(")/, `$1${fmt(target)}$2`);
    if (next === pkgText) {
      console.error(`✗ could not find a \`"version": "x.y.z"\` line to rewrite in design-system/package.json.`);
      process.exit(1);
    }
    writeFileSync(join(root, "package.json"), next);
  }

  writeFileSync(
    releasedPath,
    JSON.stringify(
      {
        $generatedBy: "design-system/scripts/contract-diff.mjs --release — do not hand-edit",
        $doc:
          "The published contract of @yordan/design-system as of `version`. Every later change is " +
          "classified against this file: an added name is MINOR, a changed value is PATCH, a removed " +
          "or renamed one is MAJOR. FOUR SURFACES. Tokens carry their AUTHORED value and mode variants, " +
          "not the resolved ones, and components carry classes and status — in both cases the omitted " +
          "fields are pure functions of the kept ones, so recording them would report one chosen edit as " +
          "fifteen consequential ones. Definitions carry the RESOLVED projection keyed by selector, with " +
          "`kind` in the signature (a modifier moving between `sizes` and `variants` leaves the CSS " +
          "identical and changes the React prop) and the property map sorted (regrouping is presentation). " +
          "Exports carry the subpath map, because that is the contract a consumer actually imports " +
          "through and until R3 nothing compared it. No prose on any of the four. See " +
          "scripts/contract-diff.mjs.",
        version: fmt(target),
        tokens: current.tokens,
        components: current.components,
        definitions: current.definitions,
        exports: current.exports,
      },
      null,
      2
    ) + "\n"
  );

  /* ---------- CHANGELOG.md ---------- */
  const changelogPath = join(root, "CHANGELOG.md");
  const HEADER =
    `# Changelog — @yordan/design-system\n\n` +
    `<!-- GENERATED by scripts/contract-diff.mjs --release — do not hand-edit an entry.\n` +
    `     Each entry is the classified diff between dist/ and the previous RELEASED.json snapshot,\n` +
    `     newest first. It records WHAT changed in the contract; WHY belongs in the commit message,\n` +
    `     which is the one place prose cannot go stale against a generated file. -->\n`;
  const HEADS = { major: "Removed or renamed (breaking)", minor: "Added", patch: "Changed" };
  const stamp = new Date().toISOString().slice(0, 10);
  const tracked = newlyTracked.length
    ? ` Newly tracked from this version: ${newlyTracked.join(", ")} — recorded as the baseline, not classified as additions.`
    : "";
  const headline =
    (BOOTSTRAP
      ? `Initial snapshot — ${SIZES()}. Everything below this line is measured against it.`
      : required === "none"
        ? `No classified contract change.`
        : `${required[0].toUpperCase()}${required.slice(1)} — ${changes.length} change(s).`) + tracked;
  const entry =
    `\n## ${fmt(target)} — ${stamp}\n\n` +
    `${headline}\n` +
    ["major", "minor", "patch"]
      .filter((rank) => sorted.some((c) => c.rank === rank))
      .map(
        (rank) =>
          `\n### ${HEADS[rank]}\n\n` +
          sorted.filter((c) => c.rank === rank).map((c) => `- ${c.subject} ${c.text}\n`).join("")
      )
      .join("");

  const existing = existsSync(changelogPath) ? readFileSync(changelogPath, "utf8") : null;
  if (existing === null) {
    writeFileSync(changelogPath, HEADER + entry);
  } else {
    /* Insert after the banner comment, so entries stay newest-first. The cut
       lands just past the banner's own newline — `entry` opens with one of its
       own, and the two together are the blank line markdown wants. */
    const at = existing.indexOf("-->");
    let cut = at === -1 ? existing.indexOf("\n\n") + 1 : at + 3;
    if (existing[cut] === "\r") cut++;
    if (existing[cut] === "\n") cut++;
    writeFileSync(changelogPath, existing.slice(0, cut) + entry + existing.slice(cut));
  }

  console.log(
    (BOOTSTRAP
      ? `✓ snapshotted ${fmt(target)} — the baseline every later change is measured against\n`
      : `✓ released ${fmt(from)} → ${fmt(target)} — ` +
        (changes.length ? `${required.toUpperCase()}, ${changes.length} change(s)\n${sorted.map(bullet).join("\n")}\n` : `no classified change\n`)) +
      (newlyTracked.length ? `  · baseline recorded for ${newlyTracked.join(", ")}\n` : "") +
      `  · package.json version, RELEASED.json snapshot and CHANGELOG.md entry written.`
  );
}
