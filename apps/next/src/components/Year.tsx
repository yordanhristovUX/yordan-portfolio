"use client";
/* The footer's year — copied from js/main.js and js/cv.js @ 2e84323 (`$("#year")
   .textContent = new Date().getFullYear()`); fix upstream first.

   The fallback in the markup is the generator's `profile.footer.fallbackYear`,
   reproduced in src/lib/vanilla-copy.ts. It is what a reader with JS off sees,
   and it is deliberately a real year rather than an empty span: a copyright
   line with a hole in it is worse than one a year out of date. */
import { useEffect, useState } from "react";

export function Year({ fallback }: { fallback: string }) {
  const [year, setYear] = useState(fallback);

  useEffect(() => {
    setYear(String(new Date().getFullYear()));
  }, []);

  return <span id="year">{year}</span>;
}
