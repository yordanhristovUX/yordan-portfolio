/* The assistant's three pieces of chrome — markup reproduced from index.html
   @ 2e84323.

   `.bar__action[data-ask]` is what hides the bar segment below 700px, where the
   chat becomes the corner pill instead; `aria-controls="ask-panel"` resolves to
   the drawer below. The open/close, the focus trap and the body lock are the
   port of js/main.js's layer stack in src/lib/vanilla/drawer.ts; the
   conversation inside is the port of js/chat.js in src/components/chat/.

   THE DRAWER IS LITERALLY THE LAST THING IN THE PAGE, after the footer, so
   that no ancestor can trap the fixed layer in a stacking context. Its words
   are hand-authored: nothing in here has a `content:` region, because none of
   them come from content/. The prose the assistant emits is model-authored;
   everything else it renders is resolved from content.json at runtime. */
import { Button } from "@yordan/design-system/react";

import { ChatClient } from "@/components/chat/ChatClient";
import { chatEndpoint } from "@/lib/content";
import { ASK } from "@/lib/vanilla-copy";

const AVATAR = "/assets/avatar.svg";

/** The bar's Ask segment. `data-ask` is what hides it on a phone. */
export function AskAction() {
  return (
    <button
      className="bar__action mono"
      type="button"
      aria-label={ASK.label}
      data-ask=""
      data-drawer-open="ask-panel"
      aria-controls="ask-panel"
      aria-expanded="false"
    >
      <img
        className="bar__face"
        src={AVATAR}
        alt=""
        aria-hidden="true"
        width={80}
        height={80}
        decoding="async"
      />
      <span className="bar__action-label">{ASK.label}</span>
    </button>
  );
}

/** The chat where messages are expected on a phone: a pill at the corner. */
export function AskFab() {
  return (
    <button
      className="ask-fab"
      type="button"
      aria-label={ASK.label}
      data-ask-fab=""
      data-drawer-open="ask-panel"
      aria-controls="ask-panel"
      aria-expanded="false"
    >
      <img
        className="ask-fab__face"
        src={AVATAR}
        alt=""
        aria-hidden="true"
        width={80}
        height={80}
        decoding="async"
      />
      <span className="ask-fab__label">{ASK.label}</span>
    </button>
  );
}

/** The drawer itself — last thing in the page, so no ancestor can trap it. */
export function AskDrawer() {
  return (
    <div className="drawer" id="ask-panel" data-drawer="">
      <div className="drawer__scrim" data-drawer-close="" />
      <aside className="drawer__sheet" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabIndex={-1}>
        <header className="drawer__head">
          <span className="drawer__portrait">
            {/* alt="" on purpose: the heading beside it carries the meaning and
                the illustration is chrome. Never inlined — 160 KB of path data
                in every page is worse than one cached request. */}
            <img src={AVATAR} alt="" width={80} height={80} decoding="async" />
          </span>
          <span className="drawer__heading">
            <h2 className="drawer__title" id="drawer-title">
              {ASK.title}
            </h2>
            <p className="drawer__note">{ASK.note}</p>
          </span>
          {/* `size="small"` is what `.btn--small` was: chrome context, one
              step down the padding ramp and one down the type ramp. The
              `data-drawer-close` contract is untouched — the port in
              src/lib/vanilla/drawer.ts finds this button by that attribute
              and knows nothing about how it is styled. */}
          <Button size="small" type="button" data-drawer-close="" aria-label="Close the assistant">
            {ASK.close}
          </Button>
        </header>
        <div className="drawer__body">
          <ChatClient endpoint={chatEndpoint} />
        </div>
      </aside>
    </div>
  );
}
