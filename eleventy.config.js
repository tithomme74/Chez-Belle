// Configuration Eleventy : les pages sont dans src/, leurs contenus dans src/_data/*.json, le site produit dans _site/
// Aperçu local du brouillon : CB_DONNEES=.local/brouillon CB_APERCU=1 (contenus lus ailleurs, bandeau « aperçu »).
// Tests : CB_DONNEES=tests/donnees CB_SORTIE=_test (contenus figés, voir scripts/tester.js).
import path from "node:path";
import { riche, lien, jetons, jsonScript, absolues } from "./src/_lib/contenu.js";
import { calculer } from "./src/_lib/calc.js";

const dossierDonnees = process.env.CB_DONNEES ? path.relative("src", process.env.CB_DONNEES).split(path.sep).join("/") : "_data";
// Aperçu : bandeau visible et pages non indexées (aperçu local, ou branche de brouillon publiée par Cloudflare Pages)
const apercu = process.env.CB_APERCU === "1" || (process.env.CF_PAGES === "1" && process.env.CF_PAGES_BRANCH !== "main");

export default function (eleventyConfig) {
  eleventyConfig.addGlobalData("apercu", apercu);
  // Valeurs calculées pour chaque page
  eleventyConfig.addGlobalData("eleventyComputed", {
    // Chemin relatif vers la racine du site : "" pour l'accueil, "../" pour les onglets (liens relatifs conservés)
    racine: data => "../".repeat(Math.max(0, (data.page.url || "/").split("/").filter(Boolean).length)),
    calc: data => calculer(data.tarifs, data.accueil, data.maison)
  });
  if (process.env.CB_DONNEES) {
    // Le dossier du brouillon est ignoré par Git : sans ceci, Eleventy ne surveillerait pas ses changements
    eleventyConfig.setUseGitIgnore(false);
    eleventyConfig.addWatchTarget(process.env.CB_DONNEES);
  }

  // Fichiers recopiés tels quels
  // _headers : en-têtes de sécurité lus par Cloudflare Pages
  ["src/assets", "src/photos", "src/favicon.svg", "src/_headers"]
    .forEach(p => eleventyConfig.addPassthroughCopy(p));
  // Espace d'administration : pages statiques + schémas partagés avec le serveur
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin", "src/_lib/schemas.js": "admin/schemas.js", "src/_lib/calc.js": "admin/calc.js", "src/_lib/contenu.js": "admin/contenu.js" });
  eleventyConfig.ignores.add("src/admin/**");
  eleventyConfig.ignores.add("src/photos/**");
  eleventyConfig.ignores.add("src/_lib/**");

  // Texte mis en forme (gras, italique, lien…) : seules quelques balises sont autorisées
  eleventyConfig.addFilter("riche", function (texte) { return riche(jetons(texte, this.ctx), this.ctx.racine); });
  // Texte simple avec jetons ({prix_min}, {depot}…), échappé normalement
  eleventyConfig.addFilter("jetons", function (texte) { return jetons(texte, this.ctx); });
  // Lien interne écrit depuis la racine (« /autour/ ») rendu relatif à la page
  eleventyConfig.addFilter("lien", function (url) { return lien(url, this.ctx.racine); });
  eleventyConfig.addFilter("jsonScript", jsonScript);
  // Adresses écrites depuis la racine (« /photos/x.webp ») rendues complètes avec l'adresse du site (données pour Google)
  eleventyConfig.addFilter("absolues", absolues);

  return {
    dir: { input: "src", includes: "_includes", data: dossierDonnees, output: process.env.CB_SORTIE || "_site" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk"
  };
}
