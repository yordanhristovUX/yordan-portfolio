#!/usr/bin/env node
/* ============================================================
   THE REACT TIER — components/<id>/definition.json → dist/react/<id>.tsx.
   Zero dependencies; a template string, like scripts/emit-css.mjs.

   Phase R2a, and the second consumer of the SAME definitions pipeline 1
   already renders to CSS. That is the point of the exercise: one file per
   component describes its appearance, and two emitters read it — one produces
   the block in css/components.css that the vanilla site loads, the other
   produces a typed React component the Next app imports. Neither is a
   translation of the other; both are renderings of the definition, which is
   why they cannot drift apart the way two hand-written implementations do.

   ── WHAT IS GENERATED, AND WHAT IS DELIBERATELY NOT ──

   GENERATED: the cva map (base classes, one entry per variant and per size,
   states as Tailwind prefixes), the variant TYPES, the element, the className
   merge, and the HTML props passthrough. Styling is data.

   NOT GENERATED, and not coming: behaviour. There is no focus management, no
   keyboard handling, no ARIA and no state in any file this emitter writes. A
   component that needs those gets them hand-authored by the consumer, on top.
   The one thing here that looks like behaviour is Button rendering <a> or
   <button>, and it is not a decision this emitter makes — see below.

   ── THE ELEMENT COMES FROM THE SPEC, NOT FROM THE DEFINITION ──

   design-system/README.md says the canonical HTML in each spec.md "is not an
   example — it is THE pattern", and build.mjs already parses those fences to
   check that every class named in one has a rule. So the element a component
   renders is READ from that fence rather than restated in the definition:

     button/spec.md    <a class="btn">…  <a class="btn btn--solid">…  <button class="btn btn--small">…
     chip/spec.md      <span class="chip">…      inside <div class="chips">…
     stat/spec.md      <span class="stat">…

   Button is polymorphic because its canonical HTML uses two elements, not
   because anybody decided a button component ought to be. If the fence ever
   shows one element, the generated component stops being polymorphic in the
   same commit — and if it shows a pair this emitter has no rule for, the build
   fails rather than guessing a discriminant.

   ── A CLASS ATTRIBUTE HAS NO ORDER ──

   The one thing about this tier that is NOT a straight transcription of the
   definition, and the reason is worth reading before changing anything here.
   cva concatenates base and variant classes into a single attribute; CSS then
   resolves them by STYLESHEET order, which Tailwind decides by sorting. So an
   override does not win by being listed later — it wins, or loses,
   alphabetically, and on the pilot's first output every single one lost.

   The emitter therefore makes colliding classes DISJOINT rather than trying to
   weight them: a base class whose property an axis overrides moves into that
   axis's `default` branch. See the block above `disjoin` for the full
   argument, including the case it refuses to guess at. Nothing about the
   definitions changed to accommodate this, and pipeline 1 is untouched —
   components.css has a real cascade and needs none of it.

   ── CLASSNAME IS APPENDED, NOT MERGED ──

   `cx` is clsx, re-exported by cva. It concatenates; it does not resolve two
   conflicting Tailwind utilities, because CSS resolves those by STYLESHEET
   order and nothing in a class attribute can change that. A consumer who needs
   last-one-wins override semantics adds tailwind-merge themselves — this
   package will not take the dependency on their behalf, and pretending the
   merge happens would be worse than saying it does not.

   ── THE ONE EXTERNAL IMPORT ──

   `class-variance-authority` is a bare specifier in a published file and is
   the CONSUMER's dependency, declared in apps/next rather than here. This
   package installs nothing: `design-system/package.json` has no `dependencies`
   and gains none. React is likewise the consumer's, and is imported for types
   only.
   ============================================================ */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { utilitiesFor, STATE_PREFIX } from "./emit-tailwind.mjs";

/* ---------- names ---------- */
const pascal = (s) => s.split(/[^a-z0-9]+/i).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const camel = (s) => { const p = pascal(s); return p[0].toLowerCase() + p.slice(1); };

