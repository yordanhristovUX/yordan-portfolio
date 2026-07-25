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
  const LABEL = { auto: "Auto", light: "Light", dark: "Dark" };
  const SAYS = {
    auto: "following your system setting",
    light: "light",
    dark: "dark",
  };

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

  function apply(state, { announce = true } = {}) {
    if (state === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state);

    try {
      if (state === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, state);
    } catch { /* nothing to do — the theme still applies for this visit */ }

    for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
      const next = STATES[(STATES.indexOf(state) + 1) % STATES.length];
      btn.dataset.state = state;
      const label = btn.querySelector(".theme__label");
      if (label) label.textContent = LABEL[state];
      // Current state AND the consequence of pressing: the visible label can
      // only carry the first, and on narrow screens it is hidden entirely.
      btn.setAttribute("aria-label", `Theme: ${SAYS[state]}. Activate for ${LABEL[next].toLowerCase()}.`);
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
    apply(STATES[(STATES.indexOf(current()) + 1) % STATES.length]);
  });

  // In auto, the OS flipping is a theme change like any other — anything
  // reading themed colours in JS needs to hear about it.
  media.addEventListener("change", () => {
    if (current() === "auto") apply("auto");
  });

  // Sync the control to what the inline script already painted.
  apply(current(), { announce: false });
})();
