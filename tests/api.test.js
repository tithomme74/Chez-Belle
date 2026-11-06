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

test("enregistrement dans le brouillon seulement, puis conflit de version", async () => {
  const t = await json(await appel("GET", "/api/contenus/tarifs"));
  t.donnees.depot = 350;
  t.donnees.champInconnu = "<script>";
  const r = await json(await appel("PUT", "/api/contenus/tarifs", { donnees: t.donnees, version: t.version }));
  assert.equal(r.statut, 200, JSON.stringify(r));
  const brouillon = JSON.parse(fs.readFileSync(path.join(racine, ".local/brouillon/tarifs.json"), "utf8"));
  assert.equal(brouillon.depot, 350);
  assert.equal(brouillon.champInconnu, undefined, "champ hors schéma ignoré");
  const publie = JSON.parse(fs.readFileSync(path.join(racine, "src/_data/tarifs.json"), "utf8"));
  assert.equal(publie.depot, 300, "le site publié n'a pas bougé");
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

// Faux GitHub minimal : branches, fichiers, comparaison, fusion, historique
function fauxGithub() {
  const refs = { main: "m1" }, appels = [];
  let enAvance = 0;
  const rep = (corps, status = 200) => new Response(corps === null ? null : JSON.stringify(corps), { status });
  const f = async (url, o = {}) => {
    const u = new URL(url), chemin = u.pathname.replace("/repos/moi/depot", ""), m = o.method || "GET";
    const corps = o.body ? JSON.parse(o.body) : null;
    appels.push({ m, chemin, query: u.search, corps, auth: o.headers.Authorization });
    let x;
    if (m === "GET" && (x = /^\/git\/ref\/heads\/(.+)$/.exec(chemin))) return refs[x[1]] ? rep({ object: { sha: refs[x[1]] } }) : rep({}, 404);
    if (m === "POST" && chemin === "/git/refs") { refs[corps.ref.replace("refs/heads/", "")] = corps.sha; return rep({}, 201); }
    if (m === "PATCH" && (x = /^\/git\/refs\/heads\/(.+)$/.exec(chemin))) { refs[x[1]] = corps.sha; enAvance = 0; return rep({}); }
    if (m === "GET" && chemin.startsWith("/contents/")) return rep({ sha: "abc", content: Buffer.from('{"depot":300}').toString("base64") });
    if (m === "PUT" && chemin.startsWith("/contents/")) { if (corps.sha && corps.sha !== "abc") return rep({}, 409); enAvance++; return rep({ content: { sha: "def" } }, 201); }
    if (m === "GET" && chemin === "/compare/main...brouillon")
      return rep({ ahead_by: enAvance, behind_by: 0, files: enAvance ? [{ filename: "src/_data/tarifs.json" }, { filename: "src/photos/x-480.webp" }] : [] });
    if (m === "POST" && chemin === "/merges") { refs.main = "m2"; return rep({ sha: "m2" }, 201); }
    if (m === "GET" && chemin === "/commits") return rep([{ sha: "c".repeat(40), commit: { committer: { date: "2027-01-02T10:00:00Z" }, message: "Publication depuis l’admin : Tarifs\n\ndétail" } }]);
    return rep({ message: "inattendu" }, 500);
  };
  return { f, refs, appels };
}
const envGh = { GITHUB_TOKEN: "jeton-factice", GITHUB_DEPOT: "moi/depot", GITHUB_BRANCHE: "brouillon", APERCU_URL: "https://brouillon--exemple.netlify.app" };

test("GitHub : la branche de brouillon est créée depuis main, lecture et écriture s'y font", async () => {
  const gh = fauxGithub(), g = stockageGithub(envGh, gh.f);
  assert.deepEqual(await g.lire("tarifs"), { donnees: { depot: 300 }, version: "abc" });
  assert.equal(gh.refs.brouillon, "m1");
  assert.ok(gh.appels.some(a => a.chemin === "/contents/src/_data/tarifs.json" && a.query === "?ref=brouillon"));
  assert.equal((await g.ecrire("tarifs", { depot: 1 }, "abc")).version, "def");
  const put = gh.appels.find(a => a.m === "PUT");
  assert.equal(put.corps.branch, "brouillon"); assert.equal(put.auth, "Bearer jeton-factice");
  await assert.rejects(g.ecrire("tarifs", { depot: 1 }, "vieux"), ConflitVersion);
  await assert.rejects(g.lire("../package"), /inconnu/);
  await g.lire("avis");
  assert.ok(gh.appels.some(a => a.chemin === "/contents/src/_data/avis.json" && a.query === "?ref=main"), "les avis se lisent sur main");
});

test("GitHub : état, publication (fusion dans main), historique, abandon", async () => {
  const gh = fauxGithub(), g = stockageGithub(envGh, gh.f);
  await g.ecrire("tarifs", { depot: 1 }, "abc");
  assert.deepEqual(await g.etat(), { modifies: ["tarifs"], photos: 1, apercu: envGh.APERCU_URL });
  assert.deepEqual((await g.publier("Publication test")).modifies, ["tarifs"]);
  const fusion = gh.appels.find(a => a.chemin === "/merges");
  assert.deepEqual(fusion.corps, { base: "main", head: "brouillon", commit_message: "Publication test" });
  assert.equal(gh.refs.brouillon, "m2", "le brouillon repart de la version publiée");
  const h = await g.historique("tarifs");
  assert.equal(h[0].message, "Publication depuis l’admin : Tarifs");
  assert.ok(gh.appels.some(a => a.chemin === "/commits" && a.query.includes("sha=main") && a.query.includes("src%2F_data%2Ftarifs.json")));
  await g.lireVersion("tarifs", h[0].id);
  await assert.rejects(g.lireVersion("tarifs", "../../x"), /Version inconnue/);
  await g.ecrire("tarifs", { depot: 2 }, "abc");
  await g.abandonner();
  const patch = gh.appels.filter(a => a.m === "PATCH").at(-1);
  assert.deepEqual(patch.corps, { sha: "m2", force: true });
});

// ---------- Brouillon, publication, historique (stockage local) ----------
test("brouillon : état, publication, historique, reprise d'une version, abandon", async () => {
  const etat = await json(await appel("GET", "/api/brouillon"));
  assert.deepEqual(etat.modifies, ["tarifs"]);
  assert.equal(etat.apercu, "/apercu/");
  const pub = await json(await appel("POST", "/api/publier", {}));
  assert.equal(pub.statut, 200, JSON.stringify(pub));
  assert.equal(JSON.parse(fs.readFileSync(path.join(racine, "src/_data/tarifs.json"), "utf8")).depot, 350, "publié");
  assert.deepEqual((await json(await appel("GET", "/api/brouillon"))).modifies, []);
  const h = await json(await appel("GET", "/api/historique/tarifs"));
  assert.equal(h.versions.length, 2);
  assert.match(h.versions[0].message, /Publication depuis l’admin : Tarifs/);
  assert.equal(h.versions[1].message, "Version d’origine");
  const origine = await json(await appel("GET", `/api/historique/tarifs/${h.versions[1].id}`));
  assert.equal(origine.donnees.depot, 300);
  assert.equal((await appel("GET", "/api/historique/tarifs/inexistant")).status, 404);
  assert.equal((await appel("GET", "/api/historique/avis")).status, 404);
  // Modification puis abandon : le brouillon redevient le site publié
  const t = await json(await appel("GET", "/api/contenus/tarifs"));
  t.donnees.depot = 400;
  await appel("PUT", "/api/contenus/tarifs", { donnees: t.donnees, version: t.version });
  assert.deepEqual((await json(await appel("GET", "/api/brouillon"))).modifies, ["tarifs"]);
  assert.equal((await appel("POST", "/api/abandonner", {})).status, 200);
  assert.deepEqual((await json(await appel("GET", "/api/brouillon"))).modifies, []);
  assert.equal((await json(await appel("GET", "/api/contenus/tarifs"))).donnees.depot, 350);
});

test("publication refusée si le brouillon est invalide (fichier modifié à la main)", async () => {
  const f = path.join(racine, ".local/brouillon/tarifs.json");
  const d = JSON.parse(fs.readFileSync(f, "utf8")); d.types.basse.prix = -1;
  fs.writeFileSync(f, JSON.stringify(d));
  const r = await json(await appel("POST", "/api/publier", {}));
  assert.equal(r.statut, 422); assert.match(r.erreurs[0].message, /Tarifs et calendrier/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(racine, "src/_data/tarifs.json"), "utf8")).types.basse.prix, 80, "rien publié");
  await appel("POST", "/api/abandonner", {});
});

