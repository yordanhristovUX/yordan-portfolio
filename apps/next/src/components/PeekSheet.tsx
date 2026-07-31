import { PEEK } from "@/lib/vanilla-copy";

/* The notable cards' detail surface on touch — markup reproduced from
   index.html @ 2e84323.

   AUTHORED, NOT INJECTED, and that is the whole reason it is a component rather
   than three lines inside the port. The page's geometry after scripts must be
   its geometry before them: the first version of js/peek.js injected this sheet
   and collapsed the cards from script, which changed heights AFTER the automata
   had measured the lattice and slid every band below the cards off the grid.

   Closed by CSS (`visibility: hidden` until `data-open`). The port fills it
   from the tapped card and toggles that one attribute — it creates nothing.
   z 350: over the bar and the menu, under the drawer. */
export function PeekSheet() {
  return (
    <div className="peek-sheet" data-peek-sheet="">
      <div className="peek-sheet__scrim" data-sheet-close="" />
      <div className="peek-sheet__panel" role="dialog" aria-modal="true" tabIndex={-1}>
        <div className="peek-sheet__head">
          <span className="peek-sheet__title" />
          <button className="peek-sheet__close" type="button" data-sheet-close="">
            {PEEK.close}
          </button>
        </div>
        <div className="peek-sheet__body">
          <span className="peek-sheet__frame">
            <img alt="" decoding="async" hidden />
          </span>
          <p className="peek-sheet__note" />
        </div>
      </div>
    </div>
  );
}
