// Sécurité et jetons des textes saisis dans l'admin (src/_lib/contenu.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { riche, lien, jetons, jsonScript } from "../src/_lib/contenu.js";
import { calculer } from "../src/_lib/calc.js";
// Contenus figés (tests/donnees) : les calculs testés ne dépendent pas des modifications faites dans l'admin
const lireJson = n => JSON.parse(fs.readFileSync(`tests/donnees/${n}.json`, "utf8"));
const calc = () => calculer(lireJson("tarifs"), lireJson("accueil"), lireJson("maison"));

test("riche : balises autorisées conservées", () => {
  assert.equal(riche("<b>a</b> <em>b</em> 1<sup>er</sup><br>&nbsp;€"), "<b>a</b> <em>b</em> 1<sup>er</sup><br>&nbsp;€");
});
test("riche : script, attributs et styles neutralisés", () => {
  assert.equal(riche('<script>alert(1)</script>'), "&lt;script&gt;alert(1)&lt;/script&gt;");
  assert.equal(riche('<b onclick="x()">a</b>'), '&lt;b onclick=&quot;x()&quot;&gt;a</b>');
  assert.equal(riche('<img src=x onerror=alert(1)>'), "&lt;img src=x onerror=alert(1)&gt;");
});
test("riche : liens sûrs seulement, externes en nouvel onglet", () => {
  assert.equal(riche('<a href="javascript:alert(1)">x</a>'), '&lt;a href=&quot;javascript:alert(1)&quot;&gt;x</a>');
  assert.equal(riche('<a href="/autour/">x</a>', "../"), '<a href="../autour/">x</a>');
  assert.equal(riche('<a href="https://ex.fr">x</a>'), '<a href="https://ex.fr" rel="noopener" target="_blank">x</a>');
});
test("lien : relatif à la page", () => {
  assert.equal(lien("/", ""), "./"); assert.equal(lien("/", "../"), "../");
  assert.equal(lien("/autour/", ""), "autour/"); assert.equal(lien("#reserver", "../"), "#reserver");
});
test("jetons : valeurs lues dans les tarifs", () => {
  const ctx = { maison: lireJson("maison"), calc: calc(), logement: { galerie: [1, 2, 3] } };
  assert.equal(jetons("Dès {prix_min} €, dépôt {depot} €, {semaine:coeur} €, {nb_photos} photos, {annee}, {inconnu}", ctx),
    "Dès 80 €, dépôt 300 €, 805 €, 3 photos, 2027, {inconnu}");
});
test("une modification de prix se répercute partout", () => {
  const c = calc();
  assert.equal(c.prixMin, 80);
  assert.equal(c.grille.find(g => g.titre === "Cœur de l’été").prix, "805 €");
  assert.deepEqual(c.zoom.map(z => z.prix), ["80 €", "90 à 105 €", "805 €"]);
  assert.deepEqual(c.zoom.map(z => z.sejour), ["3 nuits minimum", "3 ou 4 nuits minimum", "7 nuits minimum"]);
});

test("les contenus actuels respectent leurs schémas (sans perte)", async () => {
  const { SCHEMAS, valider, coherence } = await import("../src/_lib/schemas.js");
  const tous = Object.fromEntries(Object.keys(SCHEMAS).map(n => [n, JSON.parse(fs.readFileSync(`src/_data/${n}.json`, "utf8"))]));
  for (const n of Object.keys(SCHEMAS)) {
    const r = valider(SCHEMAS[n], tous[n]);
    assert.deepEqual(r.erreurs, [], n);
    assert.deepEqual(coherence(n, r.valeur, tous), [], n);
    assert.deepEqual(r.valeur, tous[n], n + " : rien ne doit être perdu à l'enregistrement");
  }
});

test("avis : le script du flow valide, garde les extraits mot pour mot et refuse ce qui casserait le site", async () => {
  const { preparerAvis } = await import("../scripts/maj-avis.js");
  const bon = { notes: { globale: "4,85", nombre: 40, categories: [{ nom: "Emplacement", note: "5,0" }] },
    avis: [{ prenom: "Léa", date: "juillet 2026", extrait: "  Très bien,\n  calme  et propre. " }] };
  const r = preparerAvis(bon, "2026-11-06");
  assert.deepEqual(r.erreurs, []);
  assert.equal(r.valeur.mis_a_jour, "2026-11-06");
  assert.equal(r.valeur.avis[0].extrait, "Très bien,   calme  et propre.", "mot pour mot : seuls les retours à la ligne deviennent des espaces");
  const mauvais = [
    { ...bon, notes: { ...bon.notes, globale: "4.85" } },                                   // point au lieu de virgule
    { ...bon, avis: [{ ...bon.avis[0], extrait: "<script>alert(1)</script>" }] },          // balise
    { ...bon, avis: [{ ...bon.avis[0], date: "2026-07" }] },                                // date mal écrite
    { ...bon, avis: [] },                                                                   // aucun avis
    { ...bon, avis: Array(13).fill(bon.avis[0]) },                                          // trop d'avis
    { notes: bon.notes }                                                                    // avis absents
  ];
  for (const m of mauvais) assert.ok(preparerAvis(m).erreurs.length > 0, JSON.stringify(m).slice(0, 80));
  const actuel = JSON.parse(fs.readFileSync("src/_data/avis.json", "utf8"));
  const { SCHEMA_AVIS, valider } = await import("../src/_lib/schemas.js");
  assert.deepEqual(valider(SCHEMA_AVIS, actuel).erreurs, [], "avis.json actuel valide");
});

