const $ = id => document.getElementById(id);
// Filtres « Autour »
document.querySelectorAll(".filtres button").forEach(b => b.addEventListener("click", () => {
  const f = b.dataset.f;
  document.querySelectorAll(".filtres button").forEach(x => x.setAttribute("aria-pressed", x === b));
  document.querySelectorAll(".zones > div").forEach(z => {
    let vis = 0;
    z.querySelectorAll(".lieu").forEach(l => { const ok = f === "tout" || l.dataset.t.split(" ").includes(f); l.hidden = !ok; vis += ok; });
    const v = z.querySelector(".vide"); if (v) v.hidden = vis > 0;
  });
  $("chien-info").hidden = f !== "chien";
}));
