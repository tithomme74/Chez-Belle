---
name: "maj-avis-chez-belle"
description: "Ce flow est lancé à la main par Thomas, deux ou trois fois par an (par exemple en janvier et en septembre). Il remplace les extraits d'avis et les notes affichés sur le site par les données actuelles de l'annonce Airbnb, puis publie la modification. Le site se met à jour tout seul via Netlify."
---

# Mettre à jour les avis et les notes du site Chez Belle (V3, site administrable)

Ce flow est lancé à la main par Thomas, deux ou trois fois par an (par exemple en janvier et en septembre). Il remplace les extraits d'avis et les notes affichés sur le site par les données actuelles de l'annonce Airbnb, puis publie la modification. Le site se met à jour tout seul via Netlify.

## Repères

- Annonce Airbnb : https://www.airbnb.fr/rooms/25931091 (section des commentaires des voyageurs et détail des notes).
- Dépôt GitHub : tithomme74/Chez-Belle, branche `main`.
- Depuis la refonte administrable, les avis et les notes vivent dans **un seul fichier de données** : `src/_data/avis.json`. Le site (accueil : ouverture, section avis, carrousel) est construit à partir de ce fichier par Eleventy. On ne modifie plus aucune page HTML.
- Ce fichier n'est **jamais modifié à la main** : on passe toujours par le script `node scripts/maj-avis.js <fichier>`, qui contrôle les données et refuse tout ce qui casserait le site.
- L'espace d'administration du site (`/admin/`) affiche ces avis en lecture seule, avec la date de dernière mise à jour ; il ne peut pas les modifier. La branche `brouillon` appartient à l'admin : ce flow n'y touche jamais.
- Site publié : https://chez-belle-pontaillac.netlify.app (ou le nom de domaine propre une fois acheté : lire `url` dans `src/_data/site.json`).
- Version anglaise : pas encore construite. Quand elle existera, ce skill sera mis à jour (notes avec un point, catégories en anglais).
- **Si `src/_data/avis.json` n'existe pas sur `main`**, la refonte administrable n'est pas encore en ligne : appliquer la méthode V2 décrite en fin de document, puis le signaler à Thomas.

## Étapes

1. **Lire les avis et les notes.** Ouvrir l'annonce Airbnb dans le navigateur disponible (navigateur intégré ou Claude in Chrome, en chargeant d'abord la skill du navigateur concerné) et afficher tous les commentaires. Relever pour chaque avis : prénom, mois et année, texte exact. Relever aussi la note globale, le nombre d'avis et les six notes par catégorie (propreté, précision, arrivée, communication, emplacement, qualité-prix). Si aucun navigateur n'est disponible ou si Airbnb bloque la page, demander à Thomas de coller ici le texte des avis et les notes ; ne jamais deviner.
2. **Choisir 6 avis**, dans cet ordre de priorité :
    - publiés dans les 24 derniers mois, du plus récent au plus ancien ;
    - note de 5 étoiles quand elle est visible ;
    - qui couvrent ensemble des sujets différents : le jardin et le calme, la proximité de la plage, la propreté et la conformité à l'annonce (les deux notes les plus faibles, à rassurer), l'accueil de Belle, les séjours avec enfants, les séjours avec un chien ;
    - un seul extrait par voyageur ;
    - éviter deux extraits qui disent la même chose.
3. **Tirer un extrait de chaque avis.**
    - Un extrait est un passage **continu** du texte original, recopié **mot pour mot**, fautes, ponctuation et espaces compris : aucune reformulation, correction, traduction, ni assemblage de deux passages.
    - Entre 15 et 45 mots ; il doit avoir un sens complet seul et ne jamais changer le sens de l'avis (pas d'extrait qui omet une réserve exprimée juste avant ou après).
    - Commencer de préférence au début d'une phrase. Si l'extrait commence au milieu d'une phrase, le recopier tel quel en commençant par sa minuscule : la page ajoute « … » automatiquement.
    - Un avis en langue étrangère est soit gardé tel quel, soit écarté.
    - Pas de caractère `<` ni `>` dans un extrait (le script le refuserait) : si l'avis en contient, choisir un autre passage.
