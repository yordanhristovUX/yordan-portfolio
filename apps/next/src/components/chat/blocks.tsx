"use client";
/* ============================================================
   Answer blocks → design-system markup.

   PORTED FROM js/answer-render.js @ 2e84323; fix upstream first. Every class
   name, every element and every source order below is that file's, because the
   markup is the design system's contract and a second surface that drifts from
   it is not a second surface, it is a fork.

   Two rules that are not style preferences:

     1. `prose` is written as TEXT, never as markup. The output schema already
        means the model cannot emit markup; JSX escaping makes it true twice,
        the same way `textContent` does in the original.
     2. AN ID THAT DOES NOT RESOLVE RENDERS NOTHING. The server already dropped
        unresolvable ids (gate 2); if one reaches here the page stays silent
        rather than inventing a placeholder. `renderBlock` returns null and the
        caller does not count it — which is also why the "no answer survived
        validation" verdict in useChat is computed from what actually rendered.

   THIS FILE KEPT `.chip`, `.chips` AND `.stat` THROUGH THE R2b SWAP, and that
   is the same rule as the paragraph above rather than an omission. Pipeline 2
   — <Chip>, <Stat> from @yordan/design-system/react — replaced the class names
   at every JSX USE SITE in this app; a renderer whose job is to reproduce
   js/answer-render.js's markup is not a use site, it is a copy, and a copy that
   emits different classes from its source has drifted. The elements below stay
   styled by components.css until the vanilla renderer moves too.

   THE ONE PORT DIFFERENCE, and it is routing rather than content: hrefs that
   the corpus writes for the vanilla site (`evals.html`, `mcp.html`) are put
   through `href()` from src/lib/routes.ts, and internal ones render through
   AppLink so a citation behaves like every other link in this app. The label,
   the id and the destination PAGE are the corpus's; only the URL shape is
   this app's, which is the same rebase every other page here does.
   ============================================================ */
import { Fragment } from "react";

import { AppLink } from "@/components/AppLink";
import type { CorpusIndex } from "@/lib/chat/corpus";
import type { AnswerBlock } from "@/lib/chat/types";
import { href, workUrl } from "@/lib/routes";

/* ---------- prose — the one block with the model's own words ---------- */
function Prose({ block }: { block: AnswerBlock }) {
  return <p className="chat__prose">{block.text}</p>;
}

/* ---------- project — a real `.idx__row`, and a real link ----------
   A card-only project has no page, so it stays a plain `div`: a link to
   nowhere is worse than no link. */
function renderProject(corpus: CorpusIndex, block: AnswerBlock) {
  const p = corpus.project.get(String(block.id));
  if (!p) return null;

  const openable = Boolean(p.hasCaseStudy);
  const name = (
    <span className="idx__name">
      {(p.indexClient || p.client || p.title) + " "}
      {p.client || p.indexClient ? <em>{"— " + (p.indexTitle || p.title)}</em> : null}
    </span>
  );
  const inner = (
    <>
      <span className="idx__no mono">{String(p.index ?? "").padStart(2, "0")}</span>
      <span className="idx__main">
        {name}
        <span className="idx__desc">{p.summary}</span>
      </span>
      <span className="idx__tags">
        {(p.indexTags || p.tags || []).slice(0, 3).map((t) => (
          <span className="chip" key={t}>
            {t}
          </span>
        ))}
      </span>
      {openable ? (
        <span className="idx__go mono" aria-hidden="true">
          View →
        </span>
      ) : null}
    </>
  );

  return (
    <ul className="idx" role="list">
      <li>
        {openable ? (
          <AppLink className="idx__row" href={workUrl(p.id)}>
            {inner}
          </AppLink>
        ) : (
          <div className="idx__row">{inner}</div>
        )}
      </li>
    </ul>
  );
}

/* ---------- experience — the real CV entry ----------
   Source order is role → span → org, which is the reading order. */
