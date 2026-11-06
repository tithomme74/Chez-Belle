// Où sont lus et écrits les contenus src/_data/<nom>.json.
//   - stockageLocal : directement sur le disque (développement ; Eleventy reconstruit aussitôt).
//   - stockageGithub : par l'API GitHub, sur la branche de brouillon (en ligne).
// Interface commune : lire(nom) → { donnees, version } ; ecrire(nom, donnees, version, message) → { version }.
// `version` empêche d'écraser une modification faite entre-temps (sinon erreur ConflitVersion).
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { FICHIERS } from "../src/_lib/schemas.js";

export class ConflitVersion extends Error { constructor() { super("Le contenu a été modifié entre-temps."); this.code = "conflit"; } }

const cheminDepot = nom => {
  if (!FICHIERS.includes(nom)) throw new Error("Fichier de contenu inconnu : " + nom);
  return `src/_data/${nom}.json`;
};
export const serialiser = d => JSON.stringify(d, null, 2) + "\n";
// Photos : seulement dans src/photos/, nom simple, jamais d'écrasement d'un fichier existant
const cheminPhoto = nom => {
  if (!/^[a-z0-9-]{1,60}\.(webp|jpg)$/.test(nom)) throw new Error("Nom de photo non valide : " + nom);
  return `src/photos/${nom}`;
};

export function stockageLocal(racineProjet) {
  const sha = t => crypto.createHash("sha1").update(t).digest("hex");
  const fichier = nom => path.join(racineProjet, cheminDepot(nom));
  return {
    async lire(nom) {
      const t = await fs.readFile(fichier(nom), "utf8");
      return { donnees: JSON.parse(t), version: sha(t) };
    },
    async ecrire(nom, donnees, version) {
      const f = fichier(nom);
      const actuel = await fs.readFile(f, "utf8");
      if (version !== sha(actuel)) throw new ConflitVersion();
      const t = serialiser(donnees), tmp = f + ".tmp";
      await fs.writeFile(tmp, t, "utf8");
      await fs.rename(tmp, f);
      return { version: sha(t) };
    },
    async ajouterPhoto(nom, octets) {
      await fs.writeFile(path.join(racineProjet, cheminPhoto(nom)), octets, { flag: "wx" });
    }
  };
}

// env : GITHUB_TOKEN (jeton limité à ce dépôt, droits « Contents »), GITHUB_DEPOT (« propriétaire/dépôt »), GITHUB_BRANCHE
export function stockageGithub(env, f = fetch) {
  const base = `https://api.github.com/repos/${env.GITHUB_DEPOT}/contents/`;
  const entetes = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "chez-belle-admin" };
  return {
    async lire(nom) {
      const r = await f(`${base}${cheminDepot(nom)}?ref=${encodeURIComponent(env.GITHUB_BRANCHE)}`, { headers: entetes });
      if (!r.ok) throw new Error(`GitHub : lecture impossible (${r.status})`);
      const j = await r.json();
      return { donnees: JSON.parse(Buffer.from(j.content, "base64").toString("utf8")), version: j.sha };
    },
    async ecrire(nom, donnees, version, message) {
      const r = await f(base + cheminDepot(nom), {
        method: "PUT", headers: { ...entetes, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: message || `Admin : mise à jour de ${nom}`,
          content: Buffer.from(serialiser(donnees), "utf8").toString("base64"),
          sha: version, branch: env.GITHUB_BRANCHE,
          committer: { name: "Admin Chez Belle", email: "admin@chez-belle.invalid" }
        })
      });
      if (r.status === 409) throw new ConflitVersion();
      if (!r.ok) throw new Error(`GitHub : écriture impossible (${r.status})`);
      const j = await r.json();
      return { version: j.content.sha };
    },
    async ajouterPhoto(nom, octets, message) {
      const r = await f(base + cheminPhoto(nom), {
        method: "PUT", headers: { ...entetes, "Content-Type": "application/json" },
        body: JSON.stringify({ message: message || `Admin : photo ${nom}`, content: Buffer.from(octets).toString("base64"), branch: env.GITHUB_BRANCHE,
          committer: { name: "Admin Chez Belle", email: "admin@chez-belle.invalid" } })
      });
      if (!r.ok) throw new Error(`GitHub : envoi de la photo impossible (${r.status})`);
    }
  };
}
