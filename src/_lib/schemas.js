// Schémas des contenus (src/_data/*.json) : ils servent à valider ce que l'admin enregistre
// et, au lot 4, à construire automatiquement les formulaires de l'admin (libellés, aides, limites).
// Module sans dépendance : utilisable par le serveur (Node) comme par le navigateur.

// ---------- Briques ----------
const texte = (label, o = {}) => ({ type: "texte", label, max: 300, ...o });
const long = (label, o = {}) => texte(label, { max: 1200, lignes: 3, riche: true, ...o });
const nombre = (label, o = {}) => ({ type: "nombre", label, min: 0, max: 100000, entier: true, ...o });
const date = (label, o = {}) => ({ type: "date", label, ...o });
const booleen = (label, o = {}) => ({ type: "booleen", label, ...o });
const choix = (label, valeurs, o = {}) => ({ type: "choix", label, valeurs, ...o });
const lienUrl = (label, o = {}) => ({ type: "lien", label, ...o });
const liste = (label, de, o = {}) => ({ type: "liste", label, de, min: 0, max: 50, ...o });
const objet = (label, champs, o = {}) => ({ type: "objet", label, champs, ...o });
const photo = (label, o = {}) => ({ type: "photo", label, ...o });
const json = (label, o = {}) => ({ type: "json", label, avance: true, ...o });
const cle = (label, o = {}) => texte(label, { max: 30, motif: "^[a-z][a-z0-9_]*$", aide: "minuscules sans accent ni espace", ...o });

const seo = (avecOgDescription = true) => objet("Référencement (Google, partages)", {
  titre: texte("Titre de l’onglet du navigateur", { max: 90 }),
  description: texte("Description pour Google", { max: 320, lignes: 3 }),
  og_titre: texte("Titre lors d’un partage", { max: 120 }),
  ...(avecOgDescription ? { og_description: texte("Description lors d’un partage", { max: 320, lignes: 2, optionnel: true }) } : {})
}, { replie: true });

const bouton = objet("Bouton", {
  label: texte("Texte du bouton", { max: 60 }),
  lien: lienUrl("Lien"),
  style: choix("Apparence", [["", "Bouton plein"], ["line", "Bouton contour"], ["lien", "Simple lien"]])
});
const boutons = (label = "Boutons") => liste(label, bouton, { max: 3, titre: "label" });
const lienSimple = (label) => objet(label, { label: texte("Texte", { max: 80 }), lien: lienUrl("Lien") });
const photos = (label, o) => liste(label, photo("Photo"), { titre: "legende", ...o });

