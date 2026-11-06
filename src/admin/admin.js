// Espace d'administration Chez Belle.
// Les formulaires sont construits automatiquement à partir des schémas (src/_lib/schemas.js) :
// ajouter un champ au schéma suffit pour qu'il apparaisse ici. Aucun contenu n'est inséré en HTML brut.
import { SCHEMAS, valider, coherence } from "/admin/schemas.js";

// Rubriques dans l'ordre du menu : [nom du contenu, titre, page du site concernée, description]
const RUBRIQUES = [
  ["accueil", "Accueil", "/", "accroche, points clés, photos, zoom prix"],
  ["logement", "Le logement", "/chez-belle/", "galerie, chiffres, équipements"],
  ["tarifs", "Prix et calendrier", "/tarifs-reservation/", "prix, périodes, durées, chien, dépôt"],
  ["reservation", "Page Tarifs : textes", "/tarifs-reservation/", "compris, étapes, formulaire, questions"],
  ["autour", "Autour", "/autour/", "filtres, lieux, conseils"],
  ["site", "Commun à toutes les pages", "/", "menu, pied de page, e-mail"],
  ["avis", "Avis Airbnb", "/#avis", "automatique, lecture seule"],
  ["aide", "Mode d’emploi", "/", "comment modifier et publier"]
];
const JETONS = "{prix_min} prix le plus bas · {depot} dépôt · {annee} année · {chien_court} {chien_long} {chien_seuil} chien · {nb_photos} nombre de photos · {prix:noel} prix d’une période · {semaine:coeur} prix à la semaine";

const etat = { nom: null, donnees: null, version: null, original: "", autres: {}, jsonInvalide: new Set() };
const $ = id => document.getElementById(id);

// ---------- Petits outils DOM ----------
function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "class") e.className = v;
    else if (k === "dataset") Object.assign(e.dataset, v);
    else if (k in e && typeof v !== "string") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of enfants.flat()) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
const clone = o => JSON.parse(JSON.stringify(o));

// ---------- Appels à l'API ----------
async function api(methode, url, corps) {
  const r = await fetch(url, {
    method: methode, credentials: "same-origin",
    headers: corps !== undefined ? { "Content-Type": "application/json" } : {},
    body: corps !== undefined ? JSON.stringify(corps) : undefined
  });
  let j = {};
  try { j = await r.json(); } catch { /* réponse vide */ }
  if (r.status === 401 && !url.endsWith("/connexion")) { afficherConnexion("Votre session a expiré : reconnectez-vous."); throw Object.assign(new Error(j.erreur || "Session expirée"), { statut: 401 }); }
  if (!r.ok) throw Object.assign(new Error(j.erreur || `Erreur ${r.status}`), { statut: r.status, details: j });
  return j;
}

// ---------- Connexion ----------
function afficherConnexion(message = "") {
  $("chargement").hidden = true;
  $("ecran-admin").hidden = true;
  $("ecran-connexion").hidden = false;
  $("erreur-connexion").hidden = !message;
  $("erreur-connexion").textContent = message;
  $("mdp").value = "";
  $("mdp").focus();
}
$("form-connexion").addEventListener("submit", async e => {
  e.preventDefault();
  const bouton = e.submitter; if (bouton) bouton.disabled = true;
  try {
    await api("POST", "/api/connexion", { motDePasse: $("mdp").value });
    $("mdp").value = "";
    await afficherAdmin();
  } catch (err) {
    $("erreur-connexion").hidden = false; $("erreur-connexion").textContent = err.message;
  } finally { if (bouton) bouton.disabled = false; }
});
$("deconnexion").addEventListener("click", async () => {
  if (modifie() && !confirm("Des modifications ne sont pas enregistrées. Se déconnecter quand même ?")) return;
  await api("POST", "/api/deconnexion", {}).catch(() => {});
  etat.nom = null; etat.original = JSON.stringify(etat.donnees);
  afficherConnexion();
});

// ---------- Navigation ----------
async function afficherAdmin() {
  $("chargement").hidden = true;
  $("ecran-connexion").hidden = true;
  $("ecran-admin").hidden = false;
  const nav = $("rubriques"); nav.replaceChildren();
  for (const [nom, titre, , desc] of RUBRIQUES)
    nav.append(el("button", { type: "button", dataset: { nom }, onclick: () => ouvrir(nom) }, titre, el("small", {}, desc)));
  majBrouillon();
  const depuisAdresse = location.hash.slice(1);
  await ouvrir(RUBRIQUES.some(r => r[0] === depuisAdresse) ? depuisAdresse : "accueil");
}
window.addEventListener("hashchange", () => {
  const n = location.hash.slice(1);
  if (n !== etat.nom && RUBRIQUES.some(r => r[0] === n) && !$("ecran-admin").hidden) ouvrir(n);
});
$("ouvrir-menu").addEventListener("click", () => $("rubriques").classList.toggle("ouvert"));

