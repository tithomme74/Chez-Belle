// Non-régression : les pages produites par Eleventy doivent rester identiques au site d'origine
// (références dans tests/reference, issues du commit 091e57e). Le site comparé (_test) est construit avec les
// contenus figés de tests/donnees : les modifications faites dans l'admin ne changent pas ce test (voir scripts/tester.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const PAGES = { accueil: "index.html", "chez-belle": "chez-belle/index.html", "tarifs-reservation": "tarifs-reservation/index.html", autour: "autour/index.html" };

// Écarts acceptés et volontaires par rapport à la référence
const ECARTS = [
  [/href="\/favicon\.svg"/g, 'href="favicon.svg"'],                        // accueil : chemin relatif comme les autres pages
  [/Éditrice du site : Isabelle Leseigneur/g, "Éditrice du site : Isabelle L."], // nom unifié sur toutes les pages
  [/<script type="application\/json" id="donnees-tarifs">[\s\S]*?<\/script>/g, ""] // tarifs transmis à l'estimation
];

// Données JS (avis, notes) comparées sur leur contenu, pas sur leur mise en forme
const canonJS = html => html.replace(/(const (?:AVIS|NOTES) = )([\s\S]*?);\n\/\/ FIN/g,
  (t, debut, json) => `${debut}${JSON.stringify(JSON.parse(json))};\n// FIN`);

export const normaliser = html => ECARTS.reduce((h, [re, r]) => h.replace(re, r), canonJS(html.replace(/\r\n/g, "\n")))
  .replace(/<!--[\s\S]*?-->/g, "")   // commentaires HTML
  .replace(/^[ \t]*\/\/.*$/gm, "")   // commentaires JS sur une ligne
  .replace(/&nbsp;/g, " ")
  .replace(/>\s+</g, "><").replace(/\s+/g, " ").replace(/> </g, "><").trim();

for (const [nom, chemin] of Object.entries(PAGES)) {
  test(`page ${nom} identique à la référence`, () => {
    const attendu = normaliser(fs.readFileSync(`tests/reference/${nom}.html`, "utf8"));
    const obtenu = normaliser(fs.readFileSync(`_test/${chemin}`, "utf8"));
    if (obtenu !== attendu) {
      let i = 0; while (obtenu[i] === attendu[i]) i++;
      assert.fail(`écart à la position ${i}\n attendu : …${attendu.slice(Math.max(0, i - 80), i + 120)}\n obtenu  : …${obtenu.slice(Math.max(0, i - 80), i + 120)}`);
    }
  });
}

test("fichiers statiques recopiés", () => {
  for (const f of ["assets/style.css", "assets/reservation.js", "assets/autour.js", "assets/galerie.js", "favicon.svg", "robots.txt", "sitemap.xml", "infos/index.html", "photos/jardin-960.webp"])
    assert.ok(fs.existsSync(`_test/${f}`), f);
});