/* ---------- the element, out of the spec's canonical HTML ---------- */
const HTML_FENCE = /```html\r?\n([\s\S]*?)```/g;
const TAG = /<([a-z][\w-]*)\b[^>]*\sclass="([^"]*)"/g;

/**
 * class → the elements the canonical HTML puts it on, in order of appearance.
 * @returns {Map<string, string[]>}
 */
export function elementsInSpec(specText) {
  const out = new Map();
  for (const fence of specText.matchAll(HTML_FENCE)) {
    for (const m of fence[1].matchAll(TAG)) {
      for (const cls of m[2].split(/\s+/).filter(Boolean)) {
        const list = out.get(`.${cls}`) ?? [];
        if (!list.includes(m[1])) list.push(m[1]);
        out.set(`.${cls}`, list);
      }
    }
  }
  return out;
}

/* ---------- declarations → classes ----------
   Every class is carried as `{ cls, keys }`, where a key is the state prefix
   plus one CSS longhand the class writes. Two classes collide exactly when
   their key sets intersect — which is a statement about properties, not about
   class names, and is what the transform below needs. A state prefix is part
   of the key because a hover declaration and a resting one do NOT compete:
   `.x:hover` outspecifies `.y` in Tailwind exactly as it does in
   components.css. */
function entriesOf(declarations, keyOf, where, tally, prefix = "") {
  const out = [];
  for (const group of declarations ?? []) {
    for (const [prop, value] of Object.entries(group.set)) {
      const { classes, arbitrary } = utilitiesFor(prop, value, keyOf, where);
      if (arbitrary) tally.arbitrary += classes.length;
      for (const { cls, sets } of classes) {
        out.push({ cls: prefix + cls, keys: new Set(sets.map((s) => `${prefix}${s}`)) });
      }
    }
  }
  return out;
}

/* A state may carry a selector LIST — `:hover, :focus-visible` is one rule under
   two selectors in the stylesheet. Tailwind has no selector list, so each class
   is emitted once per prefix. That is the same cascade and a longer attribute,
   which is the honest trade: the alternative is dropping one of the two. */
function stateEntriesOf(states, keyOf, where, tally) {
  const out = [];
  for (const s of states ?? []) {
    for (const suffix of Array.isArray(s.suffix) ? s.suffix : [s.suffix]) {
      const prefix = STATE_PREFIX[suffix];
      if (!prefix) {
        throw new Error(
          `${where}: the state \`${s.name}\` appends \`${suffix}\`, which scripts/emit-tailwind.mjs has no Tailwind ` +
            `variant prefix for. Add it to STATE_PREFIX — a state this emitter cannot name is a state the React ` +
            `component would silently drop.`
        );
      }
      out.push(...entriesOf(s.declarations, keyOf, `${where} → ${s.name}`, tally, prefix));
    }
  }
  return out;
}

const keySetOf = (entries) => new Set(entries.flatMap((e) => [...e.keys]));
const hits = (entry, keys) => [...entry.keys].some((k) => keys.has(k));