const modifie = () => etat.nom && etat.nom !== "avis" && JSON.stringify(etat.donnees) !== etat.original;
window.addEventListener("beforeunload", e => { if (modifie()) { e.preventDefault(); e.returnValue = ""; } });

async function ouvrir(nom) {
  if (nom !== etat.nom && modifie() && !confirm("Des modifications ne sont pas enregistrées. Les abandonner ?")) return;
  $("rubriques").classList.remove("ouvert");
  for (const b of $("rubriques").children) b.setAttribute("aria-current", String(b.dataset.nom === nom));
  history.replaceState(null, "", "#" + nom);
  if (nom === "aide") {
    Object.assign(etat, { nom, donnees: null, version: null, original: "null" });
    $("pied-enregistrer").hidden = true;
    $("zone").replaceChildren(...modeEmploi());
    window.scrollTo(0, 0);
    return;
  }
  $("zone").replaceChildren(el("p", { class: "aide" }, "Chargement…"));
  try {
    const c = await api("GET", "/api/contenus/" + nom);
    // Contenus voisins nécessaires aux listes de choix et aux contrôles de cohérence
    etat.autres = {};
    for (const n of ["tarifs", "accueil", "autour"]) if (n !== nom) etat.autres[n] = (await api("GET", "/api/contenus/" + n)).donnees;
    Object.assign(etat, { nom, donnees: c.donnees, version: c.version, original: JSON.stringify(c.donnees), jsonInvalide: new Set() });
    dessiner();
  } catch (err) {
    if (err.statut !== 401) $("zone").replaceChildren(el("p", { class: "erreur" }, err.message));
  }
}

// ---------- Affichage d'une rubrique ----------
function dessiner(erreurs = []) {
  const [nom, titre, page] = RUBRIQUES.find(r => r[0] === etat.nom);
  const zone = $("zone");
  const scroll = window.scrollY;
  const entete = el("div", { class: "entete-rubrique" }, el("h1", {}, titre), el("a", { href: page, target: "_blank", rel: "noopener" }, "Voir la page ↗"));
  if (nom === "avis") {
    zone.replaceChildren(entete, vueAvis(etat.donnees));
    $("pied-enregistrer").hidden = true;
    return;
  }
  const blocs = [entete];
  if (erreurs.length) blocs.push(el("div", { class: "bandeau-erreurs", role: "alert" },
    el("strong", {}, "À corriger avant d’enregistrer :"),
    el("ul", {}, erreurs.slice(0, 12).map(e => el("li", {}, e.message))),
    erreurs.length > 12 ? el("p", {}, `… et ${erreurs.length - 12} autre(s).`) : null));
  if (nom === "tarifs") blocs.push(el("div", { class: "bandeau-info" }, "Les prix saisis ici sont repris partout : grille, zoom de l’accueil, barre du bas, estimation, et les textes qui contiennent {prix_min}, {depot}…"));
  const schema = SCHEMAS[nom];
  for (const [k, s] of Object.entries(schema.champs))
    blocs.push(noeud(s, () => etat.donnees[k], v => { etat.donnees[k] = v; }, k));
  blocs.push(blocHistorique(nom));
  zone.replaceChildren(...blocs);
  $("pied-enregistrer").hidden = false;
  marquerErreurs(erreurs);
  majEtat();
  window.scrollTo(0, scroll);
}

function vueAvis(d) {
  return el("div", {},
    el("div", { class: "bandeau-info" }, "Ces avis et notes sont mis à jour automatiquement par le skill « maj-avis-chez-belle ». Ils ne sont pas modifiables ici.",
      d.mis_a_jour ? el("p", {}, el("strong", {}, "Dernière mise à jour : "), new Date(d.mis_a_jour + "T12:00:00").toLocaleDateString("fr-FR", { dateStyle: "long" })) : null),
    el("details", { class: "groupe" }, el("summary", {}, "Mettre à jour les avis"), el("div", {},
      el("ol", {},
        el("li", {}, "Dans l’application Claude, lancez le skill « maj-avis-chez-belle » (Thomas)."),
        el("li", {}, "Il relève la note et les derniers avis sur Airbnb, vous fait valider les 6 extraits, les contrôle, puis les publie directement (sans passer par le brouillon)."),
        el("li", {}, "Le site est à jour une à deux minutes après la fin du skill ; rechargez cette page pour voir la nouvelle date.")),
      el("p", { class: "aide" }, "Le brouillon en cours n’est pas touché par cette mise à jour."))),
    el("div", { class: "lecture" },
      el("p", {}, el("strong", {}, `Note globale ${d.notes.globale} sur ${d.notes.nombre} avis`), " · ", d.notes.categories.map(c => `${c.nom} ${c.note}`).join(" · ")),
      d.avis.map(a => el("figure", {}, el("blockquote", {}, a.extrait), el("figcaption", { class: "aide" }, `${a.prenom} · ${a.date}`)))));
}

