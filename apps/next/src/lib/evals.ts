/* ============================================================
   The shape of `evals/dist/page.json` — a hand-typed claim about a file this
   app does not own, exactly like src/lib/types.ts is for the corpus.

   `evals/run.mjs` writes three artefacts from one run: `evals/results.json`,
   the `<!-- content:evals-… -->` regions of `evals.html`, and this file. It is
   the SAME numbers, serialized so a second renderer does not have to parse HTML
   or re-derive anything — which is the whole reason /evals can exist on this
   surface at all without importing a line of the eval slice's code.

   TWO RULES COME WITH THE FILE AND ARE ENCODED IN THESE TYPES.

   1. EVERY STRING UNDER `regions` IS HTML, already escaped as it appears in
      evals.html. It is rendered as markup, never as React text and never
      escaped again — `p &lt; 0.0001` in the paired-test note and the <code>
      elements in the corpus rows are the live cases. The `Html` alias below is
      a `string` with that fact written on it; src/components/evals-regions.tsx
      is the only module that consumes one, and it puts every single one through
      dangerouslySetInnerHTML.

   2. `html` is NOT what this app renders. It is the exact line array written
      between that region's markers in evals.html, and it is here so a second
      renderer can PROVE it is showing the same thing byte for byte. Rendering
      it directly would make this page a copy of the vanilla page's output
      rather than a second consumer of the same data, and the structured fields
      beside it would go unverified. So it is typed, never read.

   Nothing here hard-codes a sample size or a half-width: n lives in
   `summary.questions`, the interval method and its note in `summary.confidence`,
   and each half-width beside the value it belongs to. Both have moved before.
   ============================================================ */

/** A string of HTML from the artefact. Render as markup; never escape again. */
export type Html = string;

export interface EvalsFact {
  value: Html;
  /** Rendered inside a `<small>` after the value. Empty for a bare count. */
  unit: Html;
  title: Html;
  label: Html;
}

export interface EvalsMetric {
  key: string;
  label: Html;
  value: Html;
  /** `±13.3`. Empty is possible and prints no interval rather than "±". */
  half: Html;
  /** The one leader in its group — `.chip--solid`, at most one per row. */
  best: boolean;
}

export interface EvalsArm {
  arm: Html;
  counterfactual: boolean;
  /** The metric key this arm leads, or null. `metrics[].best` is the renderer's. */
  best: string | null;
  metrics: EvalsMetric[];
}

/** An arm that did not run. A truthful row, never a substituted number. */
export interface EvalsSkippedArm {
  arm: Html;
  text: Html;
}

export interface EvalsPaired {
  a: Html;
  b: Html;
  wins: number;
  losses: number;
  discordant: number;
  counts: Html;
  p: Html;
  significant: boolean;
  verdict: Html;
  note: Html;
}

export interface EvalsSeparability {
  arm: Html;
  allPairs: Html;
  emptyDriven: Html;
  tied: Html;
  lostByRefusingAnAnswer: Html;
  /** null when no pair had two scores — the chip then says so. */
  scored: Html | null;
}

export interface EvalsCategory {
  category: Html;
  n: number;
  nLabel: Html;
  abstention: boolean;
  metric: Html;
  leader: string | null;
  arms: EvalsMetric[];
}

export interface FactsRegion {
  kind: "facts";
  facts: EvalsFact[];
  html: string[];
}

export interface ArmsRegion {
  kind: "arms";
  arms: EvalsArm[];
  skipped: EvalsSkippedArm | null;
  /** ONE paragraph, split across lines. Joined, never rendered as a list. */
  armsNote: Html[];
  paired: EvalsPaired[];
  pairedNote: Html[];
  separability: EvalsSeparability[];
  separabilityNote: Html[];
  html: string[];
}

export interface CategoriesRegion {
  kind: "categories";
  categories: EvalsCategory[];
  note: Html[];
  html: string[];
}

/** The owner's authored prose. Each entry is a complete `<p>…</p>`. */
export interface ProseRegion {
  kind: "prose";
  paragraphs: Html[];
  html: string[];
}

export interface DefinitionsRegion {
  kind: "definitions";
  rows: { term: Html; definition: Html }[];
  html: string[];
}

export interface EvalsSummary {
  corpus: {
    chunks: number;
    terms: number;
    avgdl: number;
    projects: number;
    experience: number;
    manifestChars: number;
  };
  questions: {
    total: number;
    retrieval: number;
    abstention: number;
    categories: Record<string, number>;
    shapes: Record<string, number>;
  };
  depth: { eval: number; production: number };
  confidence: { method: string; note: string };
  arms: string[];
  embeddings: string | null;
  embeddingsMeasured: boolean;
}

export interface EvalsPageData {
  generatedBy: string;
  version: number;
  contentVersion: string;
  corpusHash: string;
  questionsHash: string;
  source: unknown;
  summary: EvalsSummary;
  regions: {
    "evals-summary": FactsRegion;
    "evals-table": ArmsRegion;
    "evals-categories": CategoriesRegion;
    "evals-reading": ProseRegion;
    "evals-corpus": DefinitionsRegion;
  };
}