/* ============================================================
   THE COLLISION TRANSFORM — why a variant class cannot simply be added.

   cva concatenates base and variant classes into one class attribute, and a
   class attribute has NO ORDER: the stylesheet decides which wins, and
   Tailwind sorts its utilities. Measured on the pilot's own output, every
   override sorted BEFORE the base class it had to beat — px-space-3 before
   px-space-5, text-content-inverse before text-content-primary,
   hover:bg-action-hover before hover:bg-primary — so every one of them lost.
   A solid Button rendered dark ink on a dark fill; a small Button rendered at
   base metrics. Chip's solid variant worked, and worked only because
   `border-primary` happens to sort after `border-chrome-border-strong`.

   Pipeline 1 has no such problem, and nothing here touches it: in
   components.css `.btn--solid` really does come after `.btn`.

   THE FIX IS DISJOINTNESS, not weight. No !important, no tailwind-merge, and
   no change to the definitions — they stay transcription-faithful. For each
   axis, a base class whose property the axis overrides is MOVED into that
   axis's `default` branch, so exactly one of the two ever applies:

     base            .btn minus the properties an axis overrides
     variant.default the base's colour and hover-background
     variant.solid   the solid colour and hover-background
     size.default    the base's padding and font-size
     size.small      the small padding and font-size

   A branch that does not set every property the axis claims inherits the
   base's class for the rest, so an axis with two unlike variants still
   renders completely. With one variant per axis — which is the pilot — that
   list is always empty, but the rule is written for the general case because
   the failure it prevents is invisible.

   WHAT IT DOES NOT DO: two AXES that override the same property cannot be
   made disjoint this way, because both apply at once and cva has no ordering
   between them. Button's axes are disjoint today (variant sets colour and
   background, size sets padding and font-size). If a definition ever creates
   that overlap the build FAILS and names both branches and the property —
   guessing which should win is exactly the decision an emitter must not make.
   ============================================================ */
function disjoin(base, axes, where, declared) {
  for (const axis of axes) {
    const axisKeys = new Set();
    for (const branch of axis.branches) for (const k of keySetOf(branch.entries)) axisKeys.add(k);

    const moved = base.filter((e) => hits(e, axisKeys));
    if (!moved.length) continue;
    base = base.filter((e) => !moved.includes(e));
    axis.fallback = moved;
    for (const branch of axis.branches) {
      const own = keySetOf(branch.entries);
      branch.entries = [...branch.entries, ...moved.filter((e) => !hits(e, own))];
    }
  }

  /* Every combination that can apply at once, checked on the FINAL contents —
     including each axis's `default`, because two defaults apply together. */
  const clashes = [];
  for (let i = 0; i < axes.length; i++) {
    for (let j = i + 1; j < axes.length; j++) {
      const left = [{ name: "default", entries: axes[i].fallback ?? [] }, ...axes[i].branches];
      const right = [{ name: "default", entries: axes[j].fallback ?? [] }, ...axes[j].branches];
      for (const a of left) {
        for (const b of right) {
          const shared = [...keySetOf(a.entries)].filter((k) => keySetOf(b.entries).has(k));
          if (shared.length) {
            clashes.push(
              `${axes[i].prop}="${a.name}" and ${axes[j].prop}="${b.name}" both set ${shared.join(", ")}`
            );
          }
        }
      }
    }
  }
  if (clashes.length) {
    throw new Error(
      `\`axes.orthogonal\` claims ${JSON.stringify(declared ?? axes.map((a) => a.prop))} is a deliberate matrix, and two of ` +
        `those axes override the same property while both apply at once:\n  - ${clashes.join("\n  - ")}\n` +
        `  cva concatenates them into one class attribute, which has no order, so which one wins would be decided ` +
        `by Tailwind's alphabetical sort rather than by ${where}. Moving the base class into a \`default\` branch ` +
        `cannot help — neither axis is the base. Split the property onto one axis, or express the combination as a ` +
        `single variant. The claim is the thing to fix or the shape is; this emitter will not guess which.`
    );
  }
  return base;
}

/* ---------- prose ---------- */
const wrap = (text, width, indent) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if (line && (line + " " + w).length > width) { lines.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) lines.push(line);
  return lines.map((l, i) => (i ? `${indent}${l}` : l));
};
const tsdoc = (text, indent) => {
  const lines = wrap(text, 92 - indent.length, "");
  if (lines.length === 1) return `${indent}/** ${lines[0]} */\n`;
  return `${indent}/**\n${lines.map((l) => `${indent} * ${l}`).join("\n")}\n${indent} */\n`;
};
const list = (entries, indent) => entries.map((e) => `${indent}"${e.cls}",`).join("\n");

/* ---------- one component file ---------- */

/**
 * @param {object} def          the parsed definition.json
 * @param {Map<string,string[]>} elements  from elementsInSpec
 * @param {(name:string)=>string|null} keyOf  token name → @theme key
 */
