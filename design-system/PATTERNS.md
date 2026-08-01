# The pattern question, answered for R4

A design note, not a specification. It exists because R4's brief is "the whole of
`css/components.css` stops being authored", and that sentence has an answer that only shows
up once you measure the file rather than reason about it.

Written at the end of R3, when three of twenty-three components are definitions.

## The measurement

Every block in `css/components.css` was scanned for four features a definition cannot
express: an at-rule (`@media` / `@supports` / `@keyframes`), a combinator (`>` `+` `~`), a
positional or relational pseudo-class (`:has()` `:nth-*` `:not()` `:first-*` `:last-*`), a
descendant selector, a locally-defined custom property, and computed geometry
(`calc()` / `round()` / `max()` / `min()`).

**Five of twenty-four blocks have none of them. Nineteen have at least one.**

```
GENERATABLE-SHAPED (5)              HAS A PATTERN FEATURE (19)
  button        5 selectors  ✓ generated    card    46 sel   at-rule, combinator, computed, descendant, positional
  chip          3 selectors  ✓ generated    chat    45 sel   at-rule, computed, descendant, positional
  stat          1 selector   ✓ generated    nav     28 sel   at-rule, computed, descendant
  footer        1 selector   ✓ generated    row     26 sel   at-rule, computed, descendant, positional
  source        8 selectors  ✓ generated    drawer  25 sel   at-rule, combinator, computed, descendant, positional
                                      skeleton 18 sel  at-rule, combinator, computed, descendant, local-prop
                                      menu    16 sel   at-rule, combinator, computed, descendant, positional
                                      entry   13 sel   ✓ generated (at, positions, scoped parts)
                                      none    14 sel   at-rule
                                      … and ten more
```

The pilot chose the three simplest blocks in the file. That was the right call for a pilot
and it is a misleading sample: **the definition format covers 9 of roughly 340 selectors.**
Deciding R4 from the pilot's experience alone would be deciding from 3% of the evidence.

## The three options, and why two of them fail

**Loosen the schema.** To hold `skeleton` a definition would need combinators
(`.band > .rail--l { grid-column: 1 }`), at-rules (`@supports (grid-template-columns:
round(down, 10%, 3px))`), locally-defined custom properties (`--rail-track`, which
`evals/generation.mjs` already documents as deliberately *not* a token), and computed
geometry (`max(var(--space-6), round(down, calc(100% / 12 + 0.02px), var(--space-6)))`).
Admit all four and the schema constrains nothing: the definition becomes a JSON transcription
of CSS with the same expressive power, worse ergonomics and an emitter that is a CSS printer.
The pilot's value came from the schema being **narrow enough that the data says something** —
this property binds this token, this is a variant, this is a state. A schema that can say
anything says nothing.

**A second "pattern" kind with freer selectors.** Same failure, one level down: "freer
selectors" is the thin end of the same wedge, and by the time it holds the four features
above it *is* the loosened schema wearing a different key.

**The decisive evidence is the prose, and it is not a style preference.** `skeleton`'s banner
is forty lines of measured argument — six regions starting their cells at 0 / 14.53 / 22.33 /
17.48 / 12.31 / 20.11px past a line before the lattice got one origin; four band widths
resolving to 96 / 72 / 48 / 24px instead of 120 / 96 / 72 / 48 without the 0.02px epsilon; a
`cqi` term measuring 106.656px because a container is a container for its descendants. That
prose is attached to a **declaration**, not to a component. The definition format's `note` is
per-declaration-group and would fragment it into six comments that each explain a third of an
argument; moving it to `spec.md` would separate the argument from the value it justifies,
which is the failure this repo names in its own words — *"the prose is most confident exactly
where the value was least chosen."*

## The answer: two region kinds, and a census that admits no third

`css/components.css` becomes an assembly of exactly two kinds of region, and **the line
between them is a property of the CSS, not a judgement about the component**:

> A block is **generated** when its appearance is a set of declarations on ONE element, plus
> modifiers and states of that element.
>
> A block is **authored** when its behaviour is *relational* — it needs a combinator, an
> at-rule, a locally-defined custom property, or computed geometry.

That is a mechanical test. R4 does not have to argue about `card`; it runs the scan.

The governance that makes "the whole file stops being authored" true in the sense that
matters:

1. Every generated block is bracketed as it is today —
   `/* ---- generated:<id> … ---- */` — and byte-compared against a fresh render.
