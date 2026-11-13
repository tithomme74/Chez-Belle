// Demande de dates envoyée à Belle (POST /api/demande)
import { test } from "node:test";
import assert from "node:assert/strict";
import { traiter } from "../api/app.js";

const ORIGINE = "https://chez-belle.pages.dev";
const ENV = { RESEND_API_KEY: "re_test", DEMANDE_EMAIL: "belle@exemple.fr" };
const TEXTE = "Bonjour Belle,\n\nJe souhaiterais séjourner Chez Belle du samedi 5 juin au samedi 12 juin.";

function memoire() { const m = new Map(); return { lire: async k => m.get(k) ?? null, ecrire: async (k, v) => { m.set(k, v); } }; }
const requete = (corps, origine = ORIGINE) => new Request(ORIGINE + "/api/demande", {
  method: "POST", headers: { Origin: origine, "Content-Type": "application/json" }, body: JSON.stringify(corps)
});
function faux() {
  const envois = [];
  return { envois, envoyer: async (url, o) => { envois.push({ url, ...o, corps: JSON.parse(o.body) }); return new Response("{}", { status: 200 }); } };
}
const appeler = async (corps, { env = ENV, mem = memoire(), f = faux(), origine } = {}) => {
  const r = await traiter(requete(corps, origine), { env, memoire: mem, ip: "1.2.3.4", stockage: null, envoyer: f.envoyer });
  return { statut: r.status, corps: await r.json(), envois: f.envois };
};

test("sans configuration : 503 avec repli (la page propose copier / messagerie)", async () => {
  const r = await appeler({ contact: "a@b.fr", texte: TEXTE }, { env: {} });
  assert.equal(r.statut, 503);
  assert.equal(r.corps.repli, true);
});

test("GET : la page sait si l'envoi direct est en place", async () => {
  const dispo = async env => (await (await traiter(new Request(ORIGINE + "/api/demande"), { env, memoire: memoire(), ip: "x" })).json()).disponible;
  assert.equal(await dispo({}), false);
  assert.equal(await dispo(ENV), true);
});

test("envoi : e-mail à Belle, réponse directe au voyageur", async () => {
  const r = await appeler({ nom: "Claire Martin", contact: "claire@exemple.fr", texte: TEXTE });
  assert.equal(r.statut, 200);
  assert.equal(r.envois.length, 1);
  const e = r.envois[0];
  assert.equal(e.url, "https://api.resend.com/emails");
  assert.equal(e.headers.Authorization, "Bearer re_test");
  assert.deepEqual(e.corps.to, ["belle@exemple.fr"]);
  assert.equal(e.corps.reply_to, "claire@exemple.fr");
  assert.match(e.corps.subject, /Claire Martin/);
  assert.match(e.corps.text, /5 juin/);
});

test("téléphone seulement : pas de reply_to, coordonnées recopiées", async () => {
  const r = await appeler({ contact: "06 12 34 56 78", texte: TEXTE });
  assert.equal(r.statut, 200);
  assert.equal(r.envois[0].corps.reply_to, undefined);
  assert.match(r.envois[0].corps.text, /06 12 34 56 78/);
});

test("contact manquant ou texte vide : refusé", async () => {
  assert.equal((await appeler({ contact: "", texte: TEXTE })).statut, 400);
  assert.equal((await appeler({ contact: "a@b.fr", texte: "court" })).statut, 400);
});

test("champ piège rempli (robot) : rien n'est envoyé", async () => {
  const r = await appeler({ contact: "a@b.fr", texte: TEXTE, site_web: "http://spam" });
  assert.equal(r.statut, 200);
  assert.equal(r.envois.length, 0);
});

test("autre site : refusé ; plus de 5 demandes par heure : refusé", async () => {
  assert.equal((await appeler({ contact: "a@b.fr", texte: TEXTE }, { origine: "https://pirate.example" })).statut, 403);
  const mem = memoire();
  for (let i = 0; i < 5; i++) assert.equal((await appeler({ contact: "a@b.fr", texte: TEXTE }, { mem })).statut, 200);
  assert.equal((await appeler({ contact: "a@b.fr", texte: TEXTE }, { mem })).statut, 429);
});

test("service d'envoi en panne : 502 avec repli", async () => {
  const r = await traiter(requete({ contact: "a@b.fr", texte: TEXTE }), { env: ENV, memoire: memoire(), ip: "x", envoyer: async () => new Response("", { status: 500 }) });
  assert.equal(r.status, 502);
  assert.equal((await r.json()).repli, true);
});
