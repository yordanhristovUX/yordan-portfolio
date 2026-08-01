---
{
  "id": "typography",
  "status": "stable",
  "since": "initial",
  "a11y": "Display levels are uppercased by CSS, so source text stays normal case and is announced as words rather than letters."
}
---

# Typography scale

One voice per level. Components and pages compose these utilities instead of declaring
font stacks. Archivo (display) speaks; IBM Plex Sans narrates; IBM Plex Mono annotates.

## Levels

| Class | Token | Voice | Use |
| --- | --- | --- | --- |
| `.t-display` + `--hero` | `--text-display-hero` | Archivo 900, wide, uppercase | The hero name, once per site |
| `.t-display` + `--xl` | `--text-display-xl` | same | The contact headline |
| `.t-display` + `--lg` | `--text-display` | same | Dialog titles, the CV name |
| `.t-title` | `--text-title` | Archivo 800, uppercase | Section titles (in section heads) |
| `.t-statement` | `--text-title` | Archivo 800, sentence case | The one punchline of a section |
| `.t-lead` | `--text-lead` | Plex Sans, large | Prose intro that precedes a statement |
| `.t-kicker` | — (body) | Plex Sans, muted | Small lead-in line above a group |
| `.t-label` | `--text-xs` | Plex Mono, uppercase, letterspaced | Micro labels (role eyebrow) |

`.t-title` and `.t-statement` share one token deliberately. They are the same **level**
wearing different weights, widths and cases — which is the entire point of having utility
classes rather than sizes. Two tokens 0.2rem apart would be a distinction the reader cannot
see and the system cannot defend.

## The scale itself

Twelve steps in `tokens.json`, split at body:

| | Steps | Shape | Why |
| --- | --- | --- | --- |
| below body | `--text-2xs` `--text-xs` `--text-sm` `--text-md` | fixed rem, ~1.085 ratio | Chrome has no voice and must not grow with the window — a 12px label becoming 18px on a wide monitor is a bug, not responsiveness |
| body and above | `--text-base` then `--text-lead` `--text-sub` `--text-heading` `--text-title` `--text-display` `--text-display-xl` `--text-display-hero` | `clamp(min, vw, max)` | A display line has to survive a 375px phone and a 1600px sheet |

Plus two **ratios**, which are not steps: `--text-code` (`0.9em`, inline `<code>` inside
prose) and `--text-unit` (`0.38em`, the `%`/`+` suffix riding on a display number). They
mean "a fraction of whatever set me", which the scale cannot express.

Every step carries a `print` value in pt. Paper is a third theme for type exactly as it is
for colour — and a `vw` clamp has no viewport to scale against on a printed page, so the
fluid steps in particular *need* one.

## Pattern

```html
<h1 class="t-display t-display--hero">Yordan<br>Hristov</h1>
<p class="t-lead">Before tech: 10+ years in the fitness industry…</p>
<p class="t-statement">People don't behave the way they say they will.</p>
```

## Tokens

`--chrome-label-strong`, `--content-body`, `--content-muted`, `--content-primary`,
`--font-body`, `--font-display`, `--font-mono`, `--space-6`, `--text-display`,
`--text-display-hero`, `--text-display-xl`, `--text-lead`, `--text-statement`,
`--text-title`, `--text-xs`, `--tracking-tight`, `--tracking-tight-lg`,
`--tracking-tight-xl`, `--tracking-wide-2xl`, `--weight-black`, `--weight-extrabold`,
`--weight-medium`, `--width-body`, `--width-display`, `--width-hero`, `--width-title`

`--text-statement` is new, and `.t-statement` no longer shares `--text-title`. The two differ
by **shape of response**, not by level: a title is one line in a strip that must land on the
lattice, so it steps at the grid break for free; a statement is a 7-19 line paragraph in a
measure, so a step moves it from six lines to ten on a single pixel of resize. The title steps;
the statement keeps an authored curve.

`--space-6` is the lattice cell, and `.t-title` rounds its line box **up** to a whole one
(`line-height: round(up, 0.8em, var(--space-6))`). That is a typography rule with a layout
job: it is what makes a section head an exact number of cells tall, so the head lands on the
grid instead of leaving a fraction of a square under it. A size utility consuming a spacing
token is unusual and deliberate — the alternative was a number typed here.

## AI notes

- Hierarchy rule: a section shows at most one `.t-statement`; `.t-lead` never follows it.
- Never write a font-size in a component — this used to be advice and is now a gate:
  `node scripts/check-css.mjs` fails on any literal `font-size` in `components.css` or a
  page stylesheet. If no step fits, add one to `tokens.json`; if you find yourself adding
  a step 0.06rem from an existing one, the content is wrong, not the scale.
- Display levels are uppercase by CSS; write source text in normal case.
