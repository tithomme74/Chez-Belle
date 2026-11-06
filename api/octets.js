// Conversions d'octets avec les seules fonctions standard du web (aucune dépendance à Node),
// pour que l'API tourne aussi bien en local (Node) qu'en ligne (Cloudflare Pages Functions).

const enc = new TextEncoder(), dec = new TextDecoder();
export const versOctets = texte => enc.encode(texte);
export const versTexte = octets => dec.decode(octets);

export function base64(octets) {
  let s = "";
  for (let i = 0; i < octets.length; i += 0x8000) s += String.fromCharCode.apply(null, octets.subarray(i, i + 0x8000));
  return btoa(s);
}
// Lève une erreur si le texte n'est pas du base64 valide (les retours à la ligne de GitHub sont tolérés)
export function depuisBase64(texte) {
  const s = atob(String(texte).replace(/\s+/g, ""));
  const o = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) o[i] = s.charCodeAt(i);
  return o;
}
export const base64url = octets => base64(octets).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const depuisBase64url = t => depuisBase64(t.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((t.length + 3) % 4));

// Comparaison en temps constant (pour les signatures et empreintes)
export function egal(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}
