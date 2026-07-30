# Visual-regression baselines

One PNG per story, captured by `npm run test:visual` and **committed**. They are the expected
value of the test; a screenshot harness whose expectations live only on the machine that ran
it last is a screenshot script.

```
__screenshots__/<platform>/<story-id>.png
```

## Report-only until 2026-09-01

Decided with the owner. A mismatch prints a named block, writes a diff PNG under
`test-results/visual-diff/<platform>/` and the job still **exits 0**. A baseline set nobody has
looked at yet produces red builds rather than information, so the first month buys the
evidence before the verdict.

Two things flip on that date, together:

- the `try`/`catch` around the matcher in `.storybook/test-runner.js`;
- the exit-code override at the end of `scripts/test-storybook.mjs`.

Both carry the date in a comment beside them. Nothing else changes — a genuine test failure
(a story that throws, a browser that dies) fails the run today already; only the *image*
comparison is lenient.

## Why the platform folder

A PNG is a rasterisation, not a fact. Chromium hints and antialiases text differently on
win32 and on linux, so one shared baseline set would make every CI run a wall of mismatches
and the harness would be noise inside a week. Baselines are therefore per platform, and a
platform with none reports `no baseline yet` — which, being report-only, does not fail.

**The committed set is `win32`, captured on the machine this landed from.** Linux CI has no
baseline until someone commits one: run the job, download the `visual-received` artifact, and
commit its contents as `__screenshots__/linux/`. `DS_SNAPSHOT_PLATFORM` overrides the folder
name if you want to pin a container image rather than an OS.

## What makes them reproducible

Four runs of the unchanged tree produced four identical sets, including the canvas stories.
The pins are all in `.storybook/test-runner.js`:

| Source of drift | What holds it still |
| --- | --- |
| viewport | fixed 1280×800, set in `preVisit` — **before** the story renders |
| animation, transitions, the text caret | `prefers-reduced-motion`, an injected stylesheet, and Playwright's own `animations: "disabled"` / `caret: "hide"` |
| web fonts | `waitForPageReady` awaits `document.fonts.ready` |
| scrollbars | hidden, so a story that just crosses the fold does not gain a gutter |
| device pixel ratio | Playwright's default 1, plus `scale: "css"` |

**The automata canvases are NOT masked, and that is deliberate.** `stories/skeleton.stories.js`
draws one settled generation of Life from a seeded PRNG, so the drawing is a pure function of
the region's box — which the fixed viewport pins. Masking them would have hidden the one part
of the system where a CSS change (the `--space-6` lattice, a rail's width) has a *large* and
non-obvious visual consequence, which is exactly what a screenshot is for. If they ever do go
flaky, the fix is to find what stopped being deterministic, not to paint over them.

The viewport is set before render for the same reason: those stories measure their own box in
a `requestAnimationFrame` and size a canvas from it, so a story rendered at one width and
captured at another is a different drawing rather than a resized one.

## Updating a baseline

There is no `-u`. If a change is intended, delete the stale PNGs under
`__screenshots__/<platform>/`, re-run `npm run test:visual` to recapture them, and commit them
**in the same commit as the CSS that moved them** — the diff is the review.
