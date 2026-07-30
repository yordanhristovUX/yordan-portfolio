/* ============================================================
   Theme — auto / light / dark.

   The attribute itself is set by the inline script in <head>, before
   first paint; this file only owns the control and the persistence.
   Splitting it that way is the point: the flash of the wrong theme is a
   render-order bug, not a logic bug, and no deferred script can fix it.

   "auto" is stored as the ABSENCE of a stored value, so a visitor who has
   never chosen keeps following their OS forever, including across a change
   of OS preference mid-visit.
   ============================================================ */
(() => {
  const KEY = "theme";               // shared with the inline <head> script
  const STATES = ["auto", "light", "dark"];

  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const stored = () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null; // private mode / storage disabled — auto still works
    }
  };

  const current = () => (STATES.includes(stored()) ? stored() : "auto");

  /* What the page is actually showing right now, which is not the same as
     the state: "auto" resolves through the OS. */
  const resolved = (state) => (state === "auto" ? (media.matches ? "dark" : "light") : state);

  /* ---------- Every press changes the page ----------

     The next state is always the OPPOSITE of what is currently rendered —
     and when that opposite is what the system would show anyway, it is
     stored as auto (nothing stored) rather than as a pin. "Showing what
     your OS shows" and "following your OS" are the same state, so there
     is nothing to pin.

     That is what dissolves the old ring's arithmetic problem. Three
     states over two renderings forced one press per lap to repeat a
     rendering; this ring simply has two reachable states — auto and the
     pin that CONTRADICTS the system — so every press flips the page. The
     third state, a pin that AGREES with the system, is unreachable by
     pressing (only an OS change under a pin can produce it), and from it
     the next press still flips the page.

     A fresh visitor is in auto, and the first press gives them the
     opposite of whatever they are looking at.
     See design-system/components/theme-toggle/spec.md. */
  const nextOf = (state) => {
    const target = resolved(state) === "dark" ? "light" : "dark";
    return target === resolved("auto") ? "auto" : target;
  };

  /* The accessible name has to be true in all SIX combinations — three
     states against two system settings — so both halves of it name the
     resolution rather than the bare state. */
  const IS = (s) => (s === "auto" ? `auto, currently ${resolved("auto")}` : s);
  const TO = (s) => (s === "auto" ? `auto (your system setting, currently ${resolved("auto")})` : s);

  /* ---------- The browser chrome is part of the theme ----------

     `<meta name="theme-color">` is what tints the address bar and the task
     switcher. There are two of them and they key on `prefers-color-scheme`,
     which is right for a reader following their OS and WRONG for one who has
     pinned: pin light on a dark OS and the paper went light while the chrome
     stayed dark. The inline <head> script fixes the first paint by flipping
     `media`; this keeps it true for every press afterwards, and restores the
     OS queries when the reader goes back to auto.

     `not all` never matches and `all` always does, so a pinned tag beats the
     OS whichever way round they disagree.

     The CONTENT is then re-read from `--surface-page` rather than left as the
     literal in the markup. Same rule as everything else that touches a themed
     colour in JS — no colour literals here, read the computed token — and the
     literal in the HTML stays only because it is the one value available
     before the stylesheet is parsed, which is also exactly the case a reader
     with JS off is in. */
  function syncChrome(state) {
    const metas = document.querySelectorAll('meta[name="theme-color"][data-theme-color]');
    if (!metas.length) return;
    const shown = resolved(state);
    const paper = getComputedStyle(root).getPropertyValue("--surface-page").trim();
    for (const m of metas) {
      const forTheme = m.getAttribute("data-theme-color");
      m.media = state === "auto" ? `(prefers-color-scheme: ${forTheme})` : forTheme === state ? "all" : "not all";
      if (paper && forTheme === shown) m.setAttribute("content", paper);
    }
  }

  function apply(state, { announce = true } = {}) {
    if (state === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state);
    syncChrome(state);

    try {
      if (state === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, state);
    } catch { /* nothing to do — the theme still applies for this visit */ }

    const next = nextOf(state);
    for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
      btn.dataset.state = state;
      // The control has no visible text — the dial carries the state — so the
      // accessible name carries the current state AND the consequence of
      // pressing, and it is not optional.
      btn.setAttribute("aria-label", `Theme: ${IS(state)}. Activate for ${TO(next)}.`);
    }

    if (announce) {
      window.dispatchEvent(
        new CustomEvent("themechange", { detail: { state, resolved: resolved(state) } })
      );
    }
  }

  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-theme-toggle]");
    if (!btn) return;
    apply(nextOf(current()));
  });

  /* The OS flipping does two different things, and both have to happen.

     In auto it is a theme change like any other — anything reading themed
     colours in JS needs to hear about it. Under a PINNED state it changes
     nothing on screen, but `nextOf` is computed against the system, so the
     target of the next press has just moved and the accessible name that
     promises it is now stale. Re-applying refreshes the name either way;
     `announce` stays gated on auto so `themechange` keeps meaning "the
     rendering actually changed" rather than "something was recomputed". */
  media.addEventListener("change", () => apply(current(), { announce: current() === "auto" }));

  // Sync the control to what the inline script already painted.
  apply(current(), { announce: false });
})();