test("liens : barre oblique inversée et espaces refusés (redirection vers un autre site)", async () => {
  const { SCHEMAS, valider } = await import("../src/_lib/schemas.js");
  const site = JSON.parse(fs.readFileSync("src/_data/site.json", "utf8"));
  for (const mauvais of ["/\\evil.com", "/\\\\evil.com", "//evil.com", "https://ex.fr/a b", "javascript:alert(1)", " /autour/"]) {
    assert.ok(valider(SCHEMAS.site, { ...site, airbnb: mauvais }).erreurs.length > 0, mauvais);
    assert.ok(!riche(`<a href="${mauvais}">x</a>`).includes("<a href"), "riche : " + mauvais);
  }
  assert.equal(lien("/\\evil.com", ""), "#");
  for (const bon of ["/autour/", "#reserver", "https://www.airbnb.fr/rooms/25931091", "mailto:a@b.fr", "tel:+33 6 00 00 00 00"])
    assert.deepEqual(valider(SCHEMAS.site, { ...site, airbnb: bon }).erreurs, [], bon);
});

test("gabarits : textes saisis jamais interprétés comme du code de gabarit", async () => {
  // Le contenu est une donnée : « {{ 7*7 }} » doit s'afficher tel quel (vérifié aussi à la main au lot 7)
  assert.equal(riche("{{ 7*7 }} {% raw %}"), "{{ 7*7 }} {% raw %}");
});

test("pastilles : valeurs de la fiche, majuscule en début de phrase seulement", () => {
  const ctx = { maison: lireJson("maison"), calc: calc() };
  assert.equal(jetons("{compris}. Arrivée dès {arrivee}, {capacite} voyageurs, {surface}&nbsp;m², lits faits, {compris}.", ctx),
    "Linge et ménage compris. Arrivée dès 16 h, 4 voyageurs, 55&nbsp;m², lits faits, linge et ménage compris.");
  assert.equal(jetons("dès <b>{prix_min} €</b><br>{compris}", ctx), "dès <b>80 €</b><br>linge et ménage compris");
  assert.equal(jetons("{prix:noel} € · {semaine:coeur} € · {prix:inconnu}", ctx), "85 € · 805 € · {prix:inconnu}");
});

test("prix en lignes : calendrier nuit par nuit (la plage la plus courte l'emporte), bornes du formulaire, dates en clair", async () => {
  const { datesEnClair } = await import("../src/_lib/calc.js");
  const c = calc();
  const nuit = s => c.calendrier.find(p => p.du <= s && s <= p.au)?.type;
  assert.equal(nuit("2027-05-01"), "ponts"); assert.equal(nuit("2027-05-02"), "mai-juin");
  assert.equal(nuit("2027-05-08"), "ponts"); assert.equal(nuit("2027-05-09"), "mai-juin");
  assert.equal(nuit("2027-06-20"), "mai-juin"); assert.equal(nuit("2027-06-21"), "juillet");
  assert.equal(nuit("2027-12-31"), "noel"); assert.equal(nuit("2027-10-01"), undefined);
  assert.deepEqual(c.formulaire, { arrivee_min: "2027-05-01", arrivee_max: "2027-12-31", depart_min: "2027-05-02", depart_max: "2028-01-01", voyageurs_max: 4, voyageurs_defaut: 2, enfants_max: 3 });
  assert.equal(c.annee, 2027);
  assert.equal(datesEnClair([{ du: "2027-05-01", au: "2027-05-02" }, { du: "2027-05-06", au: "2027-05-09" }, { du: "2027-06-21", au: "2027-07-07" }]), "1er mai · 6 – 9 mai · 21 juin – 7 juillet");
  assert.deepEqual(c.types.noel.arrivees, ["2027-12-18", "2027-12-25"]);
});

test("services : listes « compris » et « en plus » tirées de la fiche", () => {
  const c = calc();
  assert.equal(c.compris.length, 5);
  assert.deepEqual(c.enPlus, ["Taxe de séjour : par adulte et par nuit, mineurs exonérés", "Chien : {chien_court} € jusqu’à {chien_seuil} nuits, {chien_long} € au-delà", "Lit parapluie et chaise haute : gratuits, sur demande"]);
});

test("données dans une balise script : « </script> » neutralisé", () => {
  assert.equal(jsonScript({ a: "</script><script>alert(1)</script>" }).includes("</script>"), false);
});
