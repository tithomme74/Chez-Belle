// Photos agrandissables : un clic (ou Entrée) sur une photo de la galerie l'ouvre en grand.
(() => {
  const figs = [...document.querySelectorAll(".galerie figure")];
  if (!figs.length || typeof HTMLDialogElement === "undefined") return;
  const dlg = document.createElement("dialog");
  dlg.className = "lb";
  dlg.setAttribute("aria-label", "Photo agrandie");
  dlg.innerHTML = '<img alt=""><p class="lb-cap"></p><div class="lb-bar"><button type="button" data-d="-1" aria-label="Photo précédente">←</button><button type="button" data-x aria-label="Fermer">✕</button><button type="button" data-d="1" aria-label="Photo suivante">→</button></div>';
  document.body.append(dlg);
  const img = dlg.querySelector("img"), cap = dlg.querySelector(".lb-cap");
  const grande = im => { const s = im.getAttribute("srcset"); return s ? s.split(",").pop().trim().split(" ")[0] : im.getAttribute("src"); };
  let i = 0;
  const show = k => {
    i = (k + figs.length) % figs.length;
    const im = figs[i].querySelector("img"), fc = figs[i].querySelector("figcaption");
    img.src = grande(im); img.alt = im.alt; cap.textContent = fc ? fc.textContent : "";
  };
  figs.forEach((f, k) => {
    const im = f.querySelector("img");
    f.tabIndex = 0; f.setAttribute("role", "button"); f.setAttribute("aria-label", "Agrandir la photo : " + im.alt);
    const open = () => { show(k); dlg.showModal(); };
    f.addEventListener("click", open);
    f.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  });
  dlg.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (b && b.dataset.d) show(i + Number(b.dataset.d));
    else if ((b && "x" in b.dataset) || e.target === dlg) dlg.close();
  });
  // Bouton « Voir les N photos » : ouvre la première photo en grand
  document.querySelectorAll("[data-galerie-ouvrir]").forEach(b => b.addEventListener("click", () => { show(0); dlg.showModal(); }));
  dlg.addEventListener("keydown", e => { if (e.key === "ArrowLeft") show(i - 1); if (e.key === "ArrowRight") show(i + 1); });
})();
