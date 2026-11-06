// API de l'espace /admin. Une seule fonction, au format standard Request → Response,
// utilisée telle quelle par le serveur local (scripts/serveur-local.js) et en ligne (functions/api/[[route]].js, Cloudflare).
//
//   POST /api/connexion        { motDePasse }         → ouvre une session (cookie)
//   POST /api/deconnexion                              → ferme la session
//   GET  /api/session                                  → { connecte }
//   GET  /api/contenus                                 → liste des contenus
//   GET  /api/contenus/<nom>                           → { donnees, version, lectureSeule }
//   PUT  /api/contenus/<nom>   { donnees, version }    → valide puis enregistre → { version }
//   POST /api/photos           { nom, variantes[] }    → enregistre une photo (WebP ou JPEG) → { photo }
//   GET  /api/brouillon                                → { modifies, photos, apercu } : ce qui attend d'être publié
//   POST /api/publier                                  → revalide tout le brouillon puis le publie
//   POST /api/abandonner                               → le brouillon redevient identique au site publié
//   GET  /api/historique/<nom>                         → { versions } publiées
//   GET  /api/historique/<nom>/<id>                    → { donnees } d'une version (à reprendre dans le formulaire)
//
// Les enregistrements vont toujours dans le brouillon ; seul « publier » modifie le site en ligne.
// deps = { env, stockage, memoire, ip }
import { verifierMotDePasse, creerSession, sessionValide, cookieSession, cookieEfface, lireCookie, estBloque, noterEchec, effacerEchecs, empreinteValide } from "./auth.js";
import { SCHEMAS, LECTURE_SEULE, FICHIERS, LIES, valider, coherence } from "../src/_lib/schemas.js";
import { ConflitVersion, ConflitPublication } from "./stockage-commun.js";
import { depuisBase64 } from "./octets.js";
import { dimensionsImage, nomFichier } from "./images.js";

const TAILLE_MAX = 300 * 1024;
const OCTETS_MAX_PHOTO = 1.5 * 1024 * 1024;
const TAILLE_MAX_PHOTO = 3 * OCTETS_MAX_PHOTO * 1.4;

const reponse = (statut, corps, entetes = {}) => new Response(JSON.stringify(corps), {
  status: statut,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...entetes }
});
const erreur = (statut, message, plus = {}) => reponse(statut, { erreur: message, ...plus });

export function configurationValide(env) {
  return empreinteValide(env.ADMIN_MOT_DE_PASSE_HASH) && (env.SESSION_SECRET || "").length >= 32;
}

// Les requêtes qui modifient quelque chose doivent venir du site lui-même (protection CSRF, en plus de SameSite=Strict)
function origineAutorisee(req, env) {
  const origine = req.headers.get("origin");
  if (!origine) return false;
  const permises = new Set([new URL(req.url).origin, ...(env.ADMIN_ORIGINES || "").split(",").map(s => s.trim()).filter(Boolean)]);
  return permises.has(origine);
}

