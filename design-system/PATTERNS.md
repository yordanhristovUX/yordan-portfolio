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
   | — | **`foreign-scope`** | added by `theme-toggle`'s `.menu__body .theme`, and it is the MIRROR of the entry above: the subject is the component's own class and the ANCESTOR is somebody else's. It is a separate reason because the scoped-part closure runs one way round — `within` names a rule this definition declares, and the *target* may be foreign (`.drawer .chat`, `.sec--tint .well`) — so a foreign ancestor is not a missing key, it is the closure. A key that could name one would make every `.a .b` sayable. |

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

### The sixth finding is that most of what was left is not CSS at all — it is TEXT, and `nav` is why

Five findings in, the instrument had been corrected five times and always in the same
direction: a feature looked disqualifying, and its vocabulary turned out to be finite. `nav` is
the largest block in the file — 28 selectors, 334 lines, more prose than declarations — and it
failed on **seven** things, of which exactly one is a fact about CSS.

The one: three rules that exist only inside a media query. `.bar__action[data-ask]`,
`.bar .theme` and `.bar__action-label` each have a rule under a condition and no unconditional
counterpart, and an `at` block could only hold *overrides* — an entry naming a rule declared
outside it. There was nothing for them to name. The answer is the ordinary rule vocabulary
nested one level, tagged by `kind`, so a query holds a state or a scoped part exactly as the
top level does and **nothing is sayable inside a query that is not sayable outside one**. That
is the same closure every construct in this note has landed with.

