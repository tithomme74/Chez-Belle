// Mise à jour des avis et notes Airbnb (utilisé par le skill « maj-avis-chez-belle »).
//
//   node scripts/maj-avis.js nouveaux-avis.json   → valide puis remplace src/_data/avis.json
//   node scripts/maj-avis.js --verifier           → vérifie seulement le fichier actuel
//
// Format attendu de nouveaux-avis.json :
//   { "notes": { "globale": "4,82", "nombre": 33, "categories": [ { "nom": "Emplacement", "note": "4,9" } ] },
//     "avis":  [ { "prenom": "Clémence", "date": "août 2025", "extrait": "texte recopié mot pour mot" } ] }
// Rien n'est écrit si une règle n'est pas respectée (le message dit laquelle).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_AVIS, valider } from "../src/_lib/schemas.js";
import { serialiser } from "../api/stockage.js";

const CIBLE = new URL("../src/_data/avis.json", import.meta.url);
const INFO = "Rempli automatiquement par le skill « maj-avis-chez-belle » (scripts/maj-avis.js). Non modifiable dans l’admin.";
const RETOUR_LIGNE = /\r?\n/g;

export function preparerAvis(entree, aujourdhui = new Date().toISOString().slice(0, 10)) {
  const donnees = { _info: INFO, mis_a_jour: aujourdhui, notes: entree && entree.notes, avis: entree && entree.avis };
  // Extrait gardé mot pour mot (espaces compris) : seuls les retours à la ligne deviennent des espaces
  if (donnees.avis && Array.isArray(donnees.avis))
    donnees.avis = donnees.avis.map(a => ({ ...a, extrait: typeof a.extrait === "string" ? a.extrait.replace(RETOUR_LIGNE, " ").trim() : a.extrait }));
  return valider(SCHEMA_AVIS, donnees);
}

function principal(args) {
  if (args[0] === "--verifier") {
    const { erreurs } = valider(SCHEMA_AVIS, JSON.parse(fs.readFileSync(CIBLE, "utf8")));
    if (erreurs.length) { erreurs.forEach(e => console.error(`✗ ${e.chemin} : ${e.message}`)); return 1; }
    console.log("✓ src/_data/avis.json est valide.");
    return 0;
  }
  if (!args[0]) { console.error("Usage : node scripts/maj-avis.js nouveaux-avis.json   (ou --verifier)"); return 2; }
  let entree;
  try { entree = JSON.parse(fs.readFileSync(args[0], "utf8")); }
  catch (e) { console.error("✗ Fichier illisible ou JSON incorrect : " + e.message); return 1; }
  const { valeur, erreurs } = preparerAvis(entree);
  if (erreurs.length) {
    console.error("✗ Avis non mis à jour, à corriger :");
    erreurs.forEach(e => console.error(`  - ${e.chemin} : ${e.message}`));
    return 1;
  }
  const avant = fs.readFileSync(CIBLE, "utf8");
  const apres = serialiser(valeur);
  const sansDate = t => { const j = JSON.parse(t); delete j.mis_a_jour; delete j._info; return JSON.stringify(j); };
  if (sansDate(avant) === sansDate(apres)) { console.log("= Aucun changement : les avis sont déjà à jour."); return 0; }
  fs.writeFileSync(CIBLE, apres, "utf8");
  console.log(`✓ src/_data/avis.json mis à jour : note ${valeur.notes.globale} sur ${valeur.notes.nombre} avis, ${valeur.avis.length} extraits.`);
  console.log("  Étape suivante : commit de ce seul fichier sur main, puis push (Cloudflare publie en 1 à 2 minutes).");
  return 0;
}

// Lancé en ligne de commande (et pas importé par les tests)
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) process.exitCode = principal(process.argv.slice(2));
