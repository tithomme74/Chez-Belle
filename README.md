# Chez Belle — site vitrine

Location de vacances à Vaux-sur-Mer, quartier de Pontaillac.
Site statique (HTML, CSS, JS sans outil de build), publié automatiquement par Netlify
depuis la branche `main` : https://chez-belle-pontaillac.netlify.app

## Architecture en 4 onglets

| Onglet | Fichier | Contenu |
|---|---|---|
| Accueil | `index.html` | Accroche (photo en tête sur mobile), l’essentiel en 6 points, aperçu photos, avis Airbnb, zoom tarifs, liens vers les conseils |
| Le logement | `chez-belle/index.html` | 5 photos visibles (10 en grand), 4 chiffres clés, cartes Dedans / Dehors / Avec Belle, option caravane, équipements en 4 familles, bandeau « compris », 1 avis fixe (Clémence) |
| Tarifs | `tarifs-reservation/index.html` | Grille 2027 + « billet tout compris », saison mai-juin-septembre, mot de Belle, réserver en direct, formulaire (`#reserver`), questions fréquentes (`#questions`) |
| Autour | `autour/index.html` | Autour de Chez Belle par distance avec filtres, info chiens, « Les belles adresses de Belle » |

`infos/index.html` ne sert plus qu’à rediriger l’ancienne adresse vers `tarifs-reservation/#questions`.

Fichiers communs :

- `assets/style.css` : la charte rétro balnéaire (marine, crème, corail, sable ; DM Serif Display, Jost, Caveat).
- `assets/reservation.js` : estimation du prix (périodes, tarifs, durées minimales et jours d’arrivée 2027 dans `RATES`) et brouillon de demande. Pour changer les tarifs, modifier `PERIODS` et `RATES` ici **et** les cartes de prix dans `tarifs-reservation/index.html` et `index.html` (zoom tarifs).
- `assets/autour.js` : filtres « par envie ».
- `assets/galerie.js` : agrandissement des photos.

L’en-tête et le pied de page sont recopiés dans chaque page : une modification du menu se fait dans les 4 fichiers.

## Avis et notes Airbnb

Le flow « maj-avis-chez-belle » met à jour les blocs `// DEBUT AVIS … // FIN AVIS` et
`// DEBUT NOTES … // FIN NOTES` : ils restent dans **`index.html`** (l’accueil), comme avant.
La page Logement affiche en plus un extrait fixe (Clémence) écrit en dur dans `chez-belle/index.html` : le flow ne le touche pas.

## Anciens liens

Les liens de l’ancien site en une page (`/#reserver`, `/#tarifs`, `/#logement`, `/#autour`, `/#faq`) et l’ancien onglet `/infos/`
redirigent vers le bon onglet.

## Photos

Voir `photos/LISEZ-MOI.txt`.
