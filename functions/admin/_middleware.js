// L'admin ne fonctionne que sur l'adresse principale du site (chez-belle-pontaillac.pages.dev) :
// les aperçus (brouillon.chez-belle-pontaillac.pages.dev, ou <code>.chez-belle-pontaillac.pages.dev) n'ont ni la mémoire (KV)
// ni les secrets. Si l'admin est ouvert depuis un aperçu, on renvoie vers l'admin de l'adresse principale.
export async function onRequest({ request, next }) {
  const url = new URL(request.url);
  const parties = url.hostname.split(".");
  if (url.hostname.endsWith(".pages.dev") && parties.length > 3) {
    url.hostname = parties.slice(-3).join(".");
    return Response.redirect(url.toString(), 302);
  }
  return next();
}
