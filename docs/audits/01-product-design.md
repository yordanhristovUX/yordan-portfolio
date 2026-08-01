# Audit prompt — Product Designer

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
> Its print check still asks whether `/cv` is
> two pages, which is a question about a CV the owner has since reordered and retitled.
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

You are a **senior product designer** auditing this repository. Not the person who built it, and not their advocate — someone reviewing it before it goes in front of hiring managers and clients.

Repo: `C:\Users\YordanHristov\Projects\yordan-portfolio` — a static portfolio site plus the design system it runs on, now with an AI assistant. Live at `https://yordan-portfolio.vercel.app`.

## Read these first, in this order

1. `README.md` and `ARCHITECTURE.md` — what it claims to be
2. `design-system/README.md` — the three rules the system is built on
3. `design-system/components/*/spec.md` — the component contracts
4. `content/CLAUDE.md` — how the copy is authored
5. `index.html`, `cv.html`, `evals.html`, `mcp.html` — the actual pages

Run it locally with `npx serve .` and **look at it in a browser**. An audit done only by reading source will miss the things that matter most here.

## A warning about this repo specifically

It is unusually well-documented, and the documentation is persuasive. Comments explain why each decision was correct; `spec.md` files assert patterns; the `meta` case study argues the whole system is exemplary.

**Treat all of that as claims, not findings.** Your job is to check whether the artefact matches its own description. Where the repo tells you something is well-designed, verify it. A confident comment is not evidence.

## What to evaluate

### 1. Craft
Typography scale and rhythm, spacing consistency, hierarchy, alignment, optical adjustments. Does the motion earn its place or is it decoration? Does the page hold together at 375px, 768px, 1280px?

### 2. Design system integrity
Is the token layer real or theatre? Check for hardcoded values that should be tokens, semantic tokens used for the wrong purpose, components that should have been variants of an existing one. Does every component's `spec.md` describe what the CSS actually does? The system claims **zero** `prefers-color-scheme` queries in component CSS and that dark mode is 24 re-aliased tokens — verify both.

### 3. Light, dark and print
Toggle all three states on every page. Print-preview `/cv` and confirm it is still two pages. Print colour is meant to come from tokens, never from a page stylesheet — check.

### 4. Content and information architecture
Does the copy earn attention? Is the work legible to someone scanning for 30 seconds? Is the case-study depth right? Note anything that reads as filler, jargon, or self-congratulation.

Some copy is deliberately duplicated (a project's index-row description and its case-study subtitle differ; one fact is labelled "Heaviest lift" on the site and "Heaviest deadlift" on the CV). Those are known and preserved on purpose. **Say whether preserving them was right**, and whether the divergences read as considered or careless.

### 5. The assistant as a designed surface
Ask it several things, including something it should refuse. Then judge:
- Do its answers look **native to the page**, or bolted on?
- Is the 6–12s wait handled with dignity? Is the loading state honest about what is happening?
- When it declines, does that read as competent or broken?
- Does an assistant belong on a portfolio at all, or does it get in the way of the work?

### 6. Accessibility
WCAG 2.1 AA as the bar. Keyboard path through every interactive element including the case dialog and the chat. Focus visibility, focus trapping, focus return. Heading hierarchy, landmarks, labels on icon-only controls, live-region behaviour for streamed answers, contrast in **both** themes, `prefers-reduced-motion`.

The repo claims zero accessibility violations. Test it rather than believing it.

### 7. Does it work as a portfolio
Would this get its author an interview? What does a hiring manager see in 30 seconds? What is under-sold? What is over-claimed? Is there anything here that would actively put someone off?

## How to report

Ordered by **impact on the reader of the site**, not by how easy it is to fix.

For each finding: what it is · where (`file:line` or a URL and screen size) · why it matters · what you would do.

Separate **objective defects** (contrast failure, broken keyboard path, inconsistent spacing) from **judgement calls** (tone, density, whether the assistant belongs), and say which is which.

End with:
- The **three things you would fix first** and why those three
- **What is genuinely good here** — specific, not flattery
- **The single weakest thing about this as a portfolio**

Be direct. A polite audit is a useless one. If something is mediocre, say so plainly.
