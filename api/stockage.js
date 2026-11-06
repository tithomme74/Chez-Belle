// Où sont lus et écrits les contenus, avec brouillon, publication et historique.
//
//   stockageLocal  (développement) : publié = src/_data/ ; brouillon = .local/brouillon/ (copie complète) ;
//                                    historique = .local/historique/<nom>/<id>.json, une entrée par publication.
//   stockageGithub (en ligne)      : publié = branche main ; brouillon = branche « brouillon » (aperçu Cloudflare) ;
//                                    historique = commits de main qui ont modifié le fichier.
//
// Interface commune :
//   lire(nom) → { donnees, version }                  contenu du brouillon (les avis : toujours la version publiée)
//   ecrire(nom, donnees, version, message) → { version }
//   ajouterPhoto(fichier, octets, message)
//   etat() → { modifies: [noms], photos: n, apercu: url }
//   publier(message) → { modifies }                   le brouillon devient le site publié
//   abandonner()                                      le brouillon redevient identique au site publié
//   historique(nom) → [{ id, date, message }]         versions publiées, la plus récente d'abord
//   lireVersion(nom, id) → donnees
// `version` empêche d'écraser une modification faite entre-temps (sinon ConflitVersion).
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { FICHIERS, LECTURE_SEULE } from "../src/_lib/schemas.js";
import { ConflitVersion, cheminDepot, cheminPhoto, verifierNom, verifierId, serialiser, pareil } from "./stockage-commun.js";
export { ConflitVersion, ConflitPublication, serialiser } from "./stockage-commun.js";
export { stockageGithub } from "./stockage-github.js";

// =====================================================================================
export function stockageLocal(racineProjet) {
  const pub = nom => path.join(racineProjet, cheminDepot(nom));
  const br = nom => path.join(racineProjet, ".local/brouillon", verifierNom(nom) + ".json");
  const hist = nom => path.join(racineProjet, ".local/historique", verifierNom(nom));
  const sha = t => crypto.createHash("sha1").update(t).digest("hex");
  const lireTexte = f => fs.readFile(f, "utf8");
  // Écriture atomique ; sous Windows, un fichier lu au même moment (Eleventy, antivirus) peut être brièvement verrouillé
  const ecrireTexte = async (f, t) => {
    await fs.mkdir(path.dirname(f), { recursive: true });
    const tmp = `${f}.${crypto.randomBytes(3).toString("hex")}.tmp`;
    await fs.writeFile(tmp, t, "utf8");
    for (let essai = 0; ; essai++) {
      try { await fs.rename(tmp, f); return; }
      catch (e) {
        if (!["EPERM", "EBUSY", "EACCES"].includes(e.code) || essai >= 8) { await fs.rm(tmp, { force: true }); throw e; }
        await new Promise(r => setTimeout(r, 50 * (essai + 1)));
      }
    }
  };
  // Les opérations sur le brouillon passent une par une (deux onglets ou deux requêtes simultanées)
  let file = Promise.resolve();
  const unParUn = fn => (...args) => { const p = file.then(() => fn(...args)); file = p.catch(() => {}); return p; };

  // Le brouillon est une copie complète des contenus (l'aperçu local est construit à partir de ce dossier).
  // Les avis (automatiques) y sont recopiés depuis le site publié quand ils ont changé.
  async function preparer() {
    for (const nom of FICHIERS) {
      if (!existsSync(br(nom))) await ecrireTexte(br(nom), await lireTexte(pub(nom)));
      else if (LECTURE_SEULE.includes(nom)) { const t = await lireTexte(pub(nom)); if (t !== await lireTexte(br(nom))) await ecrireTexte(br(nom), t); }
    }
  }
  async function noter(nom, texte, message) {
    const id = String(Date.now()) + "-" + crypto.randomBytes(2).toString("hex");
    await ecrireTexte(path.join(hist(nom), id + ".json"), JSON.stringify({ date: new Date().toISOString(), message, donnees: JSON.parse(texte) }));
  }

  const ops = {
    preparer,
    async lire(nom) {
      await preparer();
      const t = await lireTexte(LECTURE_SEULE.includes(nom) ? pub(nom) : br(nom));
      return { donnees: JSON.parse(t), version: sha(t) };
    },
    async ecrire(nom, donnees, version) {
      await preparer();
      if (version !== sha(await lireTexte(br(nom)))) throw new ConflitVersion();
      const t = serialiser(donnees);
      await ecrireTexte(br(nom), t);
      return { version: sha(t) };
    },
    async ajouterPhoto(nom, octets) {
      await fs.writeFile(path.join(racineProjet, cheminPhoto(nom)), octets, { flag: "wx" });
    },
    async etat() {
      await preparer();
      const modifies = [];
      for (const nom of FICHIERS) if (!pareil(await lireTexte(br(nom)), await lireTexte(pub(nom)))) modifies.push(nom);
      return { modifies, photos: 0, apercu: "/apercu/" };
    },
    async publier(message) {
      const { modifies } = await ops.etat();
      for (const nom of modifies) {
        // Première publication : on garde aussi la version d'origine dans l'historique
        if (!existsSync(hist(nom))) await noter(nom, await lireTexte(pub(nom)), "Version d’origine");
        const t = await lireTexte(br(nom));
        await noter(nom, t, message);
        await ecrireTexte(pub(nom), t);
      }
      return { modifies };
    },
    async abandonner() {
      for (const nom of FICHIERS) await ecrireTexte(br(nom), await lireTexte(pub(nom)));
    },
    async historique(nom) {
      if (!existsSync(hist(nom))) return [];
      const ids = (await fs.readdir(hist(nom))).filter(f => f.endsWith(".json")).map(f => f.slice(0, -5)).sort().reverse();
      const versions = [];
      for (const id of ids.slice(0, 30)) { const v = JSON.parse(await lireTexte(path.join(hist(nom), id + ".json"))); versions.push({ id, date: v.date, message: v.message }); }
      return versions;
    },
    async lireVersion(nom, id) {
      const f = path.join(hist(nom), verifierId(id) + ".json");
      if (!existsSync(f)) throw Object.assign(new Error("Version introuvable."), { statut: 404 });
      return JSON.parse(await lireTexte(f)).donnees;
    }
  };
  return Object.fromEntries(Object.entries(ops).map(([k, f]) => [k, unParUn(f)]));
}

