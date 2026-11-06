# Chez Belle — site vitrine

Location de vacances à Vaux-sur-Mer, quartier de Pontaillac.
Site statique construit avec Eleventy, publié automatiquement par Netlify
depuis la branche `main` : https://chez-belle-pontaillac.netlify.app

## Travailler en local

- `npm install` (une fois), puis `npm run mot-de-passe -- --local` (une fois : crée `.env` avec un mot de passe de test, noté en commentaire dans ce fichier).
- `npm run dev` : site « publié » sur http://localhost:8765, aperçu du brouillon sur http://localhost:8765/apercu/, admin sur http://localhost:8765/admin/.
  En local, le site publié est construit depuis `src/_data/`, le brouillon vit dans `.local/brouillon/` et l'historique dans `.local/historique/` (dossiers ignorés par Git).
- `npm run build` : produit le site dans `_site/` (ce que Netlify publie, voir `netlify.toml`).
- `npm test` : reconstruit et vérifie que les pages restent identiques aux références de `tests/reference/`.

Les sources sont dans `src/` : gabarit commun `src/_includes/base.njk` (en-tête, menu, pied de page, barre du bas),
une page `.njk` par onglet ; `assets/`, `photos/`, `infos/` et les fichiers racine sont recopiés tels quels.

## Architecture en 4 onglets

| Onglet | Fichier | Contenu |
|---|---|---|
| Accueil | `src/index.njk` | Accroche (photo en tête sur mobile), l’essentiel en 6 points, aperçu photos, avis Airbnb, zoom tarifs, liens vers les conseils |
| Le logement | `src/chez-belle/index.njk` | 5 photos visibles (10 en grand), 4 chiffres clés, cartes Dedans / Dehors / Avec Belle, option caravane, équipements en 4 familles, bandeau « compris », 1 avis fixe (Clémence) |
| Tarifs | `src/tarifs-reservation/index.njk` | Grille 2027 (prix par période, durée minimale, Noël), mot de Belle, réserver en direct, formulaire (`#reserver`), questions fréquentes (`#questions`) |
| Autour | `src/autour/index.njk` | Autour de Chez Belle par distance avec filtres, info chiens, « Les belles adresses de Belle » |

`src/infos/index.html` ne sert plus qu’à rediriger l’ancienne adresse vers `tarifs-reservation/#questions`.

Fichiers communs :

- `assets/style.css` : la charte rétro balnéaire (marine, crème, corail, sable ; DM Serif Display, Jost, Caveat).
- `assets/reservation.js` : estimation du prix (périodes, tarifs, durées minimales 2027 dans `RATES`, sans jours d’arrivée imposés) et brouillon de demande. Pour changer les tarifs, modifier `PERIODS` et `RATES` ici **et** les cartes de prix dans `src/tarifs-reservation/index.njk` et `src/index.njk` (zoom tarifs).
- `assets/autour.js` : filtres « par envie ».
- `assets/galerie.js` : agrandissement des photos.

L’en-tête, le menu et le pied de page sont écrits une seule fois dans `src/_includes/base.njk`.

## Contenus (src/_data/)

Tous les textes, prix, listes et photos sont dans des fichiers JSON, un par page, que l'espace `/admin` modifiera :
`site.json` (menu, pied de page, barre du bas, e-mail), `accueil.json`, `logement.json`, `reservation.json` (textes de la page Tarifs),
`autour.json`, `tarifs.json` (types de période, prix, durées minimales, calendrier, chien, dépôt, bornes du formulaire) et `avis.json`.

- **Tarifs saisis une seule fois** : la grille, le zoom de l'accueil, la barre du bas et l'estimation sont calculés depuis `tarifs.json` (`src/_data/calc.js`).
- **Jetons** utilisables dans les textes : `{prix_min}`, `{depot}`, `{annee}`, `{chien_court}`, `{chien_long}`, `{chien_seuil}`, `{nb_photos}`, `{prix:noel}`, `{semaine:coeur}`, `{min:juillet}`.
- **Mise en forme** autorisée dans les textes : `<b>`, `<em>`, `<sup>`, `<br>`, `<a href>` (liens internes écrits depuis la racine, ex. `/autour/`). Tout le reste est neutralisé (`src/_lib/contenu.js`).

