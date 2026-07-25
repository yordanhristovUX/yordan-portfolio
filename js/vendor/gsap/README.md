# GSAP 3.13.0 — vendored

Third-party. **Do not edit these files.** They are checked in deliberately.

| File | Purpose |
| --- | --- |
| `gsap.min.js` | Core tween engine |
| `SplitText.min.js` | Line splitting for the masked title rise |

**ScrollTrigger is deliberately not here.** Every trigger on the site was "fire once when
this scrolls into view", which is what `IntersectionObserver` already does natively — and
`js/automata.js` was using it for exactly that. `main.js` has a 14-line `onceInView` helper
that maps ScrollTrigger's `start: "top 88%"` onto a negative bottom `rootMargin`, which is
the same geometry. Dropping the plugin removed 43 KB of the 121 KB payload — 36% — with no
visual change. Do not add it back for a scroll reveal.

SplitText earns its 7 KB: splitting text into wrapped *line boxes* (and re-measuring after
webfonts load) is the one thing here that is genuinely awkward to hand-roll.

## Why vendored rather than CDN

The site has no build step, so a CDN was the obvious way to load GSAP — but it made a
third party a single point of failure for *legibility*, not just motion:
`css/style.css` hides `[data-reveal]` and `[data-rise]` behind the `js` class so they can
be animated in, and `main.js` used to add that class before touching GSAP. A failed CDN
fetch therefore left the hero and every revealed block hidden forever.

That is fixed in two independent ways, and both are load-bearing:

1. **These files ship with the site**, so there is no third-party fetch to fail.
2. **`main.js` adds the `js` class only after confirming all three globals exist**
   (`HAS_GSAP`), so even a corrupted or blocked local file degrades to a static,
   fully readable page rather than a blank one.

Keep the second guarantee if you ever move back to a CDN.

## Updating

Replace the files from `https://cdn.jsdelivr.net/npm/gsap@<version>/dist/` and bump the
version in this file. Check that `SplitText` is still bundled free — it became so in 3.13.

## Licence

Copyright GreenSock. Subject to the standard licence at https://gsap.com/standard-license —
which covers this use. The licence banners at the top of each file must stay intact.