// ---------- Fichiers ----------
export const SCHEMAS = {
  site: objet("Commun à toutes les pages", {
    url: texte("Adresse du site", { max: 100, motif: "^https://[^\\s/]+$", avance: true }),
    nom: texte("Nom du site", { max: 40 }),
    email: objet("Adresse e-mail de contact (masquée aux robots)", {
      utilisateur: texte("Partie avant @", { max: 64, motif: "^[A-Za-z0-9._+-]+$" }),
      domaine: texte("Partie après @", { max: 64, motif: "^[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$" })
    }),
    airbnb: lienUrl("Annonce Airbnb"),
    menu: liste("Menu (onglets)", lienSimple("Onglet"), { min: 1, max: 6, titre: "label", avance: true }),
    bouton_reserver: lienSimple("Bouton « réserver » de l’en-tête"),
    pied: objet("Pied de page", {
      presentation: texte("Présentation", { max: 200 }),
      legal_titre: texte("Titre de la colonne légale", { max: 60 }),
      legal: liste("Mentions légales", texte("Ligne", { max: 200 }), { max: 8 }),
      liens_titre: texte("Titre de la colonne liens", { max: 60 }),
      liens: liste("Liens", lienSimple("Lien"), { max: 8, titre: "label" })
    }),
    barre: texte("Barre du bas (mobile)", { max: 160, riche: true, aide: "{prix_min} est remplacé par le prix le plus bas" })
  }),

  accueil: objet("Accueil", {
    seo: objet("Référencement (Google, partages)", { ...seo().champs, jsonld: json("Données structurées pour Google") }, { replie: true }),
    hero: objet("En-tête", {
      kicker: texte("Surtitre", { max: 80 }),
      titre: texte("Accroche", { max: 120, riche: true }),
      texte: long("Texte d’introduction"),
      boutons: boutons(),
      photo: photo("Photo principale")
    }),
    essentiel: objet("L’essentiel", {
      kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }),
      points: liste("Points clés", objet("Point", { titre: texte("Titre", { max: 60 }), texte: texte("Détail", { max: 160, riche: true }) }), { max: 9, titre: "titre" }),
      photos: photos("Aperçu photos", { min: 1, max: 3 }),
      bouton_photos: texte("Bouton vers la galerie", { max: 60, aide: "{nb_photos} = nombre de photos de la galerie" }),
      lien_suite: lienSimple("Lien vers le logement")
    }),
    zoom: objet("Zoom sur les prix", {
      kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }), texte: long("Texte"),
      cartes: liste("Cartes de prix", objet("Carte", {
        titre: texte("Titre", { max: 60 }), dates: texte("Dates ou sous-titre", { max: 120 }),
        types: liste("Périodes de prix concernées", texte("Période", { max: 30, ref: "tarifs.types" }), { min: 1, max: 6 }),
        unite: choix("Prix affiché", [["nuit", "à la nuit"], ["semaine", "à la semaine"]]),
        vedette: texte("Étiquette mise en avant (vide = aucune)", { max: 40, optionnel: true })
      }), { min: 1, max: 4, titre: "titre", aide: "Les prix et durées sont calculés à partir des tarifs" }),
      boutons: boutons()
    }),
    avis: objet("Section des avis (les avis eux-mêmes sont automatiques)", {
      kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }),
      mention: texte("Mention sous les avis", { max: 200 }), lien_tous: texte("Lien vers tous les avis", { max: 60 })
    }),
    suite: objet("Appel final", { kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }), texte: long("Texte"), boutons: boutons() })
  }),

  logement: objet("Le logement", {
    seo: seo(),
    entete: objet("En-tête", { kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }), texte: long("Texte") }),
    galerie: photos("Galerie photos", { min: 1, max: 30, aide: "Les 5 premières photos visibles forment la mosaïque ; les photos « masquées » ne s’ouvrent qu’en grand." }),
    bouton_photos: texte("Bouton « voir les photos »", { max: 60, aide: "{nb_photos} = nombre de photos" }),
    chiffres: liste("Chiffres clés", objet("Chiffre", { valeur: texte("Valeur", { max: 30 }), texte: texte("Détail", { max: 100, riche: true }) }), { max: 6, titre: "valeur" }),
    organisation: objet("Comment c’est organisé", {
      titre: texte("Titre", { max: 120, riche: true }),
      cartes: liste("Cartes", objet("Carte", { titre: texte("Titre", { max: 40 }), points: liste("Points", texte("Point", { max: 200, riche: true }), { max: 8 }) }), { max: 4, titre: "titre" }),
      option: texte("Option (caravane…)", { max: 300, riche: true, optionnel: true })
    }),
    equipements: objet("Équipements", {
      titre: texte("Titre", { max: 120, riche: true }),
      familles: liste("Familles", objet("Famille", { titre: texte("Titre", { max: 40 }), liste: liste("Équipements", texte("Équipement", { max: 80 }), { max: 20 }) }), { max: 8, titre: "titre" })
    }),
    bandeau: liste("Bandeau « compris » et règles", objet("Bloc", { kicker: texte("Surtitre", { max: 60 }), texte: texte("Texte", { max: 300, riche: true, lignes: 2 }) }), { max: 3, titre: "kicker" }),
    avis_fixe: objet("Avis affiché en bas de page", {
      texte: long("Extrait (vide = pas d’avis)", { riche: false, optionnel: true }), prenom: texte("Prénom", { max: 40, optionnel: true }),
      date: texte("Date", { max: 40, optionnel: true }), lien_autres: texte("Lien vers les autres avis", { max: 60 })
    }),
    boutons: boutons()
  }),

  tarifs: objet("Tarifs et calendrier", {
    annee: nombre("Année de la grille", { min: 2026, max: 2100 }),
    types: { type: "dictionnaire", label: "Périodes de prix", cle: cle("Code de la période"), de: objet("Période", {
      label: texte("Nom affiché dans l’estimation", { max: 60 }),
      prix: nombre("Prix par nuit (€)", { min: 1, max: 2000 }),
      min: nombre("Durée minimale (nuits)", { min: 1, max: 60 }),
      arrivees: liste("Dates d’arrivée imposées (semaine fixe, ex. Noël)", date("Arrivée"), { max: 10, optionnel: true })
    }), max: 20 },
    calendrier: liste("Calendrier : quelle période s’applique à chaque nuit", objet("Plage de dates", {
      du: date("Première nuit"), au: date("Dernière nuit (incluse)"), type: texte("Période", { max: 30, ref: "tarifs.types" })
    }), { min: 1, max: 60, titre: "du" }),
    grille: liste("Lignes de la grille affichée", objet("Ligne", {
      type: texte("Période de prix", { max: 30, ref: "tarifs.types" }),
      titre: texte("Titre", { max: 60 }), etiquette: texte("Étiquette (vide = aucune)", { max: 30, optionnel: true }),
      dates: texte("Dates affichées", { max: 160, riche: true }),
      style: choix("Mise en avant", [["", "Normale"], ["calme", "Plus calme"], ["peak", "Haute saison"]]),
      unite: choix("Prix affiché", [["nuit", "à la nuit"], ["semaine", "à la semaine"]])
    }), { min: 1, max: 15, titre: "titre" }),
    chien: objet("Supplément chien", {
      court: nombre("Montant pour un séjour court (€)", { max: 500 }), long: nombre("Montant au-delà (€)", { max: 500 }),
      seuil: nombre("Séjour court jusqu’à (nuits)", { min: 1, max: 60 })
    }),
    depot: nombre("Dépôt de garantie (€)", { max: 10000 }),
    formulaire: objet("Formulaire de demande", {
      arrivee_min: date("Arrivée au plus tôt"), arrivee_max: date("Arrivée au plus tard"),
      depart_min: date("Départ au plus tôt"), depart_max: date("Départ au plus tard"),
      voyageurs_max: nombre("Voyageurs maximum", { min: 1, max: 20 }), voyageurs_defaut: nombre("Voyageurs proposés par défaut", { min: 1, max: 20 }),
      enfants_max: nombre("Enfants maximum", { max: 20 })
    })
  }),

  reservation: objet("Tarifs et réservation (textes)", {
    seo: seo(false),
    entete: objet("En-tête", { kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }), texte: long("Texte"), boutons: boutons() }),
    grille: objet("Grille", { titre: texte("Titre", { max: 120, riche: true }), secret: texte("Phrase sous la grille", { max: 300, riche: true, optionnel: true }) }),
    compris: objet("Compris dans le prix", { titre: texte("Titre", { max: 80, riche: true }), liste: liste("Éléments", texte("Élément", { max: 200, riche: true }), { max: 12 }) }),
    en_plus: objet("En plus", { titre: texte("Titre", { max: 80, riche: true }), liste: liste("Éléments", texte("Élément", { max: 200, riche: true }), { max: 12 }), note: texte("Note", { max: 300, riche: true }) }),
    etapes: objet("Étapes de réservation", { titre: texte("Titre", { max: 80, riche: true }), liste: liste("Étapes", objet("Étape", { titre: texte("Titre", { max: 60 }), texte: texte("Texte", { max: 300, riche: true }) }), { max: 6, titre: "titre" }) }),
    formulaire: objet("Formulaire : libellés", Object.fromEntries([
      ["titre", "Titre"], ["arrivee", "Arrivée"], ["depart", "Départ"], ["voyageurs", "Voyageurs"], ["enfants", "Enfants"], ["chien", "Case chien"],
      ["nom", "Nom"], ["nom_exemple", "Exemple de nom"], ["contact", "Contact"], ["contact_exemple", "Exemple de contact"], ["message", "Message"],
      ["message_exemple", "Exemple de message"], ["bouton", "Bouton d’envoi"], ["estimation_titre", "Titre de l’estimation"], ["estimation_note", "Note sous l’estimation"],
      ["demande_titre", "Titre de la demande prête"], ["copier", "Bouton copier"], ["messagerie", "Bouton messagerie"], ["copiee", "Confirmation de copie"], ["ecrire", "Texte avant l’e-mail"]
    ].map(([k, l]) => [k, texte(l, { max: 200, riche: k === "estimation_note" })])), { replie: true }),
    mot_de_belle: objet("Mot de Belle", { texte: long("Texte (vide = masqué)", { optionnel: true }), signature: texte("Signature", { max: 40 }) }),
    faq: objet("Questions fréquentes", {
      titre: texte("Titre", { max: 80, riche: true }),
      questions: liste("Questions", objet("Question", { question: texte("Question", { max: 200 }), reponse: long("Réponse", { max: 2000 }) }), { max: 30, titre: "question" }),
      note: texte("Note sous les questions", { max: 300, riche: true, optionnel: true })
    })
  }),

  autour: objet("Autour", {
    seo: seo(false),
    entete: objet("En-tête", { kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }), texte: long("Texte") }),
    filtres: liste("Filtres par envie", objet("Filtre", {
      cle: cle("Code du filtre"), label: texte("Nom du bouton", { max: 40 }),
      conseil: texte("Phrase-conseil", { max: 400, riche: true, lignes: 2, optionnel: true }), encadre: booleen("Conseil en encadré (règle importante)")
    }), { max: 12, titre: "label" }),
    zones: liste("Colonnes (distances)", objet("Colonne", {
      cle: cle("Code"), titre: texte("Titre", { max: 40 }), sous_titre: texte("Sous-titre", { max: 60 }), vide: texte("Message si aucun lieu", { max: 100 })
    }), { min: 1, max: 3, titre: "titre", avance: true }),
    lieux: liste("Lieux", objet("Lieu", {
      zone: texte("Colonne", { max: 30, ref: "autour.zones" }), temps: texte("Temps", { max: 20 }), nom: texte("Nom", { max: 80 }),
      texte: texte("Description", { max: 200, riche: true }),
      filtres: liste("Filtres", texte("Filtre", { max: 30, ref: "autour.filtres" }), { max: 12 }),
      lien: objet("Lien (facultatif)", { label: texte("Texte", { max: 60, optionnel: true }), lien: lienUrl("Adresse", { optionnel: true }) }, { optionnel: true })
    }), { max: 60, titre: "nom" }),
    aussi: texte("Et aussi", { max: 300, riche: true, optionnel: true }),
    adresses: objet("Les belles adresses de Belle", { afficher: booleen("Afficher ce bloc"), titre: texte("Titre", { max: 60 }), texte: long("Texte", { optionnel: true }) }),
    appel: objet("Appel final", { kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }), texte: long("Texte"), boutons: boutons() })
  })
};

