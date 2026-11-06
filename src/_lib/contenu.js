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

// Pastilles (jetons) : valeurs saisies une seule fois et reprises dans les textes. Dans l'admin, elles
// s'affichent comme des pastilles bleues avec leur valeur actuelle ; dans les données, sous la forme {nom} ou {prix:ligne}.
export const PASTILLES = [
  ["prix_min", "Prix le plus bas (par nuit)"], ["compris", "Ce qui est compris (« linge et ménage compris »)"],
  ["arrivee", "Heure d’arrivée"], ["depart", "Heure de départ"], ["capacite", "Nombre de voyageurs"],
  ["surface", "Surface du logement (m²)"], ["jardin", "Surface du jardin (m²)"],
  ["dist_conche", "Minutes à pied jusqu’à la conche"], ["dist_plage", "Minutes à pied jusqu’à la plage"],
  ["depot", "Dépôt de garantie (€)"], ["chien_court", "Chien : prix séjour court (€)"], ["chien_long", "Chien : prix séjour long (€)"],
  ["chien_seuil", "Chien : séjour court jusqu’à (nuits)"], ["annee", "Année des tarifs"], ["nb_photos", "Nombre de photos"]
];

// Remplace les jetons par leur valeur. ctx = { tarifs, maison, logement, calc }.
// Un jeton placé en début de phrase prend une majuscule (« Linge et ménage compris. »).
export function jetons(texte, ctx) {
  if (texte == null) return "";
  const c = ctx && ctx.calc, m = (ctx && ctx.maison) || {};
  if (!c) return String(texte);
  const s = String(texte);
  return s.replace(/\{([a-z_]+)(?::([a-z0-9_-]+))?\}/g, (tout, nom, cle, pos) => {
    const v = valeurJeton(nom, cle, c, m, ctx);
    if (v === null) return tout;
    const debutPhrase = pos === 0 || /[.!?]\s+$/.test(s.slice(Math.max(0, pos - 3), pos));
    return debutPhrase ? v.charAt(0).toUpperCase() + v.slice(1) : v;
  });
}

export function valeurJeton(nom, cle, c, m, ctx = {}) {
  const ligne = cle && c.types && c.types[cle];
  const ch = m.chien || {};
  switch (nom) {
    case "prix_min": return nombre(c.prixMin);
    case "annee": return String(c.annee);
    case "compris": return m.compris || "";
    case "arrivee": return m.arrivee || "";
    case "depart": return m.depart || "";
    case "capacite": return String(m.capacite ?? "");
    case "surface": return String(m.surface ?? "");
    case "jardin": return String(m.jardin ?? "");
    case "dist_conche": return String((m.distances || {}).conche ?? "");
    case "dist_plage": return String((m.distances || {}).plage ?? "");
    case "depot": return nombre(m.depot ?? 0);
    case "chien_court": return nombre(ch.court ?? 0);
    case "chien_long": return nombre(ch.long ?? 0);
    case "chien_seuil": return String(ch.seuil ?? "");
    case "nb_photos": return String(ctx.logement && ctx.logement.galerie ? ctx.logement.galerie.length : 0);
    case "prix": return ligne ? nombre(ligne.prix) : null;
    case "semaine": return ligne ? nombre(ligne.prix * 7) : null;
    case "min": return ligne ? String(ligne.min) : null;
    default: return null;
  }
}
export const nombre = n => Number(n).toLocaleString("fr-FR").replace(/ /g, " ");

// Données pour un <script type="application/json"> : « < » neutralisé pour ne jamais fermer la balise.
export const jsonScript = obj => JSON.stringify(obj).replace(/</g, "\\u003c");

// Remplace, dans un objet, chaque texte qui commence par « / » (mais pas « // ») par base + texte
export function absolues(v, base) {
  const b = String(base || "").replace(/\/+$/, "");
  if (typeof v === "string") return /^\/(?!\/)/.test(v) || v === "/" ? b + v : v;
  if (Array.isArray(v)) return v.map(x => absolues(x, b));
  if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, absolues(x, b)]));
  return v;
}
