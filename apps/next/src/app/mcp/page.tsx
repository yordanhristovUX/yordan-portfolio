/* ============================================================
   The MCP install page — reproduced from mcp.html @ 2e84323.

   THIS PAGE IS HAND-AUTHORED SOURCE, not generated output: mcp.html has no
   `<!-- content:… -->` regions and none of its words are in the corpus. So
   unlike every other page in this app, the prose below is copied from the page
   itself rather than read from content/dist/content.json — the same route
   src/lib/vanilla-copy.ts takes for index.html's frame, and for the same
   reason: the words exist, they are the owner's, and the second surface must
   not invent a different set. Character for character, at the commit above.
   If a sentence changes in mcp.html, this file is stale and gets re-copied —
   never reworded here.

   THE ONE THING NOT COPIED IS THE ENDPOINT. mcp.html writes
   `https://yordan-portfolio.vercel.app/api/mcp` in four places; here it is
   built from `profile.contact.site`, which is the same origin in the corpus.
   That is deliberate and it is not a rewrite: the MCP server runs on the
   VANILLA deployment, so this address must keep pointing there even when this
   app is served from somewhere else — which is exactly what a literal would
   fail to do, four times over, silently.
   ============================================================ */
import type { Metadata } from "next";
import { Card, CardGrid, CardTitle } from "@yordan/design-system/react/card";
import { Chip, ChipGroup } from "@yordan/design-system/react/chip";
import { DefinitionRow, DefinitionRowRow } from "@yordan/design-system/react/definition-row";
import { LinkGrid } from "@yordan/design-system/react/link-grid";
import {
  SectionHead,
  SectionHeadHead,
  SectionHeadNote,
  SectionHeadTitle,
} from "@yordan/design-system/react/section-head";

import { AppLink } from "@/components/AppLink";
import { Strip, Term } from "@/components/primitives";
import { SiteBar } from "@/components/SiteBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMenu } from "@/components/SiteMenu";
import { profile, siteUrl } from "@/lib/content";
import { FOOTER, MENU } from "@/lib/vanilla-copy";

import "@/styles/site/mcp.css";

export const metadata: Metadata = {
  title: "MCP server — Yordan Hristov",
  description:
    "Install this portfolio as a read-only MCP server and query the work, the CV, the case studies and the design system's own component contract from Claude Desktop, Claude Code or any MCP client. Eight tools, no auth, no writes.",
  alternates: { canonical: "/mcp" },
  openGraph: {
    title: "MCP server — Yordan Hristov",
    description:
      "Eight read-only tools over a product designer's portfolio corpus and the design system it is built on, served over streamable HTTP. Add it to Claude Desktop in one JSON block.",
    type: "article",
    url: `${siteUrl}/mcp`,
  },
  twitter: { card: "summary" },
};

const BAR = {
  id: { label: "← Home", href: "/" },
  nav: [
    { label: "Install", href: "#install" },
    { label: "Tools", href: "#tools" },
    { label: "Why MCP", href: "#why" },
  ],
};

const MENU_NAV = [{ label: MENU.home, href: "/" }, ...BAR.nav];