test("publication et brouillon : connexion et origine exigées", async () => {
  assert.equal((await appel("POST", "/api/publier", {}, { avecCookie: false })).status, 401);
  assert.equal((await appel("POST", "/api/publier", {}, { origine: "https://pirate.example" })).status, 403);
  assert.equal((await appel("POST", "/api/abandonner", {}, { origine: null })).status, 403);
  assert.equal((await appel("GET", "/api/brouillon", undefined, { avecCookie: false })).status, 401);
});

// ---------- Photos ----------
const webp = (l, h) => { const b = Buffer.alloc(40); b.write("RIFF", 0); b.writeUInt32LE(32, 4); b.write("WEBP", 8); b.write("VP8X", 12); b.writeUInt32LE(10, 16); b.writeUIntLE(l - 1, 24, 3); b.writeUIntLE(h - 1, 27, 3); return b; };
const jpeg = (l, h) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, l >> 8, l & 255, 3, ...Array(30).fill(0)]);

test("photos : lecture des dimensions WebP et JPEG", async () => {
  const { dimensionsImage, nomFichier } = await import("../api/images.js");
  assert.deepEqual(dimensionsImage(webp(960, 720)), { type: "webp", largeur: 960, hauteur: 720 });
  assert.deepEqual(dimensionsImage(jpeg(480, 360)), { type: "jpg", largeur: 480, hauteur: 360 });
  assert.equal(dimensionsImage(Buffer.from("<html><script>alert(1)</script></html>".padEnd(60))), null);
  assert.equal(nomFichier("La Cuisine d'été ../../x"), "la-cuisine-d-ete-x");
});