// ---------- Construction des champs à partir du schéma ----------
// lire() renvoie la valeur actuelle, ecrire(v) la remplace ; chemin = même notation que les erreurs du serveur
function changement() { majEtat(); }

function noeud(s, lire, ecrire, chemin) {
  switch (s.type) {
    case "objet": return blocObjet(s, lire, ecrire, chemin);
    case "liste": return blocListe(s, lire, ecrire, chemin);
    case "dictionnaire": return blocDictionnaire(s, lire, ecrire, chemin);
    case "photo": return blocPhoto(s, lire, ecrire, chemin);
    default: return champSimple(s, lire, ecrire, chemin);
  }
}

function blocObjet(s, lire, ecrire, chemin) {
  const enfants = Object.entries(s.champs).map(([k, sc]) => noeud(sc,
    () => (lire() || {})[k],
    v => { let o = lire(); if (!o) { o = {}; ecrire(o); } o[k] = v; },
    chemin ? `${chemin}.${k}` : k));
  if (s.replie || s.avance) {
    return el("details", { class: "groupe", dataset: { chemin } }, el("summary", {}, s.label + (s.avance ? " (réglages avancés)" : "")), el("div", {}, enfants));
  }
  return el("fieldset", { dataset: { chemin } }, el("legend", {}, s.label), enfants);
}

function champSimple(s, lire, ecrire, chemin) {
  const id = "c-" + chemin.replace(/[^a-z0-9]+/gi, "-");
  const v = lire();
  const set = val => { ecrire(val); changement(); };
  let entree, outils = null, compteur = null, compter = () => {};

  if (s.type === "texte" && s.ref) {
    entree = el("select", { id, onchange: e => set(e.target.value) },
      choixReference(s.ref).map(([k, l]) => el("option", { value: k, selected: k === v }, l)));
    if (!choixReference(s.ref).some(([k]) => k === v)) entree.prepend(el("option", { value: v ?? "", selected: true }, `${v || "—"} (inconnu)`));
  } else if (s.type === "texte" || s.type === "lien") {
    const multi = s.lignes && s.lignes > 1 || (s.type === "texte" && (s.max || 0) > 300);
    entree = el(multi ? "textarea" : "input", {
      id, rows: multi ? (s.lignes || 3) : undefined, type: multi ? undefined : "text",
      placeholder: s.type === "lien" ? "https://… ou /page/ ou #ancre" : undefined,
      oninput: e => { set(e.target.value); compter(); }
    });
    entree.value = v ?? "";
    if (s.max) {
      compteur = el("span", { class: "compteur" });
      compter = () => { const n = entree.value.length; compteur.textContent = `${n} / ${s.max}`; compteur.classList.toggle("trop", n > s.max); };
      compter();
    }
    if (s.riche) outils = barreMiseEnForme(entree, () => { set(entree.value); compter(); });
  } else if (s.type === "nombre") {
    entree = el("input", { id, type: "number", min: s.min, max: s.max, step: s.entier ? 1 : "any", oninput: e => set(e.target.value === "" ? null : Number(e.target.value)) });
    entree.value = v ?? "";
  } else if (s.type === "date") {
    entree = el("input", { id, type: "date", oninput: e => set(e.target.value) });
    entree.value = v ?? "";
  } else if (s.type === "booleen") {
    entree = el("input", { id, type: "checkbox", checked: v === true, onchange: e => set(e.target.checked) });
    return el("div", { class: "champ", dataset: { chemin } }, el("label", { class: "case", for: id }, entree, s.label), aide(s));
  } else if (s.type === "choix") {
    entree = el("select", { id, onchange: e => set(e.target.value) }, s.valeurs.map(([k, l]) => el("option", { value: k, selected: k === (v ?? "") }, l)));
  } else if (s.type === "json") {
    entree = el("textarea", { id, rows: 8, spellcheck: "false", class: "json" });
    entree.value = JSON.stringify(v ?? {}, null, 2);
    const msg = el("div", { class: "msg-erreur" });
    entree.addEventListener("input", () => {
      try { ecrire(JSON.parse(entree.value)); etat.jsonInvalide.delete(chemin); msg.textContent = ""; }
      catch { etat.jsonInvalide.add(chemin); msg.textContent = "JSON incorrect : corrigez avant d’enregistrer."; }
      changement();
    });
    return el("div", { class: "champ", dataset: { chemin } }, el("label", { for: id }, s.label), aide(s), entree, msg);
  }
  return el("div", { class: "champ", dataset: { chemin } },
    el("label", { for: id }, s.label, s.optionnel ? el("span", { class: "aide" }, " (facultatif)") : null, compteur),
    aide(s), outils, entree);
}

