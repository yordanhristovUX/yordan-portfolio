/* ============================================================
   Where a link written for the vanilla site points on this one.

   A content author writes `[the evals](evals.html)` because that is correct
   from the vanilla index, where it is also correct on paper and in llms.txt.
   `scripts/build-content.mjs` rebases it to `/evals.html` for the pages served
   one directory down, "because the renderer is the thing that knows where it
   is serving from". This app is another renderer with another URL shape —
   clean routes, no `.html` — so it rebases the same reference once more, in
   one place, for the same reason.

   THE LABEL IS THE OWNER'S AND IS NEVER TOUCHED; only the destination is this
   app's decision.

   `/evals` does not exist yet — the eval page is a later phase. The link is
   left pointing at where it will be rather than removed, because removing it
   would edit the contact block's copy, which is not this app's to edit.
   ============================================================ */
const ROUTES: Record<string, string> = {
  "index.html": "/",
  "cv.html": "/cv",
  "mcp.html": "/mcp",
  "evals.html": "/evals",
};

/** Absolute URLs, anchors, mailto:, tel: and root-relative paths pass through. */
export function href(raw: string): string {
  if (/^(https?:|mailto:|tel:|#|\/)/.test(raw)) return raw;
  return ROUTES[raw] ?? `/${raw}`;
}

export const workUrl = (id: string): string => `/work/${id}`;

/* ---------- what this app's router owns ----------
   A reference is this app's route when it starts with a single `/`: `/cv`,
   `/work/<id>`, and `/#work`, which is the index plus a fragment. Everything
   else belongs to somewhere else — an absolute URL, a mailto:, a tel:, or a
   bare `#anchor`, which is a position on the page already open and not a
   navigation at all. src/components/AppLink.tsx is the only caller. */
export const isRoute = (raw: string): boolean => /^\/(?!\/)/.test(raw);

/* Routes this app links to and does not build yet. `/evals` is Phase 6; the
   label is the owner's and the link stays pointing at where the page will be.

   Nothing reads this today, because src/components/AppLink.tsx turns prefetch
   off for EVERY route — see the measurement in its header. It is written down
   rather than dropped because the two reasons are independent: when Next fixes
   its export/prefetch separator mismatch and that blanket line can go, this
   route must still never be prefetched, or the fix ships a 404 on every page
   that carries the link. Delete this when the eval page lands. */
export const UNBUILT_ROUTES = ["/evals"];

export const isUnbuilt = (raw: string): boolean =>
  UNBUILT_ROUTES.some((r) => raw === r || raw.startsWith(`${r}#`) || raw.startsWith(`${r}/`));
