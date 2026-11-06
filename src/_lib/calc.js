// Valeurs calculées : rien n'est saisi deux fois.
//   tarifs.json  : une ligne par période (nom, plages de dates arrivée → départ, prix par nuit, minimum, options)
//   maison.json  : la fiche « Ce qui est compris » (services, horaires, capacité, dépôt, chien…)
//   accueil.json : les cartes « Zoom sur les prix » choisissent des lignes de prix
// Module sans dépendance Node : utilisé par Eleventy et par l'admin (navigateur).
import { nombre } from "./contenu.js";

const JOUR = 86400000;
const t0 = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const iso = t => new Date(t).toISOString().slice(0, 10);
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const jour = s => { const d = new Date(t0(s)); const j = d.getUTCDate(); return j === 1 ? "1er" : String(j); };
const mois = s => MOIS[new Date(t0(s)).getUTCMonth()];

// « 6 – 9 mai », « 21 juin – 7 juillet », « 1er mai » (une seule nuit) ; plusieurs plages séparées par « · »
export function datesEnClair(plages) {
  return (plages || []).filter(p => p.du && p.au).map(({ du, au }) => {
    const nuits = Math.round((t0(au) - t0(du)) / JOUR);
    if (nuits <= 1) return `${jour(du)} ${mois(du)}`;
    return mois(du) === mois(au) ? `${jour(du)} – ${jour(au)} ${mois(au)}` : `${jour(du)} ${mois(du)} – ${jour(au)} ${mois(au)}`;
  }).join(" · ");
}

// Pour chaque nuit, la période qui s'applique : la plage la plus courte qui la contient
// (les ponts de mai l'emportent ainsi sur « Mai et juin »). Renvoie des plages contiguës { du, au (dernière nuit), type }.
export function calendrier(lignes) {
  const plages = [];
  lignes.forEach(l => (l.dates || []).forEach(p => { if (p.du && p.au && t0(p.au) > t0(p.du)) plages.push({ id: l.id, a: t0(p.du), b: t0(p.au), duree: t0(p.au) - t0(p.du) }); }));
  if (!plages.length) return [];
  const debut = Math.min(...plages.map(p => p.a)), fin = Math.max(...plages.map(p => p.b));
  const res = [];
  for (let t = debut; t < fin; t += JOUR) {
    const candidates = plages.filter(p => p.a <= t && t < p.b).sort((x, y) => x.duree - y.duree);
    const id = candidates.length ? candidates[0].id : null;
    const dernier = res.at(-1);
    if (dernier && dernier.type === id && t0(dernier.au) + JOUR === t) dernier.au = iso(t);
    else if (id) res.push({ du: iso(t), au: iso(t), type: id });
  }
  return res;
}

export function calculer(tarifs, accueil, maison) {
  const lignes = [...((tarifs && tarifs.lignes) || [])].filter(l => l && typeof l === "object");
  const types = Object.fromEntries(lignes.map(l => [l.id, {
    label: l.nom, prix: l.prix, min: l.min,
    ...(l.semaine_fixe ? { arrivees: (l.dates || []).map(p => p.du) } : {})
  }]));
  const prix = lignes.map(l => l.prix).filter(p => typeof p === "number");
  const prixMin = prix.length ? Math.min(...prix) : 0;
  const toutes = lignes.flatMap(l => l.dates || []).filter(p => p.du && p.au);
  const premier = toutes.length ? toutes.map(p => p.du).sort()[0] : null;
  const dernier = toutes.length ? toutes.map(p => p.au).sort().at(-1) : null;
  const annee = premier ? Number(premier.slice(0, 4)) : new Date().getFullYear();

  // Grille de la page Tarifs
  const grille = lignes.map(l => ({
    titre: l.nom, etiquette: l.etiquette, style: l.mise_en_avant,
    dates: l.dates_texte || datesEnClair(l.dates),
    prix: nombre(l.prix_semaine ? l.prix * 7 : l.prix) + " €",
    unite: l.prix_semaine ? `la semaine, soit ${nombre(l.prix)} € la nuit` : "la nuit",
    sejour: l.semaine_fixe ? `${l.min} nuits` : `${l.min} nuits minimum`
  }));

  // Cartes « Zoom sur les prix » de l'accueil : fourchette de prix et durées minimales des lignes choisies
  const zoom = ((accueil && accueil.zoom && accueil.zoom.cartes) || []).map(c => {
    const ls = (c.types || []).map(id => types[id]).filter(Boolean);
    const semaine = c.unite === "semaine";
    const p = [...new Set(ls.map(x => semaine ? x.prix * 7 : x.prix))].sort((a, b) => a - b);
    const mins = [...new Set(ls.map(x => x.min))].sort((a, b) => a - b);
    return {
      ...c,
      prix: p.length ? (p.length > 1 ? `${nombre(p[0])} à ${nombre(p.at(-1))}` : nombre(p[0])) + " €" : "",
      unite: semaine ? "la semaine" : "la nuit",
      sejour: mins.length ? `${mins.join(" ou ")} nuits minimum` : ""
    };
  });

  // Bornes du formulaire de demande
  const capacite = (maison && maison.capacite) || 4;
  const formulaire = premier ? {
    arrivee_min: premier, arrivee_max: iso(t0(dernier) - JOUR), depart_min: iso(t0(premier) + JOUR), depart_max: dernier,
    voyageurs_max: capacite, voyageurs_defaut: Math.min(2, capacite), enfants_max: Math.max(0, capacite - 1)
  } : null;

  // Services de la fiche : « Compris dans le prix » et « En plus, selon votre séjour »
  const services = [...((maison && maison.services) || [])].filter(Boolean);
  const compris = services.filter(s => s.statut === "compris").map(s => s.precision ? `${s.nom} : ${s.precision}` : s.nom);
  const enPlus = services.filter(s => s.statut === "en_plus" || s.statut === "sur_demande")
    .map(s => `${s.nom} : ${s.precision || (s.statut === "sur_demande" ? "gratuit, sur demande" : "en supplément")}`);

  return { prixMin, annee, types, calendrier: calendrier(lignes), grille, zoom, formulaire, compris, enPlus };
}