function aide(s) {
  const t = [s.aide, s.riche ? "Mise en forme : gras, italique, lien. Jetons possibles : " + JETONS : null].filter(Boolean);
  return t.length ? el("p", { class: "aide" }, t.join(" — ")) : null;
}

// Gras / italique / lien : entoure la sélection des balises autorisées
function barreMiseEnForme(zone, apres) {
  const entourer = (avant, fin) => {
    const { selectionStart: a, selectionEnd: b, value } = zone;
    zone.value = value.slice(0, a) + avant + value.slice(a, b) + fin + value.slice(b);
    zone.focus(); zone.setSelectionRange(a + avant.length, b + avant.length); apres();
  };
  return el("div", { class: "outils" },
    el("button", { type: "button", title: "Gras", onclick: () => entourer("<b>", "</b>") }, el("b", {}, "G")),
    el("button", { type: "button", title: "Italique", onclick: () => entourer("<em>", "</em>") }, el("em", {}, "I")),
    el("button", { type: "button", title: "Lien", onclick: () => {
      const url = prompt("Adresse du lien (https://… ou /page/ du site) :", "https://");
      if (url && /^(https?:\/\/|\/|#|mailto:|tel:)/.test(url)) entourer(`<a href="${url.replace(/"/g, "")}">`, "</a>");
    } }, "Lien"));
}

// Listes de choix qui renvoient à un autre contenu (périodes de prix, colonnes, filtres)
function choixReference(ref) {
  const source = n => n === etat.nom ? etat.donnees : etat.autres[n] || {};
  if (ref === "tarifs.types") return Object.entries(source("tarifs").types || {}).map(([k, t]) => [k, `${t.label} (${t.prix} €/nuit)`]);
  if (ref === "autour.zones") return (source("autour").zones || []).map(z => [z.cle, z.titre]);
  if (ref === "autour.filtres") return (source("autour").filtres || []).map(f => [f.cle, f.label]);
  return [];
}

// ---------- Listes ----------
function valeurParDefaut(s) {
  switch (s.type) {
    case "texte": return s.ref ? (choixReference(s.ref)[0] || [""])[0] : "";
    case "nombre": return s.min ?? 0;
    case "booleen": return false;
    case "choix": return s.valeurs[0][0];
    case "liste": return [];
    case "dictionnaire": return {};
    case "json": return {};
    case "objet": return Object.fromEntries(Object.entries(s.champs).filter(([, c]) => !c.optionnel).map(([k, c]) => [k, valeurParDefaut(c)]));
    default: return "";
  }
}

function blocListe(s, lire, ecrire, chemin) {
  const liste = () => { let l = lire(); if (!Array.isArray(l)) { l = []; ecrire(l); } return l; };
  // Liste de références (filtres d'un lieu, périodes d'une carte) : cases à cocher
  if (s.de.ref) {
    const choisis = new Set(lire() || []);
    return el("div", { class: "champ", dataset: { chemin } }, el("span", { class: "titre-champ" }, s.label), aide(s),
      el("div", { class: "cases" }, choixReference(s.de.ref).map(([k, l]) => el("label", {},
        el("input", { type: "checkbox", checked: choisis.has(k), onchange: e => {
          const actuels = liste().filter(x => x !== k);
          if (e.target.checked) actuels.push(k);
          const ordre = choixReference(s.de.ref).map(([c]) => c);
          ecrire(actuels.sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b))); changement();
        } }), l))));
  }
  const simple = !["objet", "photo", "liste"].includes(s.de.type);
  const items = lire() || [];
  const conteneur = el("div", { class: "liste" + (simple ? " simple" : "") });
  items.forEach((item, i) => {
    const c = `${chemin}[${i}]`;
    const boutons = [
      el("button", { type: "button", class: "icone", title: "Monter", disabled: i === 0, onclick: () => deplacer(liste(), i, -1) }, "↑"),
      el("button", { type: "button", class: "icone", title: "Descendre", disabled: i === items.length - 1, onclick: () => deplacer(liste(), i, 1) }, "↓"),
      el("button", { type: "button", class: "icone suppr", title: "Supprimer", disabled: items.length <= (s.min || 0), onclick: () => {
        if (!simple && !confirm("Supprimer cet élément ?")) return;
        liste().splice(i, 1); changement(); dessiner();
      } }, "✕")
    ];
    const contenu = noeud(s.de, () => liste()[i], v => { liste()[i] = v; }, c);
    if (simple) conteneur.append(el("div", { class: "element", dataset: { chemin: c } }, contenu, boutons));
    else {
      const nom = titreElement(s, item, i);
      conteneur.append(el("div", { class: "element", dataset: { chemin: c } }, el("div", { class: "tete" }, el("span", { class: "nom" }, nom), boutons), el("div", { class: "corps" }, contenu)));
    }
  });
  const plein = items.length >= s.max;
  const ajouter = s.de.type === "photo"
    ? boutonEnvoiPhoto("+ Ajouter une photo", plein, async photo => {
        const p = { ...photo, alt: "", legende: "" };
        if (chemin === "galerie") Object.assign(p, { forme: "normale", masquee: false });
        if (chemin.endsWith("essentiel.photos")) p.forme = "tall";
        liste().push(p); changement(); dessiner();
      })
    : el("button", { type: "button", class: "btn line petit", disabled: plein, onclick: () => { liste().push(valeurParDefaut(s.de)); changement(); dessiner(); } }, "+ Ajouter");
  return el("fieldset", { dataset: { chemin } }, el("legend", {}, s.label), aide(s), conteneur, ajouter,
    plein ? el("p", { class: "aide" }, `Maximum atteint (${s.max}).`) : null);
}

