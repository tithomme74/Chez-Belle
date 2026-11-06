// Configuration Eleventy : les pages sont dans src/, le site produit dans _site/
export default function (eleventyConfig) {
  // Fichiers recopiés tels quels
  ["src/assets", "src/photos", "src/infos", "src/favicon.svg", "src/robots.txt", "src/sitemap.xml"]
    .forEach(p => eleventyConfig.addPassthroughCopy(p));
  eleventyConfig.ignores.add("src/photos/**");

  return {
    dir: { input: "src", includes: "_includes", data: "_data", output: "_site" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk"
  };
}
