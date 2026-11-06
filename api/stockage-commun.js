// Règles communes aux deux stockages (local et GitHub) : noms de fichiers autorisés, erreurs, mise en forme.
import { FICHIERS } from "../src/_lib/schemas.js";

export class ConflitVersion extends Error { constructor() { super("Le contenu a été modifié entre-temps."); this.code = "conflit"; } }
export class ConflitPublication extends Error { constructor() { super("Le site publié a changé d’une façon incompatible avec le brouillon."); this.code = "conflit-publication"; } }

export const verifierNom = nom => { if (!FICHIERS.includes(nom)) throw new Error("Fichier de contenu inconnu : " + nom); return nom; };
export const cheminDepot = nom => `src/_data/${verifierNom(nom)}.json`;
export const verifierId = id => { if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(id))) throw new Error("Version inconnue."); return id; };
export const serialiser = d => JSON.stringify(d, null, 2) + "\n";
// Photos : seulement dans src/photos/, nom simple, jamais d'écrasement d'un fichier existant
export const cheminPhoto = nom => {
  if (!/^[a-z0-9-]{1,60}\.(webp|jpg)$/.test(nom)) throw new Error("Nom de photo non valide : " + nom);
  return `src/photos/${nom}`;
};
export const pareil = (a, b) => JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));