async function lireJson(req, max = TAILLE_MAX) {
  if (!(req.headers.get("content-type") || "").startsWith("application/json")) throw Object.assign(new Error("Format attendu : JSON."), { statut: 415 });
  const t = await req.text();
  if (t.length > max) throw Object.assign(new Error("Contenu trop volumineux."), { statut: 413 });
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

    const connecte = await sessionValide(lireCookie(req), env);

    if (route === "/api/session" && m === "GET") return reponse(200, { connecte });

    if (route === "/api/connexion" && m === "POST") {
      const minutes = await estBloque(memoire, ip);
      if (minutes) return erreur(429, `Trop d’essais. Réessayez dans ${minutes} min.`, { minutes });
      const { motDePasse } = await lireJson(req);
      if (!(await verifierMotDePasse(motDePasse, env.ADMIN_MOT_DE_PASSE_HASH))) {
        await noterEchec(memoire, ip);
        return erreur(401, "Mot de passe incorrect.");
      }
      await effacerEchecs(memoire, ip);
      return reponse(200, { connecte: true }, { "Set-Cookie": cookieSession(await creerSession(env)) });
    }

    if (route === "/api/deconnexion" && m === "POST") return reponse(200, { connecte: false }, { "Set-Cookie": cookieEfface() });

    // ----- Tout ce qui suit demande une session -----
    if (!connecte) return erreur(401, "Session expirée : reconnectez-vous.");

    if (route === "/api/contenus" && m === "GET")
      return reponse(200, { contenus: FICHIERS.map(nom => ({ nom, titre: SCHEMAS[nom] ? SCHEMAS[nom].label : "Avis et notes Airbnb (automatiques)", lectureSeule: LECTURE_SEULE.includes(nom) })) });

    // Photo : 1 à 3 variantes (largeurs) préparées par le navigateur, en WebP ou JPEG
    if (route === "/api/photos" && m === "POST") {
      const { nom, variantes } = await lireJson(req, TAILLE_MAX_PHOTO);
      if (!Array.isArray(variantes) || variantes.length < 1 || variantes.length > 3) return erreur(400, "Photo : variantes manquantes.");
      const base = `${nomFichier(nom)}-${Date.now().toString(36)}`;
      const prets = [];
      for (const v of variantes) {
        let octets;
        try { octets = depuisBase64(String(v.donnees || "")); } catch { return erreur(415, "Ce fichier n’est pas une image WebP ou JPEG valide."); }
        if (octets.length > OCTETS_MAX_PHOTO) return erreur(413, "Photo trop lourde (1,5 Mo au plus par taille).");
        const dim = dimensionsImage(octets);
        if (!dim) return erreur(415, "Ce fichier n’est pas une image WebP ou JPEG valide.");
        if (dim.largeur < 200 || dim.largeur > 2400 || dim.hauteur < 100 || dim.hauteur > 3200) return erreur(422, "Dimensions de photo inhabituelles.");
        prets.push({ octets, dim, fichier: `${base}-${dim.largeur}.${dim.type}` });
      }
      if (new Set(prets.map(p => p.fichier)).size !== prets.length) return erreur(400, "Photo : deux variantes de même largeur.");
      prets.sort((a, b) => a.dim.largeur - b.dim.largeur);
      for (const p of prets) await stockage.ajouterPhoto(p.fichier, p.octets, `Admin : photo ${p.fichier}`);
      const grande = prets.at(-1);
      return reponse(200, { photo: {
        src: `/photos/${grande.fichier}`,
        ...(prets.length > 1 ? { srcset: prets.map(p => [`/photos/${p.fichier}`, p.dim.largeur]) } : {}),
        largeur: grande.dim.largeur, hauteur: grande.dim.hauteur
      } });
    }

    // ----- Brouillon et publication -----
    if (route === "/api/brouillon" && m === "GET") return reponse(200, await stockage.etat());

    if (route === "/api/publier" && m === "POST") {
      const { modifies } = await stockage.etat();
      // Dernier contrôle de tout le brouillon, ensemble (un contenu peut dépendre d'un autre)
      const tous = {};
      for (const n of Object.keys(SCHEMAS)) tous[n] = (await stockage.lire(n)).donnees;
      const erreurs = [];
      for (const n of modifies.filter(n => SCHEMAS[n])) {
        const r = valider(SCHEMAS[n], tous[n]);
        for (const e of [...r.erreurs, ...coherence(n, r.valeur, tous)]) erreurs.push({ ...e, rubrique: n, message: `${SCHEMAS[n].label} : ${e.message}` });
      }
      if (erreurs.length) return erreur(422, "Le brouillon contient des erreurs : corrigez-les avant de publier.", { erreurs });
      const libelles = modifies.filter(n => SCHEMAS[n]).map(n => SCHEMAS[n].label);
      try {
        const r = await stockage.publier(`Publication depuis l’admin${libelles.length ? " : " + libelles.join(", ") : ""}`);
        return reponse(200, { publie: r.modifies });
      } catch (e) {
        if (e instanceof ConflitPublication) return erreur(409, "Publication impossible : le site en ligne a été modifié d’une façon incompatible. Contactez Thomas.");
        throw e;
      }
    }

    if (route === "/api/abandonner" && m === "POST") { await stockage.abandonner(); return reponse(200, { abandonne: true }); }

    const mh = /^\/api\/historique\/([a-z]+)(?:\/([A-Za-z0-9_-]{1,64}))?$/.exec(route);
    if (mh && m === "GET") {
      const [, nom, id] = mh;
      if (!SCHEMAS[nom]) return erreur(404, "Contenu inconnu.");
      if (!id) return reponse(200, { versions: await stockage.historique(nom) });
      return reponse(200, { donnees: await stockage.lireVersion(nom, id) });
    }

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
        for (const n of LIES) if (n !== nom) autres[n] = (await stockage.lire(n)).donnees;
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
