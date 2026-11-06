# Chez Belle — site vitrine

Location de vacances à Vaux-sur-Mer, quartier de Pontaillac.
Site statique construit avec Eleventy, publié automatiquement par Netlify
depuis la branche `main` : https://chez-belle-pontaillac.netlify.app

## Travailler en local

- `npm install` (une fois), puis `npm run dev` : site sur http://localhost:8765, rechargé à chaque modification.
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

## Avis et notes Airbnb

Les avis et les notes sont dans `src/_data/avis.json`, rempli par le flow « maj-avis-chez-belle » (à adapter : il écrivait
auparavant dans `index.html`). Ce fichier n'est pas modifiable dans l'admin.
La page Logement affiche en plus un extrait fixe (Clémence), dans `logement.json` : le flow ne le touche pas.

## Anciens liens

Les liens de l’ancien site en une page (`/#reserver`, `/#tarifs`, `/#logement`, `/#autour`, `/#faq`) et l’ancien onglet `/infos/`
redirigent vers le bon onglet.

## Photos

Voir `photos/LISEZ-MOI.txt`.