function titreElement(s, item, i) {
  if (s.de.type === "photo") return (item && (item.legende || item.alt)) || `Photo ${i + 1}`;
  const t = s.titre && item ? item[s.titre] : "";
  return t ? String(t).replace(/<[^>]*>/g, "") : `${s.de.label} ${i + 1}`;
}

function deplacer(l, i, d) {
  const j = i + d; if (j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]]; changement(); dessiner();
}

// Dictionnaire (périodes de prix) : un code par élément
function blocDictionnaire(s, lire, ecrire, chemin) {
  const dico = () => { let d = lire(); if (!d) { d = {}; ecrire(d); } return d; };
  const conteneur = el("div", { class: "liste" });
  for (const k of Object.keys(lire() || {})) {
    const c = `${chemin}.${k}`;
    conteneur.append(el("div", { class: "element", dataset: { chemin: c } },
      el("div", { class: "tete" }, el("span", { class: "nom" }, `${dico()[k].label || k} · code « ${k} »`),
        el("button", { type: "button", class: "icone suppr", title: "Supprimer", onclick: () => {
          if (!confirm(`Supprimer la période « ${dico()[k].label || k} » ? Les plages du calendrier et les lignes de grille qui l’utilisent devront être modifiées.`)) return;
          delete dico()[k]; changement(); dessiner();
        } }, "✕")),
      el("div", { class: "corps" }, noeud(s.de, () => dico()[k], v => { dico()[k] = v; }, c))));
  }
  return el("fieldset", { dataset: { chemin } }, el("legend", {}, s.label),
    el("p", { class: "aide" }, "Chaque période a un code (ex. « basse ») utilisé par le calendrier et la grille."),
    conteneur,
    el("button", { type: "button", class: "btn line petit", onclick: () => {
      const code = (prompt("Code de la nouvelle période (minuscules sans accent ni espace, ex. « toussaint ») :") || "").trim();
      if (!code) return;
      if (!new RegExp(s.cle.motif).test(code)) { alert("Code non valide : lettres minuscules, chiffres et _ seulement, sans accent."); return; }
      if (dico()[code]) { alert("Ce code existe déjà."); return; }
      dico()[code] = valeurParDefaut(s.de); changement(); dessiner();
    } }, "+ Ajouter une période"));
}

// ---------- Photos ----------
function blocPhoto(s, lire, ecrire, chemin) {
  const p = lire() || {};
  const maj = (k, v) => { const o = lire() || {}; o[k] = v; ecrire(o); changement(); };
  const vignette = p.src ? el("img", { src: p.src, alt: "" }) : el("div", { class: "vide" }, "Aucune photo");
  const champs = [
    champSimple({ type: "texte", label: "Description (lue par les malvoyants et Google)", max: 200 }, () => p.alt, v => maj("alt", v), chemin + ".alt"),
    p.legende !== undefined ? champSimple({ type: "texte", label: "Légende", max: 60, optionnel: true }, () => p.legende, v => maj("legende", v), chemin + ".legende") : null,
    p.forme !== undefined ? champSimple({ type: "choix", label: "Forme dans la mosaïque", valeurs: [["big", "Grande"], ["tall", "Haute"], ["normale", "Normale"]] }, () => p.forme, v => maj("forme", v), chemin + ".forme") : null,
    chemin.startsWith("galerie") ? champSimple({ type: "booleen", label: "Visible seulement en grand (après les flèches)" }, () => p.masquee === true, v => maj("masquee", v), chemin + ".masquee") : null,
    boutonEnvoiPhoto(p.src ? "Remplacer la photo" : "Choisir une photo", false, photo => {
      const o = lire() || {}; delete o.srcset;
      ecrire(Object.assign(o, photo)); changement(); dessiner();
    })
  ];
  return el("div", { class: "champ photo", dataset: { chemin } }, vignette, el("div", {}, champs));
}

