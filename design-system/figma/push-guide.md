# Figma push — tokens → Figma Variables (MCP procedure)

One-way sync: **the repo is the source of truth; Figma is an output.** Never import from
Figma back into `tokens/tokens.json` by script — token changes happen in the repo first.

This procedure is written for an AI agent (Claude) to execute verbatim under the owner's
Figma session via the Figma MCP. It is idempotent: running it twice must not duplicate
anything — always update-by-name.

## Preconditions

1. The Figma MCP connector is **authorized** (claude.ai → connector settings). If tools named
   `use_figma` / `get_variable_defs` are unavailable or erroring with auth, stop and ask the
   owner to authorize — do not work around it.
2. `dist/tokens.flat.json` is fresh: run `npm run build` in `design-system/` first.
3. A target Figma file exists and is open/known. First run: create one named
   **"Blueprint Portfolio — Tokens"**; later runs reuse it (ask the owner for the file if unsure).

## Procedure

1. **Load the mandatory skill** before any `use_figma` call: invoke the `figma-use` skill
   (and `figma-create-new-file` first if a new file is needed).
2. Read `design-system/dist/tokens.flat.json`. Each entry:
   `"<category>.<name>": { cssVar, value, resolved?, description? }`.
3. Ensure these **variable collections** exist (create if missing, one mode "Value"):
   `color` · `font` · `space` · `border`.
   Map categories → collections: `color-stone`, `color-slate`, `color-ink`, `surface`,
   `primary`, `content`, `chrome`, `action`, `accent` → **color**; `font` → **font**;
   `space` → **space**; `border` → **border**.
4. For every token, create-or-update a variable named `<category>/<name>`
   (e.g. `surface/surface-page`, `color-stone/stone-500`) with:
   - **COLOR** for any value/`resolved` that parses as hex / rgb() / hsl(). Use the
     `resolved` value when present (aliases like `var(--stone-100)` resolve there).
     Convert to Figma RGBA floats (0–1). `accent-rgb` is a STRING (it's a triplet, not a colour).
   - **STRING** for everything else (font stacks, clamp() expressions, border shorthands).
     Push them verbatim — they document intent; Figma text styles are not in scope.
   - Set the variable description from `description` when present.
5. **Aliases:** where `value` is `var(--x)` and `--x` exists as a pushed variable, set a
   Figma variable **alias** to it instead of a raw value (keeps the semantic layer live in
   Figma). If aliasing fails for a given pair, fall back to the resolved value.
6. **Prune check (report, don't delete):** list variables in the collections that have no
   matching token and report them to the owner; deletion is a human decision.

## Verification

- `get_variable_defs` on the file → count matches `tokens.flat.json` entries (54 at time of
  writing) and spot-check: `surface/surface-page` aliases `color-stone/stone-100`;
  `accent/accent` is COLOR ≈ `hsl(225 100% 47%)`.
- Report a summary table: created / updated / aliased / skipped.

## Unit conversion table (for any future px-based tokens)

| CSS | Figma |
| --- | --- |
| hex / rgb() / hsl() | COLOR, RGBA floats 0–1 |
| `1rem` | FLOAT 16 (×16) |
| `200ms` | FLOAT 200 (strip unit) |
| clamp()/var() expressions | STRING verbatim (or alias, see step 5) |
