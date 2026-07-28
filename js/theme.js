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

  /* ---------- The cycle is not a fixed ring ----------

     Three states over two renderings: going round must repeat a rendering
     exactly once. That is arithmetic, and it cannot be designed away
     without dropping a state. What CAN be chosen is which press repeats,
     and it must not be the first.

     The old fixed ring `auto → light → dark` put it there. On a light
     system, auto already renders light, so press 1 relabelled the control
     to LIGHT and moved nothing: the reader learned the control was broken
     one press before dark arrived.

     So the next state is computed against what auto resolves to RIGHT NOW
     — `auto → dark → light → auto` on a light system, mirrored on a dark
     one. Press 1 and press 2 both change the page; the repeat lands on
     press 3, the return to auto, whose meaning is "stop overriding" and
     where staying on the colour you were already looking at is the
     correct outcome rather than a surprise. The label says so in advance.
     See design-system/components/theme-toggle/spec.md. */
  const nextOf = (state) => {
    const sys = resolved("auto");
    if (state === "auto") return sys === "dark" ? "light" : "dark";
    return state === sys ? "auto" : sys;          // matches system → back to auto
  };

  /* The accessible name has to be true in all SIX combinations — three
     states against two system settings — so both halves of it name the
     resolution rather than the bare state. */
  const IS = (s) => (s === "auto" ? `auto, currently ${resolved("auto")}` : s);
  const TO = (s) => (s === "auto" ? `auto (your system setting, currently ${resolved("auto")})` : s);

  function apply(state, { announce = true } = {}) {
    if (state === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", state);

    try {
      if (state === "auto") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, state);
    } catch { /* nothing to do — the theme still applies for this visit */ }

    const next = nextOf(state);
    for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
      btn.dataset.state = state;
      const label = btn.querySelector(".theme__label");
      if (label) label.textContent = LABEL[state];
      // Current state AND the consequence of pressing: the visible label can
      // only carry the first, and on narrow screens it is hidden entirely.
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
