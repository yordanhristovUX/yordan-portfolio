/* ============================================================
   One case study — the same page as work/<id>.html, from the same corpus.

   Five pages, one file, `generateStaticParams` over the case studies in
   content.json: a project page has no structure of its own beyond the one
   below, which is exactly why the vanilla generator emits the whole file
   rather than regions of it. Adding a sixth project to content/ adds a sixth
   page here with no code change, on both surfaces.

   WHAT THE CORPUS CANNOT TELL THIS FILE, and how it is handled.

   The vanilla page's body is rendered from `content/projects/*.md`, where a
   section is a sequence of blocks — paragraphs, lists, and `{{metric:0}}`,
   `{{media-grid:before,after}}`, `{{links}}` directives. content.json is built
   for RETRIEVAL, so `sections[].text` is that sequence flattened by `plain()`:
   the same words, in order, without the list markup, the emphasis, or the
   directives' positions. Everything the directives referenced is still in the
   corpus — `metrics`, `media`, `links` are all first-class arrays — so what is
   missing is placement, and placement is recoverable by rule:

     · the cover plate opens the body;
     · a metric's `.stat` line sits directly under the first `outcome` heading,
       which is where all three projects that have one put it;
     · the `.ph-grid` of remaining plates sits immediately before the LAST
       section, which is where all four projects that have one put it;
     · `{{links}}` closes the body.

   Those four rules reproduce all five vanilla pages. They are rules rather
   than data, and the honest way to retire them is upstream: publish
   `sections[].blocks` beside `sections[].text`. Until then a new project that
   arranges its directives differently will render them in this order instead
   of its own — the words will be right and the plates may move.
   ============================================================ */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { Fragment } from "react";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CaseBody } from "@yordan/design-system/react/case-body";
import { Media, MediaGrid, MediaLabel } from "@yordan/design-system/react/media";
import {
  SectionHead,
  SectionHeadHead,
  SectionHeadNote,
  sectionHeadTitle,
} from "@yordan/design-system/react/section-head";
import { Stat } from "@yordan/design-system/react/stat";

import { AppLink } from "@/components/AppLink";
import { AskAction, AskDrawer, AskFab } from "@/components/Ask";
import { Btn, Chips, Strip, Term } from "@/components/primitives";
import { SiteBar } from "@/components/SiteBar";
import { SiteMenu } from "@/components/SiteMenu";
import { caseStudies, neighbours, projectById, siteUrl } from "@/lib/content";
import { workUrl } from "@/lib/routes";
import type { Project, ProjectMedia } from "@/lib/types";
import { WORK_BAR, WORK_MENU_NAV, WORK_PAGER } from "@/lib/vanilla-copy";

import "@/styles/site/style.css";

export function generateStaticParams() {
  return caseStudies.map((p) => ({ id: p.id }));
}

const label = (p: Project) => `${p.client} — ${p.title}`;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = projectById(id);
  if (!project) return {};
  return {
    title: `${label(project)} — Yordan Hristov`,
    description: project.summary,
    alternates: { canonical: workUrl(project.id) },
    openGraph: {
      title: label(project),
      description: project.summary,
      type: "article",
      url: `${siteUrl}${workUrl(project.id)}`,
    },
    twitter: { card: "summary" },
  };
}

/* An empty plate with a caption — what a placeholder image degrades to when
   the real photograph has not been taken yet.

   BOTH CLASSES STAY, and neither is for components.css's sake. `.ph` is named
   by `.ph-grid .ph` — a frame inside the gallery gives up its own vertical
   margin — and `.ph__label` by `.ph:has(img) .ph__label`, the rule that hides
   the caption once real artwork arrives. Both are the media component's own
   scoped rules, and a scoped rule addresses its SINK by class even when its
   host is a utility: `[&_.ph]:m-0` on the grid, `[&:has(img)_.ph__label]:hidden`
   on the frame. That is the one thing about the React tier this cutover had to
   learn — the tier can express the relation but not the name it needs at the
   other end, so the name is written here. */
function Placeholder({ media }: { media: ProjectMedia }) {
  return (
    <Media className="ph">
      <MediaLabel className="ph__label">{media.caption}</MediaLabel>
    </Media>
  );
}

/* The one real diagram in the corpus. It is INLINED rather than <img>-ed
   because every stroke in it is `currentColor`: inside an <img> the file is a
   separate document, `color` does not inherit into it, and the diagram would
   be black on both themes — a colour that stops following the tokens is
   exactly what this repo does not allow. Read from this app's own public/
   directory, which scripts/sync-artifacts.mjs fills. */