/** The tools table — eight rows, `dt` is the tool name as the server exposes it. */
const TOOLS: { name: string; body: React.ReactNode }[] = [
  {
    name: "list_projects",
    body: (
      <>
        The catalogue — every project as a compact record: id, title, client, period, tags and a
        one-line summary. Optional filters for tag, client and whether a full case study exists.
        Start here if you do not know what the corpus contains.
      </>
    ),
  },
  {
    name: "get_project",
    body: (
      <>
        One project in full: summary, subtitle, every body section in the order it was written,
        metrics, links, media slots and tags. Sections are an ordered array, and a section kind may
        appear more than once.
      </>
    ),
  },
  {
    name: "list_experience",
    body: (
      <>
        Employment history, most recent first — organisation, role, dates, location, working mode, a
        one-line descriptor and the bullet points for each role.
      </>
    ),
  },
  {
    name: "get_profile",
    body: (
      <>
        The person: identity, location, availability, contact details, the skills taxonomy,
        education, languages and three personal facts. These are structured fields, so this is the{" "}
        <em>only</em> tool that can answer “where is he based?” or “is he available?”.
      </>
    ),
  },
  {
    name: "get_system_facts",
    body: (
      <>
        The repository rather than the work: the design system&apos;s own token and component counts,
        corpus statistics, and the case study about how this site is built. Asked more often than you
        would expect.
      </>
    ),
  },
  {
    name: "search_content",
    body: (
      <>
        Semantic search across every chunk of the corpus, ranked by embedding similarity and falling
        back to lexical BM25 when the embedding service is unavailable — a <code>ranker</code> field
        on every response says which one ran. Results come back with their citations, and with a
        coverage verdict: <code>gateMatched</code> reports whether the query named any project,
        client, role, skill or fact this corpus actually contains. A null there does not empty the
        results; it means the passages below are the closest text rather than a claim that they
        answer the question.
      </>
    ),
  },
  {
    name: "get_design_system",
    body: (
      <>
        The machine-readable contract for the design system this page is built from: the token
        categories markup may draw on, an index of every component with what it is composed of, and
        the rules markup has to obey to be on-system. Derived from the shipped stylesheet by the
        design system&apos;s build, not written by hand. Call it before writing any markup.
      </>
    ),
  },
  {
    name: "get_component",
    body: (
      <>
        One component&apos;s contract: its block names, every class it defines, its{" "}
        <code>__element</code> and <code>--variant</code> suffixes, the full selector list, and the
        exact custom properties its CSS consumes. Plus one authored sentence stating its
        accessibility contract and the path to the spec that holds the reasoning — it reports what a
        component is <em>made of</em> and never describes it, because the description is
        human-written and belongs in that file.
      </>
    ),
  },
];

const LIMITS: { title: string; body: string }[] = [
  {
    title: "Read-only by construction",
    body: "No tool writes, mutates or sends anything. There is nothing to authorise, so the worst case of an abused endpoint is cost, never data.",
  },
  {
    title: "Stateless",
    body: "No session, no memory, no per-caller history. Each request is complete on its own and nothing about you is stored.",
  },
  {
    title: "A closed corpus",
    body: "One person's work, written by him. Ask it something outside that and search still ranks — but it says so, and the honest answer is that the corpus does not cover it.",
  },
  {
    title: "Spends no inference",
    body: "No model runs here. Your own client pays for the reasoning; this endpoint only hands it text — and ranks worse rather than failing if its embedding service is away.",
  },
  {
    title: "Rate limited",
    body: "Throttled per address at the edge, before the function runs. Fair use is generous; scraping is not the intended shape.",
  },
  {
    title: "Content, not a contract",
    body: "The corpus changes when the work does. Tool names and shapes are stable; the words inside them are meant to move.",
  },
];

