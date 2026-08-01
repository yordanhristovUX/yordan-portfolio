/* ============================================================
   The portfolio index — the same page as index.html, from the same corpus.

   Section for section, class for class, in the same order. What comes from
   content/dist/content.json is every word inside a `<!-- content:… -->` region
   on the vanilla page; what comes from src/lib/vanilla-copy.ts is the frame
   around those regions, which the corpus does not publish (see the header
   there). Nothing here is authored.

   THE MOTION HOOKS ARE KEPT — `data-rise`, `data-reveal`, `data-lines`. They
   are markup, not behaviour: css/style.css hides them only under the `js`
   class, which the vanilla page adds ONLY once GSAP is confirmed loaded. No
   script here adds it, so the page renders as static content, which is exactly
   what that contract promises for a reader whose scripts never arrive. The
   attributes are already where the motion port will look for them.

   EVERY DESIGN-SYSTEM ELEMENT BELOW IS A GENERATED REACT COMPONENT, and the
   design-system classes that remain beside them are there because something
   OTHER than the React tier names them. That is the cutover's whole rule and
   README.md states it once; per element the reason is:

     .sec         css/{cv,mcp,evals}.css   .sec__head  css/cv.css, and the
                                                       automata's wall scan
     .card        css/mcp.css `break-inside`, and FOUR of card's seven
                  authored gaps — `:nth-child(3n)`, the orphan-row pair and
                  the whole two-column restatement at 960px are the grid's
                  hairline arithmetic and cannot be class attributes at all
     .card-grid   the same 960px gap
     .card--reveal · .card__title · .card__note · .card__media
                  src/lib/vanilla/peek.ts reads all four, and card--reveal's
                  own clip rules address the last three by name
     .card__more  the `(hover: hover) and (pointer: fine)` gap that hides it
     .facts .fact .fact__title .fact__label   css/cv.css and css/evals.css
     .link-grid   css/{style,cv,mcp}.css     .profile  drawer.tsx's scoped rule
     .is-ok       profile's own scoped rule, on a class the corpus supplies

   `.card__type`, `.card--ruled`, `.sec__title`, `.sec__note` and `.sec--tint`
   are named by nothing else and left with the swap; the last two of those are
   now the props `variant="ruled"` and `variant="tint"`.

   `.idx*` is untouched: `project-row` is one of the five blocks AUTHORED WHOLE
   and has no React form, because `.idx li:last-child .idx__row` puts a
   positional in the middle of a descendant path.
   ============================================================ */
import type { Metadata } from "next";
import {
  Card,
  CardGrid,
  CardMore,
  CardNote,
  CardTitle,
  CardType,
} from "@yordan/design-system/react/card";
import { Chip } from "@yordan/design-system/react/chip";
import { DefinitionRow, DefinitionRowRow } from "@yordan/design-system/react/definition-row";
import { Fact, FactFact, FactLabel, FactTitle } from "@yordan/design-system/react/fact";
import { LinkGrid } from "@yordan/design-system/react/link-grid";
import { NavClock, NavDot, NavStatus } from "@yordan/design-system/react/nav";
import { Profile } from "@yordan/design-system/react/profile";
import {
  SectionHead,
  SectionHeadHead,
  SectionHeadNote,
  SectionHeadTitle,
} from "@yordan/design-system/react/section-head";

import { AppLink } from "@/components/AppLink";
import { AskAction, AskDrawer, AskFab } from "@/components/Ask";
import { Btn, Chips, GridLink, Strip, Term } from "@/components/primitives";
import { LocalTime } from "@/components/LocalTime";
import { PeekSheet } from "@/components/PeekSheet";
import { SiteBar } from "@/components/SiteBar";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteMenu } from "@/components/SiteMenu";
import {
  capabilities,
  caseStudies,
  facts,
  notablePlate,
  notableProjects,
  profile,
  siteUrl,
  skillRows,
} from "@/lib/content";
import { workUrl } from "@/lib/routes";
import {
  CARD_MORE,
  CONTACT,
  FOOTER,
  HERO,
  INDEX_BAR,
  INDEX_META,
  INDEX_MENU_NAV,
  INDEX_ROW_GO,
  INDEX_SECTIONS,
} from "@/lib/vanilla-copy";

