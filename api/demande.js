// Demande de dates envoyée depuis la page Tarifs : transmise à Belle par e-mail (service Resend).
//   POST /api/demande  { nom, contact, texte, site_web }  → { envoyee: true }
// Sans configuration (RESEND_API_KEY et DEMANDE_EMAIL), répond 503 avec repli: true : la page propose alors
// de copier la demande ou d'ouvrir la messagerie, comme avant.
// Variables (Cloudflare → Settings → Variables and Secrets) :
//   RESEND_API_KEY        clé de l'API Resend  [secret]
//   DEMANDE_EMAIL         adresse qui reçoit les demandes (celle du compte Resend tant qu'il n'y a pas de nom de domaine)
//   DEMANDE_EXPEDITEUR    facultatif, ex. « Chez Belle <demandes@chezbelle-pontaillac.fr> » une fois le domaine vérifié
const MAX_PAR_HEURE = 5;
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i;

export function demandeConfiguree(env) {
  return Boolean(env.RESEND_API_KEY && EMAIL.test(env.DEMANDE_EMAIL || ""));
}

const nettoyer = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

// corps déjà lu (JSON) ; deps = { env, memoire, ip, envoyer } ; renvoie [statut, réponse]
export async function traiterDemande(corps, { env, memoire, ip, envoyer = (...a) => fetch(...a) }) {
  if (!demandeConfiguree(env)) return [503, { erreur: "Envoi direct indisponible.", repli: true }];
  // Champ piège invisible : rempli seulement par les robots. On fait comme si tout allait bien.
  if (nettoyer(corps.site_web, 200)) return [200, { envoyee: true }];

  const nom = nettoyer(corps.nom, 100);
  const contact = nettoyer(corps.contact, 200).replace(/[\r\n]+/g, " ");
  const texte = nettoyer(corps.texte, 4000);
  if (!contact) return [400, { erreur: "Indiquez votre e-mail ou votre téléphone." }];
  if (texte.length < 20) return [400, { erreur: "Demande incomplète." }];

  const cle = `demande:${ip}`;
  const deja = (await memoire.lire(cle)) || { n: 0, depuis: Date.now() };
  if (Date.now() - deja.depuis > 3600e3) { deja.n = 0; deja.depuis = Date.now(); }
  if (deja.n >= MAX_PAR_HEURE) return [429, { erreur: "Trop de demandes envoyées. Réessayez plus tard ou écrivez directement à Belle.", repli: true }];
  deja.n++;
  await memoire.ecrire(cle, deja);

  const message = {
    from: env.DEMANDE_EXPEDITEUR || "Site Chez Belle <onboarding@resend.dev>",
    to: [env.DEMANDE_EMAIL],
    subject: `Demande de séjour${nom ? " de " + nom : ""}`,
    text: `${texte}\n\n—\nEnvoyé depuis le formulaire du site Chez Belle.${EMAIL.test(contact) ? "\nPour répondre : touchez simplement « Répondre »." : "\nCoordonnées indiquées : " + contact}`,
    ...(EMAIL.test(contact) ? { reply_to: contact } : {})
  };
  let r;
  try {
    r = await envoyer("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(message)
    });
  } catch { r = null; }
  if (!r || !r.ok) {
    console.error("[demande] envoi refusé", r && r.status);
    return [502, { erreur: "L’envoi n’a pas fonctionné.", repli: true }];
  }
  return [200, { envoyee: true }];
}
