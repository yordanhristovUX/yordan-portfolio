"use client";
/* The bar's clock — copied from js/main.js @ 2e84323 (the "Clock" block); fix
   upstream first.

   Same formatter, same 30-second tick. The timezone arrives as a prop rather
   than as a literal: it is `profile.identity.location.timezone` in the corpus,
   and a client component cannot read the corpus — src/lib/content.ts is
   `server-only` on purpose. So the server component that renders the bar looks
   it up and hands it down, and there is still exactly one place the zone is
   written down.

   It renders `--:--` first and fills in on mount, which is what the vanilla
   page does too: the markup ships the placeholder and a script replaces it.
   Here that is also what keeps the static export deterministic — a prerendered
   clock would be wrong the moment it was served. */
import { useEffect, useState } from "react";

const PLACEHOLDER = "--:--";

export function LocalTime({ timeZone }: { timeZone: string }) {
  const [time, setTime] = useState(PLACEHOLDER);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone });
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [timeZone]);

  return <time id="local-time">{time}</time>;
}
