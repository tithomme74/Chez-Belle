// Sécurité et jetons des textes saisis dans l'admin (src/_lib/contenu.js)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { riche, lien, jetons } from "../src/_lib/contenu.js";
import { calculer } from "../src/_lib/calc.js";
const lireJson = n => JSON.parse(fs.readFileSync(`src/_data/${n}.json`, "utf8"));
const calc = () => calculer(lireJson("tarifs"), lireJson("accueil"));

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
  const tarifs = JSON.parse(fs.readFileSync("src/_data/tarifs.json", "utf8"));
  const ctx = { tarifs, calc: calc(), logement: { galerie: [1, 2, 3] } };
  assert.equal(jetons("Dès {prix_min} €, dépôt {depot} €, {semaine:coeur} €, {nb_photos} photos, {annee}, {inconnu}", ctx),
    "Dès 80 €, dépôt 300 €, 805 €, 3 photos, 2027, {inconnu}");
});
test("une modification de prix se répercute partout", () => {
  const c = calc();
  assert.equal(c.prixMin, 80);
  assert.equal(c.grille.find(g => g.type === "coeur").prix, "805 €");
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
