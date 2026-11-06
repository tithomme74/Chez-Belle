// Fonction Cloudflare Pages (functions/api/[[route]].js) : branchements KV, IP, configuration,
// et absence de modules propres à Node dans tout ce qu'elle charge.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { onRequest } from "../functions/api/[[route]].js";
import { empreinte } from "../api/auth.js";
import { configurationValide } from "../api/app.js";

const MDP = "phrase de test cloudflare";
const ORIGINE = "https://chez-belle.pages.dev";

function fauxKV() {
  const m = new Map(), ecritures = [];
  return {
    m, ecritures,
    async get(k, type) { const v = m.get(k); return v === undefined ? null : type === "json" ? JSON.parse(v) : v; },
    async put(k, v, o) { ecritures.push({ k, o }); m.set(k, v); }
  };
}
const requete = (methode, chemin, corps, ip = "5.6.7.8") => new Request(ORIGINE + chemin, {
  method: methode,
  headers: { Origin: ORIGINE, "Content-Type": "application/json", "CF-Connecting-IP": ip },
  body: corps ? JSON.stringify(corps) : undefined
});

test("sans liaison KV : admin indisponible (503)", async () => {
  const r = await onRequest({ request: requete("GET", "/api/session"), env: {} });
  assert.equal(r.status, 503);
});

test("ancienne empreinte scrypt refusée : configuration à refaire", async () => {
  assert.equal(configurationValide({ ADMIN_MOT_DE_PASSE_HASH: "scrypt$abc$def", SESSION_SECRET: "s".repeat(48) }), false);
  assert.equal(configurationValide({ ADMIN_MOT_DE_PASSE_HASH: await empreinte("x".repeat(12)), SESSION_SECRET: "s".repeat(48) }), true);
  assert.equal(configurationValide({ ADMIN_MOT_DE_PASSE_HASH: await empreinte("x".repeat(12), 200000), SESSION_SECRET: "s".repeat(48) }), false, "plus de 100 000 tours : refusé par Cloudflare");
});

test("connexion : échecs comptés dans KV par IP, avec expiration ; bonne connexion ouvre la session", async () => {
  const kv = fauxKV();
  const env = { MEMOIRE: kv, ADMIN_MOT_DE_PASSE_HASH: await empreinte(MDP), SESSION_SECRET: "s".repeat(48), GITHUB_DEPOT: "x/y", GITHUB_BRANCHE: "brouillon" };
  const mauvais = await onRequest({ request: requete("POST", "/api/connexion", { motDePasse: "faux mot de passe" }), env });
  assert.equal(mauvais.status, 401);
  assert.ok(kv.m.has("ip:5.6.7.8") && kv.m.has("global"));
  assert.ok(kv.ecritures.every(e => e.o && e.o.expirationTtl >= 60), "expiration KV (60 s minimum)");
  const bon = await onRequest({ request: requete("POST", "/api/connexion", { motDePasse: MDP }), env });
  assert.equal(bon.status, 200);
  const cookie = bon.headers.get("set-cookie").split(";")[0];
  const s = await onRequest({ request: new Request(ORIGINE + "/api/session", { headers: { cookie } }), env });
  assert.equal((await s.json()).connecte, true);
  // 5 échecs depuis une autre adresse : bloquée, la première reste libre
  for (let i = 0; i < 5; i++) await onRequest({ request: requete("POST", "/api/connexion", { motDePasse: "non" }, "9.9.9.9"), env });
  assert.equal((await onRequest({ request: requete("POST", "/api/connexion", { motDePasse: MDP }, "9.9.9.9"), env })).status, 429);
  assert.equal((await onRequest({ request: requete("POST", "/api/connexion", { motDePasse: MDP }), env })).status, 200);
});

test("la fonction en ligne ne charge aucun module propre à Node", () => {
  const vus = new Set();
  const parcourir = f => {
    if (vus.has(f)) return;
    vus.add(f);
    const texte = fs.readFileSync(f, "utf8");
    for (const [, cible] of texte.matchAll(/^\s*(?:import|export)\s[^;]*?from\s+"([^"]+)"/gm)) {
      assert.ok(!cible.startsWith("node:") && cible.startsWith("."), `${path.relative(".", f)} importe ${cible}`);
      parcourir(path.resolve(path.dirname(f), cible));
    }
    assert.ok(!/\bBuffer\b|\bprocess\.env\b/.test(texte.replace(/\/\/.*$/gm, "")), `${path.relative(".", f)} utilise Buffer ou process.env`);
  };
  parcourir(path.resolve("functions/api/[[route]].js"));
  assert.ok(vus.size >= 6);
});
