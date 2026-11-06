// Espace d'administration Chez Belle — version simplifiée (lot 7b), pensée pour une tablette.
// Les rubriques suivent des thèmes (Mes prix, Ce qui est compris, Mes photos…) et non les fichiers.
// Tous les contenus sont chargés ensemble ; « Enregistrer » enregistre tout ce qui a changé dans le brouillon.
// Aucun contenu n'est inséré en HTML brut : tout passe par createElement / textContent.
import { SCHEMAS, valider, coherence } from "/admin/schemas.js";
import { calculer, datesEnClair } from "/admin/calc.js";
import { PASTILLES, valeurJeton } from "/admin/contenu.js";

const FICHIERS = ["accueil", "logement", "tarifs", "maison", "reservation", "autour", "site", "avis"];
const etat = { fichiers: {}, vue: null, erreurs: [], avance: lireAvance() };
const $ = id => document.getElementById(id);
function lireAvance() { try { return localStorage.getItem("cb-avance") === "1"; } catch { return false; } }

// ---------- Les rubriques (thèmes) ----------
// Bloc : { f: fichier, c: chemin dans le fichier, titre, aide, page (pour « Voir sur l'aperçu »), composant, champs (sous-ensemble), sauf }
const VUES = [
  { id: "prix", titre: "Mes prix", desc: "périodes, dates, prix", blocs: [
    { f: "tarifs", c: "lignes", titre: "Périodes et prix par nuit", composant: "prix", page: "/tarifs-reservation/#tarifs",
      aide: "Une ligne par période. Les dates vont du jour d’arrivée au jour de départ. Si deux périodes se chevauchent (les ponts dans « Mai et juin »), la plus courte l’emporte." },
    { f: "accueil", c: "zoom", titre: "Encadré « Zoom sur les prix » de l’accueil", page: "/", aide: "Les prix de chaque carte sont calculés à partir des périodes cochées." }
  ] },
  { id: "compris", titre: "Ce qui est compris", desc: "services, horaires, règles", blocs: [
    { f: "maison", c: "", titre: "La maison en bref", champs: ["compris", "capacite", "surface", "jardin", "arrivee", "depart", "distances", "depot", "chien"], page: "/tarifs-reservation/#questions",
      aide: "Chaque valeur est reprise automatiquement partout sur le site (pastilles bleues dans les textes)." },
    { f: "maison", c: "services", titre: "Les services", composant: "services", page: "/tarifs-reservation/",
      aide: "Choisissez une fois le statut de chaque service : il apparaît dans « Compris dans le prix » ou « En plus » de la page Tarifs." },
    { f: "logement", c: "equipements", titre: "Les équipements", page: "/chez-belle/" },
    { f: "logement", c: "bandeau", titre: "Bandeau « compris » et règles de la maison (page Le logement)", page: "/chez-belle/" }
  ] },
  { id: "photos", titre: "Mes photos", desc: "galerie, accueil", blocs: [
    { f: "logement", c: "galerie", titre: "Galerie du logement", composant: "photos", page: "/chez-belle/#photos",
      aide: "La 1re photo est la plus grande. Les 5 premières forment la mosaïque ; les suivantes s’ouvrent en faisant défiler." },
    { f: "accueil", c: "hero.photo", titre: "Grande photo de l’accueil", page: "/" },
    { f: "accueil", c: "essentiel.photos", titre: "Les 3 photos de l’accueil", composant: "photos", page: "/" }
  ] },
  { groupe: "Mes textes" },
  { id: "t-accueil", titre: "Accueil", desc: "accroche, points clés", blocs: [
    { f: "accueil", c: "hero", titre: "En-tête de l’accueil", sauf: ["photo"], page: "/" },
    { f: "accueil", c: "essentiel", titre: "L’essentiel en quelques points", sauf: ["photos"], page: "/" },
    { f: "accueil", c: "avis", titre: "Section des avis", page: "/#avis" },
    { f: "accueil", c: "suite", titre: "Appel en bas de page", page: "/" }
  ] },
  { id: "t-logement", titre: "Le logement", desc: "présentation, chiffres", blocs: [
    { f: "logement", c: "entete", titre: "En-tête", page: "/chez-belle/" },
    { f: "logement", c: "chiffres", titre: "Les chiffres clés", page: "/chez-belle/" },
    { f: "logement", c: "organisation", titre: "Comment c’est organisé", page: "/chez-belle/" },
    { f: "logement", c: "avis_fixe", titre: "Avis affiché en bas de page", page: "/chez-belle/" },
    { f: "logement", c: "bouton_photos", titre: "Bouton des photos", page: "/chez-belle/#photos" }
  ] },
  { id: "t-tarifs", titre: "Tarifs et réservation", desc: "étapes, questions", blocs: [
    { f: "reservation", c: "entete", titre: "En-tête", page: "/tarifs-reservation/" },
    { f: "reservation", c: "grille", titre: "Sous la grille des prix", page: "/tarifs-reservation/#tarifs" },
    { f: "reservation", c: "compris", titre: "« Compris dans le prix »", page: "/tarifs-reservation/" },
    { f: "reservation", c: "en_plus", titre: "« En plus »", page: "/tarifs-reservation/" },
    { f: "reservation", c: "etapes", titre: "Réserver en trois étapes", page: "/tarifs-reservation/" },
    { f: "reservation", c: "mot_de_belle", titre: "Le mot de Belle", page: "/tarifs-reservation/#reserver" },
    { f: "reservation", c: "faq", titre: "Vos questions", page: "/tarifs-reservation/#questions" }
  ] },
  { id: "autour", titre: "Autour de chez moi", desc: "lieux, conseils", blocs: [
    { f: "autour", c: "entete", titre: "En-tête", page: "/autour/" },
    { f: "autour", c: "lieux", titre: "Les lieux", composant: "lieux", page: "/autour/" },
    { f: "autour", c: "filtres", titre: "Les envies (filtres) et leurs conseils", page: "/autour/" },
    { f: "autour", c: "", titre: "Et aussi, belles adresses, appel final", champs: ["aussi", "adresses", "appel"], page: "/autour/" }
  ] },
  { id: "coordonnees", titre: "Coordonnées", desc: "e-mail, pied de page", blocs: [
    { f: "site", c: "", titre: "Contact et liens", champs: ["nom", "email", "airbnb"], page: "/tarifs-reservation/#reserver" },
    { f: "site", c: "barre", titre: "Barre du bas (téléphone)", page: "/" },
    { f: "site", c: "pied", titre: "Pied de page", page: "/" }
  ] },
  { groupe: "Plus" },
  { id: "avis", titre: "Avis Airbnb", desc: "automatique", special: "avis" },
  { id: "aide", titre: "Mode d’emploi", desc: "comment faire", special: "aide" },
  { id: "avance", titre: "Réglages avancés", desc: "Google, menu, formulaire", avance: true, blocs: [
    { f: "accueil", c: "seo", titre: "Référencement : accueil" }, { f: "logement", c: "seo", titre: "Référencement : logement" },
    { f: "reservation", c: "seo", titre: "Référencement : tarifs" }, { f: "autour", c: "seo", titre: "Référencement : autour" },
    { f: "site", c: "", titre: "Menu et adresse du site", champs: ["url", "menu", "bouton_reserver"] },
    { f: "reservation", c: "formulaire", titre: "Formulaire de demande : libellés" },
    { f: "autour", c: "zones", titre: "Colonnes de la page Autour" },
    { f: "logement", c: "boutons", titre: "Boutons du logement" }
  ] }
];

