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

| Class | Voice | Use |
| --- | --- | --- |
| `.t-display` + `--hero` / `--xl` / `--lg` | Archivo 900, wide, uppercase | Hero name / contact headline / dialog titles |
| `.t-title` | Archivo 800 | Section titles (in section heads) |
| `.t-statement` | Archivo 800, sentence case | The one punchline of a section |
| `.t-lead` | Plex Sans, large | Prose intro that precedes a statement |
| `.t-kicker` | Plex Sans, muted | Small lead-in line above a group |
| `.t-label` | Plex Mono, uppercase, letterspaced | Micro labels (role eyebrow) |

## Pattern

```html
<h1 class="t-display t-display--hero">Yordan<br>Hristov</h1>
<p class="t-lead">Before tech: 10+ years in the fitness industry…</p>
<p class="t-statement">People don't behave the way they say they will.</p>
```

## Tokens

`--font-display`, `--font-body`, `--font-mono`, `--content-primary`, `--content-body`,
`--content-muted`, `--chrome-label-strong`

## AI notes

- Hierarchy rule: a section shows at most one `.t-statement`; `.t-lead` never follows it.
- Never add a new font-size to a component — if no level fits, the content is wrong, not
  the scale.
- Display levels are uppercase by CSS; write source text in normal case.
