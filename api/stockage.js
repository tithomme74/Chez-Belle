// Où sont lus et écrits les contenus, avec brouillon, publication et historique.
//
//   stockageLocal  (développement) : publié = src/_data/ ; brouillon = .local/brouillon/ (copie complète) ;
//                                    historique = .local/historique/<nom>/<id>.json, une entrée par publication.
//   stockageGithub (en ligne)      : publié = branche main ; brouillon = branche « brouillon » (aperçu Netlify) ;
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

export class ConflitVersion extends Error { constructor() { super("Le contenu a été modifié entre-temps."); this.code = "conflit"; } }
export class ConflitPublication extends Error { constructor() { super("Le site publié a changé d’une façon incompatible avec le brouillon."); this.code = "conflit-publication"; } }

const verifierNom = nom => { if (!FICHIERS.includes(nom)) throw new Error("Fichier de contenu inconnu : " + nom); return nom; };
const cheminDepot = nom => `src/_data/${verifierNom(nom)}.json`;
const verifierId = id => { if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(id))) throw new Error("Version inconnue."); return id; };
export const serialiser = d => JSON.stringify(d, null, 2) + "\n";
// Photos : seulement dans src/photos/, nom simple, jamais d'écrasement d'un fichier existant
const cheminPhoto = nom => {
  if (!/^[a-z0-9-]{1,60}\.(webp|jpg)$/.test(nom)) throw new Error("Nom de photo non valide : " + nom);
  return `src/photos/${nom}`;
};
const pareil = (a, b) => JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b));

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

// =====================================================================================
// env : GITHUB_TOKEN (jeton limité à ce dépôt, droit « Contents : lecture et écriture »), GITHUB_DEPOT (« propriétaire/dépôt »),
//       GITHUB_BRANCHE (brouillon), GITHUB_BRANCHE_PUBLIEE (main par défaut), APERCU_URL (adresse Netlify de la branche de brouillon)
export function stockageGithub(env, f = fetch) {
  const depot = `https://api.github.com/repos/${env.GITHUB_DEPOT}`;
  const BR = env.GITHUB_BRANCHE, MAIN = env.GITHUB_BRANCHE_PUBLIEE || "main";
  const entetes = { Authorization: `Bearer ${env.GITHUB_TOKEN}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "chez-belle-admin" };
  const auteur = { name: "Admin Chez Belle", email: "admin@chez-belle.invalid" };

  async function gh(chemin, options = {}, attendus = []) {
    const r = await f(depot + chemin, { ...options, headers: { ...entetes, ...(options.body ? { "Content-Type": "application/json" } : {}) } });
    if (!r.ok && !attendus.includes(r.status)) throw new Error(`GitHub : ${options.method || "GET"} ${chemin.split("?")[0]} impossible (${r.status})`);
    return { statut: r.status, json: r.status === 204 ? null : await r.json().catch(() => null) };
  }
  const sha = async branche => {
    const r = await gh(`/git/ref/heads/${encodeURIComponent(branche)}`, {}, [404]);
    return r.statut === 404 ? null : r.json.object.sha;
  };
  const deplacer = (branche, versSha, force) => gh(`/git/refs/heads/${encodeURIComponent(branche)}`, { method: "PATCH", body: JSON.stringify({ sha: versSha, force }) });
  let pret = false;
  async function preparer() {
    if (pret) return;
    if (!(await sha(BR))) await gh("/git/refs", { method: "POST", body: JSON.stringify({ ref: `refs/heads/${BR}`, sha: await sha(MAIN) }) });
    pret = true;
  }
  const lireA = async (nom, ref) => {
    const r = await gh(`/contents/${cheminDepot(nom)}?ref=${encodeURIComponent(ref)}`);
    return { donnees: JSON.parse(Buffer.from(r.json.content, "base64").toString("utf8")), version: r.json.sha };
  };

  return {
    preparer,
    async lire(nom) {
      await preparer();
      return lireA(nom, LECTURE_SEULE.includes(nom) ? MAIN : BR);
    },
    async ecrire(nom, donnees, version, message) {
      await preparer();
      const r = await gh("/contents/" + cheminDepot(nom), { method: "PUT", body: JSON.stringify({
        message: message || `Admin : mise à jour de ${nom}`, content: Buffer.from(serialiser(donnees), "utf8").toString("base64"),
        sha: version, branch: BR, committer: auteur }) }, [409]);
      if (r.statut === 409) throw new ConflitVersion();
      return { version: r.json.content.sha };
    },
    async ajouterPhoto(nom, octets, message) {
      await preparer();
      await gh("/contents/" + cheminPhoto(nom), { method: "PUT", body: JSON.stringify({
        message: message || `Admin : photo ${nom}`, content: Buffer.from(octets).toString("base64"), branch: BR, committer: auteur }) });
    },
    async etat() {
      await preparer();
      const c = (await gh(`/compare/${encodeURIComponent(MAIN)}...${encodeURIComponent(BR)}`)).json;
      // Rien en attente mais le site publié a avancé (avis mis à jour…) : le brouillon le rattrape
      if (c.ahead_by === 0 && c.behind_by > 0) await deplacer(BR, await sha(MAIN), false);
      const fichiers = (c.ahead_by > 0 ? c.files || [] : []).map(x => x.filename);
      const modifies = FICHIERS.filter(n => fichiers.includes(cheminDepot(n)));
      return { modifies, photos: fichiers.filter(x => x.startsWith("src/photos/")).length, apercu: env.APERCU_URL || null };
    },
    async publier(message) {
      await preparer();
      const { modifies, photos } = await this.etat();
      if (!modifies.length && !photos) return { modifies };
      const r = await gh("/merges", { method: "POST", body: JSON.stringify({ base: MAIN, head: BR, commit_message: message }) }, [409]);
      if (r.statut === 409) throw new ConflitPublication();
      // Le brouillon repart de la version publiée
      await deplacer(BR, await sha(MAIN), false);
      return { modifies };
    },
    async abandonner() {
      await preparer();
      await deplacer(BR, await sha(MAIN), true);
    },
    async historique(nom) {
      const r = await gh(`/commits?sha=${encodeURIComponent(MAIN)}&path=${encodeURIComponent(cheminDepot(nom))}&per_page=30`);
      return r.json.map(c => ({ id: c.sha, date: c.commit.committer.date, message: c.commit.message.split("\n")[0] }));
    },
    async lireVersion(nom, id) {
      return (await lireA(nom, verifierId(id))).donnees;
    }
  };
}
