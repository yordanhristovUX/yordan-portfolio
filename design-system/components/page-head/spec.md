---
{
  "id": "page-head",
  "status": "stable",
  "since": "phase-3",
  "a11y": "The kicker is a <p>, never a heading — it names the client or the protocol and is not a level in the document outline. The title is the page's one <h1>, and the band is labelled by it with aria-labelledby rather than by an aria-label, so the accessible name is the visible one."
}
---

# Page head

The head an **inner page** opens with: the five `work/<id>` case studies and `/mcp`. Four
things in a fixed order — a kicker naming whose page this is, the title, a lede, and a slot
for the tags that follow — plus one rule about the well it sits in.

It is **not** Section head. `.sec__head` opens a *section* inside a page that already has a
head; this opens the page. The clearest tell is the kicker: a section head has a note
(`.sec__note`) to its right, and a page head has an accent-ruled line above its title. Nor is
it the home page's hero, which is a different composition with actions in it.

**It goes on the band, not inside the well.** The one rule it makes about the page's geometry
is a rule about the well — an inner page's head is the thing that has to clear the floating
bar — and the clearance *replaces* the well's own `--pad-y` rather than adding to it. Put
`.page-head` inside the well and that rule cannot be written.

## Pattern

This is not an example, it is THE pattern. Copy it verbatim.

```html
<section class="band page-head" aria-labelledby="work-title">
  <div class="well">
    <p class="page-head__kicker t-label">Green Street</p>
    <h1 class="page-head__title t-display t-display--lg" id="work-title">A design system for a bank</h1>
    <p class="page-head__lede t-lead">
      One paragraph. What the work was, in the words the case study goes on to prove.
    </p>
    <div class="page-head__meta">
      <div class="chips"><span class="chip">Design system</span><span class="chip">Figma</span></div>
    </div>
  </div>
</section>
```

**The type comes from the type layer, not from here.** `t-label` on the kicker, `t-display
t-display--lg` on the title, `t-lead` on the lede — this block sets rhythm and the accent
rule and nothing else, so a page that wants a smaller title changes the utility rather than
the component.

## Rhythm

Measured off `/mcp`, which is where the pattern existed before it was one, and approved at
those numbers.

| gap | token | at an 800px-tall window |
| --- | --- | --- |
| well top (nav clearance) | `--space-nav` | 88px, and `0` on paper |
| kicker to title | `--space-flow-sm` | 20px |
| title to lede | `--space-4` | 16px |
| lede to meta | `--space-5`, **collapsed** | 20px |

The last row is the one worth knowing. The lede carries `margin-bottom: var(--space-5)` and
the meta carries `margin-top: var(--space-5)`; they are adjacent siblings in a block
container, so the two margins collapse to one 20px gap. That is deliberate rather than
accidental — it means the lede still spaces whatever follows it when there is no meta (on
`/mcp`, prose does), and the meta still has 20px above it when there is no lede.

## Variants

None, and that is a decision. A head that needs to look different needs a different *level*
of type, which is the type layer's job, or a different composition, which is a different
component. A `--compact` here would be the first step toward this block owning the type scale.

## Tokens

`--accent`, `--space-2`, `--space-4`, `--space-5`, `--space-flow-sm`, `--space-nav`

## A11y

- The kicker is a `<p>`. It is a label, not a heading, and putting an `<h2>` above the `<h1>`
  would give the page an outline that starts at the wrong level.
- The title is the page's single `<h1>` and carries the `id` the band's `aria-labelledby`
  points at. Prefer that over `aria-label`: an accessible name a sighted reader can also see
  cannot drift from the visible one.
- The meta slot holds chips, which are **not** interactive. If a page ever puts links there
  they are links and get the link treatment; a chip is a word, not a control.

## AI notes

- Reach for this on any page that is not `index.html`. The home page opens with the hero, and
  `evals.html` opens with its own generated regions.
- `--accent` on the kicker's rule is one of the five sanctioned uses of the accent. Do not add
  a second accent anywhere in this head.
- The order is fixed: kicker, title, lede, meta. A page with no kicker omits the element; it
  does not reorder the rest.
- On `/mcp` the head is followed by prose and a link grid **inside the same well**, and those
  are the page's composition rather than part of this component — `css/mcp.css` positions
  them.
