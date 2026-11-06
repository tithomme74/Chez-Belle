// Fonction Cloudflare Pages qui sert /api/* en ligne : contenus lus et écrits sur GitHub (branche de brouillon),
// essais de connexion comptés dans Cloudflare KV.
// À définir dans Cloudflare (Settings → Variables and Secrets, jamais dans le code) :
//   ADMIN_MOT_DE_PASSE_HASH  empreinte du mot de passe (npm run mot-de-passe)   [secret]
//   SESSION_SECRET           64 caractères aléatoires (même commande)          [secret]
//   GITHUB_TOKEN             jeton GitHub limité à ce dépôt, droit « Contents : lecture et écriture »  [secret]
//   GITHUB_DEPOT             tithomme74/Chez-Belle
//   GITHUB_BRANCHE           brouillon
//   APERCU_URL               https://brouillon.<projet>.pages.dev (aperçu du brouillon)
// et une liaison KV (Settings → Bindings) nommée MEMOIRE.
import { traiter } from "../../api/app.js";
import { stockageGithub } from "../../api/stockage-github.js";

const indisponible = () => new Response(JSON.stringify({ erreur: "Espace d’administration non configuré (liaison MEMOIRE manquante)." }), {
  status: 503, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
});

export async function onRequest({ request, env }) {
  if (!env.MEMOIRE) return indisponible();
  const memoire = {
    lire: k => env.MEMOIRE.get(k, "json"),
    // Les compteurs d'essais s'effacent seuls au bout de 2 heures
    ecrire: (k, v) => env.MEMOIRE.put(k, JSON.stringify(v), { expirationTtl: 7200 })
  };
  const ip = request.headers.get("CF-Connecting-IP") || "inconnue";
  return traiter(request, { env, stockage: stockageGithub(env), memoire, ip });
}
