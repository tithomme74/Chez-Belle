// API de l'admin : connexion, blocage, protections, validation et enregistrement (sur une copie des contenus)
import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { traiter } from "../api/app.js";
import { stockageLocal, stockageGithub, ConflitVersion } from "../api/stockage.js";
import { empreinte, memoireLocale, creerSession, sessionValide, DUREE_SESSION } from "../api/auth.js";

const MDP = "mot-de-passe-de-test-123";
const env = { ADMIN_MOT_DE_PASSE_HASH: empreinte(MDP), SESSION_SECRET: "s".repeat(48) };
const ORIGINE = "http://localhost:8765";
let racine, deps, cookie;

before(() => {
  racine = fs.mkdtempSync(path.join(os.tmpdir(), "chez-belle-api-"));
  fs.mkdirSync(path.join(racine, "src/_data"), { recursive: true });
  for (const f of fs.readdirSync("src/_data").filter(f => f.endsWith(".json")))
    fs.copyFileSync(path.join("src/_data", f), path.join(racine, "src/_data", f));
  deps = { env, stockage: stockageLocal(racine), memoire: memoireLocale(), ip: "1.2.3.4" };
});

const appel = (methode, route, corps, { origine = ORIGINE, avecCookie = true, type = "application/json", d = deps } = {}) => {
  const headers = {};
  if (origine) headers.origin = origine;
  if (avecCookie && cookie) headers.cookie = cookie;
  if (corps !== undefined) headers["content-type"] = type;
  return traiter(new Request(ORIGINE + route, { method: methode, headers, body: corps === undefined ? undefined : (typeof corps === "string" ? corps : JSON.stringify(corps)) }), d);
};
const json = async r => ({ statut: r.status, ...(await r.json()) });

test("sans configuration : 503", async () => {
  const r = await appel("GET", "/api/session", undefined, { d: { ...deps, env: {} } });
  assert.equal(r.status, 503);
});

test("non connecté : session fausse, contenus refusés", async () => {
  assert.equal((await json(await appel("GET", "/api/session"))).connecte, false);
  assert.equal((await appel("GET", "/api/contenus")).status, 401);
  assert.equal((await appel("GET", "/api/contenus/tarifs")).status, 401);
});

test("mauvais mot de passe puis blocage après 5 essais", async () => {
  const d = { ...deps, memoire: memoireLocale(), ip: "9.9.9.9" };
  for (let i = 0; i < 5; i++) assert.equal((await appel("POST", "/api/connexion", { motDePasse: "faux" }, { d })).status, 401);
  const r = await json(await appel("POST", "/api/connexion", { motDePasse: MDP }, { d }));
  assert.equal(r.statut, 429); assert.match(r.erreur, /Trop d’essais/);
});

test("connexion refusée sans origine ou depuis un autre site", async () => {
  assert.equal((await appel("POST", "/api/connexion", { motDePasse: MDP }, { origine: null })).status, 403);
  assert.equal((await appel("POST", "/api/connexion", { motDePasse: MDP }, { origine: "https://pirate.example" })).status, 403);
});

