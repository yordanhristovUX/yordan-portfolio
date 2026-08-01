import {
  CardPeekSheet,
  CardSheetBody,
  CardSheetClose,
  CardSheetFrame,
  CardSheetHead,
  CardSheetNote,
  CardSheetPanel,
  CardSheetScrim,
  CardSheetTitle,
} from "@yordan/design-system/react/card";

import { PEEK } from "@/lib/vanilla-copy";

/* The notable cards' detail surface on touch — markup reproduced from
   index.html @ 2e84323, rendered through @yordan/design-system/react/card.

   AUTHORED, NOT INJECTED, and that is the whole reason it is a component rather
   than three lines inside the port. The page's geometry after scripts must be
   its geometry before them: the first version of js/peek.js injected this sheet
   and collapsed the cards from script, which changed heights AFTER the automata
   had measured the lattice and slid every band below the cards off the grid.

   Closed by CSS (`visibility: hidden` until `data-open`). The port fills it
   from the tapped card and toggles that one attribute — it creates nothing.
   z 350: over the bar and the menu, under the drawer.

   SIX OF THE NINE CLASSES STAY, for the two kinds of reason the whole cutover
   turns on (README.md states the rule):

     .peek-sheet            THREE of card's seven authored gaps are about it —
     .peek-sheet__panel     `body:has(.peek-sheet[data-open]) { overflow:
     .peek-sheet__scrim     hidden }`, the reduced-motion rule that cancels all
                            three transitions, and `@media print`. None of the
                            three can be a class attribute, so all three live
                            in components.css and all three need these names.
     .peek-sheet__title     src/lib/vanilla/peek.ts writes the tapped card's
     .peek-sheet__frame     title, image and description into these. It is a
     .peek-sheet__note      COPY of js/peek.js and its selectors are not this
                            app's to re-point — a fix belongs upstream and gets
                            re-copied, so a local rewrite would be undone by
                            the next copy and would be a fork in the meantime.

   `.peek-sheet__head`, `.peek-sheet__close` and `.peek-sheet__body` are named
   by nothing outside card's own definition and leave with the swap. The close
   button is still found by `[data-sheet-close]`, which is an attribute and was
   never a styling decision. */
export function PeekSheet() {
  return (
    <CardPeekSheet className="peek-sheet" data-peek-sheet="">
      <CardSheetScrim className="peek-sheet__scrim" data-sheet-close="" />
      <CardSheetPanel className="peek-sheet__panel" role="dialog" aria-modal="true" tabIndex={-1}>
        <CardSheetHead>
          <CardSheetTitle className="peek-sheet__title" />
          <CardSheetClose type="button" data-sheet-close="">
            {PEEK.close}
          </CardSheetClose>
        </CardSheetHead>
        <CardSheetBody>
          <CardSheetFrame className="peek-sheet__frame">
            <img alt="" decoding="async" hidden />
          </CardSheetFrame>
          <CardSheetNote className="peek-sheet__note" />
        </CardSheetBody>
      </CardSheetPanel>
    </CardPeekSheet>
  );
}