// ---------- Outils ----------
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
  for (const c of enfants.flat(9)) if (c !== null && c !== undefined && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
const clone = o => JSON.parse(JSON.stringify(o));
const segments = c => c ? c.match(/[^.[\]]+/g) : [];
function obtenir(o, c) { return segments(c).reduce((x, k) => x == null ? x : x[k], o); }
function definir(o, c, v) { const s = segments(c); const der = s.pop(); const p = s.reduce((x, k) => x[k] ?? (x[k] = {}), o); p[der] = v; }
function schemaA(s, c) { return segments(c).reduce((x, k) => x && (x.type === "objet" ? x.champs[k] : x.type === "liste" ? x.de : null), s); }
const slug = t => String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);

// ---------- Dialogues dans la page (grands, en langage courant) ----------
function dialogue({ titre, texte, liste, boutons, champ }) {
  const d = $("dialogue");
  return new Promise(resoudre => {
    const entree = champ ? el("input", { type: "text", value: champ.valeur || "", placeholder: champ.exemple || "" }) : null;
    d.replaceChildren(
      el("h2", {}, titre),
      texte ? el("p", {}, texte) : null,
      liste && liste.length ? el("ul", {}, liste.map(l => el("li", {}, l))) : null,
      champ ? el("label", {}, champ.label, entree) : null,
      el("div", { class: "actions" }, boutons.map(b => el("button", { type: "button", class: b.principal ? "btn" : "btn line", onclick: () => { d.close(); resoudre(champ ? (b.valeur ? entree.value.trim() : null) : b.valeur); } }, b.texte))));
    d.oncancel = () => resoudre(champ ? null : undefined);
    d.showModal();
    (entree || d.querySelector(".btn")).focus();
  });
}
const confirmer = (titre, texte, oui = "Oui", non = "Non", liste) => dialogue({ titre, texte, liste, boutons: [{ texte: non, valeur: false }, { texte: oui, valeur: true, principal: true }] });
const informer = (titre, texte, liste) => dialogue({ titre, texte, liste, boutons: [{ texte: "D’accord", valeur: true, principal: true }] });

// ---------- API ----------
async function api(methode, url, corps) {
  const r = await fetch(url, { method: methode, credentials: "same-origin", headers: corps !== undefined ? { "Content-Type": "application/json" } : {}, body: corps !== undefined ? JSON.stringify(corps) : undefined });
  let j = {}; try { j = await r.json(); } catch { /* vide */ }
  if (r.status === 401 && !url.endsWith("/connexion")) { afficherConnexion("Votre session a expiré : entrez à nouveau le mot de passe."); throw Object.assign(new Error(j.erreur || "Session expirée"), { statut: 401 }); }
  if (!r.ok) throw Object.assign(new Error(j.erreur || `Erreur ${r.status}`), { statut: r.status, details: j });
  return j;
}

// ---------- Connexion ----------
function afficherConnexion(message = "") {
  $("chargement").hidden = true; $("ecran-admin").hidden = true; $("ecran-connexion").hidden = false;
  $("erreur-connexion").hidden = !message; $("erreur-connexion").textContent = message;
  $("mdp").value = ""; $("mdp").focus();
}
$("form-connexion").addEventListener("submit", async e => {
  e.preventDefault();
  const b = e.submitter; if (b) b.disabled = true;
  try { await api("POST", "/api/connexion", { motDePasse: $("mdp").value }); $("mdp").value = ""; await demarrer(); }
  catch (err) { $("erreur-connexion").hidden = false; $("erreur-connexion").textContent = err.message; }
  finally { if (b) b.disabled = false; }
});
$("deconnexion").addEventListener("click", async () => {
  if (modifies().length && !(await confirmer("Se déconnecter ?", "Vos dernières modifications ne sont pas enregistrées. Elles seront perdues.", "Se déconnecter", "Rester"))) return;
  await api("POST", "/api/deconnexion", {}).catch(() => {});
  for (const f of Object.values(etat.fichiers)) f.original = JSON.stringify(f.donnees);
  afficherConnexion();
});

// ---------- Chargement ----------
async function demarrer() {
  $("chargement").hidden = true; $("ecran-connexion").hidden = true; $("ecran-admin").hidden = false;
  $("zone").replaceChildren(el("p", { class: "aide" }, "Chargement…"));
  await chargerTout();
  dessinerMenu();
  majBrouillon();
  const v = location.hash.slice(1);
  ouvrir(VUES.some(x => x.id === v && (!x.avance || etat.avance)) ? v : "prix");
}
async function chargerTout() {
  for (const nom of FICHIERS) {
    const c = await api("GET", "/api/contenus/" + nom);
    etat.fichiers[nom] = { donnees: c.donnees, version: c.version, original: JSON.stringify(c.donnees), lectureSeule: c.lectureSeule };
  }
}
const modifies = () => Object.entries(etat.fichiers).filter(([, f]) => !f.lectureSeule && JSON.stringify(f.donnees) !== f.original).map(([n]) => n);
window.addEventListener("beforeunload", e => { if (modifies().length) { e.preventDefault(); e.returnValue = ""; } });

// ---------- Menu ----------
function dessinerMenu() {
  const nav = $("rubriques");
  nav.replaceChildren();
  for (const v of VUES) {
    if (v.groupe) { nav.append(el("div", { class: "groupe-menu" }, v.groupe)); continue; }
    if (v.avance && !etat.avance) continue;
    nav.append(el("button", { type: "button", dataset: { vue: v.id }, onclick: () => ouvrir(v.id) }, v.titre, el("small", {}, v.desc)));
  }
  const bascule = el("input", { type: "checkbox", id: "mode-avance", checked: etat.avance, onchange: e => {
    etat.avance = e.target.checked; try { localStorage.setItem("cb-avance", etat.avance ? "1" : "0"); } catch { /* sans stockage */ }
    dessinerMenu(); if (etat.vue === "avance" && !etat.avance) ouvrir("prix"); else dessinerVue();
  } });
  nav.append(el("label", { class: "avance-bascule", for: "mode-avance" }, bascule, "Mode avancé (Thomas)"));
  majMenu();
}
function majMenu() {
  const m = modifies();
  for (const b of $("rubriques").querySelectorAll("button[data-vue]")) {
    const v = VUES.find(x => x.id === b.dataset.vue);
    b.setAttribute("aria-current", String(v.id === etat.vue));
    b.classList.toggle("modifie", !!(v.blocs && v.blocs.some(bl => m.includes(bl.f) && JSON.stringify(obtenir(etat.fichiers[bl.f].donnees, bl.c)) !== JSON.stringify(obtenir(JSON.parse(etat.fichiers[bl.f].original), bl.c)))));
  }
}
$("ouvrir-menu").addEventListener("click", () => { const n = $("rubriques").classList.toggle("ouvert"); $("ouvrir-menu").setAttribute("aria-expanded", String(n)); });
window.addEventListener("hashchange", () => { const v = location.hash.slice(1); if (v !== etat.vue && VUES.some(x => x.id === v) && !$("ecran-admin").hidden) ouvrir(v); });

function ouvrir(id) {
  etat.vue = id;
  history.replaceState(null, "", "#" + id);
  $("rubriques").classList.remove("ouvert"); $("ouvrir-menu").setAttribute("aria-expanded", "false");
  dessinerVue();
  window.scrollTo(0, 0);
  $("zone").focus({ preventScroll: true });
}

// ---------- Affichage d'une rubrique ----------
let calcActuel = null;
const contexte = () => ({ calc: calcActuel, maison: etat.fichiers.maison.donnees, logement: etat.fichiers.logement.donnees });
function recalculer() { calcActuel = calculer(etat.fichiers.tarifs.donnees, etat.fichiers.accueil.donnees, etat.fichiers.maison.donnees); }