// Fichiers lisibles mais jamais modifiables par l'admin
export const LECTURE_SEULE = ["avis"];
export const FICHIERS = [...Object.keys(SCHEMAS), ...LECTURE_SEULE];

// ---------- Validation ----------
const LIEN_SUR = /^(https?:\/\/[^\s"<>]+|mailto:[^\s"<>]+|tel:[+0-9 ]+|#[\w-]*|\/(?!\/)[^\s"<>]*)$/i;
const CTRL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const dateValide = s => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z")) && new Date(s + "T00:00:00Z").toISOString().startsWith(s);

// Renvoie { valeur, erreurs } : la valeur ne garde que les champs prévus par le schéma.
export function valider(schema, v, chemin = "") {
  const erreurs = [];
  const err = (c, m) => erreurs.push({ chemin: c || "(racine)", message: m });
  const vide = x => x === undefined || x === null || x === "";

  function v1(s, x, c) {
    if (vide(x) && !(s.type === "choix" && s.valeurs.some(([k]) => k === x)) && s.type !== "booleen" && s.type !== "liste" && s.type !== "objet" && s.type !== "dictionnaire") {
      if (s.optionnel) return x === undefined ? undefined : (s.type === "nombre" ? null : "");
      err(c, `« ${s.label} » est obligatoire.`); return x;
    }
    switch (s.type) {
      case "texte": {
        if (typeof x !== "string") { err(c, `« ${s.label} » doit être un texte.`); return ""; }
        const t = x.replace(/\r\n/g, "\n");
        if (t.length > s.max) err(c, `« ${s.label} » dépasse ${s.max} caractères (${t.length}).`);
        if (CTRL.test(t)) err(c, `« ${s.label} » contient des caractères invisibles interdits.`);
        if (!s.lignes && t.includes("\n")) err(c, `« ${s.label} » doit tenir sur une ligne.`);
        if (s.motif && !new RegExp(s.motif).test(t)) err(c, `« ${s.label} » n’a pas le bon format${s.aide ? ` (${s.aide})` : ""}.`);
        return t;
      }
      case "nombre": {
        if (typeof x !== "number" || !isFinite(x)) { err(c, `« ${s.label} » doit être un nombre.`); return x; }
        if (s.entier && !Number.isInteger(x)) err(c, `« ${s.label} » doit être un nombre entier.`);
        if (x < s.min || x > s.max) err(c, `« ${s.label} » doit être entre ${s.min} et ${s.max}.`);
        return x;
      }
      case "date": if (typeof x !== "string" || !dateValide(x)) err(c, `« ${s.label} » doit être une date valide (AAAA-MM-JJ).`); return x;
      case "booleen": if (x !== undefined && typeof x !== "boolean") err(c, `« ${s.label} » doit être oui ou non.`); return x === true;
      case "choix": if (!s.valeurs.some(([k]) => k === x)) err(c, `« ${s.label} » : valeur non prévue.`); return x;
      case "lien":
        if (typeof x !== "string" || x.length > 500 || !LIEN_SUR.test(x)) err(c, `« ${s.label} » : lien non valide (https://…, /page/, #ancre, mailto: ou tel:).`);
        return x;
      case "json": {
        let t; try { t = JSON.stringify(x); } catch { t = null; }
        if (!x || typeof x !== "object" || t === null) err(c, `« ${s.label} » doit être un objet.`);
        else if (t.length > 20000) err(c, `« ${s.label} » est trop volumineux.`);
        return x;
      }
      case "photo": {
        if (!x || typeof x !== "object") { err(c, `« ${s.label} » est manquante.`); return x; }
        const chemin = p => typeof p === "string" && /^\/photos\/[A-Za-z0-9._-]+\.(webp|jpe?g|png)$/.test(p);
        const r = {};
        if (!chemin(x.src)) err(c + ".src", "Photo : fichier non valide."); r.src = x.src;
        if (x.srcset !== undefined) {
          if (!Array.isArray(x.srcset) || x.srcset.length > 6 || !x.srcset.every(e => Array.isArray(e) && e.length === 2 && chemin(e[0]) && Number.isInteger(e[1]) && e[1] > 0 && e[1] < 10000))
            err(c + ".srcset", "Photo : variantes non valides.");
          r.srcset = x.srcset;
        }
        for (const k of ["largeur", "hauteur"]) { if (!Number.isInteger(x[k]) || x[k] < 1 || x[k] > 10000) err(c + "." + k, `Photo : ${k} non valide.`); r[k] = x[k]; }
        r.alt = v1(texte("Description de la photo (pour les malvoyants et Google)", { max: 200 }), x.alt, c + ".alt");
        if (x.legende !== undefined) r.legende = v1(texte("Légende", { max: 60, optionnel: true }), x.legende, c + ".legende");
        if (x.forme !== undefined) { if (!["big", "tall", "normale"].includes(x.forme)) err(c + ".forme", "Photo : forme non prévue."); r.forme = x.forme; }
        if (x.masquee !== undefined) r.masquee = x.masquee === true;
        return r;
      }
      case "liste": {
        if (x === undefined && s.optionnel) return undefined;
        if (!Array.isArray(x)) { err(c, `« ${s.label} » doit être une liste.`); return []; }
        if (x.length < s.min) err(c, `« ${s.label} » : au moins ${s.min} élément(s).`);
        if (x.length > s.max) err(c, `« ${s.label} » : au plus ${s.max} éléments.`);
        return x.slice(0, s.max).map((e, i) => v1(s.de, e, `${c}[${i}]`));
      }
      case "dictionnaire": {
        if (!x || typeof x !== "object" || Array.isArray(x)) { err(c, `« ${s.label} » doit être un ensemble.`); return {}; }
        const cles = Object.keys(x);
        if (cles.length < 1) err(c, `« ${s.label} » : au moins un élément.`);
        if (cles.length > s.max) err(c, `« ${s.label} » : au plus ${s.max} éléments.`);
        const r = {};
        for (const k of cles) { v1(s.cle, k, `${c}.${k}`); r[k] = v1(s.de, x[k], `${c}.${k}`); }
        return r;
      }
      case "objet": {
        if (x === undefined && s.optionnel) return undefined;
        if (!x || typeof x !== "object" || Array.isArray(x)) { err(c, `« ${s.label} » est manquant.`); return {}; }
        const r = {};
        for (const [k, sc] of Object.entries(s.champs)) {
          const val = v1(sc, x[k], c ? `${c}.${k}` : k);
          if (val !== undefined) r[k] = val;
        }
        return r;
      }
      default: err(c, "Type inconnu."); return x;
    }
  }
  const valeur = v1(schema, v, chemin);
  return { valeur, erreurs };
}

// Contrôles de cohérence entre champs et entre fichiers. tous = { tarifs, autour, … } (valeurs actuelles).
export function coherence(nom, d, tous = {}) {
  const e = [];
  const err = (c, m) => e.push({ chemin: c, message: m });
  const types = nom === "tarifs" ? d.types : (tous.tarifs || {}).types || {};
  if (nom === "tarifs") {
    const tri = [...d.calendrier].map((p, i) => ({ ...p, i })).sort((a, b) => a.du.localeCompare(b.du));
    tri.forEach((p, k) => {
      if (!types[p.type]) err(`calendrier[${p.i}].type`, `Période « ${p.type} » inconnue.`);
      if (p.au < p.du) err(`calendrier[${p.i}]`, `La plage du ${p.du} finit avant de commencer.`);
      if (k > 0 && p.du <= tri[k - 1].au) err(`calendrier[${p.i}]`, `La plage du ${p.du} chevauche celle du ${tri[k - 1].du}.`);
    });
    d.grille.forEach((g, i) => { if (!types[g.type]) err(`grille[${i}].type`, `Période « ${g.type} » inconnue.`); });
    for (const [k, t] of Object.entries(d.types)) (t.arrivees || []).forEach((a, i) => { if (!d.calendrier.some(p => p.type === k && p.du <= a && a <= p.au)) err(`types.${k}.arrivees[${i}]`, `L’arrivée du ${a} n’est pas dans une plage « ${k} » du calendrier.`); });
    const f = d.formulaire;
    if (f.arrivee_max < f.arrivee_min) err("formulaire.arrivee_max", "L’arrivée au plus tard précède l’arrivée au plus tôt.");
    if (f.depart_max < f.depart_min) err("formulaire.depart_max", "Le départ au plus tard précède le départ au plus tôt.");
    if (f.voyageurs_defaut > f.voyageurs_max) err("formulaire.voyageurs_defaut", "Plus de voyageurs par défaut que le maximum.");
    if (tous.accueil) tous.accueil.zoom.cartes.forEach((c, i) => c.types.forEach(t => { if (!types[t]) err("types", `La carte « ${c.titre} » de l’accueil utilise la période « ${t} » : ne la supprimez pas, ou modifiez d’abord l’accueil.`); }));
  }
  if (nom === "accueil") d.zoom.cartes.forEach((c, i) => c.types.forEach((t, j) => { if (!types[t]) err(`zoom.cartes[${i}].types[${j}]`, `Période « ${t} » inconnue dans les tarifs.`); }));
  if (nom === "autour") {
    const zones = new Set(d.zones.map(z => z.cle)), filtres = new Set(d.filtres.map(f => f.cle));
    if (zones.size !== d.zones.length) err("zones", "Deux colonnes ont le même code.");
    if (filtres.size !== d.filtres.length) err("filtres", "Deux filtres ont le même code.");
    if (filtres.has("tout")) err("filtres", "Le code « tout » est réservé.");
    d.lieux.forEach((l, i) => {
      if (!zones.has(l.zone)) err(`lieux[${i}].zone`, `Colonne « ${l.zone} » inconnue.`);
      l.filtres.forEach((f, j) => { if (!filtres.has(f)) err(`lieux[${i}].filtres[${j}]`, `Filtre « ${f} » inconnu.`); });
    });
  }
  return e;
}
