/* ============================================================
   The entity gate — a COVERAGE SIGNAL, not a filter

   What it answers: does this query name something this corpus is about?
   What it no longer does: decide whether search_content returns anything.

       the gate reports COVERAGE · the ranker decides WHAT · the caller decides WHETHER

   WHY IT MOVED ABOVE THE TOOL. It used to run inside search_content and return
   zero results on a miss. Two measurements ended that arrangement:

     - the gate costs a significant amount of ranking (0–6 questions, exact
       McNemar p = 0.031 for gated-embeddings vs ungated embeddings), while the
       ranker it was guarding contributes an insignificant amount over free
       BM25 (5–3, p = 0.73). The system was paying for a ranker the gate
       cancelled.
     - inside the tool its decision collapsed to a boolean and the matched
       entity was thrown away, so it could only ever REFUSE — never narrow the
       search to the entity it had just identified, never re-route to
       get_project or list_experience.

   Six answerable questions were being refused outright, including "Where is he
   working at the moment?" — close to the most likely question a recruiter asks.
   search_content now always returns its ranking and attaches {gateMatched,
   gateScore}; api/chat.js's system prompt (which carries an explicit corpus
   boundary section) and a remote MCP client's own model decide what to do with
   it. A signal is only worth relocating if it is worth consuming, which is what
   the scoring change below is for.

   SCORING. Matching is over each entity's NAME SURFACE only — ids, titles,
   clients, tags, org and role names, skill terms, fact titles — never its body.
   A term that merely appears somewhere in the prose cannot open the gate, which
   is why "Google" (8 occurrences: Analytics, Play, AI Studio) does not.

   `descriptor` is deliberately excluded from the experience surface; see the
   note at the call site. Recorded plainly because the audit is right about it:
   that exclusion was made after "did he work at Google" failed, and a
   structural choice made by observing the evaluation set is test-set fitting
   whether or not it adds a parameter. The principled argument (a descriptor is
   a sentence, and the gate matches names) is sound on its own, but it was
   constructed after the failure, not before.

   TWO SIGNALS, BOTH CORPUS STATISTICS:

     idf(t)  how rare the term is in the corpus BODY   (content.bm25.df)
     sf(t)   how many NAME SURFACES carry the term     (computed here)

   Weight is `idf(t) / sf(t)`. A term that names exactly one entity keeps its
   full evidence; a term shared by ten entities' names is not naming any of
   them and contributes a tenth. This is what makes the weighting load-bearing:
   before this change the score was compared against zero, so the decision was
   `query shares ANY name-surface token with ANY entity` and the IDF term had
   *no effect on the outcome* — measured across 76 queries, a plain
   set-intersection gate agreed with it on all 76.

   Measured single tokens that opened the old gate on their own:

       design  system  product  senior  research  team  web  site  audit  app

   So "did he do design work at Meta" opened on `design`, retrieved real chunks
   and let the model compose a grounded-looking answer about an employer he
   never had. All ten now refuse alone.

   `senior` is worth naming: it appears in five role titles and in ZERO chunk
   bodies, so df = 0 gives it the MAXIMUM idf this formula can produce (5.037,
   higher than `spetema`). Corpus IDF is a statistic of the bodies while the
   gate matches names, and that mismatch made the most generic word in the
   corpus the strongest single piece of evidence in it. Dividing by sf brings it
   back to 1.007, below the floor.

   THE FLOOR is the weight of one term that names exactly one entity and occurs
   in a quarter of the corpus's chunks — the least distinctive thing that can
   still be called a name. It is a function of N alone. It was chosen before any
   of this was measured and has NOT been moved since; where it costs something,
   the cost is reported rather than the constant adjusted.

   WEIGHT ALONE IS NOT ENOUGH, and this is the part worth reading. Two of the
   queries that must be separated are ordered the WRONG WAY by every scalar
   signal available:

       "was he a senior designer at Figma"                  2.06   must refuse
       "What was the AI-Ready Design System project about?" 1.41   must open

   No threshold can accept the second and reject the first, because the
   fabricated-employer question carries MORE name-surface evidence than the real
   one. The separation is structural, not scalar: the first matches three
   LABELS (a job category, a tool tag) belonging to three different entities;
   the second matches one entity's own NAME. Hence the name/label split in
   buildNameSurfaces and the two rules in makeGate. Reaching for a bigger
   constant here is the trap; there is no constant that works.

   WHAT A MISS MEANS. Precise about the query, weak about the corpus — 11/11
   abstention questions refused, but 22/43 answerable ones refused too. See
   GATE_MISS_MESSAGE at the foot of this file, which is worded accordingly.

   SCALE BOUND. Correct at 76 chunks and structurally wrong above roughly 1,000.
   Name surfaces grow with the corpus while the floor is fixed, so `bestScore`
   clears it on nearly every query and the signal decays toward "always covered".
   Above that size this needs to become a retrieval problem over the names
   themselves, not a bag-of-tokens intersection.
   ============================================================ */
