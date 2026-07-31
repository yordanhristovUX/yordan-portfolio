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

/* THE UNBUILT-ROUTE EXCEPTION IS GONE, because there is no unbuilt route left:
   `/evals` was the only entry and it is now a page. What stays is the blanket
   `prefetch={false}` in src/components/AppLink.tsx, and it stays for its own
   reason — Next 16.2.12's segment-cache prefetch and its `output: export`
   writer disagree about a separator, measured there. The two were always
   independent; this one has simply run out. */
