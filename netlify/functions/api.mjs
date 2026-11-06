// Fonction Netlify qui sert /api/* en ligne : contenus lus et écrits sur GitHub (branche de brouillon),
// essais de connexion comptés dans Netlify Blobs.
// Variables à définir dans Netlify (jamais dans le code) :
//   ADMIN_MOT_DE_PASSE_HASH  empreinte du mot de passe (npm run mot-de-passe)
//   SESSION_SECRET           64 caractères aléatoires
//   GITHUB_TOKEN             jeton GitHub limité à ce dépôt, droit « Contents : lecture et écriture »
//   GITHUB_DEPOT             tithomme74/Chez-Belle
//   GITHUB_BRANCHE           brouillon
//   APERCU_URL               https://brouillon--chez-belle-pontaillac.netlify.app (aperçu du brouillon)
import { getStore } from "@netlify/blobs";
import { traiter } from "../../api/app.js";
import { stockageGithub } from "../../api/stockage.js";

export default async (req, context) => {
  const store = getStore({ name: "admin-connexion", consistency: "strong" });
  const memoire = {
    lire: k => store.get(k, { type: "json" }),
    ecrire: (k, v) => store.setJSON(k, v)
  };
  return traiter(req, { env: process.env, stockage: stockageGithub(process.env), memoire, ip: context.ip || "inconnue" });
};

export const config = { path: "/api/*" };
