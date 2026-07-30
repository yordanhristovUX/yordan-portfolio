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
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  ? { version: pkg.version, tokens: current.tokens, components: current.components }
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

diffMap("token", released.tokens ?? {}, current.tokens, {
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

diffMap("component", released.components ?? {}, current.components, {
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

if (!RELEASE) {
  if (!changes.length) {
    console.log(
      `✓ semver check           (${Object.keys(current.tokens).length} tokens, ` +
        `${Object.keys(current.components).length} components — identical to RELEASED.json at ${fmt(from)})`
    );
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
  if (!BOOTSTRAP && !changes.length && delta === "none") {
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
          "or renamed one is MAJOR. Tokens carry their AUTHORED value and mode variants, not the " +
          "resolved ones, and components carry classes and status — in both cases the omitted fields " +
          "are pure functions of the kept ones, so recording them would report one chosen edit as " +
          "fifteen consequential ones. See scripts/contract-diff.mjs.",
        version: fmt(target),
        tokens: current.tokens,
        components: current.components,
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
  const headline = BOOTSTRAP
    ? `Initial snapshot — ${Object.keys(current.tokens).length} tokens, ${Object.keys(current.components).length} components. ` +
      `Everything below this line is measured against it.`
    : required === "none"
      ? `No contract change; version bumped for another reason.`
      : `${required[0].toUpperCase()}${required.slice(1)} — ${changes.length} change(s).`;
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
      : `✓ released ${fmt(from)} → ${fmt(target)} (${required.toUpperCase()}, ${changes.length} change(s))\n` +
        sorted.map(bullet).join("\n") + "\n") +
      `  · package.json version, RELEASED.json snapshot and CHANGELOG.md entry written.`
  );
}
