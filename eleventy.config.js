// Configuration Eleventy : les pages sont dans src/, leurs contenus dans src/_data/*.json, le site produit dans _site/
import { riche, lien, jetons, jsonScript } from "./src/_lib/contenu.js";

export default function (eleventyConfig) {
  // Fichiers recopiés tels quels
  ["src/assets", "src/photos", "src/infos", "src/favicon.svg", "src/robots.txt", "src/sitemap.xml"]
    .forEach(p => eleventyConfig.addPassthroughCopy(p));
  // Espace d'administration : pages statiques + schémas partagés avec le serveur
  eleventyConfig.addPassthroughCopy({ "src/admin": "admin", "src/_lib/schemas.js": "admin/schemas.js" });
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

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk"
  };
}