function renderExperience(corpus: CorpusIndex, block: AnswerBlock) {
  const e = corpus.experience.get(String(block.entryId));
  if (!e) return null;

  return (
    <article className="entry">
      <h3 className="entry__role">{e.role}</h3>
      <p className="entry__span">{e.span}</p>
      <p className="entry__org">
        {e.org + " "}
        {e.descriptor ? <em>{"— " + e.descriptor}</em> : null}
      </p>
      {e.bullets?.length ? (
        <ul className="entry__list">
          {e.bullets.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/* ---------- facts — the profile <dl> ----------
   Term ids are profile rows ("Focus") or personal fact ids ("endurance"); the
   two sets are disjoint. A fact is its label and nothing else. */
function renderFacts(corpus: CorpusIndex, block: AnswerBlock) {
  const rows = (block.termIds ?? [])
    .map((id) => {
      const row = corpus.profileTerm.get(id);
      const fact = row ? null : corpus.fact.get(id);
      if (!row && !fact) return null;
      return {
        id,
        term: row ? row.term : fact!.title,
        value: row ? row.value : fact!.label,
        ok: Boolean(row && /^open/i.test(row.value)),
      };
    })
    .filter(Boolean) as { id: string; term: string; value: string; ok: boolean }[];

  if (!rows.length) return null;
  return (
    <dl className="profile mono">
      {rows.map((r) => (
        <div key={r.id}>
          <dt>{r.term}</dt>
          <dd className={r.ok ? "is-ok" : undefined}>{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------- metric — the framed headline number, inside prose ---------- */
function renderMetric(corpus: CorpusIndex, block: AnswerBlock) {
  const p = corpus.project.get(String(block.projectId));
  const m = p?.metrics?.[Number(block.metricIndex)];
  if (!m) return null;
  return (
    <p className="chat__metric">
      <span className="stat">{m.value}</span>
      {m.label}
    </p>
  );
}

/* ---------- tags — chips ----------
   The spec allows at most one `--solid` per group, and nothing here has earned
   emphasis, so none of them get it. */
function renderTags(block: AnswerBlock) {
  const labels = block.labels ?? [];
  if (!labels.length) return null;
  return (
    <div className="chips">
      {labels.map((label, i) => (
        <span className="chip" key={`${label}-${i}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

/* ---------- links — link-grid. Ids are "<projectId>:<index>" ---------- */
function renderLinks(corpus: CorpusIndex, block: AnswerBlock) {
  const links = (block.linkIds ?? [])
    .map((id) => {
      const at = String(id).lastIndexOf(":");
      const p = corpus.project.get(String(id).slice(0, at));
      const link = p?.links?.[Number(String(id).slice(at + 1))];
      return link ? { id: String(id), link } : null;
    })
    .filter(Boolean) as { id: string; link: { label: string; href: string; external?: boolean } }[];

  if (!links.length) return null;
  return (
    <div className="link-grid">
      {links.map(({ id, link }) => (
        <AppLink
          key={id}
          href={href(link.href)}
          {...(link.external ? { target: "_blank", rel: "noopener" } : {})}
        >
          {link.label}
        </AppLink>
      ))}
    </div>
  );
}

/* ---------- media — the labelled placeholder frame ---------- */
function renderMedia(corpus: CorpusIndex, block: AnswerBlock) {
  const p = corpus.project.get(String(block.projectId));
  const slot = p?.media?.find((m) => m.slot === block.slot);
  if (!slot) return null;
  return (
    <figure className="ph">
      <span className="ph__label">{slot.caption}</span>
    </figure>
  );
}

/* ---------- sources — the citation list ----------
   Every id here survived the provenance gate, so each one names a passage a
   tool actually returned. Collapsed, like the tool trace: it can be the single
   largest element of an answer, and it is evidence to be checked rather than
   prose to be read. The count is on the summary so its size is visible without
   opening it.

   Every source is a link. A citation that opened a modal could not be copied,
   opened in a tab, or followed by anything but a mouse — a strange property
   for the part of the answer whose entire job is "here is where this came
   from". A cited case study points at its page; everything else keeps its own
   cite page and anchor. */
function renderSources(corpus: CorpusIndex, block: AnswerBlock) {
  const chunks = (block.chunkIds ?? []).map((id) => corpus.chunk.get(id)).filter(Boolean);
  if (!chunks.length) return null;

  return (
    <details className="sources">
      <summary className="sources__title mono">
        {chunks.length === 1 ? "1 source" : chunks.length + " sources"}
      </summary>
      <ol className="sources__list">
        {chunks.map((c, i) => {
          const chunk = c!;
          const label =
            (chunk.cite?.label ? chunk.cite.label + " — " : "") + (chunk.heading || chunk.kind);
          const project = chunk.cite?.project;
          const hasPage = Boolean(project && corpus.project.get(project)?.hasCaseStudy);
          const to = hasPage
            ? workUrl(String(project))
            : (chunk.cite?.page || "/") + (chunk.cite?.anchor || "");
          return (
            <li className="source" key={chunk.id}>
              <span className="source__ref mono">{String(i + 1)}</span>
              <AppLink className="source__link" href={href(to)}>
                {label}
              </AppLink>
              <span className="source__id mono">{chunk.id}</span>
            </li>
          );
        })}
      </ol>
    </details>
  );
}

/**
 * One block → one element, or null when nothing resolves.
 * The caller must have a loaded corpus; `null` means "render nothing", and it
 * is also what stops the block being counted.
 */
export function renderBlock(corpus: CorpusIndex, block: AnswerBlock): React.ReactElement | null {
  if (!block || !block.type) return null;
  try {
    switch (block.type) {
      case "prose":
        return <Prose block={block} />;
      case "project":
        return renderProject(corpus, block);
      case "experience":
        return renderExperience(corpus, block);
      case "facts":
        return renderFacts(corpus, block);
      case "metric":
        return renderMetric(corpus, block);
      case "tags":
        return renderTags(block);
      case "links":
        return renderLinks(corpus, block);
      case "media":
        return renderMedia(corpus, block);
      case "sources":
        return renderSources(corpus, block);
      default:
        return null;
    }
  } catch {
    /* A malformed block is a dropped block, never a broken page. */
    return null;
  }
}

/** The rendered answer, in arrival order. */
export function AnswerBlocks({ nodes }: { nodes: { key: number; node: React.ReactElement }[] }) {
  return (
    <>
      {nodes.map((n) => (
        <Fragment key={n.key}>{n.node}</Fragment>
      ))}
    </>
  );
}
