#!/usr/bin/env node
/* ============================================================
   A JSON Schema validator, in the subset this repo actually writes.
   Zero dependencies, like everything else here.

   WHY NOT ajv. The generators in this repo take no dependencies, and that is
   not frugality — it is what makes `npm run check` runnable offline with no
   install step, which is the property every gate story rests on. A validator
   for the keywords one schema uses is ~150 lines; a validator for all of JSON
   Schema is a package, a lockfile entry and a supply chain.

   THE SUBSET, and it is a closed list rather than a best effort:

     type · const · enum · pattern · properties · required ·
     additionalProperties · propertyNames · minProperties ·
     items · minItems · uniqueItems · oneOf · anyOf · $ref (local)

   A KEYWORD THIS FILE DOES NOT KNOW IS AN ERROR, NOT A NO-OP. That is the
   whole difference between a small validator and a broken one. If a schema
   grows `allOf` or `if/then`, `validate` throws naming the keyword rather
   than silently ignoring it and reporting the instance valid — which is the
   failure mode that lets a schema quietly stop constraining anything, and
   the one this repo has been bitten by before (check-css.mjs's retired rule
   6 could stop finding its subject and still report success).

   `$doc` is this repo's own annotation key and is ignored on purpose, as are
   the standard annotations `$schema`, `$id`, `title` and `description`.
   ============================================================ */

/** Keywords that constrain. Anything else in a schema object must be here or known-ignored. */
const ASSERTIONS = new Set([
  "type", "const", "enum", "pattern", "properties", "required", "additionalProperties",
  "propertyNames", "minProperties", "items", "minItems", "uniqueItems", "oneOf", "anyOf", "$ref",
]);
/** Annotations: present for a reader, meaningless to a checker. */
const ANNOTATIONS = new Set(["$schema", "$id", "$defs", "title", "description", "$doc", "$comment", "examples", "default"]);

const typeOf = (v) =>
  v === null ? "null" : Array.isArray(v) ? "array" : typeof v === "number" ? (Number.isInteger(v) ? "integer" : "number") : typeof v;

const show = (v) => {
  const s = JSON.stringify(v);
  return s === undefined ? String(v) : s.length > 60 ? `${s.slice(0, 57)}…` : s;
};

/**
 * @param {object} schema  the root schema (also the $ref resolution base)
 * @param {unknown} instance
 * @param {string} [rootPath] what to call the instance in messages
 * @returns {{path: string, keyword: string, message: string}[]}
 */
export function validate(schema, instance, rootPath = "") {
  const errors = [];

  const resolve = (ref) => {
    if (!ref.startsWith("#/")) throw new Error(`validate-json.mjs resolves only local "#/…" references, got ${JSON.stringify(ref)}`);
    let node = schema;
    for (const raw of ref.slice(2).split("/")) {
      const seg = raw.replace(/~1/g, "/").replace(/~0/g, "~");
      node = node?.[seg];
      if (node === undefined) throw new Error(`the schema has no ${ref}`);
    }
    return node;
  };

  /** @returns {number} how many errors this subtree produced. */
  function check(node, value, path) {
    const before = errors.length;
    const fail = (keyword, message) => errors.push({ path: path || "(root)", keyword, message });

    if (typeof node !== "object" || node === null) throw new Error(`the schema at ${path || "(root)"} is not an object`);

    for (const keyword of Object.keys(node)) {
      if (!ASSERTIONS.has(keyword) && !ANNOTATIONS.has(keyword)) {
        throw new Error(
          `the schema at ${path || "(root)"} uses the keyword \`${keyword}\`, which scripts/validate-json.mjs does not ` +
            `implement. Add it there — a validator that ignores a keyword reports every instance valid against it.`
        );
      }
    }

    if (node.$ref !== undefined) {
      /* A $ref sits BESIDE its siblings in 2020-12, so both apply. */
      check(resolve(node.$ref), value, path);
    }

    if (node.type !== undefined) {
      const want = Array.isArray(node.type) ? node.type : [node.type];
      const got = typeOf(value);
      const ok = want.some((t) => t === got || (t === "number" && got === "integer"));
      if (!ok) {
        fail("type", `expected ${want.join(" or ")}, got ${got} (${show(value)})`);
        return errors.length - before; /* every other keyword would be noise */
      }
    }

    if (node.const !== undefined && JSON.stringify(value) !== JSON.stringify(node.const)) {
      fail("const", `must be ${show(node.const)}, got ${show(value)}`);
    }
    if (node.enum !== undefined && !node.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
      fail("enum", `must be one of ${node.enum.map(show).join(", ")}, got ${show(value)}`);
    }
    if (node.pattern !== undefined && typeof value === "string" && !new RegExp(node.pattern, "u").test(value)) {
      fail("pattern", `${show(value)} does not match /${node.pattern}/`);
    }

    if (typeOf(value) === "object") {
      for (const key of node.required ?? []) {
        if (!(key in value)) fail("required", `is missing the required property \`${key}\``);
      }
      if (node.minProperties !== undefined && Object.keys(value).length < node.minProperties) {
        fail("minProperties", `needs at least ${node.minProperties} propert${node.minProperties === 1 ? "y" : "ies"}, has ${Object.keys(value).length}`);
      }
      for (const [key, child] of Object.entries(value)) {
        const at = path ? `${path}.${key}` : key;
        if (node.propertyNames !== undefined) check(node.propertyNames, key, `${at} (name)`);
        if (node.properties?.[key] !== undefined) { check(node.properties[key], child, at); continue; }
        if (node.additionalProperties === false) {
          fail("additionalProperties", `has an unknown property \`${key}\``);
          continue;
        }
        if (typeof node.additionalProperties === "object") check(node.additionalProperties, child, at);
      }
    }

    if (typeOf(value) === "array") {
      if (node.minItems !== undefined && value.length < node.minItems) {
        fail("minItems", `needs at least ${node.minItems} item${node.minItems === 1 ? "" : "s"}, has ${value.length}`);
      }
      if (node.uniqueItems === true) {
        const seen = new Set();
        for (const item of value) {
          const k = JSON.stringify(item);
          if (seen.has(k)) fail("uniqueItems", `repeats ${show(item)}`);
          seen.add(k);
        }
      }
      if (node.items !== undefined) value.forEach((item, i) => check(node.items, item, `${path}[${i}]`));
    }

    /* oneOf / anyOf report the BRANCH COUNT, never the branches' own errors.
       "expected string, got object" from each of three alternatives is three
       true statements and no information; "matched 0 of 3 forms" plus the
       schema's own $doc is what tells you which form you meant. */
    for (const keyword of ["oneOf", "anyOf"]) {
      if (node[keyword] === undefined) continue;
      const matched = node[keyword].filter((sub) => {
        const mark = errors.length;
        const bad = check(sub, value, path);
        errors.length = mark; /* a branch's errors are not the instance's */
        return bad === 0;
      }).length;
      const want = keyword === "oneOf" ? matched === 1 : matched >= 1;
      if (!want) {
        fail(
          keyword,
          keyword === "oneOf" && matched > 1
            ? `matches ${matched} of the ${node[keyword].length} mutually exclusive forms, and must match exactly one`
            : `matches none of the ${node[keyword].length} permitted forms — got ${show(value)}`
        );
      }
    }

    return errors.length - before;
  }

  check(schema, instance, rootPath);
  return errors;
}

/** One line per error, in the shape the rest of this build's failures use. */
export const formatErrors = (errors, where) =>
  errors.map((e) => `${where} at \`${e.path}\`: ${e.message} (${e.keyword})`);
