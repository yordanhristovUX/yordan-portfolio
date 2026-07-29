/* ============================================================
   build-vectors.mjs — embed the corpus once, commit the result

   content/dist/content.json  →  content/dist/vectors.json

   The eval measures embeddings at 91.8% hit@3 against BM25's 67.3% — a 12-0
   win on exact two-sided McNemar, p = 0.0005 — and it still wins every
   retrieval class. This is what makes that ranker available at runtime.

   THOSE TWO FIGURES ARE DATED, ON PURPOSE. They are the corpus-9530564fdc07971c
   run in evals/results.json, re-derived after the owner's rewrite took the index
   from 76 chunks to 70; the previous pair (93.0% / 74.4%) sat in this header
   describing a corpus that no longer existed. Nothing checks a number in a
   comment, so re-read evals/results.json rather than trusting this line.

   WHY THIS IS A SEPARATE SCRIPT and not part of build-content.mjs: this one
   needs a network call and an API key. build-content.mjs is zero-dependency
   and offline, and it stays that way — a content build that silently depends
   on a third-party API being up is a content build that will fail on the day
   you most need it. Vectors change only when chunk text changes, which is
   rare, so paying for them on every content build would be wrong anyway.

   The output is COMMITTED, like every other generated artefact in this repo.
   That is what lets the site, the eval and CI all use embeddings without a
   key. A key is needed only to REBUILD, and only when chunk text has changed.

   Anthropic has no embeddings endpoint; Voyage is the partner model.

     node --env-file=.env scripts/build-vectors.mjs
     node scripts/build-vectors.mjs --check     # stale? (no key needed)

   THERE IS A SECOND VECTOR CACHE AND THIS SCRIPT DOES NOT TOUCH IT.
   `evals/vectors.json` holds the eval's own chunk AND question vectors, and it
   is rebuilt only by `node --env-file=.env evals/run.mjs`. So the obvious
   workflow after a content edit — rebuild content, run this, run CI — used to
   leave the eval's cache stale with every gate green, and the published
   retrieval numbers described a corpus that no longer existed. Both files now
   carry the same `corpusHash` and both have a `--check` that compares it, so
   the staleness is loud in either place; but the two commands are still
   separate and this note is the only thing that says so at the point someone
   runs one of them.

     node --env-file=.env scripts/build-vectors.mjs   # the RUNTIME ranker's vectors
     node --env-file=.env evals/run.mjs               # the EVAL's vectors
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT = join(root, "content", "dist", "content.json");
const OUT = join(root, "content", "dist", "vectors.json");
const CHECK = process.argv.includes("--check");

const MODEL = "voyage-3.5";
const URL_ = "https://api.voyageai.com/v1/embeddings";

const content = JSON.parse(readFileSync(CONTENT, "utf8"));

/* The exact text that gets embedded. Heading plus body: the heading carries
   real signal ("Outcomes", "Information architecture") that the body often
   does not repeat. Must match what the eval embeds, or the published numbers
   describe a different retriever than the one that ships. */
const texts = content.chunks.map((c) => `${c.heading}. ${c.text}`);

/* The separator is a NUL, not a space, and this constant exists so that fact
   survives being read. Written literally it renders as texts.join(" ") in every
   editor, in git diff and in a plain file read — indistinguishable from a space.
   Anyone reimplementing this hash from the source would therefore compute a
   DIFFERENT digest, declare a current cache stale, and embedRank() would return
   null on every request: search silently falls back to BM25 at 67.3% hit@3
   behind answers that look identical to the 91.8% ones. NUL is the right choice
   — it cannot occur in chunk text, so no reword can forge a boundary — but it
   must be visible. Changing this value invalidates every committed vector cache
   and costs a billed rebuild. */
const SEP = "\u0000";

/* Fingerprint of the corpus this cache was built for. Comparing a hash rather
   than a length means rewording a chunk invalidates the cache, which a count
   would silently miss. */
const corpusHash = createHash("sha256").update(texts.join(SEP)).digest("hex").slice(0, 16);

const existing = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : null;
const fresh = existing?.corpusHash === corpusHash && existing?.model === MODEL;

if (CHECK) {
  if (fresh) {
    console.log(`✓ vectors check          (${existing.vectors.length} chunks, ${MODEL}, corpus ${corpusHash})`);
    process.exit(0);
  }
  console.error(
    `✗ content/dist/vectors.json is stale — chunk text changed since it was built.\n` +
      `  Retrieval will fall back to BM25 until it is rebuilt (~25pp worse on hit@3).\n` +
      `  Rebuild with:  node --env-file=.env scripts/build-vectors.mjs`
  );
  process.exit(1);
}

if (fresh) {
  console.log(`✓ content/dist/vectors.json (already current — ${existing.vectors.length} chunks, corpus ${corpusHash})`);
  process.exit(0);
}

const key = process.env.VOYAGE_API_KEY;
if (!key) {
  console.error(
    `✗ VOYAGE_API_KEY is not set, and content/dist/vectors.json is missing or stale.\n` +
      `  Run:  node --env-file=.env scripts/build-vectors.mjs`
  );
  process.exit(1);
}

/* Voyage caps a request at 128 inputs; 70 chunks fits in one, but batching
   keeps this correct if the corpus grows. */
const vectors = [];
for (let i = 0; i < texts.length; i += 96) {
  const batch = texts.slice(i, i + 96);
  const res = await fetch(URL_, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: MODEL, input: batch, input_type: "document" }),
  });
  if (!res.ok) {
    console.error(`✗ Voyage ${res.status}: ${(await res.text()).slice(0, 300)}`);
    process.exit(1);
  }
  const json = await res.json();
  for (const d of json.data.sort((a, b) => a.index - b.index)) vectors.push(d.embedding);
}

writeFileSync(
  OUT,
  JSON.stringify({
    $generatedBy: "scripts/build-vectors.mjs — do not edit",
    model: MODEL,
    dims: vectors[0]?.length ?? 0,
    corpusHash,
    chunkIds: content.chunks.map((c) => c.id),
    vectors,
  })
);

console.log(`✓ content/dist/vectors.json (${vectors.length} chunks × ${vectors[0]?.length} dims, ${MODEL}, corpus ${corpusHash})`);
