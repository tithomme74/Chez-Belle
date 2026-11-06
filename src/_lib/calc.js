// Valeurs calculées à partir des tarifs (tarifs.json) et des cartes de l'accueil : rien n'est saisi deux fois.
import { nombre } from "./contenu.js";

export function calculer(t, accueil) {
  const prixMin = Math.min(...Object.values(t.types).map(x => x.prix));

  // Grille de la page Tarifs : prix et durée lus dans le type de période
  const grille = t.grille.map(l => {
    const ty = t.types[l.type];
    const semaine = l.unite === "semaine";
    return {
      ...l,
      prix: nombre(semaine ? ty.prix * 7 : ty.prix) + " €",
      unite: semaine ? `la semaine, soit ${nombre(ty.prix)} € la nuit` : "la nuit",
      sejour: ty.arrivees ? `${ty.min} nuits` : `${ty.min} nuits minimum`
    };
  });

  // Cartes « Zoom sur les prix » de l'accueil : fourchette de prix et durées minimales des types choisis
  const zoom = accueil.zoom.cartes.map(c => {
    const tys = c.types.map(k => t.types[k]);
    const semaine = c.unite === "semaine";
    const prix = [...new Set(tys.map(x => semaine ? x.prix * 7 : x.prix))].sort((a, b) => a - b);
    const mins = [...new Set(tys.map(x => x.min))].sort((a, b) => a - b);
    return {
      ...c,
      prix: (prix.length > 1 ? `${nombre(prix[0])} à ${nombre(prix.at(-1))}` : nombre(prix[0])) + " €",
      unite: semaine ? "la semaine" : "la nuit",
      sejour: `${mins.join(" ou ")} nuits minimum`
    };
  });

  return { prixMin, grille, zoom };
}