function boutonEnvoiPhoto(texte, desactive, quandPrete) {
  const fichier = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif", hidden: true });
  const info = el("span", { class: "envoi", "aria-live": "polite" });
  const bouton = el("button", { type: "button", class: "btn line petit", disabled: desactive, onclick: () => fichier.click() }, texte);
  fichier.addEventListener("change", async () => {
    const f = fichier.files[0]; fichier.value = "";
    if (!f) return;
    bouton.disabled = true; info.textContent = " Préparation de la photo…";
    try {
      const variantes = await preparerPhoto(f);
      info.textContent = " Envoi…";
      const { photo } = await api("POST", "/api/photos", { nom: f.name.replace(/\.[^.]+$/, ""), variantes });
      info.textContent = " Photo ajoutée. Pensez à enregistrer.";
      quandPrete(photo);
    } catch (err) {
      info.textContent = " " + err.message;
      info.classList.add("erreur");
    } finally { bouton.disabled = desactive; }
  });
  return el("div", { class: "champ" }, bouton, info, fichier);
}

// Réduit la photo dans le navigateur (480 et 960 px de large), en WebP si possible, sinon JPEG
async function preparerPhoto(f) {
  if (f.size > 30 * 1024 * 1024) throw new Error("Photo trop lourde (30 Mo au plus).");
  let image;
  try { image = await createImageBitmap(f, { imageOrientation: "from-image" }); }
  catch { throw new Error("Ce format n’est pas lu par ce navigateur : essayez une photo JPEG."); }
  if (image.width < 400) throw new Error("Photo trop petite (400 pixels de large au minimum).");
  const largeurs = [480, 960].filter(l => l <= image.width);
  const variantes = [];
  for (const l of largeurs) {
    const h = Math.round(image.height * l / image.width);
    const canvas = el("canvas", { width: l, height: h });
    canvas.getContext("2d").drawImage(image, 0, 0, l, h);
    let blob = await new Promise(ok => canvas.toBlob(ok, "image/webp", 0.82));
    if (!blob || blob.type !== "image/webp") blob = await new Promise(ok => canvas.toBlob(ok, "image/jpeg", 0.85));
    const donnees = await new Promise((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1]); r.onerror = ko; r.readAsDataURL(blob); });
    variantes.push({ largeur: l, donnees });
  }
  return variantes;
}

// ---------- Enregistrement ----------
function majEtat() {
  const e = $("etat");
  if (etat.jsonInvalide.size) { e.textContent = "Un champ JSON est incorrect."; e.className = "modifie"; }
  else if (modifie()) { e.textContent = "Modifications non enregistrées"; e.className = "modifie"; }
  else if (e.className !== "ok") { e.textContent = "Tout est enregistré"; e.className = ""; }
  $("enregistrer").disabled = !modifie() || etat.jsonInvalide.size > 0;
  $("annuler").disabled = !modifie();
}

function marquerErreurs(erreurs) {
  for (const e of erreurs) {
    const cible = document.querySelector(`[data-chemin="${CSS.escape(e.chemin)}"]`);
    if (!cible) continue;
    const champ = cible.classList.contains("champ") ? cible : cible.querySelector(".champ") || cible;
    champ.classList.add("en-erreur");
    champ.append(el("div", { class: "msg-erreur" }, e.message));
    const details = champ.closest("details"); if (details) details.open = true;
  }
}

$("annuler").addEventListener("click", () => {
  if (!confirm("Revenir à la dernière version enregistrée ?")) return;
  etat.donnees = JSON.parse(etat.original); etat.jsonInvalide.clear(); dessiner();
});

$("enregistrer").addEventListener("click", async () => {
  const nom = etat.nom;
  // Mêmes contrôles que le serveur, pour répondre tout de suite
  const { valeur, erreurs } = valider(SCHEMAS[nom], clone(etat.donnees));
  const toutes = erreurs.length ? erreurs : coherence(nom, valeur, etat.autres);
  if (toutes.length) { dessiner(toutes); document.querySelector(".bandeau-erreurs")?.scrollIntoView({ behavior: "smooth" }); return; }
  $("enregistrer").disabled = true; $("etat").textContent = "Enregistrement…"; $("etat").className = "";
  try {
    const r = await api("PUT", "/api/contenus/" + nom, { donnees: valeur, version: etat.version });
    Object.assign(etat, { donnees: r.donnees, version: r.version, original: JSON.stringify(r.donnees) });
    dessiner();
    $("etat").textContent = "Brouillon enregistré : visible dans l’aperçu, pas encore sur le site."; $("etat").className = "ok";
    majBrouillon();
  } catch (err) {
    if (err.statut === 422 && err.details && err.details.erreurs) dessiner(err.details.erreurs);
    else if (err.statut !== 401) { $("etat").textContent = err.message; $("etat").className = "modifie"; }
    majEtat();
  }
});

