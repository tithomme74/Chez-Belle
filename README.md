# Chez Belle — site vitrine

Location de vacances à Vaux-sur-Mer, quartier de Pontaillac.
Site statique (HTML, CSS, JS sans outil de build), publié automatiquement par Netlify
depuis la branche `main` : https://chez-belle-pontaillac.netlify.app

## Architecture en 5 onglets

| Onglet | Fichier | Contenu |
|---|---|---|
| Accueil | `index.html` | Accroche, l’essentiel en 6 points, aperçu photos, zoom tarifs, avis Airbnb, liens vers les conseils |
| Chez Belle | `chez-belle/index.html` | Le logement, équipements, « billet tout compris », les 9 photos (agrandissables), mot de Belle, six atouts |
| Tarifs et réservation | `tarifs-reservation/index.html` | Grille 2027, saison mai-juin-septembre, réserver en direct, formulaire d’estimation et de demande (`#reserver`) |
| Conseils et adresses | `autour/index.html` | Autour de Chez Belle par distance avec filtres, info chiens, « Les belles adresses de Belle » |
| Infos pratiques | `infos/index.html` | Questions fréquentes |

Fichiers communs :

- `assets/style.css` : la charte rétro balnéaire (marine, crème, corail, sable ; DM Serif Display, Jost, Caveat).
- `assets/reservation.js` : estimation du prix (périodes et tarifs 2027) et brouillon de demande. Pour changer les tarifs, modifier `PERIODS` et `RATES` ici **et** les cartes de prix dans `tarifs-reservation/index.html` et `index.html` (zoom tarifs).
- `assets/autour.js` : filtres « par envie ».
- `assets/galerie.js` : agrandissement des photos.

L’en-tête et le pied de page sont recopiés dans chaque page : une modification du menu se fait dans les 5 fichiers.

## Avis et notes Airbnb

Le flow « maj-avis-chez-belle » met à jour les blocs `// DEBUT AVIS … // FIN AVIS` et
`// DEBUT NOTES … // FIN NOTES` : ils restent dans **`index.html`** (l’accueil), comme avant.

## Anciens liens

Les liens de l’ancien site en une page (`/#reserver`, `/#tarifs`, `/#logement`, `/#autour`, `/#faq`)
redirigent vers le bon onglet.

## Photos

Voir `photos/LISEZ-MOI.txt`.
