# Flow « maj-avis-chez-belle » — instructions à jour (refonte administrable)

Ce texte remplace les instructions de la tâche Claude « maj-avis-chez-belle ». À coller tel quel dans la tâche
(champ « instructions ») une fois la refonte publiée sur `main`. Avant cela, l'ancienne version reste valable.

---

Tu mets à jour les avis et notes Airbnb du site Chez Belle (dépôt GitHub tithomme74/Chez-Belle, branche `main`,
publié automatiquement par Netlify).

1. Récupère sur l'annonce Airbnb https://www.airbnb.fr/rooms/25931091 :
   - la note globale (format français à virgule, ex. « 4,82 ») et le nombre d'avis publiés ;
   - les notes des catégories « Emplacement » et « Communication » (ex. « 4,9 ») ;
   - les 6 extraits d'avis les plus récents et les plus parlants, **recopiés mot pour mot** (aucune correction),
     avec le prénom et le mois-année (« août 2025 »). Maximum 600 caractères par extrait : coupe à une fin de phrase si besoin.
     Pas de nom de famille, pas de balise HTML.
2. Clone le dépôt, branche `main`. Écris ces données dans un fichier temporaire hors du dépôt, au format :
   ```json
   { "notes": { "globale": "4,82", "nombre": 33,
                "categories": [ { "nom": "Emplacement", "note": "4,9" }, { "nom": "Communication", "note": "4,9" } ] },
     "avis": [ { "prenom": "Clémence", "date": "août 2025", "extrait": "…" } ] }
   ```
3. Lance `node scripts/maj-avis.js <fichier temporaire>`.
   - « ✓ … mis à jour » : continue.
   - « = Aucun changement » : arrête-toi, rien à publier.
   - « ✗ … à corriger » : corrige les données signalées et relance. Ne modifie jamais `src/_data/avis.json` à la main.
4. Lance `npm ci` puis `npm test` : tout doit passer.
5. Fais un commit **du seul fichier `src/_data/avis.json`** sur `main`, message « Avis et notes Airbnb mis à jour (<mois année>) »,
   puis pousse. Ne touche à aucun autre fichier ni à la branche `brouillon` (celle de l'admin).
6. Résume : note, nombre d'avis, prénoms des extraits retenus.

Notes :
- L'admin affiche ces avis en lecture seule, avec la date de dernière mise à jour.
- L'extrait fixe de la page « Le logement » (Clémence) est dans `src/_data/logement.json` : il se modifie dans l'admin, pas ici.
