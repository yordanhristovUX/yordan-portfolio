/* The assistant's three pieces of chrome — markup reproduced from index.html
   @ 2e84323. ALL THREE ARE MOUNT POINTS: this run builds the static pages, and
   the behaviour behind these controls is two later ones — the drawer's open/
   close and focus trap (port of js/main.js's layer stack) with the chrome run,
   and the conversation itself (port of js/chat.js, with the verbatim replay
   rule, the 45s deadline and the block-vs-corpus race) with the chat client.

   They are here rather than deferred because the SHAPE is load-bearing now:
   `.bar__action[data-ask]` is what hides the bar segment below 700px, where
   the chat becomes the corner pill instead, and `aria-controls="ask-panel"`
   has to resolve to something for the announcement to be true. What lands
   later is listeners, not markup.

   Why the drawer's body is empty rather than carrying the composer: a <form>
   with a submit button and no handler NAVIGATES. An inert dialog that never
   opens is a scaffold; a form that reloads the page when a reader finds it is
   a bug. The head is the part that is already final. */
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
          <button className="btn btn--small" type="button" data-drawer-close="" aria-label="Close the assistant">
            {ASK.close}
          </button>
        </header>
        <div className="drawer__body">
          {/* MOUNT POINT: <ChatClient /> — the port of js/chat.js. It owns the
              thread, the composer, the four seed questions and the provenance
              line; all four strings are already in src/lib/vanilla-copy.ts
              under CHAT, copied from the same markup this drawer came from. */}
        </div>
      </aside>
    </div>
  );
}
