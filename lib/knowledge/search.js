/* ============================================================
   BM25 over the precomputed term statistics in content.json.

   Zero dependencies, zero I/O, zero network. Everything this needs was
   computed at build time by scripts/build-content.mjs: per-chunk term
   frequencies (`tf`), document frequencies (`df`), the corpus size (`N`) and
   the mean document length (`avgdl`). Query time is therefore a loop over the
   query's terms and a lookup — which is the whole argument for not standing up
   a service to do it.

   The tokeniser below is the SAME normaliser the index was built with. That is
   not a style preference: a query tokeniser that disagrees with the index
   tokeniser loses recall silently, on exactly the terms that matter most
   (`WCAG 2.1 AA`, `200+`, `1:1`, `p5.js`). Because the two live either side of
   a module boundary — the index is built in scripts/, queried in lib/ — the
   agreement cannot be an import, so it is asserted empirically instead:
   `verifyTokeniser()` re-tokenises every chunk and requires the result to
   reproduce the shipped `tf`, `df`, `N` and `avgdl` exactly. See
   lib/knowledge/CLAUDE.md.
   ============================================================ */

/* Punctuation is trimmed from the ENDS of a token and never from the middle.
   A blanket split would be wrong in both directions: leaving sentence
   punctuation on makes `analytics` and `analytics.` two terms, halving IDF for
   both; stripping it everywhere destroys tokens this corpus actually means —
   `200+`, `−40%`, `1:1`, `2.1`, `64×80`, `5–6`, `p5.js`, `tokens.json`.

   Kept character-for-character in step with scripts/build-content.mjs. The
   combining-mark range is spelled with escapes here and with literal
   characters there; `verifyTokeniser()` is what proves they are the same. */
