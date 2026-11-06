// API de l'espace /admin. Une seule fonction, au format standard Request → Response,
// utilisée telle quelle par le serveur local (scripts/serveur-local.js) et par la fonction Netlify.
//
//   POST /api/connexion        { motDePasse }         → ouvre une session (cookie)
//   POST /api/deconnexion                              → ferme la session
//   GET  /api/session                                  → { connecte }
//   GET  /api/contenus                                 → liste des contenus
//   GET  /api/contenus/<nom>                           → { donnees, version, lectureSeule }
//   PUT  /api/contenus/<nom>   { donnees, version }    → valide puis enregistre → { version }
//
// deps = { env, stockage, memoire, ip }
import { verifierMotDePasse, creerSession, sessionValide, cookieSession, cookieEfface, lireCookie, estBloque, noterEchec, effacerEchecs } from "./auth.js";
import { SCHEMAS, LECTURE_SEULE, FICHIERS, valider, coherence } from "../src/_lib/schemas.js";
import { ConflitVersion } from "./stockage.js";

const TAILLE_MAX = 300 * 1024;

const reponse = (statut, corps, entetes = {}) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...entetes }
});
const erreur = (statut, message, plus = {}) => reponse(statut, { erreur: message, ...plus });

export function configurationValide(env) {
  return /^scrypt\$/.test(env.ADMIN_MOT_DE_PASSE_HASH || "") && (env.SESSION_SECRET || "").length >= 32;
}

// Les requêtes qui modifient quelque chose doivent venir du site lui-même (protection CSRF, en plus de SameSite=Strict)
function origineAutorisee(req, env) {
  const origine = req.headers.get("origin");
  if (!origine) return false;
  const permises = new Set([new URL(req.url).origin, ...(env.ADMIN_ORIGINES || "").split(",").map(s => s.trim()).filter(Boolean)]);
  return permises.has(origine);
}

async function lireJson(req) {
  if (!(req.headers.get("content-type") || "").startsWith("application/json")) throw Object.assign(new Error("Format attendu : JSON."), { statut: 415 });
  const t = await req.text();
  if (t.length > TAILLE_MAX) throw Object.assign(new Error("Contenu trop volumineux."), { statut: 413 });
  try { return JSON.parse(t); } catch { throw Object.assign(new Error("JSON illisible."), { statut: 400 }); }
}

export async function traiter(req, deps) {
  const { env, stockage, memoire, ip = "inconnue" } = deps;
  const url = new URL(req.url);
  const route = url.pathname.replace(/\/+$/, "");
  const m = req.method;

  try {
    if (!route.startsWith("/api/")) return erreur(404, "Introuvable.");
    if (!configurationValide(env)) return erreur(503, "Espace d’administration non configuré (mot de passe ou secret de session manquant).");
    if (m !== "GET" && m !== "HEAD" && !origineAutorisee(req, env)) return erreur(403, "Requête refusée (origine).");

    const connecte = sessionValide(lireCookie(req), env);

    if (route === "/api/session" && m === "GET") return reponse(200, { connecte });

    if (route === "/api/connexion" && m === "POST") {
      const minutes = await estBloque(memoire, ip);
      if (minutes) return erreur(429, `Trop d’essais. Réessayez dans ${minutes} min.`, { minutes });
      const { motDePasse } = await lireJson(req);
      if (!verifierMotDePasse(motDePasse, env.ADMIN_MOT_DE_PASSE_HASH)) {
        await noterEchec(memoire, ip);
        return erreur(401, "Mot de passe incorrect.");
      }
      await effacerEchecs(memoire, ip);
      return reponse(200, { connecte: true }, { "Set-Cookie": cookieSession(creerSession(env)) });
    }

    if (route === "/api/deconnexion" && m === "POST") return reponse(200, { connecte: false }, { "Set-Cookie": cookieEfface() });

    // ----- Tout ce qui suit demande une session -----
    if (!connecte) return erreur(401, "Session expirée : reconnectez-vous.");

    if (route === "/api/contenus" && m === "GET")
      return reponse(200, { contenus: FICHIERS.map(nom => ({ nom, titre: SCHEMAS[nom] ? SCHEMAS[nom].label : "Avis et notes Airbnb (automatiques)", lectureSeule: LECTURE_SEULE.includes(nom) })) });

    const mc = /^\/api\/contenus\/([a-z]+)$/.exec(route);
    if (mc) {
      const nom = mc[1];
      if (!FICHIERS.includes(nom)) return erreur(404, "Contenu inconnu.");
      if (m === "GET") {
        const { donnees, version } = await stockage.lire(nom);
        return reponse(200, { donnees, version, lectureSeule: LECTURE_SEULE.includes(nom) });
      }
      if (m === "PUT") {
        if (LECTURE_SEULE.includes(nom)) return erreur(403, "Ce contenu est mis à jour automatiquement et ne peut pas être modifié ici.");
        const corps = await lireJson(req);
        if (typeof corps.version !== "string") return erreur(400, "Version manquante.");
        const { valeur, erreurs } = valider(SCHEMAS[nom], corps.donnees);
        if (erreurs.length) return erreur(422, "Certains champs sont à corriger.", { erreurs });
        // Cohérence avec les autres contenus (périodes de prix utilisées par l'accueil, etc.)
        const autres = {};
        for (const n of ["tarifs", "accueil", "autour"]) if (n !== nom) autres[n] = (await stockage.lire(n)).donnees;
        const incoherences = coherence(nom, valeur, autres);
        if (incoherences.length) return erreur(422, "Certains champs sont incohérents.", { erreurs: incoherences });
        try {
          const { version } = await stockage.ecrire(nom, valeur, corps.version, `Admin : ${SCHEMAS[nom].label}`);
          return reponse(200, { version, donnees: valeur });
        } catch (e) {
          if (e instanceof ConflitVersion) return erreur(409, "Ce contenu a été modifié entre-temps (autre onglet ?). Rechargez la page avant d’enregistrer.");
          throw e;
        }
      }
    }
    return erreur(404, "Introuvable.");
  } catch (e) {
    if (e.statut) return erreur(e.statut, e.message);
    console.error("[api]", e);
    return erreur(500, "Erreur interne. Réessayez dans un instant.");
  }
}
