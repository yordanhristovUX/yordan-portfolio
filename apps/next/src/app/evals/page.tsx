/* ============================================================
   The retrieval evaluation page — skeleton reproduced from evals.html @ cace793,
   numbers rendered from evals/dist/page.json.

   TWO KINDS OF WORD LIVE ON THIS PAGE and they arrive by two different routes,
   exactly as they do on the vanilla one.

   The GENERATED half — the four facts, the three measurement tables, the
   per-class table, the reading prose and the corpus rows — is everything
   `evals/run.mjs` writes between evals.html's `<!-- content:evals-… -->`
   markers. Here it comes from page.json, the same run's structured
   serialization of the same figures, through src/components/evals-regions.tsx.
   Not one number is typed in this file, and none is derived either: a rate, a
   half-width, a p-value or a sample size that this app computed would be a
   second opinion about a measurement, which is the one thing a second surface
   must never be.

   The HAND-AUTHORED half — the head, the section headings and notes, the
   Method section, and the two glossary notes that sit outside the regions — is
   the owner's, written in evals.html itself and in no other artefact. It is
   copied character for character at the commit above, the same route
   src/lib/vanilla-copy.ts and the /mcp page take and for the same reason. If a
   sentence changes upstream this file is stale and gets re-copied; it is never
   reworded here, and no sentence is written for this surface that the vanilla
   page does not have.

   THE IMPORT IS A STATIC `import`, NOT readFileSync, and the literal below is
   the one pinned in scripts/check-boundaries.mjs's CROSSINGS list — five levels
   up from src/app/evals/ is the repo root. src/lib/content.ts's header records
   the measurement behind the choice: Turbopack rewrites `new URL(…,
   import.meta.url)` into an emitted asset and the read fails, while
   `process.cwd()` plus a join would make the crossing invisible to the gate
   that pins it. An import is a reference the gate resolves exactly as written.
   ============================================================ */
import type { Metadata } from "next";

import { ArmsTable, CategoryTable, CorpusRows, ReadingProse, SummaryFacts } from "@/components/evals-regions";
import { Strip, Term } from "@/components/primitives";
import { SiteBar } from "@/components/SiteBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMenu } from "@/components/SiteMenu";
import { siteUrl } from "@/lib/content";
import type { EvalsPageData } from "@/lib/evals";
import { FOOTER, MENU } from "@/lib/vanilla-copy";

import pageJson from "../../../../../evals/dist/page.json";

import "@/styles/site/evals.css";

/* The shape is asserted, not assumed — src/lib/evals.ts is a hand-typed claim
   about a file this app does not own, and an unchecked claim is a comment. A
   region that has changed kind or lost its rows fails the build naming itself,
   instead of rendering an empty table under a heading that promises numbers. */
function load(): EvalsPageData {
  const data = pageJson as unknown as EvalsPageData;
  const wrong: string[] = [];
  const check = (name: string, ok: unknown) => {
    if (!ok) wrong.push(name);
  };
  const r = data.regions ?? ({} as EvalsPageData["regions"]);
  check("summary.questions.retrieval", data.summary?.questions?.retrieval);
  check("summary.confidence.note", data.summary?.confidence?.note);
  check("regions['evals-summary'].facts[]", r["evals-summary"]?.facts?.length);
  check("regions['evals-table'].arms[]", r["evals-table"]?.arms?.length);
  check("regions['evals-table'].separability[]", r["evals-table"]?.separability?.length);
  check("regions['evals-categories'].categories[]", r["evals-categories"]?.categories?.length);
  check("regions['evals-reading'].paragraphs[]", r["evals-reading"]?.paragraphs?.length);
  check("regions['evals-corpus'].rows[]", r["evals-corpus"]?.rows?.length);
  if (wrong.length) {
    throw new Error(
      `evals/dist/page.json: expected ${wrong.join(", ")}.\n` +
        `  The eval artefact has changed shape under apps/next. Re-read it, correct ` +
        `src/lib/evals.ts and this file — never loosen the type to make the build pass, ` +
        `and never substitute a number from anywhere else.`
    );
  }
  return data;
}

const evals: EvalsPageData = load();

export const metadata: Metadata = {
  title: "Retrieval evaluation — Yordan Hristov",
  description:
    "Four retrieval arms measured on a golden question set over this site's own content index: hit@k, MRR and correct abstention. The evidence for choosing structured retrieval over a vector database.",
  alternates: { canonical: "/evals" },
  openGraph: {
    title: "Retrieval evaluation — Yordan Hristov",
    description:
      "hit@k, MRR and abstention across four retrieval arms. The eval that justifies not using a vector database.",
    type: "article",
    url: `${siteUrl}/evals`,
  },
  twitter: { card: "summary" },
};

const BAR = {
  id: { label: "← Home", href: "/" },
  nav: [
    { label: "Results", href: "#results" },
    { label: "By class", href: "#classes" },
    { label: "Reading", href: "#reading" },
  ],
};

const MENU_NAV = [{ label: MENU.home, href: "/" }, ...BAR.nav];

