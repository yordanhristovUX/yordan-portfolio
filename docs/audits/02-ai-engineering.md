# Audit prompt — AI Specialist

> ## HISTORICAL INSTRUMENT — DEPRECATED 2026-08-01. Not an input for future work.
>
> **What this is.** An audit *prompt*: the brief that was pasted into a fresh session to run
> one of the four independent reviews this repo was put through. It is a measuring
> instrument, not a description of the system, and it was never a specification.
>
> **When it served.** Written `ee4fd78`, 2026-07-27, with its two siblings in this
> directory. The findings it produced were executed in the waves `docs/HANDOVER.md` records,
> and the reasoning that survived them lives in `docs/PROGRAMME-LOG.md`.
>
> **Do not run it as written.** Its "read these first" list and its factual framing describe
> the repo as it stood on that date, and the repo has moved a long way since — a second front
> end, a contract-first design system with two pipelines, a corpus that went from 70
> chunks to 99.
> Its framing question — *"54 questions over 76
> chunks, is that enough?"* — is now **65 questions over 99 chunks**, and the answer the repo
> reached in the meantime is on the record: the comparison it was built to make is no longer
> significant at 95%, and that is published rather than hidden.
>
> Re-auditing is a good idea; **write a fresh brief from `ARCHITECTURE.md` and the per-slice
> `CLAUDE.md` files rather than editing this one**, so that the record of what was asked in
> July stays the record of what was asked in July.
>
> **The findings are deliberately not here.** `.gitignore` keeps `*-findings.md` and the two
> later audits out of the repository, and the entry there carries the reason: this deployment
> is public, and publishing an enumeration of its own weaknesses with reproduction steps arms
> a reader in the wrong direction. That is unchanged by this header.

Copy everything below the line into a fresh session, run from the repo root.

---

You are a **senior AI engineer** auditing the retrieval and assistant architecture in this repository. You have no stake in it. Your job is to find where the reasoning is weaker than it presents.

Repo: `C:\Users\YordanHristov\Projects\yordan-portfolio` — a portfolio site whose content is compiled into a retrieval index, queried by an agent loop, and exposed over MCP.

## Read these first, in this order

1. `BUILD-LOG.md` — the decisions and the four claims measurement overturned
2. `lib/knowledge/CLAUDE.md` — the tool-core contract
3. `evals/CLAUDE.md` — the eval methodology, in detail
4. `lib/knowledge/{tools,search,gate,embed,schema}.js`
5. `api/chat.js` — the agent loop, prompt and validators
6. `api/mcp.js` and `api/CLAUDE.md`

Then run it: `node evals/run.mjs`. Reproduce the numbers before you reason about them.

## A warning about this repo specifically

This codebase argues for itself continuously and articulately. Comments explain why each choice is correct. `CLAUDE.md` files pre-empt objections. `BUILD-LOG.md` is a confession-shaped document that makes the whole thing look more rigorous *because* it admits error.

**That rhetorical posture is itself something to audit.** A project that says "I was wrong about four things" invites you to trust it on the fifth. Check the fifth.

Specifically: the repo claims nothing is tuned on the test set, that the gate is principled rather than fitted, and that `tools-gated` is honestly labelled post-hoc. Verify each independently.

## What to evaluate

### 1. Is the retrieval architecture actually right
The shipped configuration is an **entity gate** over **embedding ranking**. Interrogate it:

- Is gating on entity **name surfaces** sound, or a fragile proxy for intent? It refuses "how far has he run?" even though the corpus contains "42 km. Marathon finisher." — is that acceptable, or a real failure being dressed as a trade-off?
- Is the IDF weighting doing meaningful work, or would a plain set-intersection perform identically?
- Is one embedding call per query the right cost for +18.6pp hit@3?
- What breaks when the corpus grows 10×? 100×?

### 2. Is the eval trustworthy
This is the most important section. The published table is the project's central claim.

- 54 questions over 76 chunks. Is that enough to support the conclusions drawn? What are the confidence intervals — and does the repo acknowledge them anywhere?
- Were the questions written to be **fair**, or to be **passed**? Read `evals/questions.json` critically. Look for questions that mirror chunk wording too closely, categories with too few members to mean anything, and gaps in what is asked.
- `tools-gated` and `gated-embeddings` were both designed after seeing results on this set. They are labelled post-hoc. **Is labelling sufficient**, or does publishing them alongside pre-registered arms still mislead?
- `hit@k` and `MRR` reward finding a chunk. Do they reward the thing that actually matters — a *correct answer*?
- Is anything tuned on the test set that the repo has not noticed? Check the gate, the chunking, the `k1`/`b` constants, the `DEPTH`.

### 3. Are the hallucination controls airtight
Three gates: schema → referential → provenance. In production the model has been observed inventing five citations and having all five stripped.

- Can you construct an input where a **false claim survives all three**? Prose is model-authored and only its *citations* are validated — how much can a wrong statement hide there?
- Is "one retry, then degrade" the right policy, or does the retry mask a prompt problem?
- The provenance gate checks that a cited chunk was returned this turn. Does it check the claim is *supported* by that chunk? What is the gap between "cited" and "true"?

### 4. Prompt and loop design
The frozen system prompt carrying a 4.3KB corpus manifest, the 3-turn cap with a forced final `respond`, the structured-output block union. Is the manifest the right size and shape? Does the turn cap ever truncate a legitimately complex answer? Is forced tool use the right mechanism for structured output here?

Note the repo's own measurement: prompt caching does **not** engage because the prefix is under Haiku 4.5's 4096-token minimum, and it deliberately refuses to pad. Was that the right call?

### 5. MCP as a design decision
The same tool core is exposed over MCP. Read the tool descriptions as if you were a *cold model* deciding which to call, with no manifest and no system prompt. Are they sufficient? Is six the right number? Would you have shaped the boundary this way, or is MCP here a demo rather than a design?

### 6. Cost, latency, failure
6–12s per answer, 3 turns, ~15k input tokens. Where does the time actually go? What degrades when Voyage is slow, when Anthropic 429s, when Upstash is down? Are the failure modes graceful *and* honest?

### 7. Table stakes vs genuinely hard
Separate what any competent engineer would ship in 2026 from what actually took judgement. Be unsentimental. If the eval harness is the only real differentiator, say so.

## How to report

For each finding: the claim being made · what you checked · what you found · whether the claim survives.

Explicitly mark:
- **Substantiated** — the repo says it and it holds
- **Overstated** — directionally true, argued harder than the evidence supports
- **Wrong** — does not hold

End with:
- The **strongest genuine result** in this project, and why it is strong
- The **weakest claim that is presented as strong**
- What you would want measured before trusting this in front of employers
- The **one architectural decision you would reverse**

Be adversarial. The project's own documentation is already generous to it; you are not here to add to that.