import "@/styles/site/style.css";

export const metadata: Metadata = {
  title: INDEX_META.title,
  description: INDEX_META.description,
  alternates: { canonical: "/" },
  openGraph: {
    title: INDEX_META.ogTitle,
    description: INDEX_META.ogDescription,
    type: "website",
    url: siteUrl,
  },
  twitter: { card: "summary" },
};

export default function Page() {
  const S = INDEX_SECTIONS;
  return (
    <>
      <SiteBar
        id={INDEX_BAR.id}
        nav={[...INDEX_BAR.nav]}
        status={
          <NavStatus>
            {/* `.bar__dot` is the one part of the bar that keeps its class:
                the reduced-motion block of components.css — `@component none`,
                no component, so no definition and no React form ever —
                cancels its `blink`. */}
            <NavDot className="bar__dot" aria-hidden="true" />
            <span>
              {INDEX_BAR.status}
              <NavClock>
                , <LocalTime timeZone={profile.identity.location.timezone} />
              </NavClock>
            </span>
          </NavStatus>
        }
        action={<AskAction />}
      />

      <SiteMenu nav={INDEX_MENU_NAV} />
      <AskFab />

      <main id="top" className="sheet">
        {/* ============ HERO ============ */}
        <section className="band hero" aria-label="Introduction">
          <div className="well">
            <p className="hero__role t-label">{profile.identity.role}</p>
            <h1 className="hero__title t-display t-display--hero">
              {HERO.titleLines.map((word) => (
                <span className="hero__row" key={word}>
                  <span className="hero__word" data-rise="">
                    {word}
                  </span>
                </span>
              ))}
            </h1>
            <div className="hero__body">
              <p className="hero__lede">{profile.prose.heroLede}</p>
              <div className="hero__actions">
                {HERO.actions.map((a) => (
                  <Btn key={a.label} link={a} />
                ))}
              </div>
            </div>

            {/* `.profile` stays because the DRAWER reaches into it — nine of
                drawer's rules are about components it hosts, and two of them
                (`.drawer .profile` and `.drawer .profile > div:nth-child(odd)`)
                re-lay-out this list by name. `.is-ok` stays because profile's
                own scoped rule names it, and the class is the corpus's word
                for a row's status rather than this app's. */}
            <Profile className="profile mono">
              {profile.rows.map((row) => (
                <div key={row.term}>
                  <dt>{row.term}</dt>
                  <dd className={row.status === "ok" ? "is-ok" : undefined}>{row.value}</dd>
                </div>
              ))}
            </Profile>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 01 WHAT I DO ============ */}
        <SectionHead className="band sec" id={S.capabilities.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.capabilities.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well well--flush">
            <CardGrid className="card-grid">
              {capabilities.map((c) => (
                /* `.card--ruled` STAYS BESIDE `variant="ruled"`, and the
                   reason is an upstream defect rather than belt-and-braces —
                   see scripts/check-class-hooks.mjs. The variant's whole
                   effect is the scoped rule `.card--ruled .card__title`, and
                   in pipeline 2 that is the arbitrary variant
                   `[&_.card__title]:[border-top:...]`. Tailwind reads `_` in
                   an arbitrary variant as a SPACE, so it compiles to
                   `.card title` — a descendant <title> element — and the ink
                   bar above the title simply does not render. Measured
                   against the vanilla page: the card came out 15px shorter,
                   which is the 12px padding and the 3px rule. So the class
                   stays and components.css draws the bar. */
                <Card variant="ruled" className="card card--ruled" data-reveal="" key={c.id}>
                  <CardTitle className="card__title">{c.title}</CardTitle>
                  <p>{c.body}</p>
                </Card>
              ))}
            </CardGrid>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 02 SELECTED WORK ============ */}
        <SectionHead className="band sec" id={S.work.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.work.title}</SectionHeadTitle>
            <SectionHeadNote>{S.work.note}</SectionHeadNote>
          </SectionHeadHead>
          <div className="well well--flush">
            <ul className="idx" role="list">
              {caseStudies.map((p) => (
                <li key={p.id}>
                  {/* AN ANCHOR, NOT A BUTTON: a case study that cannot be
                      linked to, opened in a tab or bookmarked is the constraint
                      the modal used to impose. `AppLink` renders exactly that
                      `a`, and routes it through the client router. */}
                  <AppLink className="idx__row" href={workUrl(p.id)}>
                    <span className="idx__no mono">{String(p.index).padStart(2, "0")}</span>
                    <span className="idx__main">
                      <h3 className="idx__name">
                        {p.indexClient ?? p.client} <em>— {p.indexTitle ?? p.title}</em>
                      </h3>
                      <span className="idx__desc">{p.summary}</span>
                    </span>
                    {/* NOT a <ChipGroup>: the wrapper here is `.idx__tags`,
                        the row's own track, which provides the same wrap and
                        gap plus a `justify-content: flex-end` and a breakpoint
                        that hides the whole set. `.chips` would be a second
                        flex container inside it. The CHIPS are the design
                        system's; the container is the index row's. */}
                    <span className="idx__tags">
                      {p.indexTags.map((t) => (
                        <Chip key={t} variant={t === p.accentTag ? "solid" : "default"}>
                          {t}
                        </Chip>
                      ))}
                    </span>
                    <span className="idx__go mono" aria-hidden="true">
                      {INDEX_ROW_GO}
                    </span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 03 NOTABLE PROJECTS ============
            A peer of Selected work, not an appendix to it: these are shipped
            products in their own right. */}
        <SectionHead className="band sec" id={S.notable.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.notable.title}</SectionHeadTitle>
            {/* The same note slot Selected work uses above, and the same span:
                these nine have no case-study pages, so the pointer is the
                assistant. The component hides it below 640px, where the
                assistant is a corner button and the sentence would aim
                off-screen. */}
            <SectionHeadNote>{S.notable.note}</SectionHeadNote>
          </SectionHeadHead>
          <div className="well well--flush">
            <CardGrid className="card-grid">
              {notableProjects.map((p) => (
                <Card variant="reveal" className="card card--reveal" data-reveal="" key={p.id}>
                  {/* `.card__media` HAS NO REACT COMPONENT AND CANNOT HAVE ONE.
                      It is a SCOPED PART: it owns no rule of its own, and
                      everything it looks like is `.card--reveal`'s two clip
                      rules reaching down into it by name. design-system's
                      README states the consequence — "a scoped part exports
                      nothing" — so this span is written by hand, and the class
                      is what the reveal variant's `[&_.card__media]` utilities
                      and js/peek.js's port both bind to.

                      WIDTH AND HEIGHT ARE THE PLATE'S OWN, not the rendered
                      size: the row reserves its space before the file arrives
                      and the CSS aspect-ratio governs what is drawn. */}
                  <span className="card__media">
                    <img
                      src={notablePlate(p.id)}
                      alt=""
                      aria-hidden="true"
                      width={640}
                      height={400}
                      loading="lazy"
                      decoding="async"
                    />
                  </span>
                  {p.cardType ? <CardType>{p.cardType}</CardType> : null}
                  <CardTitle className="card__title">{p.title}</CardTitle>
                  <CardNote className="card__note">{p.summary}</CardNote>
                  {/* MOUNT POINT: the touch trigger is part of the card's own
                      markup — structure is authored, never injected. CSS shows
                      it only where hover cannot happen, and that rule is one of
                      card's seven authored gaps — `(hover: hover) and
                      (pointer: fine)` is a condition `$conditions` will not
                      name — so `.card__more` stays on the element. The port of
                      js/peek.js wires it by `[data-card-more]` and creates
                      nothing. */}
                  <CardMore className="card__more" type="button" aria-haspopup="dialog" data-card-more="">
                    {CARD_MORE}
                  </CardMore>
                </Card>
              ))}
            </CardGrid>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 04 BACKGROUND ============
            `variant="tint"` is what `.sec--tint` was. It is an EFFECT-ONLY
            modifier — it declares nothing on itself, and its entire effect is
            one scoped rule on the `.well` inside it, which is skeleton's class
            and not section-head's. */}
        <SectionHead variant="tint" className="band sec" id={S.background.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.background.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well">
            <p className="t-lead notes__prose" data-lines="">
              {profile.prose.background.prose}
            </p>
            <p className="t-statement notes__statement" data-lines="">
              {profile.prose.background.statement}
            </p>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 05 SKILLS ============ */}
        <SectionHead className="band sec">
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.skills.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well well--flush">
            {/* `.tools__row` keeps its class — three page stylesheets lay it
                out (css/cv.css on paper, css/evals.css and css/mcp.css on
                screen) — while `.tools` does not: definition-row's root is
                named by nothing outside its own definition. */}
            <DefinitionRow>
              {skillRows("site").map((row) => (
                <DefinitionRowRow className="tools__row" data-reveal="" key={row.term}>
                  <dt>{row.term}</dt>
                  <dd>{row.text}</dd>
                </DefinitionRowRow>
              ))}
            </DefinitionRow>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 06 UNEXPECTED FACTS ============
            Their own section, anchored at #unexpected — the same id cv.html
            uses, because the fact chunks cite that anchor on both pages. */}
        <SectionHead variant="tint" className="band sec" id={S.facts.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.facts.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well">
            {/* All four classes stay: css/cv.css dismantles the whole
                component for paper — `.facts` loses its border, `.fact` goes
                inline with a `·` separator, `.fact__title` changes level and
                `.fact__label` is dropped outright ("the one-line jokes
                survive; their explanations do not") — and css/evals.css adds
                `break-inside: avoid`. Print layout in a page stylesheet is not
                this app's to move. */}
            <Fact className="facts" data-reveal="">
              {facts.map((f) => (
                <FactFact className="fact" key={f.id}>
                  <FactTitle className="fact__title">{f.title}</FactTitle>
                  <FactLabel className="fact__label">{f.label}</FactLabel>
                </FactFact>
              ))}
            </Fact>
          </div>
          <Term />
        </SectionHead>

        <Strip />

        {/* ============ 07 CONTACT ============
            `.sec--contact` is css/style.css's own modifier, not a design-system
            variant — it is what spaces the link grid on this one section — so
            it rides as `className` and is unaffected by the swap. */}
        <SectionHead className="band sec sec--contact" id={S.contact.id}>
          <SectionHeadHead className="sec__head">
            <SectionHeadTitle className="t-title">{S.contact.title}</SectionHeadTitle>
          </SectionHeadHead>
          <div className="well">
            <p className="tx__kicker t-kicker">{CONTACT.kicker}</p>
            <a className="tx" href={`mailto:${profile.contact.email}`}>
              <span className="tx__big t-display t-display--xl" data-rise="">
                {CONTACT.bigLines.map((line, i) => (
                  <span key={line}>
                    {i > 0 ? <br /> : null}
                    {line}
                  </span>
                ))}
              </span>
              <span className="tx__mail mono">{profile.contact.email}</span>
            </a>
            <LinkGrid className="link-grid" data-reveal="">
              {CONTACT.links.map((l) => (
                <GridLink key={l.label} link={l} />
              ))}
            </LinkGrid>
          </div>
          {/* Contact gets one too: it is `grid-column: 2`, the well's own
              column, so the rails run past it on both sides — it closes a
              plate, not the page. */}
          <Term />
        </SectionHead>

        {/* The sheet closes on a strip, like every other section boundary: the
            last one is a boundary too, between the sheet and the footer. */}
        <Strip />
      </main>

      <SiteFooter link={FOOTER.index} />

      <AskDrawer />

      {/* Authored here, like the drawer above it, and for the stated reason:
          the page's geometry after scripts must be its geometry before them. */}
      <PeekSheet />
    </>
  );
}