const EDGE_PUNCT = /^[.,;:!?"'’“”()[\]—–…·]+|[.,;:!?"'’“”()[\]—–…·]+$/g;

/* ---- STOPWORDS, and why a 70-chunk corpus cannot do without them ----

   IDF is supposed to make common words harmless. At this corpus size it does
   the opposite, and the failure is worth stating precisely because it is
   counter-intuitive: with N=70, a word appearing in ONE chunk scores
   idf = ln(1 + (70 − 1 + 0.5)/(1 + 0.5)) = 3.857, the maximum this corpus can
   award. `where`, `moment`, `say`, `does` and `who` each appeared in exactly
   one chunk, and for three of them that chunk was the same one — the owner's
   Background statement. So "Where is he working at the moment?" scored that
   passage on the strength of `where` and `moment`, and it won nine of the
   twenty-six top-1 misses. 772 of 1048 terms had df ≤ 2: at this scale df=1
   carries almost no information about whether a term is meaningful, only that
   the corpus is small.

   THE LIST IS EXTERNAL ON PURPOSE. It is NLTK's English stopword list (Bird,
   Klein & Loper), published years before this corpus existed, minus the
   single characters the length filter already drops. It was fixed before the
   effect was measured and has not been edited since. That matters more than
   its contents: `lib/knowledge/CLAUDE.md` forbids making a structural choice
   by watching `evals/questions.json`, having been caught doing exactly that
   once, and a hand-tuned list would be that same mistake with 179 knobs
   instead of one.

   WHAT IT DOES NOT FIX, so nobody reads more into it. `moment`, `say` and
   `work` are content words and are not on any standard list; they still carry
   df 1–2 and a maximal idf. The residue is a property of corpus size, not of
   tokenisation, and the honest fix for it is more corpus rather than a longer
   list. Measured effect on the 50 retrieval questions: hit@1 48.0 → 58.0,
   hit@3 68.0 → 84.0, MRR 0.621 → 0.712, and the Background statement's nine
   wrong top-1s fall to one. It costs one question (`metric-deadlift`, which
   was riding on `can`) and leaves two queries with no scoring term at all.

   Removed from the INDEX as well as the query, which is why this constant is
   duplicated character-for-character in scripts/build-content.mjs. Filtering
   only the query would leave `len` and `avgdl` counting words no query can
   ever match, and length normalisation would penalise whichever chunks happen
   to contain the most function words. `verifyTokeniser()` recomputes the whole
   shipped index and is what proves the two copies agree. */
const STOPWORDS = new Set(
  `i me my myself we our ours ourselves you your yours yourself yourselves he him his himself
   she her hers herself it its itself they them their theirs themselves what which who whom
   this that these those am is are was were be been being have has had having do does did
   doing an the and but if or because as until while of at by for with about against between
   into through during before after above below to from up down in out on off over under
   again further then once here there when where why how all any both each few more most
   other some such no nor not only own same so than too very can will just don should now
   ll re ve ain aren couldn didn doesn hadn hasn haven isn ma mightn mustn needn shan
   shouldn wasn weren won wouldn`
    .split(/\s+/)
    .filter(Boolean)
);

export const tokenize = (s) =>
  String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[\s/·|]+/)
    .flatMap((raw) => {
      /* Possessives are the same defect as trailing full stops: `wcag` and
         `wcag's` are one term, not two. */
      const t = raw.replace(EDGE_PUNCT, "").replace(/['’]s$/, "");
      /* Word compounds split on the hyphen (`ai-ready` → ai, ready). Anything
         carrying a dot or a digit is an identifier or a measurement and stays
         whole. */
      return t.includes("-") && !/[.\d]/.test(t) ? t.split("-") : [t];
    })
    .filter((t) => t.length > 1 && t.length < 32 && !STOPWORDS.has(t));

/* Okapi BM25. k1 controls term-frequency saturation, b the length
   normalisation; 1.2 / 0.75 are the standard defaults and are not tuned
   against the eval set — tuning two constants on forty questions would be
   fitting noise, and the eval exists to measure the retriever, not to launder
   a hyperparameter search. */
export const K1 = 1.2;
export const B = 0.75;

const idf = (N, df) => Math.log(1 + (N - df + 0.5) / (df + 0.5));

/**
 * Score every chunk against a query and return the ranked hits.
 *
 * Ties break on chunk order, which is the order build-content.mjs emitted —
 * stable across runs, so the eval measures retrieval rather than Array#sort.
 *
 * @param {object} content  the parsed content/dist/content.json
 * @param {string} query
 * @param {number} limit
 * @returns {{chunkIndex:number, chunkId:string, entity:string, kind:string,
 *            heading:string, text:string, cite:object, score:number}[]}
 */
export function search(content, query, limit = 8) {
  const { N, avgdl, df } = content.bm25;
  const terms = tokenize(query);
  if (!terms.length) return [];

  /* A repeated query term counts once. BM25's tf saturation already models
     within-document repetition; repeating it in the query would double-count
     the same evidence. */
  const unique = [...new Set(terms)];

  const scored = [];
  content.chunks.forEach((c, chunkIndex) => {
    let score = 0;
    for (const t of unique) {
      const tf = c.tf[t];
      if (!tf) continue;
      const denom = tf + K1 * (1 - B + (B * c.len) / avgdl);
      score += idf(N, df[t] ?? 0) * ((tf * (K1 + 1)) / denom);
    }
    if (score > 0) scored.push({ chunkIndex, score });
  });

  scored.sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex);

  return scored.slice(0, limit).map(({ chunkIndex, score }) => {
    const c = content.chunks[chunkIndex];
    return {
      chunkIndex,
      chunkId: c.id,
      entity: c.entity,
      kind: c.kind,
      heading: c.heading,
      text: c.text,
      cite: c.cite,
      score: Number(score.toFixed(4)),
    };
  });
}

/* ============================================================
   Tokeniser agreement

   The index in content.json was produced by a copy of the tokeniser above,
   living in scripts/build-content.mjs on the other side of a module boundary
   that forbids the import. Rather than trust two copies to stay identical,
   this recomputes the entire index from the chunk text that shipped and
   requires it to match byte-for-byte. It fails loudly on any divergence —
   including one introduced in scripts/ months from now, because the artefact
   and the query path would then disagree.
   ============================================================ */
export function verifyTokeniser(content) {
  const problems = [];

  const df = {};
  let totalLen = 0;

  content.chunks.forEach((c, i) => {
    const terms = tokenize(`${c.heading} ${c.text}`);
    const tf = {};
    for (const t of terms) tf[t] = (tf[t] ?? 0) + 1;

    if (terms.length !== c.len) {
      problems.push(`chunk[${i}] ${c.id}: len ${c.len} in index, ${terms.length} recomputed`);
    }
    const want = Object.keys(c.tf).sort();
    const got = Object.keys(tf).sort();
    if (want.join("\u0000") !== got.join("\u0000")) {
      const missing = want.filter((t) => !(t in tf));
      const extra = got.filter((t) => !(t in c.tf));
      problems.push(
        `chunk[${i}] ${c.id}: term set differs` +
          (missing.length ? ` — only in index: ${missing.slice(0, 6).join(", ")}` : "") +
          (extra.length ? ` — only recomputed: ${extra.slice(0, 6).join(", ")}` : "")
      );
    } else {
      for (const t of want) {
        if (c.tf[t] !== tf[t]) {
          problems.push(`chunk[${i}] ${c.id}: tf["${t}"] ${c.tf[t]} in index, ${tf[t]} recomputed`);
        }
      }
    }

    for (const t of Object.keys(tf)) df[t] = (df[t] ?? 0) + 1;
    totalLen += terms.length;
  });

  if (content.bm25.N !== content.chunks.length) {
    problems.push(`bm25.N is ${content.bm25.N}, chunks.length is ${content.chunks.length}`);
  }
  const avgdl = Number((totalLen / (content.chunks.length || 1)).toFixed(4));
  if (Math.abs(avgdl - content.bm25.avgdl) > 1e-4) {
    problems.push(`bm25.avgdl is ${content.bm25.avgdl}, recomputed ${avgdl}`);
  }
  const indexTerms = Object.keys(content.bm25.df).sort();
  const localTerms = Object.keys(df).sort();
  if (indexTerms.length !== localTerms.length) {
    problems.push(`bm25.df has ${indexTerms.length} terms, recomputed ${localTerms.length}`);
  }
  for (const t of localTerms) {
    if (content.bm25.df[t] !== df[t]) {
      problems.push(`df["${t}"] is ${content.bm25.df[t]} in index, ${df[t]} recomputed`);
    }
  }

  return {
    ok: problems.length === 0,
    chunks: content.chunks.length,
    terms: localTerms.length,
    problems: problems.slice(0, 20),
  };
}