// ---------- Brouillon, aperçu, publication ----------
const LIBELLES = Object.fromEntries(RUBRIQUES.map(r => [r[0], r[1]]));
let brouillon = { modifies: [], photos: 0, apercu: null };

async function majBrouillon() {
  try { brouillon = await api("GET", "/api/brouillon"); } catch { return; }
  const n = brouillon.modifies.length, attente = n > 0 || brouillon.photos > 0;
  $("barre-brouillon").classList.toggle("attente", attente);
  $("texte-brouillon").textContent = attente
    ? `En attente de publication : ${brouillon.modifies.map(m => LIBELLES[m] || m).join(", ") || `${brouillon.photos} photo(s)`}.`
    : "Le site en ligne est à jour : aucun brouillon en attente.";
  $("lien-apercu").hidden = !attente || !brouillon.apercu;
  if (brouillon.apercu) $("lien-apercu").href = brouillon.apercu;
  $("publier").hidden = $("abandonner").hidden = !attente;
  for (const b of $("rubriques").children) b.classList.toggle("modifie", brouillon.modifies.includes(b.dataset.nom));
}

$("publier").addEventListener("click", async () => {
  if (modifie() && !confirm("La rubrique ouverte a des modifications non enregistrées : elles ne seront pas publiées. Continuer ?")) return;
  const liste = brouillon.modifies.map(m => "• " + (LIBELLES[m] || m)).join("\n");
  if (!confirm(`Publier sur le site en ligne ?\n\n${liste}\n\nLe site sera à jour dans une à deux minutes.`)) return;
  $("publier").disabled = true; $("texte-brouillon").textContent = "Publication en cours…";
  try {
    await api("POST", "/api/publier", {});
    await majBrouillon();
    $("texte-brouillon").textContent = "Publié ! Le site en ligne sera à jour dans une à deux minutes.";
    if (SCHEMAS[etat.nom]) dessiner();
  } catch (err) {
    await majBrouillon();
    const details = err.details && err.details.erreurs ? "\n\n" + err.details.erreurs.slice(0, 8).map(e => "• " + e.message).join("\n") : "";
    if (err.statut !== 401) alert(err.message + details);
  } finally { $("publier").disabled = false; }
});

$("abandonner").addEventListener("click", async () => {
  if (!confirm("Abandonner toutes les modifications du brouillon et revenir au site en ligne ? Cette action ne peut pas être annulée.")) return;
  try {
    await api("POST", "/api/abandonner", {});
    etat.original = JSON.stringify(etat.donnees); // évite l'alerte « non enregistré » au rechargement
    await majBrouillon();
    if (etat.nom) { const n = etat.nom; etat.nom = null; await ouvrir(n); }
  } catch (err) { if (err.statut !== 401) alert(err.message); }
});

// Versions publiées d'une rubrique : on peut en reprendre une dans le formulaire, puis l'enregistrer et la publier
function blocHistorique(nom) {
  const liste = el("div", {}, el("p", { class: "aide" }, "Chargement…"));
  const dateFr = d => new Date(d).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const bloc = el("details", { class: "groupe historique" }, el("summary", {}, "Historique : versions publiées"), el("div", {}, liste));
  bloc.addEventListener("toggle", async () => {
    if (!bloc.open || bloc.dataset.charge) return;
    bloc.dataset.charge = "1";
    try {
      const { versions } = await api("GET", "/api/historique/" + nom);
      if (!versions.length) { liste.replaceChildren(el("p", { class: "aide" }, "Aucune version publiée depuis l’admin pour l’instant.")); return; }
      liste.replaceChildren(el("p", { class: "aide" }, "« Reprendre » remet cette version dans le formulaire : vérifiez, enregistrez le brouillon, puis publiez."),
        el("ol", {}, versions.map(v => el("li", {}, el("span", {}, el("strong", {}, dateFr(v.date)), " · ", v.message),
          el("button", { type: "button", class: "btn line petit", onclick: async () => {
            if (modifie() && !confirm("Remplacer les modifications en cours par cette version ?")) return;
            try {
              const { donnees } = await api("GET", `/api/historique/${nom}/${v.id}`);
              etat.donnees = donnees; dessiner();
              $("etat").textContent = `Version du ${dateFr(v.date)} reprise : vérifiez puis enregistrez le brouillon.`; $("etat").className = "modifie";
              window.scrollTo(0, 0);
            } catch (err) { if (err.statut !== 401) alert(err.message); }
          } }, "Reprendre")))));
    } catch (err) { liste.replaceChildren(el("p", { class: "erreur" }, err.message)); }
  });
  return bloc;
}