2. Every authored block gains a marker of its own,
   `/* ---- authored:<id> — <reason> ---- */`, where `<reason>` comes from a **closed
   vocabulary**. A reason outside the list fails the build.

   **Landed, and the vocabulary is not the one proposed here** — two of the four names were
   the same misreading of the scan this note has now made three times:

   | proposed | landed | why |
   | --- | --- | --- |
   | `relational-selectors` | `relational-selectors` | unchanged |
   | `local-custom-property` | `local-custom-property` | unchanged, and it is the only one of the four that has not moved at all |
   | `at-rule` | **`unnamed-condition`** | an `@media` whose query is a *name* in `$conditions` generates — `fact`, `entry` and `section-head` prove it. What disqualifies is a condition this system cannot name: `@keyframes`, `@supports`, `(hover: hover) and (pointer: fine)`, or a breakpoint nobody has named yet. |
   | `computed-geometry` | **gone** | `expr` closed it. `calc({space-3} - 2px)` keeps every binding visible to the census, so the arithmetic was never the problem — an unreadable `var()` inside a string was. |
   | — | **`foreign-selector`** | added by `menu`'s `body:has(.menu[data-open])`: a rule whose subject the component does not own. No closure of the scoped-part vocabulary reaches it, because `within` names a rule the definition declares and `body` never will be. |

   The check asserts the feature is **present**, not that it is disqualifying. Proving the
   second would mean re-implementing the schema inside the census, and then the census would
   agree with the emitter by construction — the trap `dist/components.json` is deliberately
   kept out of. Presence is enough for the property that matters: a reason cannot quietly
   become false.

   **A consequence worth stating, because it changed a tool.** A freshly scaffolded block has
   one class and one declaration, so it has *no* reason available to it — which makes
   `generated` the only honest default for a new component. `scripts/new-component.mjs` now
   writes the quartet, and the census is why it had to.
3. `build.mjs` asserts that **every block in the file is exactly one of the two**, and that
   an authored block's declared reason is one the scan actually finds in it. An authored
   block whose reason has stopped being true is a block that should now be generated, and the
   build says so.

The invariant the owner wants is *nothing drifts silently*. That is delivered by the census —
no block unaccounted for, no reason unverified — and **not** by forcing nineteen blocks
through a schema that would have to become CSS to hold them. A gate that says "these five are
generated, these nineteen are authored and here is why each one is" is a stronger statement
than a schema that can express everything and therefore constrains nothing.

## What R4 should expect

- **Five components are generatable today**: `button`, `chip`, `stat` (done), plus `footer`
  and `source`. That is the whole of the low-hanging fruit; there is no sixth.
- **Several of the nineteen are *nearly* generatable**, and are worth a second look before
  being written off — `link-grid` (3 selectors, descendant only) and `case-body` (8, descendant
  + positional) fail on one feature each. Splitting a block into a generated core and a small
  authored region is a legitimate third shape, and the marker scheme above already supports it.

  **Both generate whole, and the split was not needed.** R4 took them first, and the reason
  the third shape was not required is the one thing this note measured but did not weigh:
  *descendant* and *positional* are not one feature each with nineteen faces. Each block needs
  exactly one relation, and both relations are closeable at both ends. A scoped part names the
  ancestor — a selector the same definition already declares, so the set of referents is
  finite and written down — and an array of bare tag names, so the emitter supplies the
  combinator and `.case-body p strong` is sayable while `.band > .rail--l` is not. A position
  is an enum with one member per block that has asked, so `:first-child` is sayable and
  `:nth-last-child(-n+3)` is not a value the key accepts.
  The wedge this note refuses is a schema that admits a *selector*; admitting a **relation
  whose vocabulary is finite** is a different thing, and it is checkable in a way a selector
  string never is. Whether that holds for the remaining seventeen is decided one block at a
  time, with the block in front of you — which is the method this note argued for.

  **The third shape landed, and `ask-fab` is what needed it.** Every rule in that block
  transcribes except its last two — `@media (prefers-reduced-motion: reduce)` and
  `@media print` — and both are conditions this system will not name, because `$conditions`
  holds *viewports* named for the number each carries and neither of those has a number. So
  the block is a definition with a two-rule tail. One sentence of this note needed correcting
  to build it: *"the marker scheme above already supports it"* is true of the **marker** and
  was not true of the **census**, which read one marker per banner and would have counted a
  remainder as nothing at all. A split block is now: one banner, a region that opens above it
  and closes inside it, and a remainder carrying its own `authored:` marker whose reason is
  scanned **for the remainder alone**. That last clause is the whole of why it is not a
  loophole — a reason satisfied by the generated half would be a reason that says nothing.

### `at-rule` was the wrong half of the mechanical test, and `entry` and `fact` are why

The test above puts a block in the authored column if it needs an at-rule. Both of those
blocks do, and both generate — so the line needed one more cut, and it is the same cut the
paragraph above makes.