export function renderComponent(def, elements, keyOf) {
  const where = `components/${def.id}/definition.json`;
  const tally = { arbitrary: 0 };
  const Name = pascal(def.id);
  const fn = camel(def.id);

  /* The element(s) a selector renders on, read from the spec's canonical HTML —
     for a root and, since R4, for a part on exactly the same terms. */
  const elementsFor = (selector, label) => {
    const list = elements.get(selector);
    if (!list || !list.length) {
      throw new Error(
        `components/${def.id}/spec.md: its canonical HTML never puts \`${selector}\` (${label}) on an element, so this ` +
          `emitter cannot know what to render. The fence in a spec is THE pattern — add the class to it.`
      );
    }
    if (list.length > 1 && !(list.length === 2 && list.includes("a") && list.includes("button"))) {
      throw new Error(
        `components/${def.id}/spec.md: its canonical HTML puts \`${selector}\` on ${list.map((e) => `<${e}>`).join(" and ")}. ` +
          `The only polymorphic pair this emitter has a discriminant for is <a> / <button>, which it tells apart by ` +
          `\`href\`. Decide the discriminant and add it here rather than letting the generator pick one.`
      );
    }
    return list;
  };
  const els = elementsFor(def.root, "the root");
  const polymorphic = els.length > 1;

  let base = [
    ...entriesOf(def.base.declarations, keyOf, where, tally),
    ...stateEntriesOf(def.base.states, keyOf, where, tally),
  ];

  /* One cva axis per kind the definition actually has. Every axis carries a
     `default` branch, so the unmodified component is a value of the type
     rather than the absence of one — and, since the transform below, the
     branch that holds the base's own value for anything the axis overrides. */
  const axes = [];
  const branchesOf = (items) =>
    items.map((item) => ({
      name: item.name,
      $doc: item.$doc,
      entries: [
        ...entriesOf(item.declarations, keyOf, `${where} → ${item.selector}`, tally),
        ...stateEntriesOf(item.states, keyOf, `${where} → ${item.selector}`, tally),
      ],
    }));
  if (def.variants?.length) axes.push({ prop: "variant", branches: branchesOf(def.variants) });
  if (def.sizes?.length) axes.push({ prop: "size", branches: branchesOf(def.sizes) });

  base = disjoin(base, axes, where, def.axes?.orthogonal);

  let out = header(def, `dist/react/${def.id}.tsx`);
  out += `import { cva, cx, type VariantProps } from "class-variance-authority";\n`;
  out += `import type { ComponentPropsWithRef } from "react";\n\n`;

  /* the cva map */
  out += tsdoc(
    `The class map for \`${def.root}\`, rendered from its definition. The base carries only what no ` +
      `variant or size overrides; anything one of them does override sits in that axis's \`default\` branch instead, ` +
      `so exactly one of the two classes is ever in the attribute.`,
    ""
  );
  if (!axes.length) {
    /* No variants and no sizes: the same one-argument shape a part gets, so a
       component with one appearance does not look like one whose axes went
       missing. */
    out += `export const ${fn} = cva([\n${list(base, "  ")}\n]);\n\n`;
  } else {
    out += `export const ${fn} = cva(\n  [\n${list(base, "    ")}\n  ]`;
    out += `,\n  {\n    variants: {\n`;
    for (const axis of axes) {
      out += `      ${axis.prop}: {\n`;
      const fallback = axis.fallback ?? [];
      if (!fallback.length) {
        out += `        default: "",\n`;
      } else {
        out += tsdoc(
          `The base's own value for every property this axis overrides. It lives here rather than in the base list ` +
            `because a class attribute has no order — see the transform in scripts/emit-react.mjs.`,
          "        "
        );
        out += `        default: [\n${list(fallback, "          ")}\n        ],\n`;
      }
      for (const branch of axis.branches) {
        if (branch.$doc) out += tsdoc(branch.$doc, "        ");
        out += `        ${branch.name}: [\n${list(branch.entries, "          ")}\n        ],\n`;
      }
      out += `      },\n`;
    }
    out += `    },\n    defaultVariants: { ${axes.map((a) => `${a.prop}: "default"`).join(", ")} },\n  }`;
    out += `\n);\n\n`;
  }

  out += `export type ${Name}Variants = VariantProps<typeof ${fn}>;\n\n`;

  /* props + component */
  const own = `${Name}Variants & { className?: string }`;
  const args = axes.map((a) => a.prop);
  const call = args.length ? `${fn}({ ${args.join(", ")} })` : `${fn}()`;
  const destructure = [...args, "className"].join(", ");

  if (polymorphic) {
    out += tsdoc(
      `The props of \`<${Name} />\`. A union rather than one type, because the canonical HTML in ` +
        `components/${def.id}/spec.md renders this on <a> AND on <button>: pass \`href\` and it is a link, omit it ` +
        `and it is a button, and the element's own attributes follow the branch you chose.`,
      ""
    );
    out += `export type ${Name}Props =\n`;
    out += `  | (${own} & { href: string } & Omit<ComponentPropsWithRef<"a">, "className" | "href">)\n`;
    out += `  | (${own} & { href?: undefined } & Omit<ComponentPropsWithRef<"button">, "className">);\n\n`;
    out += tsdoc(`Renders the canonical pattern of components/${def.id}/spec.md. Styling only — behaviour is the consumer's.`, "");
    out += `export function ${Name}(props: ${Name}Props) {\n`;
    out += `  if (props.href !== undefined) {\n`;
    out += `    const { ${destructure}, ...rest } = props;\n`;
    out += `    return <a className={cx(${call}, className)} {...rest} />;\n`;
    out += `  }\n`;
    out += `  const { ${destructure}, ...rest } = props;\n`;
    out += `  return <button className={cx(${call}, className)} {...rest} />;\n`;
    out += `}\n`;
  } else {
    const el = els[0];
    out += `export type ${Name}Props = ${own} & Omit<ComponentPropsWithRef<"${el}">, "className">;\n\n`;
    out += tsdoc(`Renders the canonical pattern of components/${def.id}/spec.md: a <${el}>. Styling only — behaviour is the consumer's.`, "");
    out += `export function ${Name}({ ${destructure}, ...rest }: ${Name}Props) {\n`;
    out += `  return <${el} className={cx(${call}, className)} {...rest} />;\n`;
    out += `}\n`;
  }

  /* parts — a companion selector that is not a modifier of the root. Since R4 a
     part is a FULL rule: it may carry states, and it may be polymorphic on the
     same terms the root is, because `.source__link` is a <button> and an <a> in
     its own canonical HTML. It still has no variants and no sizes — a companion
     selector that needs an axis is a component with its own definition. */
  for (const part of def.parts ?? []) {
    const PartName = pascal(`${def.id}-${part.name}`);
    const partFn = camel(`${def.id}-${part.name}`);
    const partEls = elementsFor(part.selector, `part \`${part.name}\``);
    const partPoly = partEls.length > 1;
    const classes = [
      ...entriesOf(part.declarations, keyOf, `${where} → ${part.selector}`, tally),
      ...stateEntriesOf(part.states, keyOf, `${where} → ${part.selector}`, tally),
    ];
    out += `\n`;
    if (part.$doc) out += tsdoc(part.$doc, "");
    out += `export const ${partFn} = cva([\n${list(classes, "  ")}\n]);\n\n`;
    if (partPoly) {
      out += tsdoc(
        `The props of \`<${PartName} />\`. A union, because the canonical HTML in components/${def.id}/spec.md ` +
          `renders \`${part.selector}\` on <a> AND on <button>: pass \`href\` and it is a link, omit it and it is a button.`,
        ""
      );
      out += `export type ${PartName}Props =\n`;
      out += `  | ({ className?: string; href: string } & Omit<ComponentPropsWithRef<"a">, "className" | "href">)\n`;
      out += `  | ({ className?: string; href?: undefined } & Omit<ComponentPropsWithRef<"button">, "className">);\n\n`;
      out += tsdoc(`The \`${part.selector}\` half of the pattern in components/${def.id}/spec.md.`, "");
      out += `export function ${PartName}(props: ${PartName}Props) {\n`;
      out += `  if (props.href !== undefined) {\n`;
      out += `    const { className, ...rest } = props;\n`;
      out += `    return <a className={cx(${partFn}(), className)} {...rest} />;\n`;
      out += `  }\n`;
      out += `  const { className, ...rest } = props;\n`;
      out += `  return <button className={cx(${partFn}(), className)} {...rest} />;\n`;
      out += `}\n`;
    } else {
      const el = partEls[0];
      out += `export type ${PartName}Props = { className?: string } & Omit<ComponentPropsWithRef<"${el}">, "className">;\n\n`;
      out += tsdoc(`The \`${part.selector}\` half of the pattern in components/${def.id}/spec.md: a <${el}>.`, "");
      out += `export function ${PartName}({ className, ...rest }: ${PartName}Props) {\n`;
      out += `  return <${el} className={cx(${partFn}(), className)} {...rest} />;\n`;
      out += `}\n`;
    }
  }

  return { source: out, tally, elements: els, exports: exportsOf(def) };
}

