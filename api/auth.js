// Connexion du superviseur : un seul mot de passe, jamais stocké en clair (empreinte PBKDF2-SHA256),
// session dans un cookie signé (HMAC-SHA256), HttpOnly, Secure, SameSite=Strict, valable 8 heures.
// Uniquement des fonctions standard du web (WebCrypto) : même code en local (Node) et en ligne (Cloudflare).
import { versOctets, versTexte, base64, depuisBase64, base64url, depuisBase64url, egal } from "./octets.js";

// Nombre de tours : l'offre gratuite de Cloudflare limite le temps de calcul par appel (environ 10 ms).
// En contrepartie : mot de passe d'au moins 12 caractères, essais limités (voir plus bas), empreinte gardée en secret.
export const TOURS = 10000;
export const DUREE_SESSION = 8 * 3600;
export const COOKIE = "cb_session";
const sub = globalThis.crypto.subtle;

async function deriver(motDePasse, sel, tours, longueur) {
  const cle = await sub.importKey("raw", versOctets(motDePasse.normalize("NFC")), "PBKDF2", false, ["deriveBits"]);
  return new Uint8Array(await sub.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: sel, iterations: tours }, cle, longueur * 8));
}

// Empreinte à placer dans la variable ADMIN_MOT_DE_PASSE_HASH : pbkdf2$<tours>$<sel base64>$<empreinte base64>
export async function empreinte(motDePasse, tours = TOURS) {
  const sel = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${tours}$${base64(sel)}$${base64(await deriver(String(motDePasse), sel, tours, 32))}`;
}

const MOTIF = /^pbkdf2\$([0-9]{4,6})\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/;
// Cloudflare refuse plus de 100 000 tours
export function empreinteValide(h) {
  const m = MOTIF.exec(h || "");
  return !!m && Number(m[1]) >= 1000 && Number(m[1]) <= 100000;
}

export async function verifierMotDePasse(motDePasse, hash) {
  if (!empreinteValide(hash) || typeof motDePasse !== "string" || !motDePasse || motDePasse.length > 200) {
    await deriver("x", new Uint8Array(16), TOURS, 32); // même durée qu'une vraie vérification
    return false;
  }
  const [, tours, sel, h] = MOTIF.exec(hash);
  const attendu = depuisBase64(h);
  return egal(await deriver(motDePasse, depuisBase64(sel), Number(tours), attendu.length), attendu);
}

async function signer(data, secret) {
  const cle = await sub.importKey("raw", versOctets(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return base64url(new Uint8Array(await sub.sign("HMAC", cle, versOctets(data))));
}
// Empreinte courte du mot de passe dans le jeton : changer le mot de passe déconnecte toutes les sessions.
const version = async hash => base64url(new Uint8Array(await sub.digest("SHA-256", versOctets(hash)))).slice(0, 12);

export async function creerSession(env, maintenant = Date.now()) {
  const p = { exp: Math.floor(maintenant / 1000) + DUREE_SESSION, v: await version(env.ADMIN_MOT_DE_PASSE_HASH) };
  const data = base64url(versOctets(JSON.stringify(p)));
  return `${data}.${await signer(data, env.SESSION_SECRET)}`;
}

export async function sessionValide(jeton, env, maintenant = Date.now()) {
  if (typeof jeton !== "string" || jeton.length > 500) return false;
  const [data, sig] = jeton.split(".");
  if (!data || !sig) return false;
  if (!egal(versOctets(await signer(data, env.SESSION_SECRET)), versOctets(sig))) return false;
  try {
    const p = JSON.parse(versTexte(depuisBase64url(data)));
    return p.exp > maintenant / 1000 && p.v === await version(env.ADMIN_MOT_DE_PASSE_HASH);
  } catch { return false; }
}

export const cookieSession = jeton => `${COOKIE}=${jeton}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${DUREE_SESSION}`;
export const cookieEfface = () => `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
export function lireCookie(req, nom = COOKIE) {
  const c = req.headers.get("cookie") || "";
  const m = c.split(/;\s*/).find(x => x.startsWith(nom + "="));
  return m ? m.slice(nom.length + 1) : null;
}

// Blocage des essais : 5 échecs par adresse en 15 min, 30 échecs au total par heure.
// `memoire` : { lire(cle), ecrire(cle, valeur) } (mémoire du processus en local, Cloudflare KV en ligne).
export const LIMITES = { parIp: { max: 5, fenetre: 15 * 60 }, global: { max: 30, fenetre: 3600 } };
const compteurs = ip => [["ip:" + ip, LIMITES.parIp], ["global", LIMITES.global]];

// Renvoie le nombre de minutes de blocage restantes (0 = pas bloqué)
export async function estBloque(memoire, ip, maintenant = Date.now()) {
  for (const [cle, l] of compteurs(ip)) {
    const essais = ((await memoire.lire(cle)) || []).filter(t => t > maintenant - l.fenetre * 1000);
    if (essais.length >= l.max) return Math.max(1, Math.ceil((essais[0] + l.fenetre * 1000 - maintenant) / 60000));
  }
  return 0;
}
export async function noterEchec(memoire, ip, maintenant = Date.now()) {
  for (const [cle, l] of compteurs(ip)) {
    const essais = ((await memoire.lire(cle)) || []).filter(t => t > maintenant - l.fenetre * 1000);
    essais.push(maintenant);
    await memoire.ecrire(cle, essais.slice(-l.max));
  }
}
export async function effacerEchecs(memoire, ip) { await memoire.ecrire("ip:" + ip, []); }

export function memoireLocale() {
  const m = new Map();
  return { lire: async k => m.get(k), ecrire: async (k, v) => { m.set(k, v); } };
}
