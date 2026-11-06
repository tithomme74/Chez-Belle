// Prépare le mot de passe superviseur.
//   npm run mot-de-passe -- "mon mot de passe"  → affiche l'empreinte à coller dans Netlify (ADMIN_MOT_DE_PASSE_HASH)
//   npm run mot-de-passe -- --local             → crée .env pour le développement, avec un mot de passe de test aléatoire
//                                                  (noté en commentaire dans .env, fichier jamais envoyé sur GitHub)
import fs from "node:fs";
import crypto from "node:crypto";
import { empreinte } from "../api/auth.js";

const arg = process.argv[2];
if (arg === "--local") {
  if (fs.existsSync(".env")) { console.log(".env existe déjà : supprimez-le d'abord pour en créer un nouveau."); process.exit(1); }
  const mdp = crypto.randomBytes(9).toString("base64url");
  fs.writeFileSync(".env", [
    "# Configuration locale de l'admin (ne jamais publier ce fichier)",
    `# Mot de passe de test local : ${mdp}`,
    `ADMIN_MOT_DE_PASSE_HASH=${empreinte(mdp)}`,
    `SESSION_SECRET=${crypto.randomBytes(48).toString("base64url")}`,
    ""
  ].join("\n"));
  console.log(".env créé. Le mot de passe de test est écrit en commentaire dans .env.");
} else if (arg) {
  if (arg.length < 12) { console.log("Choisissez au moins 12 caractères."); process.exit(1); }
  console.log("ADMIN_MOT_DE_PASSE_HASH=" + empreinte(arg));
  console.log("SESSION_SECRET=" + crypto.randomBytes(48).toString("base64url"));
} else {
  console.log('Usage : npm run mot-de-passe -- "mot de passe"   ou   npm run mot-de-passe -- --local');
}