The reason `@media` looked disqualifying is that a media query can hold *anything*: admit an
`at-rule` key whose value is a CSS condition string and the schema has admitted arbitrary CSS
one level down, wearing a bracket. What R4 admitted instead is a **named** condition —
`{"condition": "below-720"}`, resolved in `tokens.json`'s `$conditions`, with an unknown name
failing the build — wrapping overrides that each **name a rule the definition already
declares** rather than writing a selector. Both halves are references into finite sets, and
neither is a string a definition can invent. `@supports (grid-template-columns: round(down,
10%, 3px))` is still unsayable, and would still have to be, because its condition is a
computed value rather than a viewport this system has named.

That is worth stating plainly because it moves a number: **the scan is the right instrument
and `at-rule` was the wrong reading of it.** The question is never "does this block have a
feature" but "does the feature have a finite vocabulary here". `skeleton`'s `@supports` does
not. `fact`'s `@media` does — and the proof it does is that `entry` writes the same query for
the same reason, which is the drift the construct closes rather than a coincidence it exploits.
### `computed` was the next wrong reading, and `section-head` is why

Same instrument, same misreading, one column over. The scan puts a block in the authored
column if it needs computed geometry, and `section-head` needs
`calc(var(--space-3) - 2px)` — so by the letter of the test it stays authored, and it
generates.

The reason is the reason above, said about a value instead of a condition. What makes a
`calc()` dangerous to admit is not the arithmetic, it is that `var(--x)` inside a string is a
binding **no gate can see**: the literal guard reads terms, the token census counts bindings,
and both walk straight past a colour or a step hidden in a function call. So the form that
landed does not admit a CSS string. `{"expr": "calc({space-3} - 2px)"}` interpolates a
**name**, resolved by the emitter, checked against `tokens.json` exactly as `{"token": …}` is
— and a literal `var(` inside one is refused, because that is the very thing the key exists to
prevent. Both halves are references into finite sets again, and the `2px` that remains is a
border width, which is structure and has no tier to come from.

It is also worth saying what did *not* widen. An `expr` is a **value**, and a value cannot
change what a rule applies to. Every argument in this note is about selectors — `.band >
.rail--l`, a freer prelude, a condition that could hold anything — and none of them is reachable
from a key that produces the right-hand side of a declaration. `@supports (grid-template-columns:
round(down, 10%, 3px))` is still unsayable, and still has to be: its condition is a computed
value rather than a viewport this system has named, which is the at-rule paragraph's line, not
this one's.

**Three of the four features are now the same finding.** `at-rule`, `descendant`/`positional`
and `computed` each looked disqualifying and each turned out to have a finite vocabulary in the
blocks that have asked. The one that has not moved is `local-custom-property` — `--rail-track`
is a name a block invents for itself, and nothing outside that block can check it, name it or
count it. If the mechanical test is going to keep one column, that is the entry it keeps.

### The fourth finding is not a feature at all — it is ORDER, and `media` and `profile` are why

This note scans blocks for *features*, and every finding above is about one. The next block to
fail was rejected by nothing in the scan: `media` has a `:has()` and `profile` has a `>`, both
squarely inside the closures the sections above argued for, and neither could be written down.

The obstruction was the **emitter's fixed cascade** — base, then variants, then sizes, then
parts, then the `@media` blocks at the foot — which was a reasonable reading of a stylesheet
that groups its rules by kind. These two do not. They group by **topic**:

```css
.ph { … }  .ph--tall { … }  .ph__label { … }
.ph:has(img) { … }              /* four rules after .ph, with a part in between */
.ph:has(img) .ph__label { … }   /* a part scoped to a STATE, which owns no selector to quote */

.profile > div { … }   … three parts …
.profile > div:nth-child(odd) { … }   /* at the foot, beside the query that undoes it */
```

Under a fixed cascade the first is `.ph:has(img)` emitted directly after `.ph`, and the second
is `:nth-child(odd)` emitted directly after `.profile > div`. Both are *different bytes*, and
this migration's whole claim is that a block joins by transcription.

**The decisive point is which of the two the fix belongs to.** A `detach` flag on a rule would
have kept the sections and moved the line, and it would have been an **emitter hint** — a key
whose meaning is "render me elsewhere" rather than a statement about the component. This
format has refused that once already, from the other side: `break` records a blank line
*because the paragraph is a statement*, not because the emitter needed telling. So the sections
became one ordered list, `rules`, and the entry's position IS the stylesheet's order. Source
order is the cascade in CSS; recording it records a fact.

It pays for itself twice over, which is the sign it was structural rather than local. The
`within` of a scoped part became a **name** instead of a quoted selector, and that is the only
form in which `.ph:has(img) .ph__label`, `.drawer[data-open] .drawer__sheet` and
`.ask-fab[data-collapsed] .ask-fab__label` are sayable at all — their ancestor is a state,
which has no selector of its own for an author to quote. And the two shapes that wore the word
`at` collapsed into one: what distinguished them was *where* the query sat, and where is now
where the entry sits.

