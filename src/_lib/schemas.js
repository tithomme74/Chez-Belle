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
}, { avance: true });

const bouton = objet("Bouton", {
  label: texte("Texte du bouton", { max: 60 }),
  lien: lienUrl("Lien", { avance: true }),
  style: choix("Apparence", [["", "Bouton plein"], ["line", "Bouton contour"], ["lien", "Simple lien"]], { avance: true })
});
const boutons = (label = "Boutons") => liste(label, bouton, { max: 3, titre: "label" });
const lienSimple = (label) => objet(label, { label: texte("Texte", { max: 80 }), lien: lienUrl("Lien", { avance: true }) });
const photos = (label, o) => liste(label, photo("Photo"), { titre: "legende", ...o });
const minutes = label => nombre(label, { min: 0, max: 600 });

// ---------- Fichiers ----------
export const SCHEMAS = {
  site: objet("Commun à toutes les pages", {
    url: texte("Adresse du site", { max: 100, motif: "^https://[^\\s/]+$", avance: true }),
    nom: texte("Nom du site", { max: 40 }),
    email: objet("Adresse e-mail de contact (masquée aux robots)", {
      utilisateur: texte("Partie avant @", { max: 64, motif: "^[A-Za-z0-9._+-]+$" }),
      domaine: texte("Partie après @", { max: 64, motif: "^[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$" })
    }),
    airbnb: lienUrl("Adresse de l’annonce Airbnb"),
    menu: liste("Menu (onglets)", lienSimple("Onglet"), { min: 1, max: 6, titre: "label", avance: true }),
    bouton_reserver: lienSimple("Bouton « réserver » de l’en-tête"),
    pied: objet("Pied de page", {
      presentation: texte("Présentation", { max: 200 }),
      legal_titre: texte("Titre de la colonne légale", { max: 60 }),
      legal: liste("Mentions légales", texte("Ligne", { max: 200 }), { max: 8 }),
      liens_titre: texte("Titre de la colonne liens", { max: 60 }),
      liens: liste("Liens", lienSimple("Lien"), { max: 8, titre: "label" })
    }),
    barre: texte("Barre du bas (mobile)", { max: 160, riche: true, lignes: 2, aide: "{prix_min} est remplacé par le prix le plus bas" })
  }),

  accueil: objet("Accueil", {
    seo: objet("Référencement (Google, partages)", { ...seo().champs, jsonld: json("Données structurées pour Google") }, { avance: true }),
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
        types: liste("Périodes de prix concernées", texte("Période", { max: 30, ref: "tarifs.lignes" }), { min: 1, max: 6 }),
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

  tarifs: objet("Mes prix", {
    lignes: liste("Périodes", objet("Période", {
      id: texte("Identifiant interne", { max: 40, motif: "^[a-z0-9-]+$", cache: true }),
      nom: texte("Période", { max: 40 }),
      dates: liste("Dates (arrivée → départ)", objet("Dates", { du: date("Arrivée"), au: date("Départ") }), { min: 1, max: 8 }),
      prix: nombre("Prix par nuit (€)", { min: 1, max: 2000 }),
      min: nombre("Minimum (nuits)", { min: 1, max: 60 }),
      semaine_fixe: booleen("Semaine fixe : arrivée seulement le premier jour de chaque plage (ex. Noël)"),
      prix_semaine: booleen("Afficher le prix à la semaine"),
      mise_en_avant: choix("Mise en avant dans la grille", [["", "Aucune"], ["calme", "Période calme"], ["peak", "Haute saison"]]),
      etiquette: texte("Petite étiquette (ex. « plus calme »)", { max: 30, optionnel: true }),
      dates_texte: texte("Dates écrites dans la grille (vide = automatique)", { max: 160, riche: true, optionnel: true })
    }), { min: 1, max: 15, titre: "nom" })
  }),

  maison: objet("Ce qui est compris", {
    compris: texte("En quelques mots, ce qui est compris", { max: 80, aide: "repris sur tout le site, ex. « linge et ménage compris »" }),
    capacite: nombre("Nombre de voyageurs au maximum", { min: 1, max: 20 }),
    surface: nombre("Surface du logement (m²)", { min: 1, max: 1000 }),
    jardin: nombre("Surface du jardin (m²)", { min: 0, max: 100000 }),
    arrivee: texte("Arrivée à partir de", { max: 10, motif: "^[0-9]{1,2} h( [0-9]{2})?$", aide: "ex. 16 h" }),
    depart: texte("Départ avant", { max: 10, motif: "^[0-9]{1,2} h( [0-9]{2})?$", aide: "ex. 10 h" }),
    distances: objet("À pied depuis la maison", { conche: minutes("Minutes jusqu’à la conche"), plage: minutes("Minutes jusqu’à la plage de Pontaillac") }),
    depot: nombre("Dépôt de garantie (€)", { max: 10000 }),
    chien: objet("Chien", {
      court: nombre("Prix pour un séjour court (€)", { max: 500 }), long: nombre("Prix au-delà (€)", { max: 500 }),
      seuil: nombre("Séjour court jusqu’à (nuits)", { min: 1, max: 60 })
    }),
    services: liste("Services", objet("Service", {
      nom: texte("Service", { max: 120 }),
      statut: choix("Statut", [["compris", "Compris"], ["sur_demande", "Sur demande"], ["en_plus", "En plus"], ["non", "Non proposé"]]),
      precision: texte("Précision (ex. « gratuits, sur demande »)", { max: 160, optionnel: true })
    }), { max: 30, titre: "nom" })
  }),

  reservation: objet("Tarifs et réservation (textes)", {
    seo: seo(false),
    entete: objet("En-tête", { kicker: texte("Surtitre", { max: 80 }), titre: texte("Titre", { max: 120, riche: true }), texte: long("Texte"), boutons: boutons() }),
    grille: objet("Grille", { titre: texte("Titre", { max: 120, riche: true }), secret: texte("Phrase sous la grille", { max: 300, riche: true, optionnel: true }) }),
    compris: objet("Compris dans le prix (la liste vient de « Ce qui est compris »)", { titre: texte("Titre", { max: 80, riche: true }) }),
    en_plus: objet("En plus (la liste vient de « Ce qui est compris »)", { titre: texte("Titre", { max: 80, riche: true }), note: texte("Note sous la liste", { max: 300, riche: true }) }),
    etapes: objet("Étapes de réservation", { titre: texte("Titre", { max: 80, riche: true }), liste: liste("Étapes", objet("Étape", { titre: texte("Titre", { max: 60 }), texte: texte("Texte", { max: 300, riche: true }) }), { max: 6, titre: "titre" }) }),
    formulaire: objet("Formulaire : libellés", Object.fromEntries([
      ["titre", "Titre"], ["arrivee", "Arrivée"], ["depart", "Départ"], ["voyageurs", "Voyageurs"], ["enfants", "Enfants"], ["chien", "Case chien"],
      ["nom", "Nom"], ["nom_exemple", "Exemple de nom"], ["contact", "Contact"], ["contact_exemple", "Exemple de contact"], ["message", "Message"],
      ["message_exemple", "Exemple de message"], ["bouton", "Bouton d’envoi"], ["estimation_titre", "Titre de l’estimation"], ["estimation_note", "Note sous l’estimation"],
      ["demande_titre", "Titre de la demande prête"], ["copier", "Bouton copier"], ["messagerie", "Bouton messagerie"], ["copiee", "Confirmation de copie"], ["ecrire", "Texte avant l’e-mail"]
    ].map(([k, l]) => [k, texte(l, { max: 200, riche: k === "estimation_note" })])), { avance: true }),
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
// Ordre de lecture pour les contrôles de cohérence entre fichiers
export const LIES = ["tarifs", "accueil", "autour", "maison"];
export const FICHIERS = [...Object.keys(SCHEMAS), ...LECTURE_SEULE];

// ---------- Validation ----------
const LIEN_SUR = /^(https?:\/\/[^\s"<>\\]+|mailto:[^\s"<>\\]+|tel:[+0-9 ]+|#[\w-]*|\/(?![\/\\])[^\s"<>\\]*)$/i;
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
  const lignesPrix = nom === "tarifs" ? d.lignes : ((tous.tarifs || {}).lignes || []);
  const idsPrix = new Set(lignesPrix.map(l => l.id));
  if (nom === "tarifs") {
    if (idsPrix.size !== d.lignes.length) err("lignes", "Deux périodes ont le même identifiant interne.");
    const plages = [];
    d.lignes.forEach((l, i) => l.dates.forEach((p, k) => {
      if (p.au <= p.du) err(`lignes[${i}].dates[${k}]`, `« ${l.nom} » : le départ doit être après l’arrivée.`);
      else plages.push({ i, k, nom: l.nom, du: p.du, au: p.au, duree: Date.parse(p.au) - Date.parse(p.du) });
      if (l.semaine_fixe && p.au > p.du && Math.round((Date.parse(p.au) - Date.parse(p.du)) / 864e5) !== l.min)
        err(`lignes[${i}].dates[${k}]`, `« ${l.nom} » : en semaine fixe, chaque plage doit durer exactement ${l.min} nuits.`);
    }));
    // Deux plages qui se chevauchent : la plus courte l'emporte ; à durée égale, c'est ambigu
    for (let a = 0; a < plages.length; a++) for (let b = a + 1; b < plages.length; b++) {
      const x = plages[a], y = plages[b];
      if (x.du < y.au && y.du < x.au && x.duree === y.duree && x.i !== y.i)
        err(`lignes[${y.i}].dates[${y.k}]`, `« ${y.nom} » et « ${x.nom} » ont les mêmes dates : impossible de savoir quel prix appliquer.`);
    }
    if (tous.accueil) tous.accueil.zoom.cartes.forEach(c => c.types.forEach(t => { if (!idsPrix.has(t)) err("lignes", `La carte « ${c.titre} » de l’accueil utilise une période supprimée : modifiez d’abord l’encadré prix de l’accueil.`); }));
  }
  if (nom === "accueil") d.zoom.cartes.forEach((c, i) => c.types.forEach((t, j) => { if (!idsPrix.has(t)) err(`zoom.cartes[${i}].types[${j}]`, `Période « ${t} » inconnue dans les prix.`); }));
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

// Avis et notes Airbnb : jamais modifiables dans l'admin, mais validés quand le flow « maj-avis-chez-belle »
// les remplace (scripts/maj-avis.js), pour qu'un avis mal recopié ne casse pas le site.
const sansBalise = "^[^<>]*$";
export const SCHEMA_AVIS = objet("Avis et notes Airbnb", {
  _info: texte("Note", { max: 200, optionnel: true }),
  mis_a_jour: date("Dernière mise à jour", { optionnel: true }),
  notes: objet("Notes", {
    globale: texte("Note globale", { max: 4, motif: "^[0-5],[0-9]{1,2}$", aide: "ex. 4,82" }),
    nombre: nombre("Nombre d’avis publiés", { min: 1, max: 10000 }),
    categories: liste("Notes par catégorie", objet("Catégorie", {
      nom: texte("Catégorie", { max: 40, motif: sansBalise }),
      note: texte("Note", { max: 4, motif: "^[0-5](,[0-9]{1,2})?$" })
    }), { max: 6 })
  }),
  avis: liste("Extraits d’avis", objet("Avis", {
    prenom: texte("Prénom", { max: 40, motif: sansBalise }),
    date: texte("Mois et année", { max: 30, motif: "^[a-zéû]+ [0-9]{4}$", aide: "ex. août 2025" }),
    extrait: texte("Extrait recopié mot pour mot", { max: 600, motif: sansBalise })
  }), { min: 1, max: 12 })
});