import { tokenize } from "./search.js";

/** Build the name surfaces once per corpus. Exported so the eval can construct
 *  a gate over a fixture without reaching into module state.
 *
 *  Each surface carries TWO sets:
 *
 *    `name`   what the entity IS — its id, the organisation or client it
 *             belongs to, its own title. A name is the thing itself.
 *    `label`  what the entity is TAGGED WITH — tags, card type, a role read as
 *             a job category, a discipline. A label is shared vocabulary that
 *             many entities carry.
 *
 *  That distinction is the one the old flat set could not make, and it is what
 *  separates "was he a senior designer at Figma" (three LABELS, belonging to
 *  three different entities, denoting an employer the corpus never mentions)
 *  from "What was the AI-Ready Design System project about?" (that project's
 *  own NAME, carrying less name-surface evidence by weight). No monotone
 *  threshold on evidence can separate those two — the second scores HIGHER —
 *  so the separation has to be structural.
 *
 *  `terms` is the union and is what a caller counting name-surface frequency
 *  should read. */
export function buildNameSurfaces(content) {
  const surfaces = [];
  const add = (entity, nameParts, labelParts) => {
    const name = new Set(tokenize(nameParts.filter(Boolean).join(" ")));
    const label = new Set(tokenize(labelParts.filter(Boolean).join(" ")));
    surfaces.push({ entity, name, label, terms: new Set([...name, ...label]) });
  };

  for (const p of content.projects) {
    add(
      `project:${p.id}`,
      [p.id.replace(/-/g, " "), p.client, p.indexClient, p.title, p.indexTitle],
      [p.cardType, ...(p.tags ?? []), ...(p.indexTags ?? [])]
    );
  }
  for (const e of content.experience) {
    /* `descriptor` is EXCLUDED. It is a sentence — Studio Kipo's is "sole
       designer for all client work" — and a sentence in a name surface is the
       body-matching this gate exists to avoid: it let the token "work" open the
       gate for "did he work at Google". See the honesty note in the header
       about the order in which that argument and that measurement happened.

       `role` is a LABEL, not a name: "Senior Product Designer" is a job
       category five roles share, and treating it as a name is what let the bare
       token `team` (from "Service Designer & Team Lead") open the gate. */
    add(`experience:${e.id}`, [e.id.replace(/-/g, " "), e.org], [e.role]);
  }
  for (const c of content.capabilities ?? []) {
    add(`capability:${c.id}`, [c.id.replace(/-/g, " ")], [c.title]);
  }
  for (const [id, g] of Object.entries(content.skills.groups)) {
    add(`skills:${id}`, [id.replace(/-/g, " ")], [g.site?.term, g.cv?.term]);
  }
  for (const f of content.facts) add(`fact:${f.id}`, [f.id], [f.title, f.unit]);
  add(
    "profile",
    [content.profile.identity.name],
    [
      content.profile.identity.role,
      ...content.profile.identity.disciplines,
      ...content.education.education.map((e) => `${e.qualification} ${e.institution}`),
      ...content.education.languages.map((l) => l.language),
      ...content.profile.rows.map((r) => r.term),
    ]
  );
  return surfaces;
}

/* ============================================================
   Is a term a PROPER NAME, according to the corpus itself?

   `spetema`, `mindromeda` and `paraflow` must open the gate alone; `team`,
   `web` and `audit` must not. All six name exactly one entity and three of them
   have an all-but-identical corpus df, so no frequency statistic separates
   them — the test suite says as much in its own comment. What separates them is
   that one set is proper nouns and the other is ordinary English that happens
   to appear in a title.

   The corpus already records that distinction, in its CAPITALISATION. A term is
   read as a proper name when every occurrence in the chunk bodies is
   capitalised, or when it never appears in a body at all — an id token the
   prose never uses (`paraflow`, `greenstreet`) cannot be ordinary vocabulary
   either. `audit` appears lowercase in the text that describes the audit, so it
   is not a name; `Spetema` never does.

   This scans raw chunk text case-sensitively and does NOT tokenise, so it adds
   no second tokeniser to keep in step with the index — the rule the slice
   contract is strictest about. It runs once per corpus, over ~150 terms.
   ============================================================ */
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

function makeProperNameTest(content, df) {
  const body = content.chunks.map((c) => `${c.heading}. ${c.text}`).join("\n");
  const cache = new Map();

  return (term) => {
    let known = cache.get(term);
    if (known !== undefined) return known;

    /* A term the bodies never contain cannot be corpus vocabulary. */
    if ((df[term] ?? 0) === 0) known = true;
    else if (!/^[a-z]/.test(term)) known = false; // digits, symbols — not names
    else {
      const tail = term.slice(1).replace(REGEX_SPECIAL, "\\$&");
      const head = term[0];
      const lower = new RegExp(`(?<![A-Za-z])${head}${tail}(?![A-Za-z])`, "g");
      known = !lower.test(body);
    }
    cache.set(term, known);
    return known;
  };
}

