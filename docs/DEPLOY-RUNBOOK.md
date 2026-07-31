# Deploy runbook — the owner's steps

Everything in this file happens in the Vercel dashboard and **cannot be committed**. That is
the whole reason it exists, and it is the same argument `api/CLAUDE.md` makes for writing the
WAF rules down: a configuration nobody can grep for is a configuration nobody can audit.

`docs/` is excluded from the deployment by `.vercelignore`, so this file is repository
material and is never served.

**How to read the status markers.** Everything below is either a step that has been taken
(and is verifiable from outside), or one that has not. Nothing is presumed done.

| | Project | State |
| --- | --- | --- |
| 1 | the vanilla site — repo root | **LIVE**, and running an **older commit** — see below. `https://yordan-portfolio.vercel.app` answers 200, and so does `/cv`. `CHAT_ALLOWED_ORIGINS` is **PENDING** |
| 2 | the second site — `apps/next` | **PENDING.** No project exists yet. The app builds; nothing deploys it |
| 3 | Storybook — `design-system` | **PENDING, and optional.** `yordan-design-system.vercel.app` currently answers 200 with **this portfolio** (`/cv` resolves there, `/index.json` 404s) — it is a second domain on project 1, not a Storybook deployment. The CV and the README publish that URL |

### Step zero: push

Local `main` is **ahead of `origin/main` by the whole of Phases 1–8**, so none of the work
these steps configure is on the deployment yet (`git rev-list --count origin/main..main` for
the current figure). Production is serving the commit before
this programme started — checked from outside: `/apps/next/package.json` and
`/apps/next/next.config.mjs` both 404 on the live site, which is what a deployment that
predates `apps/next` looks like *and* what the `.vercelignore` fix is meant to produce. The
two are indistinguishable from a URL, which is exactly why the first thing to verify after
pushing is that they still 404.

Nothing below has any effect until `git push` has happened and a deployment has been built
from it.

---

## 1. The vanilla project (repo root)

This is the deployment that serves `index.html`, `/cv`, `/mcp`, `/evals`, `/work/<id>` **and
the two functions in `api/`**. `vercel.json` configures it and is committed; two things are
not, and both are below.

### 1a. `CHAT_ALLOWED_ORIGINS` — which other origin may read the assistant's answers

> Project → **Settings** → **Environment Variables** → Add

| | |
| --- | --- |
| Name | `CHAT_ALLOWED_ORIGINS` |
| Value | a comma-separated list of **exact origins**: scheme + host + port. No path, no trailing slash, no wildcard |
| Environments | Production. Add Preview only if you intend previews of the second site to talk to the production assistant — each preview has its own generated origin, so that list is unbounded and cannot be maintained by hand |

Example, once project 2 exists and has a domain:

```
https://yordan-next.vercel.app
```

and, if a second domain is attached to it:

```
https://yordan-next.vercel.app,https://www.yordan-next.example
```

**Matching is exact string equality**, and what goes back on the wire is the entry from this
list rather than the header the caller sent. So `https://example.com` does not admit
`https://www.example.com`, `http://example.com`, `https://example.com:8443`, or
`https://example.com/`. A trailing slash in an entry means that entry can never match
anything, silently — a browser's `Origin` header never carries one.

**Leaving it unset is a fully supported state and costs nothing.** No CORS header is emitted
at all, which is byte-identical to the behaviour before the allowlist existed: the vanilla
site's own assistant is same-origin and unaffected, and `curl` cannot tell the feature is
there. Set it when there is a second origin that needs it, not before.

### 1b. Redeploy — an environment change does not reach a deployment that already exists

> Project → **Deployments** → the current production deployment → **⋯** → **Redeploy**

This is the step that is skipped and then debugged for an hour. Vercel binds environment
variables to a deployment when it is created; editing a variable changes what the *next*
deployment sees, and the running one keeps the value it was built with. After the redeploy,
run the verification in §4 — it will tell you plainly whether the variable arrived.

### 1c. Optional — do not rebuild this project when only the second site changed

> Project → **Settings** → **Git** → **Ignored Build Step**

```sh
git diff --quiet HEAD^ HEAD -- . ':(exclude)apps'
```

Vercel's convention is inverted from the usual one: **exit 0 skips the build, exit 1 runs
it.** `git diff --quiet` exits 0 when nothing matched changed, so the line above skips a
deploy whose only changes are under `apps/`.

