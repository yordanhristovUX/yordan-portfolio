"use client";
/* ============================================================
   Theme — auto / light / dark.

   COPIED FROM js/theme.js @ 2e84323; fix upstream first. A bug found here is
   reported against js/theme.js, fixed there by its owner, and re-copied — never
   fixed only in this copy.

   Ported, not rewritten, and deliberately NOT re-expressed as React state. The
   original is a delegated document click listener that rewrites every
   `[data-theme-toggle]` in the page on each apply(), which is what keeps the
   bar's satellite puck and the one inside the mobile menu from ever
   disagreeing. Two React components holding the same state would need a
   context, a provider and a decision about which of them is authoritative;
   this needs none, behaves identically with one control or five, and stays
   diffable against the file it came from.

   What changed in the port, and nothing else did:
     - an `init()` guard, because React may mount two toggles and StrictMode
       mounts each of them twice — the original ran once, as a page script;
     - `attach()` is idempotent for the same reason.

   The event contract is part of the copy: `themechange` on `window`, with
   `detail: { state, resolved }`. js/automata.js listens for exactly that to
   re-read its themed colours, and anything themed in this app must do the
   same rather than reading a colour twice.
   ============================================================ */

const KEY = "theme"; // shared with the inline <head> script
const STATES = ["auto", "light", "dark"];

type State = string;

let started = false;

const root = () => document.documentElement;

const stored = (): string | null => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // private mode / storage disabled — auto still works
  }
};

const current = (): State => (STATES.includes(stored() ?? "") ? (stored() as State) : "auto");

/* What the page is actually showing right now, which is not the same as
   the state: "auto" resolves through the OS. */
const media = () => window.matchMedia("(prefers-color-scheme: dark)");
const resolved = (state: State): string =>
  state === "auto" ? (media().matches ? "dark" : "light") : state;

/* ---------- Every press changes the page ----------
   The next state is always the OPPOSITE of what is currently rendered — and
   when that opposite is what the system would show anyway, it is stored as
   auto (nothing stored) rather than as a pin. "Showing what your OS shows"
   and "following your OS" are the same state, so there is nothing to pin. */
const nextOf = (state: State): State => {
  const target = resolved(state) === "dark" ? "light" : "dark";
  return target === resolved("auto") ? "auto" : target;
};

/* The accessible name has to be true in all SIX combinations — three states
   against two system settings — so both halves of it name the resolution
   rather than the bare state. */
const IS = (s: State) => (s === "auto" ? `auto, currently ${resolved("auto")}` : s);
const TO = (s: State) =>
  s === "auto" ? `auto (your system setting, currently ${resolved("auto")})` : s;

/* ---------- The browser chrome is part of the theme ----------
   `not all` never matches and `all` always does, so a pinned tag beats the OS
   whichever way round they disagree. The CONTENT is then re-read from
   `--surface-page` rather than left as the value in the markup — same rule as
   everything else that touches a themed colour in JS. */
function syncChrome(state: State): void {
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-theme-color]');
  if (!metas.length) return;
  const shown = resolved(state);
  const paper = getComputedStyle(root()).getPropertyValue("--surface-page").trim();
  for (const m of metas) {
    const forTheme = m.getAttribute("data-theme-color");
    m.media = state === "auto" ? `(prefers-color-scheme: ${forTheme})` : forTheme === state ? "all" : "not all";
    if (paper && forTheme === shown) m.setAttribute("content", paper);
  }
}

export function apply(state: State, { announce = true }: { announce?: boolean } = {}): void {
  if (state === "auto") root().removeAttribute("data-theme");
  else root().setAttribute("data-theme", state);
  syncChrome(state);

  try {
    if (state === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, state);
  } catch {
    /* nothing to do — the theme still applies for this visit */
  }

  const next = nextOf(state);
  for (const btn of document.querySelectorAll<HTMLElement>("[data-theme-toggle]")) {
    btn.dataset.state = state;
    // The control has no visible text — the dial carries the state — so the
    // accessible name carries the current state AND the consequence of
    // pressing, and it is not optional.
    btn.setAttribute("aria-label", `Theme: ${IS(state)}. Activate for ${TO(next)}.`);
  }

  if (announce) {
    window.dispatchEvent(new CustomEvent("themechange", { detail: { state, resolved: resolved(state) } }));
  }
}

/** Idempotent: the first toggle to mount starts it, the rest are along for the ride. */
export function startTheme(): void {
  if (started) return;
  started = true;

  document.addEventListener("click", (e) => {
    const btn = (e.target as Element | null)?.closest("[data-theme-toggle]");
    if (!btn) return;
    apply(nextOf(current()));
  });

  /* The OS flipping does two different things, and both have to happen. In
     auto it is a theme change like any other. Under a PINNED state it changes
     nothing on screen, but `nextOf` is computed against the system, so the
     target of the next press has just moved and the accessible name that
     promises it is now stale. `announce` stays gated on auto so `themechange`
     keeps meaning "the rendering actually changed". */
  media().addEventListener("change", () => apply(current(), { announce: current() === "auto" }));

  // Sync the control to what the inline script already painted.
  apply(current(), { announce: false });
}
