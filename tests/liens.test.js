// Recette : aucun lien interne cassé dans le site construit (pages, images, scripts, ancres #…)
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const SITE = "_site";
const pages = [];
(function parcourir(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) parcourir(p);
    else if (e.name.endsWith(".html")) pages.push(p);
  }
})(SITE);

const idsDe = f => new Set([...fs.readFileSync(f, "utf8").matchAll(/\sid="([^"]+)"/g)].map(m => m[1]));

test("toutes les pages ont été construites", () => {
  for (const p of ["index.html", "chez-belle/index.html", "tarifs-reservation/index.html", "autour/index.html", "infos/index.html", "admin/index.html"])
    assert.ok(fs.existsSync(path.join(SITE, p)), p);
});

for (const page of pages) {
  test(`liens internes valides : ${path.relative(SITE, page).replace(/\\/g, "/")}`, () => {
    const html = fs.readFileSync(page, "utf8");
    const urls = [
      ...[...html.matchAll(/\s(?:href|src)="([^"]*)"/g)].map(m => m[1]),
      ...[...html.matchAll(/\s(?:srcset|imagesrcset)="([^"]*)"/g)].flatMap(m => m[1].split(",").map(s => s.trim().split(/\s+/)[0]))
    ];
    const casses = [];
    for (const u of urls) {
      if (!u || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(u)) continue;
      const [chemin, ancre] = u.split("#");
      let cible = chemin
        ? (chemin.startsWith("/") ? path.join(SITE, chemin) : path.join(path.dirname(page), chemin))
        : page;
      if (fs.existsSync(cible) && fs.statSync(cible).isDirectory()) cible = path.join(cible, "index.html");
      if (!fs.existsSync(cible)) { casses.push(u); continue; }
      if (ancre && cible.endsWith(".html") && !idsDe(cible).has(ancre) && ancre !== "") casses.push(u + " (ancre absente)");
    }
    assert.deepEqual(casses, []);
  });
}
