/* The assistant's three pieces of chrome — markup reproduced from index.html
   @ 2e84323, rendered through @yordan/design-system/react/{nav,ask-fab,drawer}.

   `.bar__action[data-ask]` is what hides the bar segment below 700px, where the
   chat becomes the corner pill instead; `aria-controls="ask-panel"` resolves to
   the drawer below. The open/close, the focus trap and the body lock are the
   port of js/main.js's layer stack in src/lib/vanilla/drawer.ts; the
   conversation inside is the port of js/chat.js in src/components/chat/.

   THE DRAWER IS LITERALLY THE LAST THING IN THE PAGE, after the footer, so
   that no ancestor can trap the fixed layer in a stacking context. Its words
   are hand-authored: nothing in here has a `content:` region, because none of
   them come from content/. The prose the assistant emits is model-authored;
   everything else it renders is resolved from content.json at runtime.

   WHICH CLASSES SURVIVE, AND WHY (the cutover's rule is in README.md — a class
   stays exactly when something other than the React tier names it):

     .ask-fab, .ask-fab__label   ask-fab's single authored gap, the two rules
                                 `$conditions` cannot name: reduced motion and
                                 `@media print`. Both list the label beside the
                                 pill, so both classes are load-bearing.
     .drawer, .drawer__scrim,    the reduced-motion block of components.css
     .drawer__sheet              (`@component none`, which will never have a
                                 React form) cancels all three transitions in
                                 one rule; four page stylesheets also hide
                                 `.drawer` in print. `.drawer__sheet` is
                                 additionally what src/lib/vanilla/drawer.ts
                                 focuses, and a port is a copy — its selectors
                                 are not this app's to re-point.

   `.bar__action`, `.bar__face`, `.bar__action-label`, `.ask-fab__face` and
   every `.drawer__` part below the sheet are named by nothing else and leave
   with the swap.

   ONE ELEMENT CHANGED TAG, AND IT IS A FIX RATHER THAN A COST. The sheet was
   `<aside role="dialog">` here; `DrawerSheet` renders the `<div>` that
   components/drawer/spec.md's canonical HTML has carried since the a11y gate
   found that `<aside role="dialog">` silently promoted its `<header>` into a
   SECOND banner landmark. index.html already says `<div class="drawer__sheet">`
   — this app was the surface still holding the old pair. */
import { AskFab as AskFabRoot, AskFabFace, AskFabLabel } from "@yordan/design-system/react/ask-fab";
import { Button } from "@yordan/design-system/react/button";
import {
  Drawer,
  DrawerBody,
  DrawerHead,
  DrawerHeading,
  DrawerPortrait,
  DrawerScrim,
  DrawerSheet,
  DrawerSubtitle,
  DrawerTitle,
} from "@yordan/design-system/react/drawer";
import { NavAction, NavActionLabel, NavFace } from "@yordan/design-system/react/nav";

import { ChatClient } from "@/components/chat/ChatClient";
import { chatEndpoint } from "@/lib/content";
import { ASK } from "@/lib/vanilla-copy";

const AVATAR = "/assets/avatar.svg";

/** The bar's Ask segment. `data-ask` is what hides it on a phone. */
export function AskAction() {
  return (
    <NavAction
      className="mono"
      type="button"
      aria-label={ASK.label}
      data-ask=""
      data-drawer-open="ask-panel"
      aria-controls="ask-panel"
      aria-expanded="false"
    >
      <NavFace src={AVATAR} alt="" aria-hidden="true" width={80} height={80} decoding="async" />
      <NavActionLabel>{ASK.label}</NavActionLabel>
    </NavAction>
  );
}

/** The chat where messages are expected on a phone: a pill at the corner. */
export function AskFab() {
  return (
    <AskFabRoot
      className="ask-fab"
      type="button"
      aria-label={ASK.label}
      data-ask-fab=""
      data-drawer-open="ask-panel"
      aria-controls="ask-panel"
      aria-expanded="false"
    >
      <AskFabFace src={AVATAR} alt="" aria-hidden="true" width={80} height={80} decoding="async" />
      <AskFabLabel className="ask-fab__label">{ASK.label}</AskFabLabel>
    </AskFabRoot>
  );
}

/** The drawer itself — last thing in the page, so no ancestor can trap it. */
export function AskDrawer() {
  return (
    <Drawer className="drawer" id="ask-panel" data-drawer="">
      <DrawerScrim className="drawer__scrim" data-drawer-close="" />
      <DrawerSheet
        className="drawer__sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
      >
        <DrawerHead>
          <DrawerPortrait>
            {/* alt="" on purpose: the heading beside it carries the meaning and
                the illustration is chrome. Never inlined — 160 KB of path data
                in every page is worse than one cached request. */}
            <img src={AVATAR} alt="" width={80} height={80} decoding="async" />
          </DrawerPortrait>
          <DrawerHeading>
            <DrawerTitle id="drawer-title">{ASK.title}</DrawerTitle>
            <DrawerSubtitle>{ASK.note}</DrawerSubtitle>
          </DrawerHeading>
          {/* `size="small"` is what `.btn--small` was: chrome context, one
              step down the padding ramp and one down the type ramp. The
              `data-drawer-close` contract is untouched — the port in
              src/lib/vanilla/drawer.ts finds this button by that attribute
              and knows nothing about how it is styled. */}
          <Button size="small" type="button" data-drawer-close="" aria-label="Close the assistant">
            {ASK.close}
          </Button>
        </DrawerHead>
        <DrawerBody>
          <ChatClient endpoint={chatEndpoint} />
        </DrawerBody>
      </DrawerSheet>
    </Drawer>
  );
}
