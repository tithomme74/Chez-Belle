// Outils partagés par les gabarits (et plus tard par l'admin) pour transformer les contenus JSON en HTML sûr.

const ECHAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
export const echapper = s => String(s).replace(/[&<>"]/g, c => ECHAP[c]);

// Lien interne écrit depuis la racine (« /autour/ ») → relatif à la page courante ; les autres liens sont inchangés.
export function lien(url, racine = "") {
  if (typeof url !== "string") return "";
  if (/[\\\s]/.test(url)) return "#"; // « /\\site.com » serait lu comme un lien vers un autre site
  if (url.startsWith("/") && !url.startsWith("//")) return (racine + url.slice(1)) || "./";
  return url;
}

const sur = url => !/[\\\s]/.test(url) && /^(https?:\/\/|mailto:|tel:|#|\/(?!\/)|\.\.?\/)/i.test(url);

// Texte mis en forme : seules les balises b, strong, em, i, sup, br et a (href http(s), interne, ancre, mailto, tel) passent.
// Tout le reste est échappé. Les entités (&nbsp; …) sont conservées.
export function riche(texte, racine = "") {
  if (texte == null) return "";
  const s = String(texte);
  let out = "", i = 0;
  const re = /<(\/?)([a-z]+)([^<>]*)>/gi;
  for (let m; (m = re.exec(s)); ) {
    out += texteSur(s.slice(i, m.index));
    i = re.lastIndex;
    const [brut, ferme, nomBrut, attrs] = m, nom = nomBrut.toLowerCase();
    if (["b", "strong", "em", "i", "sup"].includes(nom) && !attrs.trim()) out += `<${ferme}${nom}>`;
    else if (nom === "br" && !ferme) out += "<br>";
    else if (nom === "a" && ferme) out += "</a>";
    else if (nom === "a") {
      const href = (attrs.match(/\shref="([^"]*)"/) || [])[1];
      if (href && sur(href)) {
        const ext = /^https?:/i.test(href);
        out += `<a href="${echapper(lien(href, racine))}"${ext ? ' rel="noopener" target="_blank"' : ""}>`;
      } else out += echapper(brut);
    } else out += echapper(brut);
  }
  return out + texteSur(s.slice(i));
}
const texteSur = t => t.replace(/&(?![a-z]+;|#\d+;)/gi, "&amp;").replace(/[<>"]/g, c => ECHAP[c]);

// Jetons remplacés dans les textes, pour que prix, dépôt, etc. ne soient saisis qu'une fois (dans les tarifs).
//   {prix_min} {depot} {annee} {nb_photos} {chien_court} {chien_long} {chien_seuil} {prix:noel} {semaine:coeur} {min:juillet}
export function jetons(texte, ctx) {
  if (texte == null) return "";
  const t = ctx && ctx.tarifs, c = ctx && ctx.calc;
  if (!t || !c) return String(texte);
  return String(texte).replace(/\{([a-z_]+)(?::([a-z0-9_]+))?\}/g, (tout, nom, cle) => {
    const type = cle && t.types[cle];
    switch (nom) {
      case "prix_min": return nombre(c.prixMin);
      case "depot": return nombre(t.depot);
      case "annee": return String(t.annee);
      case "chien_court": return nombre(t.chien.court);
      case "chien_long": return nombre(t.chien.long);
      case "chien_seuil": return String(t.chien.seuil);
      case "nb_photos": return String(ctx.logement ? ctx.logement.galerie.length : 0);
      case "prix": return type ? nombre(type.prix) : tout;
      case "semaine": return type ? nombre(type.prix * 7) : tout;
      case "min": return type ? String(type.min) : tout;
      default: return tout;
    }
  });
}
export const nombre = n => Number(n).toLocaleString("fr-FR").replace(/\u202f/g, "\u00a0");

// Données pour un <script type="application/json"> : « < » neutralisé pour ne jamais fermer la balise.
export const jsonScript = obj => JSON.stringify(obj).replace(/</g, "\u003c");
