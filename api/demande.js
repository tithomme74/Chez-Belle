// Demande de dates envoyée depuis la page Tarifs : transmise à Belle par e-mail (Brevo), avec un accusé de réception
// au voyageur s'il a donné une adresse e-mail.
//   GET  /api/demande                                    → { disponible } : la page n'affiche « Envoyer à Belle » que si true
//   POST /api/demande  { nom, contact, texte, site_web }  → { envoyee: true }
// Sans configuration, répond 503 avec repli: true : la page garde « Copier » / « Ouvrir ma messagerie ».
// Variables (Cloudflare → Settings → Variables and Secrets, environnement Production) :
//   BREVO_CLE_API      clé API Brevo (SMTP & API → Clés API ; commence par xkeysib-)  [secret]
//                      (BREVO_API_KEY est aussi accepté)
//   DEMANDE_EMAIL      adresse qui reçoit les demandes, et expéditrice des e-mails : doit être vérifiée dans Brevo
//                      (l'adresse du compte Brevo l'est d'office)
//   DEMANDE_NOM        facultatif, nom de l'expéditeur (défaut « Chez Belle »)
const MAX_PAR_HEURE = 5;      // par adresse IP
const MAX_PAR_JOUR = 40;      // pour tout le site : protège le quota gratuit Brevo (300 e-mails/jour) en cas d'abus
const EMAIL = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,}$/i;

// Valeurs saisies à la main dans Cloudflare : on tolère espaces et guillemets autour
const propre = v => String(v || "").trim().replace(/^["'<]+|["'>]+$/g, "").trim();
const cleBrevo = env => propre(env.BREVO_CLE_API || env.BREVO_API_KEY);
const emailBelle = env => propre(env.DEMANDE_EMAIL);
export function demandeConfiguree(env) {
  return Boolean(cleBrevo(env) && EMAIL.test(emailBelle(env)));
}
// Ce qui manque, pour aider à régler Cloudflare (noms seulement, jamais les valeurs)
export function diagnosticDemande(env) {
  const manque = [];
  if (!cleBrevo(env)) manque.push(env.RESEND_API_KEY ? "BREVO_CLE_API (une ancienne RESEND_API_KEY est présente : à remplacer)" : "BREVO_CLE_API");
  if (!env.DEMANDE_EMAIL) manque.push("DEMANDE_EMAIL");
  else if (!EMAIL.test(emailBelle(env))) manque.push("DEMANDE_EMAIL (adresse e-mail non reconnue)");
  return manque;
}

const nettoyer = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

async function compter(memoire, cle, max, duree) {
  const c = (await memoire.lire(cle)) || { n: 0, depuis: Date.now() };
  if (Date.now() - c.depuis > duree) { c.n = 0; c.depuis = Date.now(); }
  if (c.n >= max) return false;
  c.n++;
  await memoire.ecrire(cle, c);
  return true;
}

// corps déjà lu (JSON) ; deps = { env, memoire, ip, envoyer } ; renvoie [statut, réponse]
export async function traiterDemande(corps, { env, memoire, ip, envoyer = (...a) => fetch(...a) }) {
  if (!demandeConfiguree(env)) return [503, { erreur: "Envoi direct indisponible.", repli: true }];
  // Champ piège invisible : rempli seulement par les robots. On fait comme si tout allait bien.
  if (nettoyer(corps.site_web, 200)) return [200, { envoyee: true }];

  const nom = nettoyer(corps.nom, 100).replace(/[\r\n]+/g, " ");
  const contact = nettoyer(corps.contact, 200).replace(/[\r\n]+/g, " ");
  const texte = nettoyer(corps.texte, 4000);
  if (!contact) return [400, { erreur: "Indiquez votre e-mail ou votre téléphone." }];
  if (texte.length < 20) return [400, { erreur: "Demande incomplète." }];

  const trop = [429, { erreur: "Trop de demandes envoyées. Réessayez plus tard ou écrivez directement à Belle.", repli: true }];
  if (!(await compter(memoire, `demande:${ip}`, MAX_PAR_HEURE, 3600e3))) return trop;
  if (!(await compter(memoire, "demande:jour", MAX_PAR_JOUR, 86400e3))) return trop;

  const belle = { email: emailBelle(env), name: propre(env.DEMANDE_NOM) || "Chez Belle" };
  const voyageurEmail = EMAIL.test(contact) ? contact : null;
  const brevo = message => envoyer("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": cleBrevo(env), "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(message)
  }).then(r => r.ok, () => false);

  // 1. La demande, chez Belle : « Répondre » écrit directement au voyageur
  const ok = await brevo({
    sender: { email: belle.email, name: "Site Chez Belle" },
    to: [{ email: belle.email, name: belle.name }],
    ...(voyageurEmail ? { replyTo: { email: voyageurEmail, ...(nom ? { name: nom } : {}) } } : {}),
    subject: `Demande de séjour${nom ? " de " + nom : ""}`,
    textContent: `${texte}\n\n—\nEnvoyé depuis le formulaire du site Chez Belle.\n${voyageurEmail ? "Pour répondre : touchez simplement « Répondre »." : "Coordonnées indiquées : " + contact}`
  });
  if (!ok) {
    console.error("[demande] envoi à Belle refusé par Brevo");
    return [502, { erreur: "L’envoi n’a pas fonctionné.", repli: true }];
  }

  // 2. Accusé de réception au voyageur (s'il a donné un e-mail) ; un échec ici n'annule pas la demande
  if (voyageurEmail) {
    const accuse = await brevo({
      sender: belle,
      to: [{ email: voyageurEmail, ...(nom ? { name: nom } : {}) }],
      replyTo: { email: belle.email, name: belle.name },
      subject: "Votre demande de séjour Chez Belle",
      textContent: [
        `Bonjour${nom ? " " + nom : ""},`, "",
        "Belle a bien reçu votre demande et vous répond sous 24 heures pour vous confirmer les disponibilités.", "",
        "Pour rappel, voici votre demande :", "",
        texte, "",
        "—",
        "Chez Belle · location de vacances à Vaux-sur-Mer, quartier de Pontaillac",
        "Pour compléter votre demande, répondez simplement à cet e-mail."
      ].join("\n")
    });
    if (!accuse) console.error("[demande] accusé de réception non envoyé");
  }
  return [200, { envoyee: true }];
}