test("photos : envoi accepté, fichiers créés, description renvoyée", async () => {
  await appel("POST", "/api/connexion", { motDePasse: MDP }).then(r => { cookie = r.headers.get("set-cookie").split(";")[0]; });
  fs.mkdirSync(path.join(racine, "src/photos"), { recursive: true });
  const r = await json(await appel("POST", "/api/photos", { nom: "Terrasse fleurie", variantes: [
    { largeur: 960, donnees: webp(960, 720).toString("base64") }, { largeur: 480, donnees: webp(480, 360).toString("base64") }] }));
  assert.equal(r.statut, 200, JSON.stringify(r));
  assert.match(r.photo.src, /^\/photos\/terrasse-fleurie-[a-z0-9]+-960\.webp$/);
  assert.equal(r.photo.srcset.length, 2); assert.equal(r.photo.srcset[0][1], 480);
  assert.deepEqual([r.photo.largeur, r.photo.hauteur], [960, 720]);
  for (const [f] of r.photo.srcset) assert.ok(fs.existsSync(path.join(racine, "src", f)), f);
});

test("photos : faux fichiers, tailles et accès refusés", async () => {
  const envoyer = (variantes, o) => appel("POST", "/api/photos", { nom: "x", variantes }, o);
  assert.equal((await envoyer([{ donnees: Buffer.from("<svg onload=alert(1)>".padEnd(80)).toString("base64") }])).status, 415);
  assert.equal((await envoyer([{ donnees: webp(50, 50).toString("base64") }])).status, 422);
  assert.equal((await envoyer([{ donnees: Buffer.concat([webp(960, 720), Buffer.alloc(1.6 * 1024 * 1024)]).toString("base64") }])).status, 413);
  assert.equal((await envoyer([])).status, 400);
  assert.equal((await envoyer([{ donnees: webp(960, 720).toString("base64") }], { avecCookie: false })).status, 401);
  assert.equal((await envoyer([{ donnees: webp(960, 720).toString("base64") }], { origine: "https://pirate.example" })).status, 403);
});