// ---------- Mode d'emploi (guide du superviseur) ----------
function modeEmploi() {
  const section = (titre, ...contenu) => el("section", { class: "guide" }, el("h2", {}, titre), ...contenu);
  const liste = (...points) => el("ul", {}, points.map(p => el("li", {}, p)));
  const etapes = (...points) => el("ol", {}, points.map(p => el("li", {}, p)));
  return [
    el("div", { class: "entete-rubrique" }, el("h1", {}, "Mode d’emploi")),
    el("p", { class: "bandeau-info" }, "Rien de ce que vous faites ici n’arrive sur le site sans le bouton « Publier sur le site ». Vous pouvez donc essayer sans crainte."),
    section("Le principe en 4 gestes",
      etapes(
        "Choisissez une rubrique à gauche (sur téléphone : le bouton ☰), modifiez les champs.",
        "Cliquez sur « Enregistrer le brouillon » en bas de l’écran. Le site en ligne ne change pas encore.",
        "Cliquez sur « Voir l’aperçu ↗ » dans la barre rose : c’est le site avec vos modifications, marqué « Aperçu du brouillon ».",
        "Si tout est bon, « Publier sur le site » : le site est à jour en une à deux minutes. Sinon, corrigez et enregistrez à nouveau, ou « Abandonner le brouillon » pour tout annuler.")),
    section("Saisir les textes",
      liste(
        "Le compteur à droite d’un champ indique la longueur maximale.",
        "Boutons G (gras), I (italique) et Lien : sélectionnez le texte puis cliquez. Un lien vers une page du site s’écrit /autour/ ou /tarifs-reservation/#reserver.",
        "Des repères entre accolades sont remplacés automatiquement : {prix_min} par le prix le plus bas, {depot} par le dépôt de garantie, {annee} par l’année de la grille, {nb_photos} par le nombre de photos. Gardez-les : ainsi, un prix modifié une fois l’est partout.",
        "Une liste (questions, lieux, équipements…) se gère avec + Ajouter, ✕ pour supprimer, ↑ ↓ pour changer l’ordre.",
        "Si un champ est mal rempli, il passe en rouge avec une explication, et rien n’est enregistré.")),
    section("Les photos",
      liste(
        "« + Ajouter une photo » ou « Remplacer la photo » : choisissez une photo du téléphone ou de l’ordinateur, elle est réduite automatiquement.",
        "Écrivez toujours la description (elle est lue par les malvoyants et par Google) et, si demandé, la légende.",
        "Dans la galerie du logement, les 5 premières photos visibles forment la mosaïque ; les photos cochées « visible seulement en grand » apparaissent quand on fait défiler.",
        "Retirer une photo de la liste suffit à la retirer du site.")),
    section("Les prix (rubrique « Prix et calendrier »)",
      liste(
        "Périodes de prix : chaque période a un prix par nuit et une durée minimale. Ce prix est repris partout (grille, accueil, barre du bas, estimation, textes).",
        "Calendrier : indique quelle période s’applique à chaque nuit. Les plages ne doivent pas se chevaucher ; une nuit hors calendrier invite le voyageur à écrire à Belle.",
        "Grille : les lignes affichées sur la page Tarifs (titre, dates écrites en clair, mise en avant)."),
      el("p", {}, el("strong", {}, "Nouvelle saison : "), "changez l’année, les plages du calendrier, les dates écrites dans la grille, les dates d’arrivée de Noël et les dates du formulaire (arrivée et départ au plus tôt et au plus tard), puis vérifiez l’estimation dans l’aperçu.")),
    section("Revenir en arrière",
      etapes(
        "Ouvrez la rubrique, puis « Historique : versions publiées » tout en bas.",
        "« Reprendre » sur la version voulue : elle revient dans le formulaire.",
        "Enregistrez le brouillon, vérifiez l’aperçu, publiez.")),
    section("Les avis Airbnb",
      el("p", {}, "Ils sont mis à jour par Thomas avec le skill « maj-avis-chez-belle », deux ou trois fois par an, et ne se modifient pas ici. Seul l’avis affiché en bas de la page « Le logement » se change dans la rubrique « Le logement ».")),
    section("En cas de souci",
      liste(
        "« Session expirée » : reconnectez-vous (la connexion dure 8 heures). Vos modifications non enregistrées de la page ouverte peuvent être perdues : enregistrez souvent.",
        "« Modifié entre-temps » : la rubrique a été changée dans un autre onglet. Rechargez la page.",
        "« Trop d’essais » : après 5 mots de passe erronés, attendez 15 minutes.",
        "Tout autre message : notez-le et prévenez Thomas. Le site en ligne, lui, n’est jamais touché tant que rien n’est publié."))
  ];
}

// ---------- Démarrage ----------
(async () => {
  try {
    const s = await api("GET", "/api/session");
    if (s.connecte) await afficherAdmin(); else afficherConnexion();
  } catch (err) {
    if (err.statut !== 401) { $("chargement").textContent = err.message; }
  }
})();