The other six are the emitter and the file disagreeing about **where the newlines go**. A value
written across three lines (`.bar`'s two shadows). A selector list written across two. Two
comments above one rule. A blank line *inside* a rule. A comment above an override. A comment
above a state. Every one of them renders identically as CSS and differently as bytes, and this
migration's whole claim is byte-identity — so each is a key, each is `const true` or an array
of arrays, and each is refused where there is nothing to record.

**That is worth naming as a finding rather than as seven details, because it changes what the
remaining blocks are likely to cost.** The scan in this note measures *features*, and the
fourth finding already showed it cannot see ORDER. It cannot see line breaks either, and by the
time a block is 334 lines with forty-line banners in it, the prose is most of the file — so the
distance between "expressible" and "transcribable" stops being about selectors and becomes
about typography. A reasonable prediction from `button` was that a big block would need a
freer *grammar*. What it needed was a way to say where the author pressed Return.

The line that keeps this from being a licence: **a formatting key may only RECORD, never
CHOOSE.** `wrap` is refused on a value with no comma to break at and on a state with one
suffix; a group `break` is a blank line and not an indent; `note` as an array of arrays is two
comments and not a layout. Nothing here names a width, a column or a position, and there is no
combination of them that reflows a declaration the stylesheet does not already write reflowed.
That is the same test the relational constructs pass — closed at both ends — asked about text.

**And `@keyframes` came off the disqualifying list, which moves a number back.** This note used
it three times as the archetype of "a condition this system cannot name", and that was the
wrong at-rule to make the point with: a `@media` needs a condition and a `@keyframes` has none.
It has a name and a set of offsets, both finite. `@supports (grid-template-columns: round(down,
10%, 3px))` is still the archetype, and still unsayable, because its condition really is a
computed value. What `@keyframes` cost instead was a **second published file** — a class
attribute holds declarations, so pipeline 2 carries it as `dist/keyframes.css` rather than as a
class, which is the first time the two pipelines have needed different *shapes* of artefact for
one construct rather than different renderings of one.

### The seventh finding is that a block's holes are not at its end, and `menu` is why

The third shape — a generated core plus an authored remainder — landed with `ask-fab`, and the
sentence that describes it has a hidden assumption in it: *"a remainder that is everything
after the close marker."* That is true of `ask-fab` because its two unnameable rules happen to
be its last two, and it was read as the general case for one release.

`menu` has three unnameable rules and not one of them is at the end. `body:has(.menu[data-open])`
is the seventh rule of twenty; `.menu__nav a + a` is the second-to-last; the foot query is the
last. Under a prefix-only split, `menu` generates 33 of its 127 lines and the other 94 are
accounted for as one authored lump whose declared reason is satisfied by whichever of the three
features the scan happens to find first. **That is the census measuring the wrong thing** — the
same failure the note describes for a reason satisfied by the generated half.

So a definition may declare a **gap**, and the important thing about it is what it does not
carry. It has no key that holds CSS. `{"kind": "authored", "reason": "foreign-selector"}` says
*a rule exists here and this is why it is not expressible*, and says nothing about what the rule
is — the lines stay in the stylesheet, untouched by the emitter and by the splice. A gap that
could carry the rule would be the wedge this note refuses, wearing a census marker.

It pays for itself by making the census **two-sided**. Until now a split block was checked by
reading its markers; a definition had no opinion about how many holes it had, so a hole that
grew a second rule was invisible and a definition that stopped needing one was invisible too.
The reasons a definition declares must now equal the markers the block carries, in order, and
the build names both sides when they disagree. `ask-fab` adopted the form in the same commit
without moving a byte, which is the sign the shape was the general one all along.

### The eighth finding is that a LIST is a different claim from a relation, and `card` is why

`card` is the last block of R4 and the biggest hole in the format was one rule:

```css
.card--reveal .card__media,
.card--reveal .card__note { position: absolute; width: 1px; … }
```

Two selectors, one set of declarations, and nothing in the vocabulary reached it. It is not a
state's list `suffix` — those share a subject and differ only in a pseudo-class, and these
differ in the *element*. It is not `aliases`, which resolves to two rules and therefore
different bytes. And it could not be a **gap** either, which is the interesting part: the closed
census vocabulary has no reason that is *true* of that fragment. `relational-selectors` finds no
combinator and no positional; `foreign-selector` needs a bare-tag subject; `foreign-scope` needs
two BEM families and both ends are `card`; there is no at-rule and no local property. A gap with
no findable reason would have been the census's first lie.

So a scoped part's `class` may be an **array**, with `within` distributed over each member. The
widening is exactly the one `element` already is, one axis over — and the closure it needed is
the finding:

> The SINGLE `class` form deliberately admits a **foreign** class. The ARRAY form deliberately
> does not.

That looks inconsistent and is the opposite. A single target says *this ancestor does this to
that descendant* — one relation, whose ancestor half is always the definition's own, which is
what makes `.sec--tint .well` and `.drawer .chat` honest. A list says *these two selectors carry
the same declarations*, and that is a claim about both ends, checkable only when both ends are
declared in the file making it. Admit one foreign member and `.a .x, .a .y` is sayable for any
`x` and `y` — a selector list with arbitrary members, which is this note's wedge wearing a
comma. The guard is in the loader, it names the wedge when it fires, and it is mutation-tested:
a foreign class, a class that merely *resembles* the root (`.cardigan`), and a part scoped
*within* a list all fail.

**The other half of `card` is the census measuring the right thing, at last, on the block that
needed it most.** Seven gaps, the most in the file, and every one of them is a relation rather
than an appearance: three positional pairs that compute the grid's hairlines from where a card
sits (`:nth-child(3n)`, `:nth-last-child(-n+3):nth-child(3n+1) ~ .card`, and the whole two-column
restatement at 960px), `body:has()`, and three at-rules whose conditions this system will not
name. The dividers are the block's entire idea — nine cells whose rules never trail into empty
space — and they stay authored. That is not the format falling short of a key; it is the line
this note drew in its first paragraph, holding on the twentieth block.

One gap in it is worth reading twice. The 960px query **could** have been named in
`$conditions`, and naming it would have bought nothing: the fragment is unreachable for its
*selectors*, so it would still be a gap, and its declared reason would then read
`unnamed-condition` — true of the at-rule and false of what actually stops it. A reason is
load-bearing prose. The gate can only check that the feature is present; choosing which present
feature to name is the author's, and choosing the wrong one is how a census starts lying while
staying green.

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

## R4 COMPLETE — the closing record

This note opened by measuring the file and predicting **five** generatable blocks of
twenty-four. It ends with **twenty** definitions over twenty-six blocks, and the four times the
prediction was wrong are the six findings above: every feature the scan called disqualifying
turned out to have a finite vocabulary *in the blocks that asked*, except one.

### The census, block by block, as it ships at 2.6.0

`node design-system/scripts/build.mjs --check` prints the totals; this is the same statement
with the names in it, so a reader can check the claim rather than trust the number.

**GENERATED WHOLE — 17 blocks**

`typography`¹ · `nav` · `section-head` · `button` · `chip` · `entry` · `definition-row` ·
`profile` · `fact` · `media` · `stat` · `link-grid` · `footer` · `case-body` · `chat` ·
`drawer` · `source`

¹ generated from `tokens/typography.json` rather than from a component definition — it is a
layer of utility classes, not a component. See the README for why that distinction is kept.

**SPLIT — 4 blocks, 15 generated regions and 14 gaps between them**

| block | regions | gaps, in order, with the reason the scan finds in each |
| --- | --- | --- |
| `card` | 8 | `relational-selectors` (`:nth-child(3n)`), `relational-selectors` (the orphan-row pair), `unnamed-condition` (`(hover: hover) and (pointer: fine)`), `foreign-selector` (`body:has()`), `unnamed-condition` (reduced motion + print), `unnamed-condition` (reduced motion), `relational-selectors` (the two-column step at 960px) |
| `menu` | 3 | `foreign-selector` (`body:has()`), `relational-selectors` (`a + a`), `unnamed-condition` (reduced motion + print) |
| `theme-toggle` | 3 | `foreign-scope` (`.menu__body .theme`), `unnamed-condition`, `unnamed-condition` |
| `ask-fab` | 1 | `unnamed-condition` (reduced motion + print) |

**AUTHORED WHOLE — 5 blocks, and each one is a *kind* of thing rather than a leftover**

| block | reason | what the scan finds, and why it is not going to move |
| --- | --- | --- |
| Foundation (`@component none`) | `foreign-selector` | it styles `body`, `*` and the focus ring. There is no component here to be a definition of — that is what `@component none` says. |
| `skeleton` | `local-custom-property` | `--rail-track`, a name the block invents for itself, inside a `@supports (grid-template-columns: round(down, 10%, 3px))`. **The one feature that never moved**, exactly as this note predicted on page one, and the one block it said not to start with. |
| `terminator` | `local-custom-property` | the same, for the same reason. |
| `project-row` | `relational-selectors` | `.idx li:last-child .idx__row` — a positional in the MIDDLE of a descendant path. It is the half of the old `row` component that the split put in this column, and the sentence describing it is the fifth finding above. |
| Reduced motion (`@component none`) | `unnamed-condition` | one `@media (prefers-reduced-motion: reduce)` block that speaks for the whole document. Again: no component, so no definition. |

**Totals: 26 blocks — 17 generated, 4 split, 5 authored. 19 census markers: 8
`unnamed-condition`, 5 `relational-selectors`, 3 `foreign-selector`, 2 `local-custom-property`,
1 `foreign-scope`.** Contract at 2.6.0: 103 tokens, 24 components, **239 definition rules**, 29
export subpaths, 20 generated React components.

### "No block unaccounted for" is now checkable end to end

That sentence was the invariant this note asked for, and it was a claim until R4 built the three
things that make it a gate. All three run on every `--check`, offline:

1. **Every block is exactly one of three kinds.** A block that is neither inside a
   `generated:<id>` region nor carrying an `authored:<id> — <reason>` marker fails by name.
2. **Every declared reason is *found* in the fragment it is declared over** — the block for an
   authored block, the fragment ALONE for each gap of a split one. The check asserts the feature
   is present, never that it is disqualifying: proving the second would mean re-implementing the
   schema inside the census, and then the census would agree with the emitter by construction.
3. **The census is two-sided.** The sequence of `kind: "authored"` gaps a definition declares
   must equal the sequence of markers its block carries, in order. A gap that quietly grows a
   second rule, or a definition that stops believing in one, fails naming both sides.

And underneath all three: every generated region is re-rendered **in memory** and byte-compared
before anything is written, so the migration's whole claim — *a block joins by transcription* —
is a gate rather than a review note. Twenty blocks joined and not one visual baseline moved.

### The construct inventory — 27, by what they are for

The per-construct table with the block that forced each is in `README.md`; this is the same set
seen as the shape of the answer. **Every one of them is a reference into a finite set that is
written down somewhere a gate can read.**

- **Relations, closed at both ends (7).** A scoped part (`within` + `element[]` + `pseudo?`);
  its `class` form; its **`class` ARRAY**; `child`; `contains` (+ `nothing`); `positions`; a
  pseudo-element of a named rule. `within` always NAMES a rule the same definition declares;
  a target is bare tags, one class, one own-class list, or one child tag. `.case-body p strong`,
  `.profile > div` and `.card--reveal .card__media, .card--reveal .card__note` are sayable;
  `.band > .rail--l` is not, and no combination of the keys assembles it.
- **Conditions, named rather than written (4).** `at` with a `$conditions` name; `inline` on
  one; a **query-only rule** inside one; `kind: "keyframes"`, whose at-rule has no condition at
  all.
- **Values (2).** `expr`, computed geometry with its bindings still interpolations; and the
  three-form value itself (literal / binding / sequence), which is what lets a border record
  which half is structure.
- **Structure (6).** `rules` as ONE ordered list — the finding that paid for itself twice;
  an effect-only modifier; a part or state with **no declarations** (a scope); an attribute
  suffix with a value; the ordinals `second`/`third`/`fourth`; `::placeholder` and
  `::-webkit-details-marker`.
- **Text — six of them, and they are `nav`'s and `card`'s (7).** `wrap` on a group, on a state
  and now **on a part**; a group's `break`; a `note` that is an array of arrays; a `note` on an
  override, a state, a **modifier** and a **position**. A formatting key may only RECORD, never
  CHOOSE: each is `const true` or an array of arrays, and each is refused where there is nothing
  to record.
- **The census itself (1).** `kind: "authored"` — a gap, which carries no CSS.

### What R5's cutover needs to know

- The published surface is **29 subpaths**, of which **20 are `./react/<id>`** — one per
  definition, enumerated, never a wildcard. `dist/react/index.ts` is the barrel and exports both
  the `cva` function and the component for every root **and every class part**: `card` alone
  ships 18 pairs (`Card`, `CardGrid`, `CardPeekSheet`, `CardSheetFrame`, `CardPeek`…).
- The consumption contract is unchanged and is documented in full in `README.md`'s "What a
  consumer must provide": import order `tailwindcss` → `tokens.css` → `tokens.tailwind.css` →
  `keyframes.css`; `@source` naming `…/@yordan/design-system/dist/react`; `cva` and `react` as
  the consumer's own dependencies; a build that transpiles TSX out of `node_modules`.
- Six blocks have **no React component and never will**: the two `@component none` blocks,
  `skeleton`, `terminator`, `project-row`, and the authored halves of the four split blocks. A
  split block's `.tsx` carries its generated core only — the gaps are CSS the consumer gets
  through `components.css` and cannot get through a class attribute.

## The owner's review list

Everything R4 found and deliberately did **not** do, in one place, because the migration's rule
was that it transcribes and never rewrites. Each is an *appearance* or *naming* decision, which
is the owner's; none is a defect. The cost column is what approving it spends.

| # | what | why it was deferred | what approving it costs |
| --- | --- | --- | --- |
| 1 | **The breakpoint ramp.** `$conditions` is twelve entries with no ramp — 480/560/600/620/640/699/720/760/860/1024/1199/1280 — each named for the number it carries. | Consolidating breakpoints is an appearance change, and this migration may not make one. A value-derived name records the decision without inventing a hierarchy. | Every consolidated pair moves a real layout at real widths; the names are in twenty definitions and the diff shows each. A rename is MAJOR. |
| 2 | **`tracking-wide-xl`** has one consumer, and **`width-display` / `width-normal`** have one each. | Folding a step into its neighbour changes how type sits. A tier of one-consumer steps is the drift this system's own rule retires — but the fix is a look decision. | Three token names disappear (MAJOR) and four selectors change tracking or width by one step. |
| 3 | **A leading tier.** `line-height` has twelve distinct values across nineteen declarations and is the one property still exempt from the literal guard. | It is drift to be **consolidated before** it is tokenised, not drift to enshrine: twelve steps with one consumer each fails the rule that retired `action`. | Consolidation moves line boxes, which moves the lattice under anything measured in cells. `check-css.mjs` gains a fourth row the day it lands. |
| 4 | **A measure tier.** `max-width` is likewise exempt. | A measure is a different job from spacing and has no ramp to join. | One new tier, and every `max-width` in the file rebound in the same commit. |
| 5 | ~~**A motion tier.**~~ **TAKEN at 2.7.0** — `--motion-state` (0.2s), `--motion-arrive` (0.28s), `--ease-arrive` and `--ease-fade`. 21 generated rules and 3 authored ones rebound; `check-css.mjs` gained rule 1c. | — | — |
| 5a | **The four durations the tier does not name.** `.theme__lamp` 0.3s, `.peek` 0.18s, `.idx__row::before` 0.25s, `.tx__big` 0.25s — one consumer each, and the last two are the same number by coincidence rather than by decision. | Folding a one-off into a register changes how something moves, which is a look decision. A tier of one-consumer steps is the drift this system's own rule retires — the same argument that keeps `line-height` out of a tier. | Each is registered in `MOTION_EXEMPT` in `scripts/check-css.mjs` with its reason, and the register is two-sided, so approving a consolidation is deleting a line and moving a number. |
| 5b | **`--rule` is one token carrying a width, a style and a colour, and pipeline 2 cannot take it apart.** `.link-grid` and `.link-grid a` both write `border: var(--rule); border-width: …`, and a class attribute has no order, so Tailwind emits the shorthand last and the grid gets four hairlines where the stylesheet draws two. | The emitter refuses to guess which part of a shorthand's value belongs to which longhand — that is the shorthand's grammar. Splitting the token is an appearance-source decision. | Declared in `UNORDERABLE` in `scripts/emit-react.mjs`, counted on every build, two-sided. It is item 6's question from the other side: a `--rule` split into `--rule-width` / `--rule-style` / `--rule-colour` would make both expressible, and would be MAJOR. |
| 6 | **`--rule-chrome-strong`.** `1px solid var(--chrome-border-strong)` has five consumers. | R3 deferred it because four of the five were in blocks with no definition; they all have one now, so the count is real and the question is live. | One token, five rebinds — additive. The judgement is whether a composed border wants a name when it carries no mode value. |
| 7 | **`card`'s orphan row, rewritten.** `.card:nth-last-child(-n+3):nth-child(3n+1)` and its `~ .card` twin, twice (3-up and 2-up). | Rewriting a selector is an appearance change however identical it renders, and R4 transcribes. | It is the block's hardest rule to read and would still not be expressible as a definition — the win is a reader's, not the census's. |
| 8 | **`.profile--drawer`.** `.drawer .profile` and `.drawer .profile > div:nth-child(odd)` are the drawer re-laying-out a component it hosts. | A modifier on `profile` would put the fact where the component is, but it changes markup on a shipped page. | Two rules move from `drawer` to `profile`, `index.html` gains a class, and both definitions and the contract change. |
| 9 | **`stat` and `fact__num` compose `.t-display`.** Both restate four of its five declarations — display family, `weight-black`, `width-hero`, `--text-display`. | Composing in markup is a markup change, and the type layer landed too late in R4 to spend the risk. | Two blocks shrink; two shipped pages gain `class="t-display t-display--lg"`; the visual baselines should not move, and "should not" is why it wants a deliberate run. |
| 10 | **`@media (hover: hover)` on `:hover`.** Tailwind's `hover:` compiles to that query and `components.css` has none, so pipeline 2 emits `[&:hover]:` rather than invent one. | The query may well be the better behaviour. It is not the emitter's to decide, and it must be decided for BOTH surfaces at once. | A `media` key on a state, both emitters changed in one commit, and every hover in the system stops firing on a sticky tap — which is a real behavioural change on touch. |
| 11 | **`!important` as a value-level key.** `card`'s `below-620` block writes three, transcribed as structural literals (`"0 !important"`, `[{token: "rule"}, "!important"]`). | It lands correctly as-is and both pipelines carry the same bytes, so `card` did not have to decide it. But `!important` changes the **cascade**, and a value form that can do that deserves a `$doc` saying so out loud rather than arriving as a string. | One key, closed and refused everywhere it is not already written; the argument is whether recording "this wins" as data makes it easier to add. |
| 12 | **The part-selector-ownership wedge.** A part's own `selector` is not checked to belong to its component, so a declarations-less scope part could declare a foreign class and make `.a .b` sayable through the back door. | Soft: it is bolted by the React tier, which reads a class part's element out of the spec's canonical HTML and fails on a class the fence does not carry. Closing it properly is a rule about what a component may name. | A check that a part's `selector` shares the root's BEM family — which `.chips`, `.peek`, `.peek-sheet` and `.idx` would all fail today, so the rule needs a stated exception before it can be a gate. |
| 13 | **`project-row` stays authored** on `relational-selectors`. | `.idx li:last-child .idx__row` puts a positional in the middle of a descendant path. Reaching it needs a construct nobody has designed. | Either a rewrite of the selector (an appearance risk) or a genuinely new relation — and this note's whole argument is that the second is decided with the block in front of you. |
