# Project pages — architecture

**Status: proposed, not built.** Nothing in this document is implemented. It exists so the
decisions are made before the code, and so the two that need the owner are visible rather than
buried in a diff.

**Scope: the five case studies get pages. The nine notable projects do not.** That is not a
compromise — it is the distinction the content already draws. A project with
`hasCaseStudy: true` has ordered `sections[]` worth a page; a card-only project has a
`{#summary}` and nothing else, and a page for it would be a heading over one paragraph.

---

## Why pages, and why the usual argument is the weak one

The usual case is "a modal is bad for long-form". True, but not decisive.

**The decisive reason is that a modal has no URL.** Today the Green Street audit cannot be
linked to, cannot be indexed, cannot be opened in a tab, cannot be printed on its own, and
cannot be cited by anything — including the assistant, which can name the project but cannot
point at it. For work whose entire premise is *"every claim here is inspectable"*, an
inspectable thing with no address is the contradiction worth fixing.

Everything else — back button, print, share, SEO — falls out of that one property.

---

## The finding that changes the sequencing

**This is free. It does not need the billed corpus rebuild, and it should not wait for it.**

I previously advised batching this with the deeper-knowledge work. That was wrong, and the
reason is worth stating precisely because it is the kind of thing that is expensive to assume:

```
scripts/build-vectors.mjs:70   const texts = content.chunks.map(c => `${c.heading}. ${c.text}`)
evals/run.mjs:160              const CORPUS_TEXTS = content.chunks.map(c => `${c.heading}. ${c.text}`)
```

The corpus digest is **heading and text only**. A chunk's `cite` — which is where a page path
lives — is not in it. So moving `cite.page` from `/` to a project page changes chunk
*metadata* and not chunk *text*: `corpusHash` holds, both committed vector caches stay valid,
and nothing is billed.

The prose on the pages is the prose that is already chunked. Only *new* writing costs.

---

## Routing, and the landmine under it

`vercel.json` sets `cleanUrls: true` and `trailingSlash: false`. `ARCHITECTURE.md` already
names the second as "the single most load-bearing line of deploy config in the repo", because
every page references its CSS, JS and fonts by **relative** path. A page served at `/cv`
resolves `design-system/dist/tokens.css` against `/` and it works.

**A page in a subdirectory does not.** Served at `/work/greenstreet-audit`, that same relative
reference resolves against `/work/` and 404s — the page ships unstyled and unscripted, and
`npm run check` would not notice, because every generated file is still byte-perfect. This is
the same failure mode the trailingSlash warning describes, reached by a different route.

Two ways out.

### A · Root-level pages — `/greenstreet-audit`

Relative references keep working with no change anywhere. Costs nothing and adds no
convention.

The price is the root namespace: `/cv`, `/mcp`, `/evals` already live there, and a project id
that ever collides with a future route silently shadows it. Five known ids today, all safe.

### B · `/work/<id>` with root-absolute references — **recommended**

Better information architecture — the section is already `#work`, and the URL says what the
page is. The generated pages reference assets as `/design-system/dist/tokens.css`.

The price is that the repo would then have two conventions, and the failure is silent. That is
exactly the shape this codebase gates rather than documents, so it comes with a check:

> **every generated project page references its assets root-absolutely**, asserted by the same
> script that generates them, failing the build otherwise.

### The third option, worth naming

Migrate *all four* existing pages to root-absolute references and have one convention. It
removes the trailingSlash landmine permanently rather than routing around it. It is a larger
diff and touches four working pages to fix a problem none of them currently has — a fair thing
to do later, and the wrong thing to bundle into this.

---

## One renderer, not two

**DECIDED by the owner: the modal goes, and navigation is native.** The rest of this section
is the reasoning that was put to him and is kept because it records why, not to re-open it.

A note on the word: the element carries `role="dialog"` and `aria-modal="true"`, and this
document used to call it "the dialog" after the ARIA attribute. It is a **full-screen modal**,
and that is what it should be called — the attribute is an accessibility mapping, not the name
of the pattern.

**Retire the modal. The rows become links.**

`js/case-studies.js` renders a case study in JavaScript from `window.CASE_STUDIES`; a project
page would render the same case study as HTML. Both from the same `content/projects/*.md`.
**Two renderers for one source is precisely the drift this pipeline exists to prevent** — when
they disagree, nothing says which is right, and the generator gate cannot help because both
outputs are individually up to date.

What the index row is today, and why there is no URL:

```html
<button class="idx__row" data-project="greenstreet-audit">   <!-- a button cannot be linked to -->
```

It becomes an `<a href="/work/greenstreet-audit">`. That is the whole navigation change.

**What is lost, stated plainly.** The modal is recent, deliberate work: a focus trap, its own
lattice root, `window.rebuildCaseSquares()`, and a keyboard trap that was found and closed in
it. Retiring it deletes all of that, including the fix. It also loses "stay in the flow of the
index", which was the reason it was built.

**The alternative that was considered and rejected.** Make the row a real link *and* intercept
it in JS: the modal opens, `history.pushState` gives it the URL, popstate closes it, and a
reader without JS gets the page. It keeps the flow and every property above — and it keeps two
renderers, which is the thing worth not having. The owner's call was native navigation.

**What retiring it deletes**, so the removal is a checklist rather than a hunt:

| | |
| --- | --- |
| `js/case-studies.js` | generated; `build-content.mjs` stops emitting it |
| `window.CASE_STUDIES` | its only consumer is `js/main.js:353` |
| the modal open/close path | `js/main.js:412`, bound to `[data-project]` |
| `.case`, `.case__backdrop`, `.case__well`, `.case__title` | markup in `index.html` and the block in `components.css` |
| `window.rebuildCaseSquares()` | exists so the automata can re-measure after the modal lays out — **and it had a second caller this checklist did not predict**, see below |
| the second lattice root | `.band` outside a `.sheet` is its own root *because of* this modal — see `skeleton/spec.md`. With it gone, check whether any other surface still needs that rule before deleting it |

The last row is the one to be careful with: it is a rule in the skeleton that exists for this
modal, and removing a rule because its only caller went away is right *only* after confirming
it has no other caller.

**Two things that caution caught, recorded because the checklist was wrong about both.**

- `window.rebuildCaseSquares()` had a **live second caller**: `js/chat.js`, after appending to
  the thread. Deleting it blind would have looked safe and silently changed the drawer's
  behaviour. It turned out to be removable anyway, but only after measuring: the drawer
  contains **0 automata regions** — no rail, no strip, no canvas — so there was never anything
  inside it for that call to rebuild. Deleted, with the measurement written into all three
  specs that documented it.
- The `.band`-outside-a-`.sheet` rule was confirmed to have exactly one user, the modal, and
  **kept anyway**. It is a capability rather than a claim: it makes a band self-sufficient, it
  costs one declaration, and deleting a capability because its only caller left is a different
  decision from deleting a false statement. The spec says it is currently unexercised.

---

## What a project page contains

Generated by `scripts/build-content.mjs` from the same source as everything else, so it is a
byte-compared artefact like the content regions — never hand-edited.

| Region | Source |
| --- | --- |
| `<head>`, og tags, JSON-LD `CreativeWork` | the project's frontmatter; the graph already carries one node per project |
| Header — client, title, `{#subtitle}`, period, tags | frontmatter + the subtitle section |
| Cover media | the `cover` slot, emitted automatically as it is today |
| Body — ordered `sections[]` | every section but `{#summary}` and `{#subtitle}`, in authored order, kinds repeating |
| Metrics, links, media | the existing `{{metric:N}}`, `{{links}}`, `{{media:slot}}` directives |
| Prev / next | `index` order, so the five read as a set |
| Back to the index | to `/#work`, the section the reader came from |

The page is a `.sheet` with `.band`/`.well` like every other page, so it inherits the lattice,
the automata, the terminator and the print rules with no new layout work.

---

## What stays on the index

Unchanged: the work index list, the notable cards, everything else. The rows change element and
gain an `href`. The nine notable cards keep their peek panel and get no pages.

---

## The corpus and the assistant

- **`cite.page`** moves from `/` to the project's path, and `cite.anchor` from `#work` to the
  section. Citations start pointing at the passage instead of at the list containing it.
- **Chunk ids do not change.** `project:greenstreet-audit#approach` is unaffected, so the
  provenance gate, the eval baseline and both vector caches are untouched.
- **The assistant gains a real link target.** An answer that names a project can point at
  `/work/<id>`; the referential gate already resolves project ids, so this needs no new block
  type and no new validation.
- **This is where the deeper-knowledge work lands later.** Assistant-only sections would be
  chunked and *not* rendered on the page — the page emitter renders an allow-list of kinds, so
  "not on the page" stays the default and exposure stays the deliberate act.

---

## Gates this needs

Each of these is cheap, and each replaces something a reviewer would otherwise have to
remember:

1. **Coverage** — every `hasCaseStudy` project has a generated page, and every generated page
   has a project. The existing component-coverage gate is the model.
2. **Byte comparison** — the pages join `build-content.mjs --check`, like every other generated
   artefact.
3. **Link integrity** — every `href` in the work index resolves to a page that was generated
   this run. A dead internal link on the one page that lists the work is the worst place for
   one.
4. **Reference form** — if option B is taken, every asset reference on a generated page is
   root-absolute. This is the silent failure; it needs the check more than the others.
5. **`cite.page` agreement** — the path in a chunk's citation is the path the page was written
   to. Two sources for one URL is how a citation quietly starts pointing at a 404.

---

## Sequencing

1. Decide routing (A or B). The modal question is settled: native navigation.
2. Emit the pages, retire the modal, convert the rows to links.
3. Land the five gates.
4. `npm run check` — nothing billed, no re-baseline, no vector rebuild.
5. Deploy.

The deeper-knowledge pass comes after, on its own schedule, and pays the one billed rebuild
then.

---

## Decisions

Both are made. Nothing in this document is open.

1. ~~**The modal**~~ — **RESOLVED.** It goes; navigation is native. One renderer.
2. ~~**Routing**~~ — **RESOLVED: `/work/<id>`**, with generated pages referencing assets
   root-absolutely and a gate asserting they keep doing so. The subdirectory is the better
   information architecture and the root namespace stays free for routes; the price is a
   second reference convention, and the price of *that* is paid by a check rather than by a
   paragraph asking people to remember.

Migrating the four existing pages to one convention — which would retire the
`trailingSlash: false` landmine entirely rather than routing around it — is explicitly **not**
part of this. It touches four working pages to fix a problem none of them has today. It is the
right follow-up and the wrong bundle.
