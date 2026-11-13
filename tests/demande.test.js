// Demande de dates envoyée à Belle par Brevo (POST /api/demande), avec accusé de réception au voyageur
import { test } from "node:test";
import assert from "node:assert/strict";
import { traiter } from "../api/app.js";

const ORIGINE = "https://chez-belle.pages.dev";
const ENV = { BREVO_CLE_API: "xkeysib-test", DEMANDE_EMAIL: "belle@exemple.fr" };
const TEXTE = "Bonjour Belle,\n\nJe souhaiterais séjourner Chez Belle du samedi 5 juin au samedi 12 juin.";

function memoire() { const m = new Map(); return { lire: async k => m.get(k) ?? null, ecrire: async (k, v) => { m.set(k, v); } }; }
const requete = (corps, origine = ORIGINE) => new Request(ORIGINE + "/api/demande", {
  method: "POST", headers: { Origin: origine, "Content-Type": "application/json" }, body: JSON.stringify(corps)
});
function faux(statuts = []) {
  const envois = [];
  return { envois, envoyer: async (url, o) => { envois.push({ url, ...o, corps: JSON.parse(o.body) }); return new Response("{}", { status: statuts[envois.length - 1] ?? 201 }); } };
}
const appeler = async (corps, { env = ENV, mem = memoire(), f = faux(), origine, ip = "1.2.3.4" } = {}) => {
  const r = await traiter(requete(corps, origine), { env, memoire: mem, ip, stockage: null, envoyer: f.envoyer });
  return { statut: r.status, corps: await r.json(), envois: f.envois };
};

test("sans configuration : 503 avec repli (la page propose copier / messagerie)", async () => {
  const r = await appeler({ contact: "a@b.fr", texte: TEXTE }, { env: {} });
  assert.equal(r.statut, 503);
  assert.equal(r.corps.repli, true);
});

test("GET : la page sait si l'envoi direct est en place (BREVO_CLE_API ou BREVO_API_KEY)", async () => {
  const dispo = async env => (await (await traiter(new Request(ORIGINE + "/api/demande"), { env, memoire: memoire(), ip: "x" })).json()).disponible;
  assert.equal(await dispo({}), false);
  assert.equal(await dispo({ BREVO_CLE_API: "k" }), false, "adresse de Belle manquante");
  assert.equal(await dispo(ENV), true);
  assert.equal(await dispo({ BREVO_API_KEY: "k", DEMANDE_EMAIL: "belle@exemple.fr" }), true);
});

test("e-mail donné : demande chez Belle (Répondre → voyageur) puis accusé de réception au voyageur", async () => {
  const r = await appeler({ nom: "Claire Martin", contact: "claire@exemple.fr", texte: TEXTE });
  assert.equal(r.statut, 200);
  assert.equal(r.envois.length, 2);
  const [demande, accuse] = r.envois;
  assert.equal(demande.url, "https://api.brevo.com/v3/smtp/email");
  assert.equal(demande.headers["api-key"], "xkeysib-test");
  assert.deepEqual(demande.corps.to, [{ email: "belle@exemple.fr", name: "Chez Belle" }]);
  assert.equal(demande.corps.sender.email, "belle@exemple.fr");
  assert.deepEqual(demande.corps.replyTo, { email: "claire@exemple.fr", name: "Claire Martin" });
  assert.match(demande.corps.subject, /Claire Martin/);
  assert.match(demande.corps.textContent, /5 juin/);
  assert.deepEqual(accuse.corps.to, [{ email: "claire@exemple.fr", name: "Claire Martin" }]);
  assert.equal(accuse.corps.replyTo.email, "belle@exemple.fr");
  assert.match(accuse.corps.textContent, /Bonjour Claire Martin/);
  assert.match(accuse.corps.textContent, /5 juin/);
});

test("téléphone seulement : pas d'accusé, coordonnées recopiées pour Belle", async () => {
  const r = await appeler({ contact: "06 12 34 56 78", texte: TEXTE });
  assert.equal(r.statut, 200);
  assert.equal(r.envois.length, 1);
  assert.equal(r.envois[0].corps.replyTo, undefined);
  assert.match(r.envois[0].corps.textContent, /06 12 34 56 78/);
});

test("accusé de réception en échec : la demande reste envoyée", async () => {
  const r = await appeler({ contact: "claire@exemple.fr", texte: TEXTE }, { f: faux([201, 400]) });
  assert.equal(r.statut, 200);
  assert.equal(r.corps.envoyee, true);
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

test("autre site : refusé ; plus de 5 demandes par heure et par IP, ou 40 par jour : refusé", async () => {
  assert.equal((await appeler({ contact: "a@b.fr", texte: TEXTE }, { origine: "https://pirate.example" })).statut, 403);
  const mem = memoire();
  for (let i = 0; i < 5; i++) assert.equal((await appeler({ contact: "0600000000", texte: TEXTE }, { mem })).statut, 200);
  assert.equal((await appeler({ contact: "0600000000", texte: TEXTE }, { mem })).statut, 429);
  const mem2 = memoire();
  for (let i = 0; i < 40; i++) assert.equal((await appeler({ contact: "0600000000", texte: TEXTE }, { mem: mem2, ip: "ip" + i })).statut, 200);
  assert.equal((await appeler({ contact: "0600000000", texte: TEXTE }, { mem: mem2, ip: "nouvelle" })).statut, 429);
});

test("Brevo refuse : 502 avec repli", async () => {
  const r = await appeler({ contact: "a@b.fr", texte: TEXTE }, { f: faux([401]) });
  assert.equal(r.statut, 502);
  assert.equal(r.corps.repli, true);
});
