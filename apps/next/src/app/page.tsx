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
   ============================================================ */
import type { Metadata } from "next";
import { Chip } from "@yordan/design-system/react";

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
          <div className="bar__status">
            <span className="bar__dot" aria-hidden="true" />
            <span>
              {INDEX_BAR.status}
              <span className="bar__clock">
                , <LocalTime timeZone={profile.identity.location.timezone} />
              </span>
            </span>
          </div>
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

            <dl className="profile mono">
              {profile.rows.map((row) => (
                <div key={row.term}>
                  <dt>{row.term}</dt>
                  <dd className={row.status === "ok" ? "is-ok" : undefined}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 01 WHAT I DO ============ */}
        <section className="band sec" id={S.capabilities.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.capabilities.title}</h2>
          </header>
          <div className="well well--flush">
            <div className="card-grid">
              {capabilities.map((c) => (
                <article className="card card--ruled" data-reveal="" key={c.id}>
                  <h3 className="card__title">{c.title}</h3>
                  <p>{c.body}</p>
                </article>
              ))}
            </div>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 02 SELECTED WORK ============ */}
        <section className="band sec" id={S.work.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.work.title}</h2>
            <span className="sec__note">{S.work.note}</span>
          </header>
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
        </section>

        <Strip />

        {/* ============ 03 NOTABLE PROJECTS ============
            A peer of Selected work, not an appendix to it: these are shipped
            products in their own right. */}
        <section className="band sec" id={S.notable.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.notable.title}</h2>
            {/* The same note slot Selected work uses above, and the same span:
                these nine have no case-study pages, so the pointer is the
                assistant. components.css hides it below 640px, where the
                assistant is a corner button and the sentence would aim
                off-screen. */}
            <span className="sec__note">{S.notable.note}</span>
          </header>
          <div className="well well--flush">
            <div className="card-grid">
              {notableProjects.map((p) => (
                <article className="card card--reveal" data-reveal="" key={p.id}>
                  {/* WIDTH AND HEIGHT ARE THE PLATE'S OWN, not the rendered
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
                  {p.cardType ? <span className="card__type">{p.cardType}</span> : null}
                  <h3 className="card__title">{p.title}</h3>
                  <p className="card__note">{p.summary}</p>
                  {/* MOUNT POINT: the touch trigger is part of the card's own
                      markup — structure is authored, never injected. CSS shows
                      it only where hover cannot happen; the port of js/peek.js
                      wires it to the peek sheet and creates nothing. */}
                  <button className="card__more" type="button" aria-haspopup="dialog" data-card-more="">
                    {CARD_MORE}
                  </button>
                </article>
              ))}
            </div>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 04 BACKGROUND ============ */}
        <section className="band sec sec--tint" id={S.background.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.background.title}</h2>
          </header>
          <div className="well">
            <p className="t-lead notes__prose" data-lines="">
              {profile.prose.background.prose}
            </p>
            <p className="t-statement notes__statement" data-lines="">
              {profile.prose.background.statement}
            </p>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 05 SKILLS ============ */}
        <section className="band sec">
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.skills.title}</h2>
          </header>
          <div className="well well--flush">
            <dl className="tools">
              {skillRows("site").map((row) => (
                <div className="tools__row" data-reveal="" key={row.term}>
                  <dt>{row.term}</dt>
                  <dd>{row.text}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 06 UNEXPECTED FACTS ============
            Their own section, anchored at #unexpected — the same id cv.html
            uses, because the fact chunks cite that anchor on both pages. */}
        <section className="band sec sec--tint" id={S.facts.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.facts.title}</h2>
          </header>
          <div className="well">
            <div className="facts" data-reveal="">
              {facts.map((f) => (
                <div className="fact" key={f.id}>
                  <span className="fact__title">{f.title}</span>
                  <span className="fact__label">{f.label}</span>
                </div>
              ))}
            </div>
          </div>
          <Term />
        </section>

        <Strip />

        {/* ============ 07 CONTACT ============ */}
        <section className="band sec sec--contact" id={S.contact.id}>
          <header className="sec__head">
            <h2 className="sec__title t-title">{S.contact.title}</h2>
          </header>
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
            <div className="link-grid" data-reveal="">
              {CONTACT.links.map((l) => (
                <GridLink key={l.label} link={l} />
              ))}
            </div>
          </div>
          {/* Contact gets one too: it is `grid-column: 2`, the well's own
              column, so the rails run past it on both sides — it closes a
              plate, not the page. */}
          <Term />
        </section>

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