function dessinerVue() {
  const v = VUES.find(x => x.id === etat.vue);
  recalculer();
  const zone = $("zone");
  const scroll = window.scrollY;
  majMenu();
  const blocs = [el("div", { class: "entete-vue" }, el("h1", {}, v.titre))];
  if (etat.erreurs.length) blocs.push(bandeauErreurs());
  if (v.special === "avis") blocs.push(vueAvis(etat.fichiers.avis.donnees));
  else if (v.special === "aide") blocs.push(...modeEmploi());
  else {
    for (const b of v.blocs) blocs.push(dessinerBloc(b));
    blocs.push(blocHistorique(v));
  }
  zone.replaceChildren(...blocs.filter(Boolean));
  marquerErreurs();
  majEtat();
  window.scrollTo(0, scroll);
}

function urlApercu(page) {
  const base = brouillon.apercu || "/apercu/";
  const [chemin, ancre] = (page || "/").split("#");
  return base.replace(/\/?$/, "/") + chemin.replace(/^\//, "") + (ancre ? "#" + ancre : "");
}

function dessinerBloc(b) {
  const fichier = etat.fichiers[b.f];
  const racine = SCHEMAS[b.f];
  const s = b.c ? schemaA(racine, b.c) : racine;
  const lire = () => b.c ? obtenir(fichier.donnees, b.c) : fichier.donnees;
  const ecrire = v => b.c ? definir(fichier.donnees, b.c, v) : (fichier.donnees = v);
  const chemin = `${b.f}:${b.c}`;
  let contenu;
  if (b.composant) contenu = COMPOSANTS[b.composant](s, lire, ecrire, chemin);
  else if (s.type === "objet") contenu = champsObjet(s, lire, ecrire, chemin, b.champs, b.sauf, 0);
  else contenu = noeud(s, lire, ecrire, chemin, 0, true);
  return el("section", { class: "bloc", dataset: { chemin } },
    el("div", { class: "bloc-tete" }, el("h2", {}, b.titre), b.page ? el("a", { href: urlApercu(b.page), target: "_blank", rel: "noopener" }, "Voir sur l’aperçu ↗") : null),
    b.aide ? el("p", { class: "aide" }, b.aide) : null,
    contenu);
}

// ---------- Champs générés à partir du schéma ----------
const visible = s => !s.cache && (!s.avance || etat.avance);
function changement() { majEtat(); majMenu(); }

function champsObjet(s, lire, ecrire, chemin, seulement, sauf, profondeur) {
  return Object.entries(s.champs)
    .filter(([k, sc]) => (!seulement || seulement.includes(k)) && !(sauf || []).includes(k) && visible(sc))
    .map(([k, sc]) => noeud(sc,
      () => (lire() || {})[k],
      v => { let o = lire(); if (!o) { o = {}; ecrire(o); } o[k] = v; },
      chemin.endsWith(":") ? chemin + k : `${chemin}.${k}`, profondeur + 1));
}

function noeud(s, lire, ecrire, chemin, profondeur = 1, racine = false) {
  switch (s.type) {
    case "objet": return el("div", { dataset: { chemin } }, racine ? null : el("div", { class: "sous-titre" }, s.label), champsObjet(s, lire, ecrire, chemin, null, null, profondeur));
    case "liste": return blocListe(s, lire, ecrire, chemin);
    case "photo": return blocPhoto(s, lire, ecrire, chemin);
    default: return champSimple(s, lire, ecrire, chemin);
  }
}

function champSimple(s, lire, ecrire, chemin) {
  const id = "c-" + chemin.replace(/[^a-z0-9]+/gi, "-");
  const v = lire();
  const set = val => { ecrire(val); changement(); };
  const titre = (...apres) => el("label", { for: id }, s.label, s.optionnel ? el("span", { class: "aide" }, " (facultatif)") : null, ...apres);
  const aideChamp = s.aide && !/jeton|\{/.test(s.aide) ? el("p", { class: "aide" }, s.aide) : null;
  const champ = (...enfants) => el("div", { class: "champ", dataset: { chemin } }, ...enfants);

  if (s.type === "texte" && s.ref) {
    const options = choixReference(s.ref);
    return champ(titre(), el("select", { id, onchange: e => set(e.target.value) }, options.map(([k, l]) => el("option", { value: k, selected: k === v }, l))));
  }
  if (s.type === "texte" && !s.motif) return champ(...editeurTexte(s, lire, set, id, titre), aideChamp);
  if (s.type === "texte" || s.type === "lien") {
    const e = el("input", { id, type: "text", placeholder: s.type === "lien" ? "https://… ou /page/" : undefined, oninput: ev => set(ev.target.value) });
    e.value = v ?? "";
    return champ(titre(), aideChamp, e);
  }
  if (s.type === "nombre") {
    const e = el("input", { id, type: "number", inputmode: "numeric", min: s.min, max: s.max, step: s.entier ? 1 : "any", oninput: ev => set(ev.target.value === "" ? null : Number(ev.target.value)) });
    e.value = v ?? "";
    return champ(titre(), e);
  }
  if (s.type === "date") {
    const e = el("input", { id, type: "date", oninput: ev => set(ev.target.value) });
    e.value = v ?? "";
    return champ(titre(), e);
  }
  if (s.type === "booleen") return champ(el("label", { class: "case", for: id }, el("input", { id, type: "checkbox", checked: v === true, onchange: ev => set(ev.target.checked) }), s.label));
  if (s.type === "choix") return champ(el("span", { class: "titre-champ" }, s.label), segmentsChoix(s.valeurs, v ?? "", set, id));
  if (s.type === "json") {
    const e = el("textarea", { id, class: "json", spellcheck: "false" });
    e.value = JSON.stringify(v ?? {}, null, 2);
    const msg = el("div", { class: "msg-erreur" });
    e.addEventListener("input", () => { try { ecrire(JSON.parse(e.value)); msg.textContent = ""; } catch { msg.textContent = "Format incorrect."; } changement(); });
    return champ(titre(), e, msg);
  }
  return champ(titre(), String(v ?? ""));
}

function segmentsChoix(valeurs, v, set, nomGroupe) {
  const groupe = el("div", { class: "segments", role: "radiogroup" });
  for (const [k, l] of valeurs) {
    groupe.append(el("label", { class: k === v ? "coche" : "" },
      el("input", { type: "radio", name: nomGroupe, value: k, checked: k === v, onchange: () => {
        set(k);
        groupe.querySelectorAll("label").forEach(x => x.classList.toggle("coche", x.querySelector("input").checked));
      } }), l));
  }
  return groupe;
}

// Listes de choix qui renvoient à un autre contenu (périodes de prix, colonnes, envies)
function choixReference(ref) {
  const d = n => etat.fichiers[n].donnees;
  if (ref === "tarifs.lignes") return d("tarifs").lignes.map(l => [l.id, `${l.nom} (${l.prix} €)`]);
  if (ref === "autour.zones") return d("autour").zones.map(z => [z.cle, z.titre]);
  if (ref === "autour.filtres") return d("autour").filtres.map(f => [f.cle, f.label]);
  return [];
}

// ---------- Éditeur de texte avec pastilles ----------
// La valeur stockée garde le format du site (balises <b>, <em>, <a>, <sup>, <br> et jetons {prix_min}…) ;
// à l'écran, on voit du texte mis en forme et des pastilles bleues avec la valeur actuelle.
function editeurTexte(s, lire, set, id, titre) {
  const multi = (s.lignes || 0) > 1 || (s.max || 0) > 300;
  const zone = el("div", { id, class: "editeur" + (multi ? " multi" : ""), contenteditable: "true", role: "textbox", "aria-multiline": String(multi), spellcheck: "true", lang: "fr" });
  versEditeur(lire() ?? "", zone);
  const compteur = s.max ? el("span", { class: "compteur" }) : null;
  const compter = val => { if (compteur) { compteur.textContent = `${val.length} / ${s.max}`; compteur.classList.toggle("trop", val.length > s.max); } };
  const maj = () => { const val = depuisEditeur(zone, multi); set(val); compter(val); };
  compter(lire() ?? "");
  zone.addEventListener("input", maj);
  zone.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); if (multi) { document.execCommand("insertLineBreak"); maj(); } }
  });
  zone.addEventListener("paste", e => {
    e.preventDefault();
    const t = (e.clipboardData || window.clipboardData).getData("text/plain").replace(/\s*\r?\n\s*/g, " ");
    document.execCommand("insertText", false, t);
  });
  const outils = el("div", { class: "outils" });
  const garderSelection = e => e.preventDefault();
  if (s.riche) {
    outils.append(
      el("button", { type: "button", onmousedown: garderSelection, onclick: () => { zone.focus(); document.execCommand("bold"); maj(); } }, el("b", {}, "Gras")),
      el("button", { type: "button", onmousedown: garderSelection, onclick: () => { zone.focus(); document.execCommand("italic"); maj(); } }, el("em", {}, "Italique")),
      el("button", { type: "button", onmousedown: garderSelection, onclick: async () => {
        const sel = window.getSelection(); const plage = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
        if (!plage || plage.collapsed || !zone.contains(plage.commonAncestorContainer)) { await informer("Ajouter un lien", "Sélectionnez d’abord les mots à transformer en lien."); return; }
        const url = await dialogue({ titre: "Ajouter un lien", texte: "Adresse d’une page du site (ex. /autour/) ou d’un autre site (https://…).",
          champ: { label: "Adresse", exemple: "https://" }, boutons: [{ texte: "Annuler", valeur: false }, { texte: "Ajouter le lien", valeur: true, principal: true }] });
        if (!url) return;
        if (!/^(https?:\/\/[^\s\\]+|\/[^\s\\/]?[^\s\\]*|#[\w-]+|mailto:[^\s\\]+)$/.test(url)) { await informer("Adresse non valable", "Une adresse commence par https://, par / pour une page du site, ou par mailto:."); return; }
        zone.focus(); sel.removeAllRanges(); sel.addRange(plage);
        document.execCommand("createLink", false, url); maj();
      } }, "Lien"),
      el("button", { type: "button", onmousedown: garderSelection, onclick: () => { zone.focus(); document.execCommand("unlink"); document.execCommand("removeFormat"); maj(); } }, "Sans mise en forme"));
  }
  if (s.riche || s.max >= 120) {
    const choix = el("select", { "aria-label": "Insérer une valeur automatique", onchange: () => {
      if (!choix.value) return;
      const p = pastille(choix.value);
      const sel = window.getSelection();
      if (sel.rangeCount && zone.contains(sel.anchorNode)) {
        const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(p); r.setStartAfter(p); r.collapse(true); sel.removeAllRanges(); sel.addRange(r);
      } else zone.append(" ", p);
      choix.value = ""; maj(); zone.focus();
    } }, el("option", { value: "" }, "+ Valeur automatique…"), listePastilles().map(([k, l]) => el("option", { value: k }, l)));
    outils.append(choix);
  }
  return [titre(compteur), outils.childNodes.length ? outils : null, zone];
}

function listePastilles() {
  const c = calcActuel, m = etat.fichiers.maison.donnees;
  const base = PASTILLES.map(([k, l]) => [k, `${l} : ${valeurJeton(k, null, c, m, contexte()) ?? ""}`]);
  const prix = etat.fichiers.tarifs.donnees.lignes.flatMap(l => [[`prix:${l.id}`, `Prix « ${l.nom} » : ${l.prix} €`], ...(l.prix_semaine ? [[`semaine:${l.id}`, `Prix à la semaine « ${l.nom} » : ${l.prix * 7} €`]] : [])]);
  return [...base, ...prix];
}
function pastille(jeton) {
  const [nom, cle] = jeton.split(":");
  const v = valeurJeton(nom, cle, calcActuel, etat.fichiers.maison.donnees, contexte());
  const info = listePastilles().find(([k]) => k === jeton);
  return el("span", { class: "pastille", contenteditable: "false", dataset: { jeton }, title: (info ? info[1] : "Valeur automatique") + " — se met à jour toute seule" }, v === null ? `{${jeton}}` : v);
}

// Texte stocké → contenu de l'éditeur (sans innerHTML : chaque balise autorisée devient un élément)
function versEditeur(valeur, zone) {
  zone.replaceChildren();
  const pile = [zone];
  const re = /<(\/?)(b|strong|em|i|sup|br|a)(\s[^>]*)?>|\{([a-z_]+(?::[a-z0-9-]+)?)\}|&(nbsp|amp|lt|gt|quot|#39);/gi;
  const ENT = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: "\"", "#39": "'" };
  let i = 0, m;
  const texte = t => { if (t) pile.at(-1).append(document.createTextNode(t)); };
  while ((m = re.exec(valeur))) {
    texte(valeur.slice(i, m.index)); i = re.lastIndex;
    if (m[4]) { pile.at(-1).append(pastille(m[4])); continue; }
    if (m[5]) { texte(ENT[m[5].toLowerCase()]); continue; }
    const [, ferme, nom, attrs] = m; const n = nom.toLowerCase();
    if (n === "br") { pile.at(-1).append(document.createElement("br")); continue; }
    if (ferme) { if (pile.length > 1) pile.pop(); continue; }
    const tag = { strong: "b", i: "em" }[n] || n;
    const e = document.createElement(tag);
    if (tag === "a") { const h = /\shref="([^"]*)"/.exec(attrs || ""); if (h) e.setAttribute("href", h[1]); }
    pile.at(-1).append(e); pile.push(e);
  }
  texte(valeur.slice(i));
}