/** Every name a component's file exports, in emission order. */
export function exportsOf(def) {
  const Name = pascal(def.id);
  const values = [camel(def.id), Name];
  const types = [`${Name}Props`, `${Name}Variants`];
  for (const part of def.parts ?? []) {
    const PartName = pascal(`${def.id}-${part.name}`);
    values.push(camel(`${def.id}-${part.name}`), PartName);
    types.push(`${PartName}Props`);
  }
  return { values, types };
}

/* ---------- the barrel ---------- */
export function renderIndex(defs) {
  let out = header(null, "dist/react/index.ts");
  for (const def of defs) {
    const { values, types } = exportsOf(def);
    out += `export { ${values.join(", ")} } from "./${def.id}";\n`;
    out += `export type { ${types.join(", ")} } from "./${def.id}";\n`;
  }
  return out;
}

/* ---------- the provenance banner ---------- */
function header(def, rel) {
  /* Never `components/*` + `/definition.json` for the barrel: that substring
     closes the comment this string is inside, and the file stops parsing. The
     generated artefact is the only place that would have shown it. */
  const source = def ? `components/${def.id}/definition.json` : "the pilot definitions, components/<id>/definition.json";
  return (
    `/* GENERATED by scripts/build.mjs from ${source} — do not edit.\n` +
    `   Edit the definition and run \`npm run build\`; \`build.mjs --check\` byte-compares this file,\n` +
    `   so a hand-edit fails the build rather than being silently overwritten.\n\n` +
    `   Published as @yordan/design-system/react${def ? `/${def.id}` : ""} (${rel}).\n` +
    (def
      ? `   The element comes from the canonical HTML in components/${def.id}/spec.md, which\n` +
        `   design-system/README.md calls THE pattern rather than an example.\n`
      : `   The barrel. Every name below is generated; nothing is re-exported by hand.\n`) +
    `\n` +
    `   STYLING IS DATA, BEHAVIOUR IS CODE. There is no state, no effect, no event handler and\n` +
    `   no ARIA here, and none is coming — those are the consumer's, written by hand. This file\n` +
    `   is a class map, a type and an element.\n\n` +
    `   REQUIRES, from the consumer: tailwindcss v4 with @yordan/design-system/tokens.css and\n` +
    `   tokens.tailwind.css imported and this directory named in an @source; the peer packages\n` +
    `   class-variance-authority and react; and a build that transpiles TSX out of node_modules\n` +
    `   (Next: \`transpilePackages: ["@yordan/design-system"]\`). This package declares no\n` +
    `   dependencies of its own and installs nothing. */\n`
  );
}
