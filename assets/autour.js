const $ = id => document.getElementById(id);
// Filtres « Autour » : tri des lieux et phrase-conseil du filtre choisi
document.querySelectorAll(".filtres button").forEach(b => b.addEventListener("click", () => {
  const f = b.dataset.f;
  document.querySelectorAll(".filtres button").forEach(x => x.setAttribute("aria-pressed", x === b));
  document.querySelectorAll(".conseil").forEach(c => { c.hidden = c.dataset.c !== f; });
  document.querySelectorAll(".zones > div").forEach(z => {
    let vis = 0;
    z.querySelectorAll(".lieu").forEach(l => { const ok = f === "tout" || l.dataset.t.split(" ").includes(f); l.hidden = !ok; vis += ok; });
    const v = z.querySelector(".vide"); if (v) v.hidden = vis > 0;
  });
}));