**So the mechanical test keeps its four columns and gains a caveat.** A feature with a finite
vocabulary is expressible; a feature with a finite vocabulary *in an order the emitter chose
for it* is not. The scan cannot see the second, and the only way to find it is the method this
note has argued for throughout — one block at a time, with the block in front of you.

### The fifth finding is about the UNIT, and `row` is why

Every measurement in this note counts **blocks**, and the two columns of the table above are a
verdict on a block. The format's unit is a **component** — one `definition.json`, one `spec.md`,
one story, one `.tsx`, one entry in `dist/components.json` — and for twenty-two of the
twenty-three those two units were the same thing, so the difference cost nothing and was
invisible.

`row` was the one that was not. It owned **two banners**: `.idx__row`, a clickable index entry,
and `.tools__row`, a term-and-definition pair. They shared an id because both are full-width
list rows and for no other reason — no rule in either mentions the other, they share no class,
no token decision and no markup. The scan duly reported one row of the table (`row  26 sel
at-rule, computed, descendant, positional`) and that row was **the union of two blocks'
features**, which is a measurement of nothing: the union fails whenever *either* half fails,
and here exactly one half did. `.idx li:last-child .idx__row` puts a positional in the MIDDLE
of a descendant path — not a scoped part, whose ancestor names a rule and whose target is bare
tags, and not a position, which applies to the rule it hangs off. It is the wedge, and the
definition half was waiting behind it for nothing.

So the component split, which is a **MAJOR** change (`row` is a published id, and it is gone),
and the two halves went to the two columns the scan should have put them in: `definition-row`
generates whole, `project-row` stays authored under `relational-selectors` with the sentence
above as its reason. Nothing about how either LOOKS moved — the CSS is byte-identical apart
from the two banners' own names.

**The lesson is not "split components".** It is that a table with one row per block answers
"can this block be data" and the migration asks "can this component be data", and those are
the same question only while the two are the same thing. Two of the twenty-four blocks are
`@component none` and belong to no component at all, which is the same seam from the other
side. Before writing a block off, check what it is a block *of*.

- **`typography` fails on `computed` alone** (its `clamp()` values), which is a token
  question rather than a pattern one: those are `--text-*` steps and the block mostly maps a
  class to a step. It may be the best argument for a fourth value form (a token binding with
  a computed modifier) — decide it with the block in front of you, not now.
- **Do not start with `skeleton`.** It is the block with the most load-bearing prose, the most
  measured constants and the only `local-prop` besides `terminator`. If the scheme above is
  going to be wrong, it will be wrong there, and finding that out on block nineteen is
  cheaper than on block one.

## The border-token question, deferred here on purpose

R1 reported that two idioms for a border coexist. R3 measured them across the whole file:

| value | uses |
| --- | --- |
| `var(--rule)` | 22 |
| `0` | 16 |
| `var(--rule-strong)` | 6 |
| `1px solid var(--chrome-border-strong)` | **5** |
| `3px solid var(--primary)` | 1 |
| `2px solid var(--chrome-border-strong)` | 1 |
| `1px solid var(--content-primary)` | 1 |
| `1px dashed var(--chrome-border-strong)` | 1 |

`--rule-ink` — the token R1 floated for button's border — would have **one** consumer, and
this system retired `action` for exactly that ("a semantic tier earns its keep by being
consumed"). Minting it would be a regression against a stated rule.

`--rule-chrome-strong` would have five, which is a real candidate — but **four of the five are
in components whose definitions do not exist yet**. Minting it now means hand-editing four
authored blocks that R4 will transcribe anyway, and choosing the name against 3 of 23
components' idioms instead of all of them. A rename later is MAJOR.

So the line R4 executes against, and the reason it is a line rather than a preference:

> A `--rule-*` token exists to carry a **judgement**. A composed border array exists to record
> a **structure**.

`--rule-strong` earns its name because it re-aliases in dark — inverted literally it would be
a 2px near-white bar across every section — and in print. Neither `1px solid
var(--content-primary)` nor `1px solid var(--chrome-border-strong)` carries any judgement:
both invert correctly through their colour alias, with nothing to decide. And the legibility
half of R1's finding is **already solved** by the definition format, which was the actual
complaint: `["1px", "solid", {"token": "chrome-border-strong"}]` records which part is
structure and which is a token, and that was the fact no CSS parser could recover.

Revisit when R4 has all twenty-three border idioms in definitions. If the count for one shape
is still five or more *and* it turns out to want a mode value, mint it then — as one additive
change, with every consumer rebound in the same commit.
