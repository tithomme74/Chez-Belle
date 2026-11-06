// Connexion du superviseur : un seul mot de passe, jamais stocké en clair (empreinte scrypt),
// session dans un cookie signé (HMAC), HttpOnly, Secure, SameSite=Strict, valable 8 heures.
import crypto from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };
export const DUREE_SESSION = 8 * 3600;
export const COOKIE = "cb_session";

// Empreinte à placer dans la variable ADMIN_MOT_DE_PASSE_HASH : scrypt$<sel base64>$<empreinte base64>
export function empreinte(motDePasse) {
  const sel = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(motDePasse).normalize("NFC"), sel, 32, SCRYPT);
  return `scrypt$${sel.toString("base64")}$${h.toString("base64")}`;
}

export function verifierMotDePasse(motDePasse, hash) {
  const m = /^scrypt\$([A-Za-z0-9+/=]+)\$([A-Za-z0-9+/=]+)$/.exec(hash || "");
  if (!m || typeof motDePasse !== "string" || !motDePasse || motDePasse.length > 200) {
    crypto.scryptSync("x", "sel-factice", 32, SCRYPT); // même durée qu'une vraie vérification
    return false;
  }
  const attendu = Buffer.from(m[2], "base64");
  const h = crypto.scryptSync(motDePasse.normalize("NFC"), Buffer.from(m[1], "base64"), attendu.length, SCRYPT);
  return crypto.timingSafeEqual(h, attendu);
}

const b64u = b => Buffer.from(b).toString("base64url");
const signer = (data, secret) => crypto.createHmac("sha256", secret).update(data).digest("base64url");
// Empreinte courte du mot de passe dans le jeton : changer le mot de passe déconnecte toutes les sessions.
const version = hash => crypto.createHash("sha256").update(hash).digest("base64url").slice(0, 12);

export function creerSession(env, maintenant = Date.now()) {
  const data = b64u(JSON.stringify({ exp: Math.floor(maintenant / 1000) + DUREE_SESSION, v: version(env.ADMIN_MOT_DE_PASSE_HASH) }));
  return `${data}.${signer(data, env.SESSION_SECRET)}`;
}

export function sessionValide(jeton, env, maintenant = Date.now()) {
  if (typeof jeton !== "string" || jeton.length > 500) return false;
  const [data, sig] = jeton.split(".");
  if (!data || !sig) return false;
  const attendu = Buffer.from(signer(data, env.SESSION_SECRET)), recu = Buffer.from(sig);
  if (attendu.length !== recu.length || !crypto.timingSafeEqual(attendu, recu)) return false;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString());
    return p.exp > maintenant / 1000 && p.v === version(env.ADMIN_MOT_DE_PASSE_HASH);
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
// `memoire` : { lire(cle), ecrire(cle, valeur) } (mémoire du processus en local, Netlify Blobs en ligne).
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
