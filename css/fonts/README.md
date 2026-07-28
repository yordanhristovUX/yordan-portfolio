# Web fonts — vendored

Third-party. **Do not edit these files.** They are checked in deliberately.

14 WOFF2 files, 481 KB, plus `fonts.css` which declares them. The four page heads link
`css/fonts/fonts.css`; nothing on the site touches `fonts.googleapis.com` any more.

| Family | Faces | Role |
| --- | --- | --- |
| Archivo | one **variable** face, `wght 700–900` × `wdth 62–125%` | Display — the voice |
| IBM Plex Sans | 400 / 500 / 600 static | Body — the narration |
| IBM Plex Mono | 400 / 500 / 600 static | Labels, chrome, code — the annotation |

Two subsets each, `latin` and `latin-ext`. Cyrillic, Greek and Vietnamese are deliberately
not here: no page on this site contains a character outside latin-ext, and the three extra
subsets would have roughly doubled the payload to serve nothing.

## Why vendored rather than fetched

Same argument as `js/vendor/gsap/`, and for the same reason it is not a style preference:
**a third party was a single point of failure for the site's voice.**

`design-system/tokens/tokens.json` declares the display stack as
`"Archivo", "Arial Black", sans-serif`. If `fonts.googleapis.com` is unreachable — a
corporate network, a filtered country, an outage — every heading falls back to Arial Black.
That is not a slightly different heading. Arial Black has **no `wdth` axis**, so every
`font-variation-settings: "wdth" …` call in `components.css` silently does nothing:
`.t-display` at `wdth 115`, `.t-title` at 110, `.t-statement` at 105, `.idx__name` at 108,
`.card__title` at 105. The entire width-modulated display system collapses to one width,
and nothing reports an error. The page still "works"; it just stops being this design.

Vendoring removes the failure mode rather than mitigating it. There is no third-party fetch
left to fail, and no `preconnect` warming a connection the site no longer makes.

## The `wdth` axis is the thing to protect

The single most important property of this folder is that `archivo-*.woff2` is a **variable**
font, not a static instance. Its `@font-face` says:

```css
font-weight: 700 900;
font-stretch: 62% 125%;
```

Two ranges, not two values. If a future update replaces these with single numbers, or swaps
the variable file for a static one, every `wdth` call flattens and the failure is invisible —
the type still renders, at the wrong widths. **Verifying "the font loaded" does not catch
this.** Measure a string at two different `wdth` values and assert the widths differ:

```js
// must be > 0
widthAt(125) - widthAt(62)
```

That check was run when these files landed: at 4rem/900, "Hristov" measures 306.6px at
`wdth 62` and 528.9px at `wdth 125` — a 222.3px spread across the axis.

## What is deliberately not covered

Google's `latin` subset does not include `→` (U+2192), `✕` (U+2715) or `▪` (U+25AA), all of
which the site uses. Those already fell back to a system font when the fonts came from
Google, so vendoring changes nothing about them — but do not "fix" it by adding subsets, and
do not assume a glyph is present because the family is.

## Updating

Re-fetch from the Google Fonts CSS API with a modern browser User-Agent (an old UA gets you
TTF instead of WOFF2), keep only the `latin` and `latin-ext` blocks, and rewrite each `src`
to a local relative path. The source URL is recorded at the top of `fonts.css`. After any
update, re-run the `wdth` spread check above — it is the one regression that is silent.

## Licence

All three families are licensed under the SIL Open Font License 1.1.
Archivo — Omnibus-Type. IBM Plex — IBM. The OFL permits redistribution of the font files,
including bundling them with a work, provided they are not sold on their own.