export default function Page() {
  const endpoint = `${profile.contact.site.replace(/\/$/, "")}/api/mcp`;
  const desktopConfig = `{
  "mcpServers": {
    "yordan": {
      "url": "${endpoint}"
    }
  }
}`;
  const curl = `curl -s ${endpoint} \\
  -H 'content-type: application/json' \\
  -H 'accept: application/json, text/event-stream' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'`;

  return (
    <>
      <SiteBar id={BAR.id} nav={BAR.nav} />
      <SiteMenu nav={MENU_NAV} />

      <main id="top" className="sheet">
        {/* ============ HEAD ============ */}
        <section className="band mcp-head" aria-label="Introduction">
          <div className="well">
            <p className="mcp-head__kicker t-label">Model Context Protocol</p>
            <h1 className="mcp-head__title t-display t-display--lg">Ask your own agent</h1>
            <p className="mcp-head__lede t-lead">
              This portfolio is also a remote MCP server. Add one line to your client and your
              Claude — not a chat widget on someone else&apos;s website — can read the projects, the
              case studies, the CV and the design system&apos;s own component contract directly.
            </p>
            <div className="mcp-prose">
              <p>
                It is <strong>read-only, unauthenticated and stateless</strong>. Eight tools, no
                writes, no sign-up, no key. The interesting part is not that an MCP server exists; it
                is that these are the <em>same functions</em> the site&apos;s own assistant calls in
                process, so a bug cannot exist on one surface and not the other.
              </p>
              <p>
                Six of them read the corpus. The other two read the design system this page is built
                from — every class, every <code>__element</code> and <code>--variant</code> suffix,
                and the exact custom properties each component&apos;s CSS consumes, extracted from
                the shipped stylesheet by the system&apos;s own build. Your agent can write markup
                that is on-system rather than merely plausible, because the server cannot describe a
                class that does not exist.
              </p>
            </div>
            {/* `.mcp-head` is this page's own band, not a `.sec` — mcp.css
                gives it its own head. So the section element stays a plain
                <section>; only the four `.sec` bands below are section-head's.
                `.link-grid` keeps its class: `.mcp-head .link-grid` spaces it
                and the print block hides it. */}
            <LinkGrid className="link-grid">
              <a href="#install">Install it</a>
              <a href="#tools">See the tools</a>
              <AppLink href="/evals">Retrieval evaluation</AppLink>
              <a href={profile.contact.repo} target="_blank" rel="noopener">
                Source ↗
              </a>
            </LinkGrid>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 01 · INSTALL ============ */}
        <SectionHead id="install" className="band sec" aria-labelledby="install-title">
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle id="install-title" className="t-title">
              Install
            </SectionHeadTitle>
            <SectionHeadNote>Streamable HTTP · no authentication</SectionHeadNote>
          </SectionHeadHead>
          <div className="well">
            <div className="mcp-endpoint">
              <span className="mcp-endpoint__label mono">Endpoint</span>
              <code className="mcp-endpoint__url">{endpoint}</code>
              <ChipGroup>
                <Chip variant="solid">Read-only</Chip>
                <Chip>No auth</Chip>
                <Chip>Stateless</Chip>
                <Chip>8 tools</Chip>
              </ChipGroup>
            </div>

            <h3 className="mcp-sub t-label">Claude Code — one command</h3>
            <div className="mcp-prose">
              <p>
                The fastest route. Run it in any project; add <code>--scope user</code> to make it
                available everywhere.
              </p>
            </div>
            <pre className="mcp-code">
              <code>{`claude mcp add --transport http yordan ${endpoint}`}</code>
            </pre>
            <div className="mcp-prose">
              <p>
                Then ask, in Claude Code: <em>“What did Yordan do at Domestina?”</em> It will call{" "}
                <code>get_project</code> and answer from the returned text.
              </p>
            </div>

            <h3 className="mcp-sub t-label">Claude Desktop — config file</h3>
            <div className="mcp-prose">
              <p>
                Settings → Developer → Edit Config opens <code>claude_desktop_config.json</code>. On
                macOS it lives at <code>~/Library/Application Support/Claude/</code>; on Windows at{" "}
                <code>%APPDATA%\Claude\</code>. Paste the block below — if the file already has an{" "}
                <code>mcpServers</code> object, add the <code>&quot;yordan&quot;</code> entry inside
                it rather than creating a second one — then quit and reopen Claude Desktop.
              </p>
            </div>
            <pre className="mcp-code" id="claudeDesktopConfig">
              <code>{desktopConfig}</code>
            </pre>
            <div className="mcp-prose">
              <p>
                The tools then appear under the tools icon in the composer. Nothing needs to be
                installed locally: the server runs as a function on this site, not on your machine.
              </p>
            </div>

            <h3 className="mcp-sub t-label">Anything else</h3>
            <div className="mcp-prose">
              <p>
                Any client that speaks MCP streamable HTTP works — point it at the endpoint and{" "}
                <code>POST</code> JSON-RPC. There is no <code>GET</code> stream and no session id,
                because the server keeps no state between requests; every call is complete in one
                round trip. To look under the hood without a client at all:
              </p>
            </div>
            <pre className="mcp-code">
              <code>{curl}</code>
            </pre>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 02 · THE TOOLS ============ */}
        <SectionHead id="tools" className="band sec" aria-labelledby="tools-title">
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle id="tools-title" className="t-title">
              The tools
            </SectionHeadTitle>
            <SectionHeadNote>
              Six over the corpus, two over the design system — every one read-only
            </SectionHeadNote>
          </SectionHeadHead>
          <div className="well">
            <DefinitionRow>
              {TOOLS.map((t) => (
                <DefinitionRowRow className="tools__row" key={t.name}>
                  <dt>{t.name}</dt>
                  <dd>{t.body}</dd>
                </DefinitionRowRow>
              ))}
            </DefinitionRow>

            <p className="mcp-note">
              Every tool declares readOnlyHint · destructiveHint false · openWorldHint false — the
              protocol&apos;s own way of saying nothing here can change anything
            </p>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 03 · WHY MCP HERE ============ */}
        <SectionHead variant="tint" id="why" className="band sec" aria-labelledby="why-title">
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle id="why-title" className="t-title">
              Why MCP
            </SectionHeadTitle>
            <SectionHeadNote>And where it deliberately is not used</SectionHeadNote>
          </SectionHeadHead>
          <div className="well">
            <div className="mcp-prose">
              <p>
                <strong>MCP here is a distribution surface, not this app&apos;s internal boundary.</strong>{" "}
                That distinction is worth stating plainly, because putting an agent↔tool protocol
                behind a public web chat invites a fair question: is the protocol doing real work, or
                is it architecture worn as a costume?
              </p>
              <p>
                <strong>The tools are the asset; the protocol is one way to reach them.</strong> They
                live in <code>lib/knowledge/</code> as pure functions over a generated content index —
                no state, no dependencies, and no network beyond embedding the search query. The
                site&apos;s own assistant imports that module and calls it <em>in process</em>. This
                endpoint imports the same module and exposes the same functions to anyone; it reads
                the tool list rather than enumerating it, which is why the two design-system tools
                appeared here without a line of transport code changing. Two consumers, one core.
              </p>
              <p>
                <strong>The web chat does not call this endpoint, and that is deliberate.</strong>{" "}
                Routing it through here would mean the serverless function calling itself over HTTP
                once per tool call — an extra hundred to three hundred milliseconds per hop, a second
                cold-start path, and a self-referential dependency, all bought to satisfy a purity
                argument. The Claude API supports remote MCP servers natively, so this was a real
                option rather than a straw man. It was rejected on latency and on the self-call.
              </p>
              <p>
                <strong>What the endpoint adds is the thing a reader can take away.</strong> A chat
                widget only works while you are on the page. An MCP server installs into your tooling
                and answers from wherever you already work — inside a review, next to a job spec, in
                a terminal. That is the whole feature, and it costs a page and a JSON snippet.
              </p>
              <p>
                <strong>
                  Both surfaces share the core, so a tool bug cannot exist in one and not the other.
                </strong>{" "}
                That equivalence is the argument for the boundary being where it is — and it is also
                why the retrieval underneath got{" "}
                <AppLink href="/evals">measured and published</AppLink> rather than asserted.
              </p>
            </div>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 04 · LIMITS ============ */}
        <SectionHead id="limits" className="band sec" aria-labelledby="limits-title">
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle id="limits-title" className="t-title">
              Limits
            </SectionHeadTitle>
            <SectionHeadNote>What it will not do, stated up front</SectionHeadNote>
          </SectionHeadHead>
          <div className="well">
            {/* `.card` and `.card-grid` stay: css/mcp.css gives the card
                `break-inside: avoid` in print, and four of card's seven
                authored gaps are the grid's hairline arithmetic — the
                `:nth-child(3n)` right rule, the orphan-row pair, and the whole
                two-column restatement at 960px. None of those can be a class
                attribute, so they come from components.css and need the names.
                `.card--ruled` rides BESIDE `variant="ruled"` for the reason
                src/app/page.tsx spells out: the variant is an effect-only
                modifier whose whole effect is `.card--ruled .card__title`, and
                Tailwind compiles that arbitrary variant to `.card title`
                because `_` means a space in one. Upstream defect; the class
                keeps the ink bar drawn until it is fixed. */}
            <CardGrid className="card-grid">
              {LIMITS.map((l) => (
                <Card variant="ruled" className="card card--ruled" key={l.title}>
                  <CardTitle className="card__title">{l.title}</CardTitle>
                  <p>{l.body}</p>
                </Card>
              ))}
            </CardGrid>
          </div>
          <Term />
        </SectionHead>
      </main>

      <SiteFooter link={FOOTER.cv} />
    </>
  );
}