function Diagram({ media }: { media: ProjectMedia }) {
  const svg = readFileSync(join(process.cwd(), "public", "assets", media.src ?? ""), "utf8").trim();
  return (
    <figure
      style={{
        border: "1px solid var(--chrome-border-strong)",
        background: "var(--surface-raised)",
        padding: "1.25rem",
        margin: "1.5rem 0",
        color: "var(--content-primary)",
        maxWidth: "none",
      }}
    >
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption
        className="mono"
        style={{
          fontSize: ".68rem",
          letterSpacing: ".08em",
          textTransform: "uppercase",
          color: "var(--chrome-label)",
          marginTop: ".75rem",
        }}
      >
        {media.caption}
      </figcaption>
    </figure>
  );
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = projectById(id);
  if (!project) notFound();

  const { prev, next } = neighbours(project.id);
  const cover = project.media.find((m) => m.slot === "cover");
  const diagrams = project.media.filter((m) => m.type === "svg");
  const plates = project.media.filter((m) => m !== cover && !diagrams.includes(m));
  const firstOutcome = project.sections.find((s) => s.kind === "outcome");
  const lastSection = project.sections[project.sections.length - 1];

  /* A diagram belongs to the section that introduces it, and the only handle
     the corpus offers is its slot name — "pipeline" against "The pipeline".
     Anything unclaimed falls through to the plate grid rather than vanishing. */
  const diagramFor = (heading: string) =>
    diagrams.filter((d) => heading.toLowerCase().includes(d.slot.toLowerCase()));
  const claimed = new Set(project.sections.flatMap((s) => diagramFor(s.heading)));
  const orphanPlates = [...plates, ...diagrams.filter((d) => !claimed.has(d))];

  return (
    <>
      <SiteBar id={WORK_BAR.id} nav={[...WORK_BAR.nav]} action={<AskAction />} />
      <SiteMenu nav={WORK_MENU_NAV} />
      <AskFab />

      <main className="sheet" id="top">
        <SectionHead className="band sec work" aria-labelledby="work-title">
          {/* THE TITLE IS AN <h1> HERE AND `SectionHeadTitle` RENDERS AN <h2>,
              because the canonical HTML in components/section-head/spec.md is
              the index page's — a section heading under a page heading. A case
              study's section head IS the page heading, which is a document
              fact rather than an appearance one, so the class map is applied
              to this page's own element via `sectionHeadTitle()`. That is the
              same reconciliation `Btn` makes for `href`, and the cva function
              is exported beside the component precisely for it. */}
          <SectionHeadHead className="sec__head">
            <h1 className={sectionHeadTitle({ className: "t-title" })} id="work-title">
              {project.title}
            </h1>
            {project.client ? <SectionHeadNote>{project.client}</SectionHeadNote> : null}
          </SectionHeadHead>
          <div className="well">
            <p className="t-lead">{project.subtitle}</p>
            <Chips tags={project.tags} accent={project.accentTag} />
            <CaseBody>
              {cover ? <Placeholder media={cover} /> : null}

              {project.sections.map((s) => (
                /* A FRAGMENT, NOT A DIV, and it is load-bearing:
                   `.case-body h3:first-child` drops the rule and the space
                   above the first heading. Wrap each section in an element and
                   every heading becomes its parent's first child, so every
                   heading loses its rule — the vanilla page's flat body is the
                   shape that CSS was written against. */
                <Fragment key={s.kind + s.heading}>
                  {/* The plate grid closes the section BEFORE the last one on
                      every vanilla page that has one, so it is rendered above
                      this heading rather than under it. */}
                  {s === lastSection && orphanPlates.length ? (
                    <MediaGrid>
                      {orphanPlates.map((m) => (
                        <Placeholder key={m.slot} media={m} />
                      ))}
                    </MediaGrid>
                  ) : null}
                  <h3>{s.heading}</h3>
                  {s === firstOutcome
                    ? project.metrics.map((m) => (
                        <p key={m.value}>
                          <Stat>{m.value}</Stat>
                        </p>
                      ))
                    : null}
                  {diagramFor(s.heading).map((d) => (
                    <Diagram key={d.slot} media={d} />
                  ))}
                  {s.text ? <p>{s.text}</p> : null}
                  {s === lastSection && project.links.length ? (
                    <p>
                      {project.links.map((l, i) => (
                        <Btn
                          key={l.href}
                          link={{ ...l, variant: l.variant === "solid" ? "solid" : undefined }}
                          style={i < project.links.length - 1 ? { marginRight: ".6rem" } : undefined}
                        />
                      ))}
                    </p>
                  ) : null}
                </Fragment>
              ))}
            </CaseBody>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        <SectionHead className="band sec" aria-label="More work">
          <div className="well work__nav">
            {prev ? (
              <AppLink className="work__prev" href={workUrl(prev.id)}>
                <span className="mono">{WORK_PAGER.prev}</span> {prev.title}
              </AppLink>
            ) : null}
            {next ? (
              <AppLink className="work__next" href={workUrl(next.id)}>
                <span className="mono">{WORK_PAGER.next}</span> {next.title}
              </AppLink>
            ) : null}
          </div>
          <Term />
        </SectionHead>
      </main>

      <AskDrawer />
    </>
  );
}
