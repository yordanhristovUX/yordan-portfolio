/* The three shapes every page repeats — markup reproduced from index.html and
   the generated work pages @ 2e84323. Not design-system components (they have
   no spec.md and no story, and are not new classes either): each is one
   element the pages already write by hand, given a name here so that the page
   files read as their own structure rather than as a list of divs. */
import { href } from "@/lib/routes";
import type { Link } from "@/lib/vanilla-copy";

/** The living separator between two bands. */
export function Strip() {
  return <div className="strip" aria-hidden="true" />;
}

/* Closes the plate on a lattice line. LAST CHILD OF THE BAND, ALWAYS: it is
   auto-placed, and the rails span its row via `.band:has(> .term)`. Its height
   is CSS's one-cell base plus the shortfall js/automata.js measures into
   --term-slack — which is why it is the only element on the page whose height
   is nobody's content, and why it stays here with the automata still to be
   ported: the CSS base is the part that draws. */
export function Term() {
  return <div className="term" aria-hidden="true" />;
}

/** A button-shaped anchor. `variant: "solid"` is the filled one. */
export function Btn({ link, className, style }: { link: Link; className?: string; style?: React.CSSProperties }) {
  const classes = ["btn", link.variant === "solid" ? "btn--solid" : "", className ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <a
      className={classes}
      href={href(link.href)}
      style={style}
      {...(link.external ? { target: "_blank", rel: "noopener" } : {})}
    >
      {link.label}
    </a>
  );
}

/** A plain link inside a `.link-grid` — no `.btn`, same external handling. */
export function GridLink({ link }: { link: Link }) {
  return (
    <a href={href(link.href)} {...(link.external ? { target: "_blank", rel: "noopener" } : {})}>
      {link.label}
    </a>
  );
}

/** A project's tags. The accent tag is the one solid chip in the row. */
export function Chips({ tags, accent }: { tags: string[]; accent?: string | null }) {
  return (
    <div className="chips">
      {tags.map((t) => (
        <span key={t} className={t === accent ? "chip chip--solid" : "chip"}>
          {t}
        </span>
      ))}
    </div>
  );
}