4. **Faire valider.** Montrer à Thomas les 6 extraits retenus (prénom, date, extrait) et les nouvelles notes, en une courte liste, et attendre son accord avant de modifier le site. S'il en écarte un, proposer le suivant de la liste.
5. **Préparer les données.**
    - Cloner ou mettre à jour le dépôt (branche `main`), puis lancer `npm ci`.
    - Écrire les données validées dans un fichier temporaire **hors du dépôt** (par exemple `avis-nouveaux.json` dans le dossier temporaire), au format :
      ```json
      {
        "notes": {
          "globale": "4,82",
          "nombre": 33,
          "categories": [ { "nom": "Emplacement", "note": "4,9" }, { "nom": "Communication", "note": "4,9" } ]
        },
        "avis": [
          { "prenom": "Marie", "date": "août 2026", "extrait": "…" }
        ]
      }
      ```
    - Notes au format français, avec une virgule (« 4,82 »). Dans `categories`, garder les deux catégories les mieux notées, dans l'ordre décroissant (en cas d'égalité, préférer Emplacement puis Communication).
    - Dates en minuscules, mois en toutes lettres puis année (« août 2026 », « février 2027 »).
    - Prénom seul, jamais de nom de famille ni de photo. Exactement les 6 extraits validés, dans l'ordre d'affichage voulu.
6. **Appliquer avec le script** : `node scripts/maj-avis.js <fichier temporaire>`.
    - « ✓ … mis à jour » : continuer.
    - « = Aucun changement » : les avis sont déjà à jour ; le dire à Thomas et s'arrêter (rien à publier).
    - « ✗ … à corriger » : corriger les données signalées (sans jamais modifier le texte d'un extrait autrement qu'en choisissant un autre passage validé par Thomas), puis relancer.
7. **Vérifier.**
    - `npm test` : tout doit passer.
    - `npm run build`, puis servir le dossier `_site` en local (par exemple `python -m http.server 8080 --directory _site`) et ouvrir l'accueil dans le navigateur : la section des avis est visible, le carrousel affiche 6 cartes, la note de l'ouverture et celle de la section avis sont les nouvelles, et la console ne montre aucune erreur JavaScript.
    - `git status` ne doit montrer **que** `src/_data/avis.json` modifié.
8. **Publier.** Faire un commit du seul fichier `src/_data/avis.json` sur `main`, avec le message « Avis et notes Airbnb mis à jour (mois année) », puis pousser. Ne jamais pousser sur la branche `brouillon`. Si le dépôt refuse l'écriture, dire à Thomas de vérifier l'installation de l'application GitHub de Claude sur le dépôt Chez-Belle.
9. **Conclure** en une ou deux phrases : les 6 extraits publiés, la note affichée, et l'invitation à vérifier le site dans une à deux minutes (l'admin affichera aussi la nouvelle date de mise à jour).

## Règles

- N'afficher que des avis réels, publiés sur l'annonce, et des extraits recopiés à l'identique. Ne jamais inventer, compléter ou « améliorer » un avis.
- Ne pas afficher d'avis négatif ou mitigé, mais ne jamais présenter la sélection comme représentative : la page renvoie toujours vers tous les avis Airbnb.
- Les notes affichées sont toujours celles relevées le jour du flow, jamais arrondies à la hausse.
- Ne pas automatiser la lecture d'Airbnb en dehors de ce flow lancé à la main (pas de tâche planifiée, pas de script de collecte). Le script `scripts/maj-avis.js` ne collecte rien : il contrôle et enregistre les données relevées dans ce flow.
- Ne modifier que `src/_data/avis.json`, et seulement par le script. L'extrait fixe de la page « Le logement » (Clémence) est dans `src/_data/logement.json` : il se modifie dans l'admin, pas dans ce flow.

## Méthode V2 (seulement si `src/_data/avis.json` n'existe pas encore sur `main`)

Dans `index.html` (et `en/index.html` s'il existe), remplacer uniquement :
- le tableau `AVIS` entre `// DEBUT AVIS` et `// FIN AVIS` (entrées `{ "prenom": "Marie", "date": "août 2026", "extrait": "…" }`) ;
- l'objet `NOTES` entre `// DEBUT NOTES` et `// FIN NOTES` (`{ "globale": "4,82", "nombre": 33, "categories": [ … ] }`).

Échapper correctement guillemets et retours à la ligne, ne rien modifier d'autre, vérifier la page en local (6 cartes, nouvelles notes, aucune erreur de console), puis faire les étapes 8 et 9 en remplaçant le fichier publié par `index.html`. Signaler à Thomas que la refonte administrable n'est pas encore en ligne.