export default function Page() {
  const regions = evals.regions;

  return (
    <>
      <SiteBar id={BAR.id} nav={BAR.nav} />
      <SiteMenu nav={MENU_NAV} />

      <main id="top" className="sheet">
        {/* ============ HEAD ============ */}
        <section className="band ev-head" aria-label="Introduction">
          <div className="well">
            <p className="ev-head__kicker t-label">Retrieval evaluation</p>
            <h1 className="ev-head__title t-display t-display--lg">Sized to the corpus</h1>
            <p className="ev-head__lede t-lead">
              This site&apos;s assistant retrieves through typed tools over a generated content index,
              not through a vector database. That was a decision, so it gets an experiment rather
              than an assertion — four retrieval arms, one golden question set, published numbers.
            </p>
            <div className="ev-prose">
              <p>
                Anyone can wire a vector database. Almost nobody publishes the evaluation that says
                they did not need one. The deliverable here is not <em>“I chose simple”</em>; it is{" "}
                <strong>“I measured retrieval against the corpus, and here is the table.”</strong>{" "}
                The arms are measured on the same questions with the same scoring, and the honest
                result is reported even where it embarrasses the design.
              </p>
            </div>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 01 · RESULTS ============ */}
        <section id="results" className="band sec" aria-labelledby="results-title">
          <header className="sec__head">
            <h2 id="results-title" className="sec__title t-title">
              Results
            </h2>
            <span className="sec__note">Regenerated by evals/run.mjs on every run</span>
          </header>
          <div className="well">
            <div className="ev-facts">
              <SummaryFacts region={regions["evals-summary"]} />
            </div>

            <ArmsTable region={regions["evals-table"]} />

            <p className="ev-note">
              hit@k · the right chunk within the top k — ent@k · the right project or role within
              the top k — MRR · mean reciprocal rank — abstain · returned nothing when nothing
              should be returned — separability · whether any score cut tells an answerable
              question from an unanswerable one; 0.5 is chance
            </p>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 02 · METHOD ============ */}
        <section id="method" className="band sec" aria-labelledby="method-title">
          <header className="sec__head">
            <h2 id="method-title" className="sec__title t-title">
              Method
            </h2>
            <span className="sec__note">Offline, free, no API key, runs in CI</span>
          </header>
          <div className="well">
            <div className="ev-prose">
              <p>
                <strong>The arms.</strong> <code>tools-only</code> navigates by name — every project
                id, title, client and tag is already in the assistant&apos;s system prompt, so it matches
                the question against that surface and reads the entity it finds. <code>bm25</code> is
                Okapi BM25 over term statistics precomputed at build time. <code>hybrid</code> puts
                tools first and appends BM25 beneath, which was the shape originally proposed for
                production. <code>tools-gated</code> keeps BM25&apos;s ranking but lets the name match
                decide only <em>whether</em> to answer at all. <code>embeddings</code> is Voyage,
                implemented and gated behind an API key; without the key it skips and says so rather
                than being replaced by a cosine similarity wearing a semantic label.
              </p>
              <p>
                <strong>Two hit rates, because they measure different failures.</strong>{" "}
                <code>hit@k</code> asks whether the right <em>chunk</em> came back; <code>ent@k</code>{" "}
                asks whether the right <em>project or role</em> did. An arm that answers “what was
                Domestina about?” with the Domestina research section found the right thing and chose
                the wrong paragraph of it, and one number should not hide that from the other.
              </p>
              <p>
                <strong>The questions.</strong> Written as a person would ask them, and grounded in
                the real corpus — the runner refuses to start if any expected chunk id does not
                exist in the index. Roughly a fifth of them are questions the corpus{" "}
                <em>cannot</em> answer, because a retriever that never abstains is a retriever that
                will confidently answer anything.
              </p>
              <p>
                <strong>What is deliberately not measured here.</strong> Citation validity in a real
                answer, turns per answer, latency and cost per answer all need a live model. They
                belong with the chat endpoint, not with the retriever. hit@k, MRR and abstention are
                properties of retrieval alone, so this suite is free, offline, deterministic, and
                runs on every commit — which is the only reason an eval suite survives contact with
                a real project.
              </p>
              <p>
                <strong>Nothing here is tuned on these questions.</strong> BM25 keeps the standard{" "}
                <code>k1 = 1.2</code>, <code>b = 0.75</code>. The tools arm weights a matched name by
                its inverse document frequency in the corpus, a statistic that comes from the index
                rather than from the test set. Abstention is reported threshold-free: separability is
                the fraction of answerable/unanswerable question pairs that <em>any</em> score cut
                would order correctly, so no magic number is chosen after seeing the answers.
              </p>
            </div>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 03 · BY QUESTION CLASS ============ */}
        <section id="classes" className="band sec" aria-labelledby="classes-title">
          <header className="sec__head">
            <h2 id="classes-title" className="sec__title t-title">
              By question class
            </h2>
            <span className="sec__note">hit@3, except abstention classes</span>
          </header>
          <div className="well">
            <CategoryTable region={regions["evals-categories"]} />

            <p className="ev-note">
              structured-only · answerable from content.json but not present in any chunk —
              corpus-gap · an entity that exists yet produced no chunk —
              out-of-corpus · not in the corpus at all
            </p>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 04 · READING THE NUMBERS ============ */}
        <section id="reading" className="band sec sec--tint" aria-labelledby="reading-title">
          <header className="sec__head">
            <h2 id="reading-title" className="sec__title t-title">
              Reading the numbers
            </h2>
            <span className="sec__note">Including the parts that went badly</span>
          </header>
          <div className="well">
            <ReadingProse region={regions["evals-reading"]} />
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 05 · THE CORPUS ============ */}
        <section id="corpus" className="band sec" aria-labelledby="corpus-title">
          <header className="sec__head">
            <h2 id="corpus-title" className="sec__title t-title">
              The corpus
            </h2>
            <span className="sec__note">Generated from content/, never hand-written</span>
          </header>
          <div className="well">
            <CorpusRows region={regions["evals-corpus"]} />

            <p className="ev-note">
              Reproduce · node evals/run.mjs — no API key, no network, no dependencies
            </p>
          </div>
          <Term />
        </section>
      </main>

      <SiteFooter link={FOOTER.cv} />
    </>
  );
}