This is a convenience, not a correctness measure — this project has `buildCommand: ""`, so
its "build" is an upload — and it is **UNVERIFIED here**: it depends on the platform
providing at least two commits of history, which cannot be tested from the repository. If it
misbehaves, the failure is a skipped or an extra deployment, never a wrong one.

### 1d. The one check to run on the first deployment after the push

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://yordan-portfolio.vercel.app/apps/next/package.json
curl -s -o /dev/null -w '%{http_code}\n' https://yordan-portfolio.vercel.app/apps/next/next.config.mjs
```

Both must be **404**. This project has `outputDirectory: "."` and `buildCommand: ""`, so
whatever is uploaded is served verbatim; `/apps/` in `.vercelignore` is the only thing
standing between the second site's TypeScript source and a public URL on the portfolio
domain. A `200` here means that entry is not being applied and the second site's source is
published — treat it as urgent.

---

## 2. The second site (`apps/next`) — not created yet

### 2a. Create the project

> **Add New… → Project** → import the same Git repository

| Setting | Value | Why |
| --- | --- | --- |
| Root Directory | `apps/next` | its own `package.json` and lockfile live there; the root install must not run |
| **Include source files outside of the Root Directory in the Build Step** | **ON** | three of the app's four inputs live *above* `apps/next`: `content/dist/content.json`, `evals/dist/page.json`, `css/**` — and the design system itself, which is a `file:../../design-system` dependency npm resolves against the checkout |
| Framework Preset | **Next.js** | |
| Install / Build / Output | leave as the preset's defaults | `apps/next/package.json` already runs `sync-artifacts.mjs` from `prebuild`, and `next.config.mjs` runs it again at config load, so a bare `next build` works from a clean checkout |

### 2b. MANDATORY FIRST STEP — a preview deployment, before any domain is attached

Do not point a domain at this project until one preview build has succeeded. The reason is a
specific, documented risk rather than general caution, and it is written out in full in the
comment above `/apps/` in `.vercelignore`:

> That project needs "Include files outside the Root Directory" ON — three of its four inputs
> live above `apps/next`. With that setting on, the build context is the whole repository,
> which means this file is plausibly read by that project's upload as well, and `/apps/`
> would then exclude that project's own source from its own build.

Confidence in that risk is **medium-high and it has not been tested**, because it can only be
tested by creating the project.

**How you will know it materialised.** The preview build fails *missing its own source* —
`next.config.mjs` not found, "Couldn't find any `pages` or `app` directory", or an install
that reports no `package.json` at the root directory. A build that gets as far as compiling
routes has not hit this.

**It cannot be patched from the root `.vercelignore`.** A negation cannot re-include a path
whose parent directory is already excluded, so a trailing `!/apps/next/` does nothing — that
is gitignore semantics, which is the syntax `.vercelignore` uses. The `/apps/` entry also
cannot simply be deleted: this project's sibling has `outputDirectory: "."` and
`buildCommand: ""`, so **whatever is uploaded there is served**, and removing the entry
publishes the second site's TypeScript source at `/apps/next/…` on the portfolio domain.

So the fix belongs in **this** project's configuration, and these are the options as they
stand. Each is stated with what is known about it and what is not; the choice is the owner's:

1. **A `.vercelignore` inside `apps/next/`.** Cheapest if it works. Whether Vercel reads an
   ignore file relative to the Root Directory, relative to the repository root, or both, is
   **not established here** — one preview deployment answers it. If it is read relative to
   the Root Directory, the root file may not apply to this project at all, in which case the
   risk never materialises and nothing needs doing.
2. **Deploy this app somewhere that does not share the file.** It is a pure static export —
   `apps/next/out/` is the whole artefact — so any static host serves it. Costs a second
   provider; removes the interaction entirely.
3. **Give the vanilla project a real build step** that assembles a directory to serve, so
   `apps/` can stop being excluded because it would no longer be uploaded as output. This is
   the structurally clean answer and the most expensive: `no build step` is a claim the
   README, `ARCHITECTURE.md` and the site's own case study all make about this repo.

Option 1 first, because one preview tells you whether there is a problem at all.

### 2c. Environment variables

| Name | Set it when | Default if unset |
| --- | --- | --- |
| `NEXT_PUBLIC_CHAT_ENDPOINT` | the assistant API is somewhere other than the vanilla production deployment | `https://yordan-portfolio.vercel.app/api/chat`, derived from `profile.contact.site` in the corpus |
| `NEXT_PUBLIC_SITE_URL` | you want this app's `canonical` and `og:url` to name **its own** domain | `https://yordan-portfolio.vercel.app` — the same corpus field |

The chat endpoint defaults to the *other* deployment on purpose: the function lives there
whatever origin this app is served from. That is what makes every one of this app's chat
requests cross-origin, and it is the entire reason §1a exists.

`NEXT_PUBLIC_SITE_URL` is a decision rather than a step. Left unset, both surfaces publish
the vanilla site as canonical, which is defensible if the second site is a demonstration.
Set, the second site is its own canonical page and will be indexed as one.

### 2d. Response headers — PENDING, and a documented divergence

**Nothing in the repository sets headers for this project.** `apps/next/` has no
`vercel.json` (checked), and a static export cannot set headers by itself. Adding one is a
change inside `apps/next/`, which belongs to that slice's owner rather than to this document;
what follows is the specification for it.

Take `vercel.json`'s CSP verbatim, with **two** changes:

| Directive | Vanilla | Second site | Why |
| --- | --- | --- | --- |
| `connect-src` | `'self'` | `'self' https://yordan-portfolio.vercel.app` | the assistant POSTs to the other origin. Without this the browser blocks the request before CORS is even consulted, and the failure looks exactly like a missing allowlist entry |
| `script-src` | `'self' 'sha256-…'` | `'self' 'unsafe-inline'` | Next emits inline bootstrap scripts (`self.__next_f.push(…)`) whose contents change with every build, plus the no-flash theme script. A hash list would be stale on the next deploy |

Everything else — `default-src 'self'`, `base-uri`, `object-src 'none'`,
`frame-ancestors 'none'`, `form-action 'self'`, `img-src 'self' data:`,
`X-Content-Type-Options`, `Referrer-Policy` — carries over unchanged.

**`'unsafe-inline'` is genuinely weaker, and calling it a divergence rather than a detail is
the point.** The standard fix is a per-request nonce from middleware, and this app cannot do
that today: `output: "export"` produces static HTML with no request to attach a nonce to.
Adopting nonces means adopting a server runtime for this app, which is a decision about what
the second site *is*, not a header tweak. Until then the mitigations that remain are the ones
above — `object-src 'none'`, a locked `base-uri`, and no third-party script origin at all.

Two directives in the vanilla CSP do **not** need carrying over: `font-src` allows
`https://fonts.gstatic.com` and `style-src` allows `https://fonts.googleapis.com`, and no
shipped page or stylesheet references either (checked — the fonts are vendored in
`css/fonts/`, and the second site serves them from `/fonts/`). They are dead allowances on
the vanilla side; that is a separate cleanup and not this document's to make.

### 2e. Optional — only rebuild when this app or an input changed

> Project → **Settings** → **Git** → **Ignored Build Step**

```sh
git diff --quiet HEAD^ HEAD -- apps/next css content/dist evals/dist design-system
```

Same inverted convention as §1c: exit 0 skips. The pathspecs are the app plus the four
upstream surfaces it copies or imports — miss one and the second site silently serves last
week's corpus. Same **UNVERIFIED** caveat.

---

## 3. Storybook (`design-system`) — optional, and not created

> **Add New… → Project** → the same repository

| Setting | Value |
| --- | --- |
| Root Directory | `design-system` |
| Framework Preset | Other |
| Build Command | `npm run build-storybook` |
| Output Directory | `storybook-static` |
| **Include source files outside of the Root Directory** | **ON** — see below |

That last row is not optional, and the reason is worth knowing before the build fails.
`build-storybook` runs `npm run build` first, which is `build.mjs && build.mjs --check`, and
the `--check` pass asserts the advertised counts against four files — **three** of which
(`../README.md`, `../cv.html`, `../work/portfolio-system.html`) are above this Root
Directory. A missing file there is a failure and not a pass, deliberately, because relocating
content used to disable the check silently. So a Storybook build without the outside files is
a red build, not a subtly wrong one.

If it fails on a missing `../README.md`, that is the same `.vercelignore` mechanism §2b
describes, reached by a different route.

**The domain is the interesting part of this project.** `yordan-design-system.vercel.app` is
what the CV links, what `content/profile.json` publishes and what the README used to claim
was a Storybook. It currently resolves to the portfolio (checked). Moving that domain from
project 1 to project 3 is the step that makes the CV's link true; until it is taken, the
link is a live URL pointing at the wrong site, which is worse than a dead one.

---

## 4. Verifying the cross-origin assistant — the Tier 2 checklist

Run this **after** §1a and §1b, against the real production deployment. It is derived from
`api/chat.js` and mirrors what `test/chat-cors.test.js` asserts against the same handler
locally, so a disagreement between the two means the environment, not the code.

Set the two variables once:

```sh
API=https://yordan-portfolio.vercel.app/api/chat
ORIGIN=https://<the second site's exact origin>
```

**1 — the preflight is answered, and answered before anything is spent.**

```sh
curl -si -X OPTIONS "$API" \
  -H "Origin: $ORIGIN" \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Expect **`204`** with an empty body, and:

- `access-control-allow-origin: $ORIGIN` — reflected exactly, byte for byte
- `vary: Origin`
- `access-control-allow-methods` containing `POST` and `OPTIONS`
- `access-control-allow-headers` containing `content-type` (this is the load-bearing one:
  `application/json` is not a CORS-safelisted content type, so without it no message is ever
  sent) and `accept`
- `access-control-max-age: 86400`
- **no** `access-control-allow-credentials` — this endpoint has no cookie and no session, and
  allowing credentials would turn a reflected origin into ambient authority

A `405` here means the origin did not match. Compare the two strings character by character
before suspecting anything else; a trailing slash or `http` for `https` is the usual answer.

**2 — the preflight cost nothing.** The CORS branch sits in front of `checkBudget()`, so a
preflight must not touch Redis, must not decrement the daily token budget and must not call a
model. From outside, the observable check is the pair: run step 1 twenty times, then look at
the project's Function logs and the Upstash request count. Neither should have moved. (The
assertion itself is held locally by `test/chat-cors.test.js`, driven against a stub Upstash
for exactly this reason — this step confirms the deployed configuration, not the logic.)

**3 — a real POST carries the same headers.**

```sh
curl -si -X POST "$API" \
  -H "Origin: $ORIGIN" \
  -H 'content-type: application/json' \
  -H 'accept: text/event-stream' \
  --data '{"messages":[{"role":"user","content":"what did Yordan do at Domestina?"}]}'
```

Expect `access-control-allow-origin: $ORIGIN` and `vary: Origin` on the response, an SSE
stream, and **exactly one** budget decrement for the whole conversation. A `429` with
`kind: "over_budget"` means the cap is reached, not that CORS is wrong.

**4 — the negative checks, which are the half that proves the mechanism.**

| Send | Expect |
| --- | --- |
| `OPTIONS` with `Origin: https://not-listed.example` | `405`, `Allow: POST`, and **no** `access-control-*` header of any kind |
| `POST` with `Origin: https://not-listed.example` | processed exactly as any other request — the answer streams — with **no** CORS header. It is not rejected, and that is deliberate: `Origin` is a hint a browser attaches, so treating it as authorisation would stop nobody who matters while changing the answer for `curl`, a server-side fetch and `evals/groundedness.mjs`. Withholding the header *is* the mechanism |
| `POST` with no `Origin` at all | byte-identical to the day before the allowlist existed |
| `Origin: https://<listed-origin>.evil.test` and `Origin: https://evil-<listed-origin>` | no CORS header on either — matching is exact equality, not prefix or substring |

**5 — the browser's own verdict, which is the only one that matters.** Open the second site,
ask the assistant a question, and watch the Network panel. A cross-origin failure shows as a
CORS error on the `POST` (or on the `OPTIONS` before it) with no response body reaching the
page, even though the server answered — which is exactly what CORS promises and why steps 1–4
cannot substitute for this one.

---

## What is deliberately not here

- **The WAF rate-limit rules.** They live in `api/CLAUDE.md`, next to the argument for the
  two different limits, and that is the right place for them.
- **`UPSTASH_REDIS_REST_URL` / `_TOKEN` / `DAILY_TOKEN_BUDGET`.** Same file, under "the token
  budget", including what happens when they are absent (a visible degradation, never a silent
  pass).
- **Anything that can be committed.** If a setting has a `vercel.json` key, it belongs in
  `vercel.json` and in `ARCHITECTURE.md`'s deploy section, not in a runbook.
