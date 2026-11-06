// Chemin relatif vers la racine du site : "" pour l'accueil, "../" pour les onglets (liens relatifs conservés)
export default {
  racine: data => "../".repeat(Math.max(0, (data.page.url || "/").split("/").filter(Boolean).length))
};