test("bonne connexion : cookie protégé", async () => {
  const r = await appel("POST", "/api/connexion", { motDePasse: MDP });
  assert.equal(r.status, 200);
  const c = r.headers.get("set-cookie");
  for (const attr of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/api"]) assert.ok(c.includes(attr), attr);
  cookie = c.split(";")[0];
  assert.equal((await json(await appel("GET", "/api/session"))).connecte, true);
});

test("cookie falsifié ou expiré refusé", async () => {
  const vrai = cookie.split("=")[1];
  assert.equal(sessionValide(vrai.slice(0, -2) + "xx", env), false);
  assert.equal(sessionValide(creerSession(env, Date.now() - (DUREE_SESSION + 10) * 1000), env), false);
  assert.equal(sessionValide(vrai, { ...env, ADMIN_MOT_DE_PASSE_HASH: empreinte("autre-mot-de-passe") }), false, "changer le mot de passe déconnecte");
  assert.equal((await appel("GET", "/api/contenus", undefined, { avecCookie: false })).status, 401);
});

test("liste et lecture des contenus", async () => {
  const l = await json(await appel("GET", "/api/contenus"));
  assert.deepEqual(l.contenus.map(c => c.nom).sort(), ["accueil", "autour", "avis", "logement", "reservation", "site", "tarifs"]);
  const t = await json(await appel("GET", "/api/contenus/tarifs"));
  assert.equal(t.donnees.depot, 300); assert.equal(typeof t.version, "string"); assert.equal(t.lectureSeule, false);
});

test("enregistrement valide, puis conflit de version", async () => {
  const t = await json(await appel("GET", "/api/contenus/tarifs"));
  t.donnees.depot = 350;
  t.donnees.champInconnu = "<script>";
  const r = await json(await appel("PUT", "/api/contenus/tarifs", { donnees: t.donnees, version: t.version }));
  assert.equal(r.statut, 200, JSON.stringify(r));
  const disque = JSON.parse(fs.readFileSync(path.join(racine, "src/_data/tarifs.json"), "utf8"));
  assert.equal(disque.depot, 350);
  assert.equal(disque.champInconnu, undefined, "champ hors schéma ignoré");
  const r2 = await appel("PUT", "/api/contenus/tarifs", { donnees: t.donnees, version: t.version });
  assert.equal(r2.status, 409);
});

test("contenu invalide : erreurs détaillées, rien n'est écrit", async () => {
  const t = await json(await appel("GET", "/api/contenus/tarifs"));
  const avant = fs.readFileSync(path.join(racine, "src/_data/tarifs.json"), "utf8");
  t.donnees.types.basse.prix = -5;
  t.donnees.calendrier[0].du = "2027-02-30";
  const r = await json(await appel("PUT", "/api/contenus/tarifs", { donnees: t.donnees, version: t.version }));
  assert.equal(r.statut, 422);
  assert.ok(r.erreurs.some(e => e.chemin === "types.basse.prix"));
  assert.ok(r.erreurs.some(e => e.chemin === "calendrier[0].du"));
  assert.equal(fs.readFileSync(path.join(racine, "src/_data/tarifs.json"), "utf8"), avant);
});

test("incohérence entre contenus : période utilisée par l'accueil", async () => {
  const t = await json(await appel("GET", "/api/contenus/tarifs"));
  delete t.donnees.types.juillet;
  t.donnees.calendrier = t.donnees.calendrier.filter(p => p.type !== "juillet");
  t.donnees.grille = t.donnees.grille.filter(g => g.type !== "juillet");
  const r = await json(await appel("PUT", "/api/contenus/tarifs", { donnees: t.donnees, version: t.version }));
  assert.equal(r.statut, 422); assert.match(JSON.stringify(r.erreurs), /accueil/);
});

test("chevauchement de dates dans le calendrier refusé", async () => {
  const t = await json(await appel("GET", "/api/contenus/tarifs"));
  t.donnees.calendrier[1].du = "2027-05-01";
  const r = await json(await appel("PUT", "/api/contenus/tarifs", { donnees: t.donnees, version: t.version }));
  assert.equal(r.statut, 422); assert.match(JSON.stringify(r.erreurs), /chevauche/);
});

test("lien dangereux refusé", async () => {
  const s = await json(await appel("GET", "/api/contenus/site"));
  s.donnees.airbnb = "javascript:alert(1)";
  assert.equal((await appel("PUT", "/api/contenus/site", { donnees: s.donnees, version: s.version })).status, 422);
});

test("avis : lecture seule", async () => {
  const a = await json(await appel("GET", "/api/contenus/avis"));
  assert.equal(a.lectureSeule, true);
  assert.equal((await appel("PUT", "/api/contenus/avis", { donnees: a.donnees, version: a.version })).status, 403);
});

test("noms de contenu inconnus ou détournés", async () => {
  for (const r of ["/api/contenus/inconnu", "/api/contenus/..%2F..%2Fpackage", "/api/contenus/Site"]) assert.equal((await appel("GET", r)).status, 404, r);
});

test("format et taille de requête contrôlés", async () => {
  assert.equal((await appel("PUT", "/api/contenus/site", "x=1", { type: "application/x-www-form-urlencoded" })).status, 415);
  assert.equal((await appel("PUT", "/api/contenus/site", "{pas du json", {})).status, 400);
  assert.equal((await appel("PUT", "/api/contenus/site", JSON.stringify({ donnees: "x".repeat(400000), version: "a" }))).status, 413);
});

test("déconnexion : cookie effacé", async () => {
  const r = await appel("POST", "/api/deconnexion", {});
  assert.match(r.headers.get("set-cookie"), /Max-Age=0/);
});

test("stockage GitHub : lecture, écriture sur la branche, conflit", async () => {
  const appels = [];
  const faux = async (url, o = {}) => {
    appels.push({ url, o });
    if (!o.method) return new Response(JSON.stringify({ sha: "abc", content: Buffer.from('{"depot":300}').toString("base64") }));
    const b = JSON.parse(o.body);
    if (b.sha !== "abc") return new Response("{}", { status: 409 });
    return new Response(JSON.stringify({ content: { sha: "def" } }));
  };
  const g = stockageGithub({ GITHUB_TOKEN: "jeton-factice", GITHUB_DEPOT: "moi/depot", GITHUB_BRANCHE: "brouillon" }, faux);
  const l = await g.lire("tarifs");
  assert.deepEqual(l, { donnees: { depot: 300 }, version: "abc" });
  assert.match(appels[0].url, /contents\/src\/_data\/tarifs\.json\?ref=brouillon$/);
  assert.equal((await g.ecrire("tarifs", { depot: 1 }, "abc")).version, "def");
  const corps = JSON.parse(appels[1].o.body);
  assert.equal(corps.branch, "brouillon"); assert.equal(appels[1].o.headers.Authorization, "Bearer jeton-factice");
  await assert.rejects(g.ecrire("tarifs", { depot: 1 }, "vieux"), ConflitVersion);
  await assert.rejects(g.lire("../package"), /inconnu/);
});