## Espace d'administration (/admin/)

`src/admin/` : page de connexion puis une rubrique par contenu (Accueil, Le logement, Prix et calendrier, Page Tarifs : textes, Autour,
Commun, Avis en lecture seule). Les formulaires sont générés à partir de `src/_lib/schemas.js` : ajouter un champ au schéma le fait
apparaître dans l'admin. Listes : ajouter, supprimer, monter, descendre. Photos : réduites dans le navigateur (480 et 960 px, WebP,
ou JPEG si le navigateur ne sait pas faire de WebP), puis envoyées à `/api/photos`. Retirer une photo de la liste la retire du site
(le fichier reste dans `src/photos/`). Contrôles faits dans le navigateur puis refaits par le serveur.

## Brouillon, aperçu, publication, historique

- Chaque « Enregistrer le brouillon » écrit dans le brouillon : en ligne, la branche Git `brouillon`, que Netlify publie comme aperçu
  (bandeau « Aperçu du brouillon », pages non indexées) ; en local, `.local/brouillon/` servi sur `/apercu/`.
- « Publier sur le site » revalide tout le brouillon puis le fusionne dans `main` (Netlify reconstruit le site, 1 à 2 min) ;
  le brouillon repart ensuite de la version publiée. « Abandonner le brouillon » le remet à l'identique du site publié.
- Historique : chaque rubrique liste ses versions publiées (commits de `main` qui ont modifié son fichier) ; « Reprendre »
  remet une version dans le formulaire, à enregistrer puis publier.
- Les avis (`avis.json`) se lisent toujours sur la version publiée ; le flow les met à jour directement sur `main`.

Mode d'emploi du superviseur : rubrique « Mode d'emploi » de l'admin (`modeEmploi()` dans `src/admin/admin.js`).

## API de l'admin (api/)

- `api/app.js` : routes `/api/connexion`, `/api/deconnexion`, `/api/session`, `/api/contenus`, `/api/contenus/<nom>` (lecture, enregistrement).
- `api/auth.js` : mot de passe unique (empreinte scrypt), cookie de session signé (HttpOnly, Secure, SameSite=Strict, 8 h), blocage après 5 essais ratés (15 min) et 30 au total par heure.
- `src/_lib/schemas.js` : schéma de chaque contenu (libellés, limites, formats) ; tout enregistrement est validé puis contrôlé (dates qui se chevauchent, périodes inconnues…). `avis` est en lecture seule.
- `api/images.js` : contrôle des photos envoyées (vraie image WebP ou JPEG, dimensions lues dans le fichier).
- `api/stockage.js` : en local, écrit dans `src/_data/` ; en ligne, écrit sur GitHub (branche de brouillon) via `netlify/functions/api.mjs`.
- En ligne, variables Netlify à définir : voir `.env.exemple` et l'en-tête de `netlify/functions/api.mjs`. `npm run mot-de-passe -- "…"` calcule l'empreinte du vrai mot de passe.

## Avis et notes Airbnb

Les avis et les notes sont dans `src/_data/avis.json`, rempli par le flow « maj-avis-chez-belle » avec
`node scripts/maj-avis.js <fichier>` (validation : note au format « 4,82 », 1 à 12 extraits, pas de balise, date « août 2025 »),
puis commit de ce seul fichier sur `main`. Instructions complètes : skill claude.ai « maj-avis-chez-belle » (V3), copie de référence dans `outils/skill-maj-avis-chez-belle/SKILL.md`.
`node scripts/maj-avis.js --verifier` contrôle le fichier actuel. Ce fichier n'est pas modifiable dans l'admin (lecture seule,
avec la date de dernière mise à jour).
La page Logement affiche en plus un extrait fixe (Clémence), dans `logement.json` : le flow ne le touche pas.

## Anciens liens

Les liens de l’ancien site en une page (`/#reserver`, `/#tarifs`, `/#logement`, `/#autour`, `/#faq`) et l’ancien onglet `/infos/`
redirigent vers le bon onglet.

## Photos

Voir `photos/LISEZ-MOI.txt`.