/* Okapi's IDF, over the corpus df that content.json already carries. */
const idfOf = (N, df) => Math.log(1 + (N - df + 0.5) / (df + 0.5));

/** The score a query must reach for the gate to call the corpus covered:
 *  ONE term, naming exactly ONE entity, occurring in a QUARTER of the chunks.
 *  A function of the corpus size and nothing else — no question set was
 *  consulted to pick it, and it has not been adjusted since. */
export const gateFloor = (N) => idfOf(N, N / 4);

/** How many name surfaces a term appears in. A term naming three or more
 *  different entities identifies none of them. */
const SHARED_NAME_LIMIT = 3;

/** A gate bound to one corpus. */
export function makeGate(content) {
  const surfaces = buildNameSurfaces(content);
  const { N, df } = content.bm25;

  /* Surface frequency: how many of the entity name surfaces carry this term.
     `designer` is in 11 of 35, `design` and `product` in 10 each, `spetema` in
     one. This is the statistic that separates a category word from a name, and
     the corpus df cannot see it — `designer` has df 2 and looks rare. */
  const sf = new Map();
  for (const s of surfaces) for (const t of s.terms) sf.set(t, (sf.get(t) ?? 0) + 1);

  const isProperName = makeProperNameTest(content, df);
  const weight = (t) => idfOf(N, df[t] ?? 0) / sf.get(t);
  const floor = gateFloor(N);

  /** @returns {{entity:string, score:number}|null} — null means "the query
   *  names nothing in this corpus". It is a COVERAGE VERDICT for the caller to
   *  weigh, not an instruction to return nothing. */
  const entityGate = function entityGate(query) {
    if (typeof query !== "string") return null; // never coerce a caller's value
    const terms = [...new Set(tokenize(query))];
    let best = null;
    let bestScore = 0;

    for (const surface of surfaces) {
      const matched = terms.filter((t) => surface.terms.has(t));
      if (!matched.length) continue;

      let score = 0;
      for (const t of matched) score += weight(t);

      /* (a) NAMED OUTRIGHT. One term is enough when it is the entity's own
             name, distinctive enough to identify it, and a proper noun rather
             than ordinary corpus vocabulary. This is what keeps "What is
             Mindromeda?" — a single matched term — working. */
      const namedOutright = matched.some(
        (t) => surface.name.has(t) && sf.get(t) < SHARED_NAME_LIMIT && isProperName(t)
      );

      /* (b) CORROBORATED. Otherwise at least two terms must match, at least one
             of them from the entity's NAME rather than its labels, and their
             combined weight must clear the floor. The name requirement is what
             refuses "was he a senior designer at Figma": three matched terms,
             comfortably over the floor, every one of them a label. */
      const corroborated =
        matched.length >= 2 &&
        matched.some((t) => surface.name.has(t)) &&
        score >= floor;

      if ((namedOutright || corroborated) && score > bestScore) {
        bestScore = score;
        best = surface.entity;
      }
    }

    return best ? { entity: best, score: Number(bestScore.toFixed(4)) } : null;
  };

  /* Carried on the function so a caller (or a test) can report the threshold it
     was judged against without rebuilding the surfaces. */
  entityGate.floor = Number(floor.toFixed(4));
  return entityGate;
}

/** The note a gate miss carries on an otherwise normal search result.
 *
 *  WHAT A MISS ACTUALLY MEANS, measured on the 54-question eval set:
 *
 *      abstention questions   11 of 11 correctly refused
 *      retrieval questions    22 of 43 ALSO refused
 *
 *  So a miss is a precise signal about the QUERY — it names no entity — and a
 *  weak signal about the CORPUS. Half the questions it refuses are answerable,
 *  because "Does he do motion design?" and "What languages does he speak?"
 *  genuinely name no entity while the corpus genuinely answers them.
 *
 *  That is why this is worded as a fact and not as an instruction. When the
 *  gate filtered, a miss was terminal and the message could say "say so rather
 *  than rephrasing"; now that it only annotates, the same wording would talk a
 *  model out of 22 answers it is holding in its hand. The results are ranked
 *  over the whole corpus either way and they are right there to be read.
 *
 *  This is also the one thing the corpus manifest never tells a cold client. */
export const GATE_MISS_MESSAGE =
  "Coverage note: this query names no project, client, role, skill or fact that exists in " +
  "this corpus — it may still be answerable, since a question can describe something " +
  "without naming it. The results below were ranked over the whole corpus and are the " +
  "closest passages, not a claim that they answer the question. Judge them on their text: " +
  "answer from them if they do, and say the corpus does not cover it if they do not. " +
  "Rephrasing and searching again will not surface anything new — the ranking was over " +
  "everything.";