// Contenu de l'éditeur → texte stocké
function depuisEditeur(zone, multi) {
  const ech = t => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;");
  const parcourir = n => {
    if (n.nodeType === 3) return ech(n.nodeValue);
    if (n.nodeType !== 1) return "";
    if (n.classList.contains("pastille")) return `{${n.dataset.jeton}}`;
    const tag = n.tagName.toLowerCase();
    const dedans = [...n.childNodes].map(parcourir).join("");
    if (tag === "br") return multi ? "<br>" : " ";
    if (tag === "b" || tag === "strong") return dedans ? `<b>${dedans}</b>` : "";
    if (tag === "i" || tag === "em") return dedans ? `<em>${dedans}</em>` : "";
    if (tag === "sup") return `<sup>${dedans}</sup>`;
    if (tag === "a") { const h = (n.getAttribute("href") || "").replace(/"/g, ""); return h ? `<a href="${h}">${dedans}</a>` : dedans; }
    if ((tag === "div" || tag === "p") && n.previousSibling) return (multi ? "<br>" : " ") + dedans;
    return dedans;
  };
  return [...zone.childNodes].map(parcourir).join("").replace(/(<br>)+$/, "").replace(/^\s+|\s+$/g, "");
}

// ---------- Listes ----------
function valeurParDefaut(s) {
  switch (s.type) {
    case "texte": return s.ref ? (choixReference(s.ref)[0] || [""])[0] : "";
    case "nombre": return s.min ?? 0;
    case "booleen": return false;
    case "choix": return s.valeurs[0][0];
    case "liste": return [];
    case "json": return {};
    case "objet": return Object.fromEntries(Object.entries(s.champs).filter(([, c]) => !c.optionnel).map(([k, c]) => [k, valeurParDefaut(c)]));
    default: return "";
  }
}
function listeDe(lire, ecrire) { let l = lire(); if (!Array.isArray(l)) { l = []; ecrire(l); } return l; }
function boutonsOrdre(liste, i, min, nomElement) {
  return [
    el("button", { type: "button", class: "bouton-ligne", disabled: i === 0, onclick: () => { [liste[i - 1], liste[i]] = [liste[i], liste[i - 1]]; changement(); dessinerVue(); } }, "↑ Monter"),
    el("button", { type: "button", class: "bouton-ligne", disabled: i === liste.length - 1, onclick: () => { [liste[i + 1], liste[i]] = [liste[i], liste[i + 1]]; changement(); dessinerVue(); } }, "↓ Descendre"),
    el("button", { type: "button", class: "bouton-ligne suppr", disabled: liste.length <= (min || 0), onclick: async () => {
      if (!(await confirmer("Supprimer ?", nomElement ? `« ${nomElement} » sera retiré.` : "Cet élément sera retiré.", "Supprimer", "Garder"))) return;
      liste.splice(i, 1); changement(); dessinerVue();
    } }, "Supprimer")
  ];
}

function blocListe(s, lire, ecrire, chemin) {
  // Liste de références (envies d'un lieu, périodes d'une carte) : gros boutons à cocher
  if (s.de.ref) {
    const choisis = new Set(lire() || []);
    const groupe = el("div", { class: "segments" });
    for (const [k, l] of choixReference(s.de.ref)) {
      const lab = el("label", { class: choisis.has(k) ? "coche" : "" }, el("input", { type: "checkbox", checked: choisis.has(k), onchange: e => {
        const ordre = choixReference(s.de.ref).map(([c]) => c);
        const actuels = listeDe(lire, ecrire).filter(x => x !== k);
        if (e.target.checked) actuels.push(k);
        ecrire(actuels.sort((a, b) => ordre.indexOf(a) - ordre.indexOf(b)));
        lab.classList.toggle("coche", e.target.checked); changement();
      } }), l);
      groupe.append(lab);
    }
    return el("div", { class: "champ", dataset: { chemin } }, el("span", { class: "titre-champ" }, s.label), groupe);
  }
  if (s.de.type === "photo") return grillePhotos(s, lire, ecrire, chemin);
  const simple = !["objet", "liste"].includes(s.de.type);
  const items = lire() || [];
  const conteneur = el("div", { class: simple ? "liste-simple" : "" });
  items.forEach((item, i) => {
    const c = `${chemin}[${i}]`;
    const nom = simple ? null : titreElement(s, item, i);
    const contenu = simple
      ? champSimple({ ...s.de, label: `${s.de.label} ${i + 1}` }, () => listeDe(lire, ecrire)[i], v => { listeDe(lire, ecrire)[i] = v; }, c)
      : champsObjet(s.de, () => listeDe(lire, ecrire)[i], v => { listeDe(lire, ecrire)[i] = v; }, c, null, null, 1);
    conteneur.append(el("div", { class: "element", dataset: { chemin: c } },
      simple ? null : el("div", { class: "element-tete" }, el("span", { class: "nom" }, nom)),
      contenu,
      el("div", { class: "element-tete" }, boutonsOrdre(listeDe(lire, ecrire), i, s.min, nom))));
  });
  const plein = items.length >= s.max;
  return el("div", { dataset: { chemin } },
    el("div", { class: "sous-titre" }, s.label),
    conteneur,
    el("div", { class: "ajouter" }, el("button", { type: "button", class: "btn line petit", disabled: plein, onclick: () => { listeDe(lire, ecrire).push(valeurParDefaut(s.de)); changement(); dessinerVue(); } }, "+ Ajouter"),
      plein ? el("span", { class: "aide" }, ` Maximum atteint (${s.max}).`) : null));
}
function titreElement(s, item, i) {
  const t = s.titre && item ? item[s.titre] : "";
  const propre = String(t || "").replace(/<[^>]*>/g, "").replace(/\{[^}]*\}/g, "…");
  return propre || `${s.de.label} ${i + 1}`;
}

// ---------- Composant : Mes prix (une ligne par période) ----------
function tableauPrix(s, lire, ecrire, chemin) {
  const lignes = () => listeDe(lire, ecrire);
  const sL = s.de.champs;
  const conteneur = el("div", {}, el("div", { class: "prix-ligne entete", "aria-hidden": "true" }, el("span", {}, "Période"), el("span", {}, "Dates (arrivée → départ)"), el("span", {}, "Prix par nuit"), el("span", {}, "Minimum")));
  lignes().forEach((l, i) => {
    const c = `${chemin}[${i}]`;
    const lireL = () => lignes()[i];
    const enClair = el("p", { class: "en-clair" });
    const majEnClair = () => { const t = datesEnClair(lireL().dates); enClair.textContent = t ? `Soit : ${t}${lireL().prix_semaine ? ` · ${lireL().prix * 7} € la semaine` : ""}` : ""; };
    const champNom = champSimple({ ...sL.nom, label: "Période", motif: ".*" }, () => lireL().nom, v => { lireL().nom = v; }, `${c}.nom`);
    const dates = el("div", { class: "champ", dataset: { chemin: `${c}.dates` } }, el("span", { class: "titre-champ" }, "Dates (arrivée → départ)"),
      (lireL().dates || []).map((p, k) => el("div", { class: "plage", dataset: { chemin: `${c}.dates[${k}]` } },
        el("input", { type: "date", "aria-label": "Arrivée", value: p.du || "", oninput: e => { lireL().dates[k].du = e.target.value; changement(); majEnClair(); } }),
        el("span", {}, "→"),
        el("input", { type: "date", "aria-label": "Départ", value: p.au || "", oninput: e => { lireL().dates[k].au = e.target.value; changement(); majEnClair(); } }),
        lireL().dates.length > 1 ? el("button", { type: "button", class: "bouton-ligne suppr", onclick: () => { lireL().dates.splice(k, 1); changement(); dessinerVue(); } }, "Retirer") : null)),
      el("button", { type: "button", class: "bouton-ligne", onclick: () => { lireL().dates.push({ du: "", au: "" }); changement(); dessinerVue(); } }, "+ Autres dates"),
      enClair);
    majEnClair();
    const prix = champSimple({ ...sL.prix, label: "Prix par nuit (€)" }, () => lireL().prix, v => { lireL().prix = v; majEnClair(); }, `${c}.prix`);
    const min = champSimple({ ...sL.min, label: "Minimum (nuits)" }, () => lireL().min, v => { lireL().min = v; }, `${c}.min`);
    const options = el("div", { class: "prix-options", hidden: true },
      champSimple(sL.semaine_fixe, () => lireL().semaine_fixe, v => { lireL().semaine_fixe = v; }, `${c}.semaine_fixe`),
      champSimple(sL.prix_semaine, () => lireL().prix_semaine, v => { lireL().prix_semaine = v; majEnClair(); }, `${c}.prix_semaine`),
      champSimple(sL.mise_en_avant, () => lireL().mise_en_avant, v => { lireL().mise_en_avant = v; }, `${c}.mise_en_avant`),
      champSimple(sL.etiquette, () => lireL().etiquette, v => { lireL().etiquette = v; }, `${c}.etiquette`),
      champSimple(sL.dates_texte, () => lireL().dates_texte, v => { lireL().dates_texte = v; }, `${c}.dates_texte`));
    const basculer = el("button", { type: "button", class: "bouton-ligne", "aria-expanded": "false", onclick: () => {
      options.hidden = !options.hidden; basculer.setAttribute("aria-expanded", String(!options.hidden)); basculer.textContent = options.hidden ? "Plus d’options" : "Moins d’options";
    } }, "Plus d’options");
    conteneur.append(el("div", { class: "prix-ligne", dataset: { chemin: c } }, champNom, dates, prix, min,
      el("div", { class: "prix-actions" }, basculer, boutonsOrdre(lignes(), i, s.min, l.nom)), options));
  });
  return el("div", { dataset: { chemin } }, conteneur,
    el("div", { class: "ajouter" }, el("button", { type: "button", class: "btn line petit", onclick: async () => {
      const nom = await dialogue({ titre: "Nouvelle période", champ: { label: "Nom de la période", exemple: "Toussaint" }, boutons: [{ texte: "Annuler", valeur: false }, { texte: "Ajouter", valeur: true, principal: true }] });
      if (!nom) return;
      let id = slug(nom) || "periode"; while (lignes().some(x => x.id === id)) id += "-" + Math.random().toString(36).slice(2, 5);
      lignes().push({ id, nom, dates: [{ du: "", au: "" }], prix: calcActuel.prixMin || 80, min: 3, semaine_fixe: false, prix_semaine: false, mise_en_avant: "", etiquette: "", dates_texte: "" });
      changement(); dessinerVue();
    } }, "+ Ajouter une période")));
}

// ---------- Composant : services (une ligne, un statut) ----------
function tableauServices(s, lire, ecrire, chemin) {
  const liste = () => listeDe(lire, ecrire);
  const sS = s.de.champs;
  const conteneur = el("div", {});
  liste().forEach((sv, i) => {
    const c = `${chemin}[${i}]`;
    const lireS = () => liste()[i];
    conteneur.append(el("div", { class: "service", dataset: { chemin: c } },
      champSimple({ ...sS.nom, label: "Service", motif: ".*" }, () => lireS().nom, v => { lireS().nom = v; }, `${c}.nom`),
      el("div", { class: "champ", dataset: { chemin: `${c}.statut` } }, segmentsChoix(sS.statut.valeurs, lireS().statut, v => { lireS().statut = v; changement(); dessinerVue(); }, `statut-${i}`)),
      lireS().statut === "sur_demande" || lireS().statut === "en_plus"
        ? champSimple({ ...sS.precision, label: lireS().statut === "sur_demande" ? "Précision (vide = « gratuit, sur demande »)" : "Précision (prix, conditions)" }, () => lireS().precision, v => { lireS().precision = v; }, `${c}.precision`)
        : null,
      el("div", { class: "element-tete" }, boutonsOrdre(liste(), i, 0, sv.nom))));
  });
  return el("div", { dataset: { chemin } }, conteneur,
    el("div", { class: "ajouter" }, el("button", { type: "button", class: "btn line petit", onclick: () => { liste().push({ nom: "", statut: "compris", precision: "" }); changement(); dessinerVue(); } }, "+ Ajouter un service")));
}

// ---------- Composant : lieux de la page Autour ----------
function tableauLieux(s, lire, ecrire, chemin) {
  const liste = () => listeDe(lire, ecrire);
  const sL = s.de.champs;
  const conteneur = el("div", {});
  liste().forEach((l, i) => {
    const c = `${chemin}[${i}]`;
    const lireL = () => liste()[i];
    conteneur.append(el("div", { class: "lieu-ligne", dataset: { chemin: c } },
      champSimple({ ...sL.nom, motif: ".*" }, () => lireL().nom, v => { lireL().nom = v; }, `${c}.nom`),
      champSimple({ ...sL.temps, motif: ".*", label: "Temps" }, () => lireL().temps, v => { lireL().temps = v; }, `${c}.temps`),
      el("div", { class: "champ pleine", dataset: { chemin: `${c}.zone` } }, el("span", { class: "titre-champ" }, "Comment y aller"),
        segmentsChoix(choixReference("autour.zones"), lireL().zone, v => { lireL().zone = v; changement(); }, `zone-${i}`)),
      el("div", { class: "pleine" }, champSimple(sL.texte, () => lireL().texte, v => { lireL().texte = v; }, `${c}.texte`)),
      el("div", { class: "pleine" }, blocListe(sL.filtres, () => lireL().filtres, v => { lireL().filtres = v; }, `${c}.filtres`)),
      etat.avance ? el("div", { class: "pleine" }, champsObjet(sL.lien, () => lireL().lien, v => { lireL().lien = v; }, `${c}.lien`, null, null, 1)) : null,
      el("div", { class: "pleine element-tete" }, boutonsOrdre(liste(), i, 0, l.nom))));
  });
  return el("div", { dataset: { chemin } }, conteneur,
    el("div", { class: "ajouter" }, el("button", { type: "button", class: "btn line petit", onclick: () => {
      liste().push({ zone: choixReference("autour.zones")[0][0], temps: "", nom: "", texte: "", filtres: [] }); changement(); dessinerVue();
    } }, "+ Ajouter un lieu")));
}

// ---------- Photos ----------
function grillePhotos(s, lire, ecrire, chemin) {
  const liste = () => listeDe(lire, ecrire);
  const grille = el("div", { class: "grille-photos" });
  const estGalerie = chemin === "logement:galerie";
  liste().forEach((p, i) => {
    const c = `${chemin}[${i}]`;
    const rang = estGalerie ? (i === 0 ? "grande photo" : i < 5 ? "dans la mosaïque" : "en faisant défiler") : (i === 0 ? "grande photo" : "petite photo");
    grille.append(el("div", { class: "photo-carte", dataset: { chemin: c } },
      el("img", { src: p.src, alt: "" }),
      el("span", { class: "rang" }, `Photo ${i + 1} : ${rang}`),
      champSimple({ type: "texte", label: "Légende", max: 60, optionnel: true, motif: ".*" }, () => liste()[i].legende, v => { liste()[i].legende = v; }, `${c}.legende`),
      champSimple({ type: "texte", label: "Description (pour les malvoyants et Google)", max: 200, motif: ".*" }, () => liste()[i].alt, v => { liste()[i].alt = v; }, `${c}.alt`),
      el("div", { class: "actions" },
        el("button", { type: "button", class: "bouton-ligne", disabled: i === 0, onclick: () => { const l = liste(); [l[i - 1], l[i]] = [l[i], l[i - 1]]; changement(); dessinerVue(); } }, "← Avant"),
        el("button", { type: "button", class: "bouton-ligne", disabled: i === liste().length - 1, onclick: () => { const l = liste(); [l[i + 1], l[i]] = [l[i], l[i + 1]]; changement(); dessinerVue(); } }, "Après →"),
        el("button", { type: "button", class: "bouton-ligne suppr", disabled: liste().length <= (s.min || 0), onclick: async () => {
          if (!(await confirmer("Retirer cette photo ?", "Elle n’apparaîtra plus sur le site.", "Retirer", "Garder"))) return;
          liste().splice(i, 1); changement(); dessinerVue();
        } }, "Retirer")),
      boutonEnvoiPhoto("Remplacer", false, false, photos => { const o = liste()[i]; delete o.srcset; Object.assign(o, photos[0]); changement(); dessinerVue(); })));
  });
  const place = s.max - liste().length;
  return el("div", { dataset: { chemin } }, grille,
    place > 0 ? boutonEnvoiPhoto(liste().length ? "+ Ajouter des photos" : "+ Ajouter une photo", false, place > 1, photos => {
      photos.slice(0, place).forEach(ph => liste().push({ ...ph, alt: "", legende: "" }));
      changement(); dessinerVue();
      informer("Photos ajoutées", "Écrivez une description pour chaque nouvelle photo, puis touchez « Enregistrer ».");
    }) : el("p", { class: "aide" }, `Nombre maximum de photos atteint (${s.max}).`));
}

function blocPhoto(s, lire, ecrire, chemin) {
  const p = lire() || {};
  const maj = (k, v) => { const o = lire() || {}; o[k] = v; ecrire(o); };
  return el("div", { class: "photo-unique", dataset: { chemin } },
    p.src ? el("img", { src: p.src, alt: "" }) : el("div", { class: "aide" }, "Aucune photo"),
    el("div", {},
      champSimple({ type: "texte", label: "Description (pour les malvoyants et Google)", max: 200, motif: ".*" }, () => (lire() || {}).alt, v => maj("alt", v), chemin + ".alt"),
      boutonEnvoiPhoto(p.src ? "Remplacer la photo" : "Choisir une photo", false, false, photos => { const o = lire() || {}; delete o.srcset; ecrire(Object.assign(o, photos[0])); changement(); dessinerVue(); })));
}

function boutonEnvoiPhoto(texte, desactive, plusieurs, quandPretes) {
  const fichier = el("input", { type: "file", accept: "image/jpeg,image/png,image/webp,image/heic,image/heif", multiple: plusieurs, hidden: true });
  const info = el("span", { class: "envoi", "aria-live": "polite" });
  const bouton = el("button", { type: "button", class: "btn line petit", disabled: desactive, onclick: () => fichier.click() }, texte);
  fichier.addEventListener("change", async () => {
    const liste = [...fichier.files]; fichier.value = "";
    if (!liste.length) return;
    bouton.disabled = true; info.classList.remove("erreur");
    const pretes = [];
    try {
      for (const [k, f] of liste.entries()) {
        info.textContent = ` Préparation de la photo ${k + 1} sur ${liste.length}…`;
        const variantes = await preparerPhoto(f);
        const { photo } = await api("POST", "/api/photos", { nom: f.name.replace(/\.[^.]+$/, ""), variantes });
        pretes.push(photo);
      }
      info.textContent = "";
      quandPretes(pretes);
    } catch (err) { info.textContent = " " + err.message; info.classList.add("erreur"); if (pretes.length) quandPretes(pretes); }
    finally { bouton.disabled = desactive; }
  });
  return el("div", { class: "ajouter" }, bouton, info, fichier);
}

// Réduit la photo dans le navigateur (480 et 960 px de large), en WebP si possible, sinon JPEG
async function preparerPhoto(f) {
  if (f.size > 30 * 1024 * 1024) throw new Error("Photo trop lourde (30 Mo au plus).");
  let image;
  try { image = await createImageBitmap(f, { imageOrientation: "from-image" }); }
  catch { throw new Error("Cette photo n’a pas pu être lue : essayez une photo JPEG."); }
  if (image.width < 400) throw new Error("Photo trop petite (400 pixels de large au minimum).");
  const variantes = [];
  for (const l of [480, 960].filter(x => x <= image.width)) {
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

const COMPOSANTS = { prix: tableauPrix, services: tableauServices, lieux: tableauLieux, photos: grillePhotos };

// ---------- Enregistrer ----------
function majEtat() {
  const m = modifies(), e = $("etat");
  $("pied-enregistrer").classList.toggle("a-enregistrer", m.length > 0);
  if (m.length) { e.textContent = "Modifications pas encore enregistrées"; e.className = "modifie"; }
  else if (e.className !== "ok") { e.textContent = "Tout est enregistré"; e.className = ""; }
  $("enregistrer").disabled = !m.length;
  $("annuler").hidden = !m.length;
}

function controler() {
  const tous = Object.fromEntries(Object.entries(etat.fichiers).map(([n, f]) => [n, f.donnees]));
  const erreurs = [], valeurs = {};
  for (const n of modifies()) {
    const { valeur, erreurs: e1 } = valider(SCHEMAS[n], clone(tous[n]));
    valeurs[n] = valeur;
    e1.forEach(e => erreurs.push({ ...e, f: n }));
    if (!e1.length) coherence(n, valeur, tous).forEach(e => erreurs.push({ ...e, f: n }));
  }
  return { erreurs, valeurs };
}

async function enregistrer() {
  const { erreurs, valeurs } = controler();
  etat.erreurs = erreurs;
  if (erreurs.length) { dessinerVue(); window.scrollTo(0, 0); return false; }
  $("enregistrer").disabled = true; $("etat").textContent = "Enregistrement…"; $("etat").className = "";
  try {
    for (const [n, valeur] of Object.entries(valeurs)) {
      const f = etat.fichiers[n];
      const r = await api("PUT", "/api/contenus/" + n, { donnees: valeur, version: f.version });
      Object.assign(f, { donnees: r.donnees, version: r.version, original: JSON.stringify(r.donnees) });
    }
    etat.erreurs = [];
    dessinerVue();
    $("etat").textContent = "Enregistré. Rien n’est encore en ligne : touchez « Publier sur le site » quand tout est prêt."; $("etat").className = "ok";
    await majBrouillon();
    return true;
  } catch (err) {
    if (err.statut === 422 && err.details && err.details.erreurs) { etat.erreurs = err.details.erreurs.map(e => ({ ...e, f: e.f || e.rubrique || Object.keys(valeurs)[0] })); dessinerVue(); }
    else if (err.statut === 409) await informer("Modifié ailleurs", "Ce contenu a été modifié dans un autre onglet ou par quelqu’un d’autre. Rechargez la page avant de continuer.");
    else if (err.statut !== 401) await informer("Enregistrement impossible", err.message);
    majEtat();
    return false;
  }
}
$("enregistrer").addEventListener("click", enregistrer);
$("annuler").addEventListener("click", async () => {
  if (!(await confirmer("Annuler vos modifications ?", "Tout revient à la dernière version enregistrée.", "Annuler mes modifications", "Continuer"))) return;
  for (const f of Object.values(etat.fichiers)) f.donnees = JSON.parse(f.original);
  etat.erreurs = []; dessinerVue();
});

// Rubrique où se trouve un champ (« fichier » + chemin), pour les messages d'erreur
function vueDe(f, chemin) {
  const commence = (c, k) => c === k || c.startsWith(k + ".") || c.startsWith(k + "[");
  for (const v of VUES) for (const b of v.blocs || [])
    if (b.f === f && (!b.c || commence(chemin, b.c)) && (!b.champs || b.champs.some(k => commence(chemin, k))) && (!v.avance || etat.avance)) return v;
  return null;
}
function bandeauErreurs() {
  return el("div", { class: "bandeau-erreurs", role: "alert" },
    el("strong", {}, "Quelques points à corriger avant d’enregistrer :"),
    el("ul", {}, etat.erreurs.slice(0, 12).map(e => {
      const v = vueDe(e.f, e.chemin || "");
      return el("li", {}, e.message, v && v.id !== etat.vue ? [" ", el("button", { type: "button", class: "lien", onclick: () => ouvrir(v.id) }, `Aller à « ${v.titre} »`)] : null);
    })),
    etat.erreurs.length > 12 ? el("p", {}, `… et ${etat.erreurs.length - 12} autre(s).`) : null);
}
function marquerErreurs() {
  const parent = c => { const p = c.replace(/(\.[^.[\]:]+|\[\d+\])$/, ""); return p === c ? "" : p; };
  for (const e of etat.erreurs) {
    let c = `${e.f}:${e.chemin || ""}`, cible = null;
    while (c && !(cible = document.querySelector(`[data-chemin="${CSS.escape(c)}"]`))) c = parent(c);
    if (!cible) continue;
    const champ = cible.classList.contains("champ") ? cible : cible.querySelector(".champ") || cible;
    champ.classList.add("en-erreur");
    champ.append(el("div", { class: "msg-erreur" }, e.message));
  }
}

// ---------- Brouillon, aperçu, publication ----------
let brouillon = { modifies: [], photos: 0, apercu: null };
const LIBELLES = { accueil: "Accueil", logement: "Le logement", tarifs: "Mes prix", maison: "Ce qui est compris", reservation: "Page Tarifs", autour: "Autour", site: "Coordonnées" };
async function majBrouillon() {
  try { brouillon = await api("GET", "/api/brouillon"); } catch { return; }
  const attente = brouillon.modifies.length > 0 || brouillon.photos > 0;
  $("barre-brouillon").classList.toggle("attente", attente);
  $("texte-brouillon").textContent = attente
    ? `Enregistré mais pas encore en ligne : ${brouillon.modifies.map(m => LIBELLES[m] || m).join(", ") || `${brouillon.photos} photo(s)`}.`
    : "Le site en ligne est à jour.";
  $("lien-apercu").hidden = !attente;
  $("lien-apercu").href = brouillon.apercu || "/apercu/";
  $("publier").hidden = $("abandonner").hidden = !attente;
}
$("publier").addEventListener("click", async () => {
  if (modifies().length) {
    const ok = await confirmer("Enregistrer d’abord ?", "Certaines modifications ne sont pas encore enregistrées.", "Enregistrer et publier", "Annuler");
    if (!ok || !(await enregistrer())) return;
  }
  if (!(await confirmer("Publier sur le site ?", "Ces parties seront mises en ligne. Le site sera à jour dans une à deux minutes.", "Publier", "Pas encore", brouillon.modifies.map(m => LIBELLES[m] || m)))) return;
  $("publier").disabled = true; $("texte-brouillon").textContent = "Publication en cours…";
  try {
    await api("POST", "/api/publier", {});
    await majBrouillon();
    $("texte-brouillon").textContent = "Publié. Le site en ligne sera à jour dans une à deux minutes.";
  } catch (err) {
    await majBrouillon();
    if (err.statut !== 401) await informer("Publication impossible", err.message, (err.details && err.details.erreurs || []).slice(0, 8).map(e => e.message));
  } finally { $("publier").disabled = false; }
});
$("abandonner").addEventListener("click", async () => {
  if (!(await confirmer("Tout annuler ?", "Toutes les modifications enregistrées mais pas encore publiées seront perdues. Le site en ligne ne change pas.", "Tout annuler", "Garder mes modifications"))) return;
  try {
    await api("POST", "/api/abandonner", {});
    await chargerTout(); etat.erreurs = []; await majBrouillon(); dessinerVue();
  } catch (err) { if (err.statut !== 401) await informer("Impossible", err.message); }
});

// ---------- Historique : revenir à une version publiée ----------
function blocHistorique(v) {
  const fichiers = [...new Set((v.blocs || []).map(b => b.f))].filter(f => SCHEMAS[f]);
  if (!fichiers.length) return null;
  const liste = el("div", {}, el("p", { class: "aide" }, "Chargement…"));
  const dateFr = d => new Date(d).toLocaleString("fr-FR", { dateStyle: "long", timeStyle: "short" });
  const bloc = el("details", { class: "bloc replie historique" }, el("summary", {}, "Revenir à une version déjà publiée"), liste);
  bloc.addEventListener("toggle", async () => {
    if (!bloc.open || bloc.dataset.charge) return;
    bloc.dataset.charge = "1";
    const parties = [];
    for (const f of fichiers) {
      try {
        const { versions } = await api("GET", "/api/historique/" + f);
        parties.push(el("h3", {}, LIBELLES[f] || f), versions.length
          ? el("ol", {}, versions.map(x => el("li", {}, el("span", {}, el("strong", {}, dateFr(x.date)), " · ", x.message),
            el("button", { type: "button", class: "bouton-ligne", onclick: async () => {
              if (!(await confirmer("Reprendre cette version ?", `« ${LIBELLES[f] || f} » revient à la version du ${dateFr(x.date)}. Vérifiez, enregistrez, puis publiez.`, "Reprendre", "Annuler"))) return;
              try { const { donnees } = await api("GET", `/api/historique/${f}/${x.id}`); etat.fichiers[f].donnees = donnees; etat.erreurs = []; dessinerVue(); window.scrollTo(0, 0); }
              catch (err) { if (err.statut !== 401) informer("Impossible", err.message); }
            } }, "Reprendre"))))
          : el("p", { class: "aide" }, "Aucune version publiée depuis l’admin pour l’instant."));
      } catch (err) { parties.push(el("p", { class: "erreur" }, err.message)); }
    }
    liste.replaceChildren(...parties);
  });
  return bloc;
}

// ---------- Avis (lecture seule) ----------
function vueAvis(d) {
  return el("div", {},
    el("div", { class: "bandeau-info" }, "Ces avis et notes sont mis à jour par Thomas avec le skill « maj-avis-chez-belle ». Ils ne se modifient pas ici.",
      d.mis_a_jour ? el("p", {}, el("strong", {}, "Dernière mise à jour : "), new Date(d.mis_a_jour + "T12:00:00").toLocaleDateString("fr-FR", { dateStyle: "long" })) : null),
    el("section", { class: "bloc lecture" },
      el("p", {}, el("strong", {}, `Note globale ${d.notes.globale} sur ${d.notes.nombre} avis`), " · ", d.notes.categories.map(c => `${c.nom} ${c.note}`).join(" · ")),
      d.avis.map(a => el("figure", {}, el("blockquote", {}, a.extrait), el("figcaption", { class: "aide" }, `${a.prenom} · ${a.date}`)))));
}

// ---------- Mode d'emploi ----------
function modeEmploi() {
  const section = (titre, ...contenu) => el("section", { class: "bloc guide" }, el("h2", {}, titre), ...contenu);
  const liste = (...p) => el("ul", {}, p.map(x => el("li", {}, x)));
  const etapes = (...p) => el("ol", {}, p.map(x => el("li", {}, x)));
  return [
    el("div", { class: "bandeau-info" }, "Rien de ce que vous faites ici n’arrive sur le site sans le bouton « Publier sur le site ». Vous pouvez essayer sans crainte."),
    section("En 4 gestes",
      etapes("Choisissez un thème dans le menu (sur tablette : le bouton « Menu »), puis modifiez.",
        "Touchez « Enregistrer » en bas de l’écran. Le site en ligne ne change pas encore.",
        "Touchez « Voir avant de publier » dans la barre rose : c’est le site avec vos modifications.",
        "Si tout vous plaît, « Publier sur le site » : c’est en ligne en une à deux minutes. Sinon « Tout annuler ».")),
    section("Écrire un texte",
      liste("Écrivez comme dans un traitement de texte. Gras et Italique : sélectionnez les mots puis touchez le bouton.",
        "Les pastilles bleues (par exemple « 80 » ou « 16 h ») sont des valeurs automatiques : elles se mettent à jour toutes seules quand vous changez un prix ou un horaire. Pour en ajouter une : « + Valeur automatique ».",
        "Le petit compteur indique la longueur maximale du texte.")),
    section("Mes prix",
      liste("Une ligne par période : nom, dates de l’arrivée au départ, prix par nuit, nombre minimum de nuits.",
        "« + Autres dates » ajoute des dates à la même période (par exemple les trois ponts de mai).",
        "Si deux périodes se chevauchent, la plus courte l’emporte : les ponts gardent leur prix au milieu de « Mai et juin ».",
        "Nouvelle saison : changez les dates de chaque ligne ; l’année et le formulaire de demande suivent tout seuls.")),
    section("Ce qui est compris",
      liste("Pour chaque service, touchez « Compris », « Sur demande », « En plus » ou « Non proposé » : c’est repris sur la page Tarifs.",
        "Les horaires, la capacité, le dépôt et le prix du chien sont repris partout où ils sont cités.")),
    section("Mes photos",
      liste("« + Ajouter des photos » : vous pouvez en choisir plusieurs d’un coup.",
        "« ← Avant » et « Après → » changent l’ordre. La 1re photo est la plus grande.",
        "Écrivez toujours une description : elle aide les malvoyants et Google.")),
    section("En cas de souci",
      liste("« Session expirée » : entrez à nouveau le mot de passe (la connexion dure 8 heures). Enregistrez souvent.",
        "Un message rouge indique ce qu’il faut corriger, à côté du champ concerné.",
        "Pour revenir en arrière : en bas de chaque thème, « Revenir à une version déjà publiée ».",
        "Après 5 mots de passe erronés, attendez 15 minutes. Pour tout autre message, prévenez Thomas."))
  ];
}

// ---------- Démarrage ----------
(async () => {
  try { const s = await api("GET", "/api/session"); if (s.connecte) await demarrer(); else afficherConnexion(); }
  catch (err) { if (err.statut !== 401) $("chargement").textContent = err.message; }
})();
