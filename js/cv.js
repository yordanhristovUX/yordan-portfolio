/* ============================================================
   CV page — the two things this page needs from JS.
   No GSAP here: a CV is a document. It should be readable the
   instant it renders, and it must survive being printed, which
   scroll-triggered reveals actively fight.
   ============================================================ */
(() => {
  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-print]")) window.print();
  });
})();
