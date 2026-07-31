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
