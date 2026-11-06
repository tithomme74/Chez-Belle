// Stockage en ligne : contenus lus et écrits sur GitHub (voir l'interface dans stockage.js).
// Uniquement des fonctions standard du web : tourne dans Cloudflare Pages Functions.
import { FICHIERS, LECTURE_SEULE } from "../src/_lib/schemas.js";
import { ConflitVersion, ConflitPublication, cheminDepot, cheminPhoto, verifierId, serialiser } from "./stockage-commun.js";
import { base64, depuisBase64, versOctets, versTexte } from "./octets.js";

// env : GITHUB_TOKEN (jeton limité à ce dépôt, droit « Contents : lecture et écriture »), GITHUB_DEPOT (« propriétaire/dépôt »),
//       GITHUB_BRANCHE (brouillon), GITHUB_BRANCHE_PUBLIEE (main par défaut), APERCU_URL (adresse Cloudflare de la branche de brouillon)
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
    return { donnees: JSON.parse(versTexte(depuisBase64(r.json.content))), version: r.json.sha };
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
        message: message || `Admin : mise à jour de ${nom}`, content: base64(versOctets(serialiser(donnees))),
        sha: version, branch: BR, committer: auteur }) }, [409]);
      if (r.statut === 409) throw new ConflitVersion();
      return { version: r.json.content.sha };
    },
    async ajouterPhoto(nom, octets, message) {
      await preparer();
      await gh("/contents/" + cheminPhoto(nom), { method: "PUT", body: JSON.stringify({
        message: message || `Admin : photo ${nom}`, content: base64(octets), branch: BR, committer: auteur }) });
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
