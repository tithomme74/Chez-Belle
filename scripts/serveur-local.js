// Serveur de développement : `npm run dev`
//  - _site/   : le « site en ligne », construit depuis src/_data/ (modifié seulement par « Publier ») ;
//  - /apercu/ : l'aperçu du brouillon, construit depuis .local/brouillon/ (modifié par chaque enregistrement) ;
//  - /api/*   : l'API de l'admin avec le stockage local.
// Le mot de passe de test et le secret de session sont lus dans .env (créé par `npm run mot-de-passe -- --local`).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { traiter } from "../api/app.js";
import { stockageLocal } from "../api/stockage.js";
import { memoireLocale } from "../api/auth.js";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = path.join(RACINE, "_site");
const APERCU = path.join(RACINE, "_apercu");
const PORT = Number(process.env.PORT) || 8765;
if (fs.existsSync(path.join(RACINE, ".env"))) process.loadEnvFile(path.join(RACINE, ".env"));

const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".txt": "text/plain; charset=utf-8", ".xml": "application/xml; charset=utf-8", ".ico": "image/x-icon" };

// Mêmes en-têtes de sécurité qu'en ligne (src/_headers)
const ENTETES_ADMIN = {
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
  "X-Robots-Tag": "noindex, nofollow", "X-Frame-Options": "DENY", "Referrer-Policy": "same-origin"
};

const deps = { env: process.env, stockage: stockageLocal(RACINE), memoire: memoireLocale() };

async function api(req, res) {
  const corps = req.method === "GET" || req.method === "HEAD" ? undefined : await new Promise((ok, ko) => {
    const morceaux = []; let taille = 0;
    req.on("data", c => { taille += c.length; if (taille > 7e6) { ko(new Error("trop gros")); req.destroy(); } else morceaux.push(c); });
    req.on("end", () => ok(Buffer.concat(morceaux))); req.on("error", ko);
  });
  const requete = new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers: req.headers, body: corps });
  const r = await traiter(requete, { ...deps, ip: req.socket.remoteAddress });
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}

function fichier(req, res) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  const estApercu = p === "/apercu" || p.startsWith("/apercu/");
  const base = estApercu ? APERCU : SITE;
  const f = path.join(base, path.normalize(estApercu ? p.slice("/apercu".length) || "/" : p));
  if (!f.startsWith(base)) { res.writeHead(403).end(); return; }
  let cible = f;
  if (fs.existsSync(cible) && fs.statSync(cible).isDirectory()) {
    if (!p.endsWith("/")) { res.writeHead(301, { Location: p + "/" }).end(); return; }
    cible = path.join(cible, "index.html");
  }
  if (!fs.existsSync(cible)) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Page introuvable"); return; }
  res.writeHead(200, { "Content-Type": MIME[path.extname(cible).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache", "X-Content-Type-Options": "nosniff", ...(p.startsWith("/admin/") ? ENTETES_ADMIN : {}) });
  fs.createReadStream(cible).pipe(res);
}

http.createServer((req, res) => {
  (req.url.startsWith("/api/") ? api(req, res) : Promise.resolve(fichier(req, res)))
    .catch(e => { console.error(e); if (!res.headersSent) res.writeHead(500); res.end(); });
}).listen(PORT, () => console.log(`Site et admin : http://localhost:${PORT}  (Ctrl+C pour arrêter)`));

// Deux Eleventy en surveillance : le site publié et l'aperçu du brouillon
await deps.stockage.preparer(); // crée .local/brouillon/ si besoin
const CMD = path.join(RACINE, "node_modules/@11ty/eleventy/cmd.cjs");
const site = spawn(process.execPath, [CMD, "--watch", "--quiet"], { cwd: RACINE, stdio: "inherit" });
const apercu = spawn(process.execPath, [CMD, "--watch", "--quiet", "--output=_apercu"], {
  cwd: RACINE, stdio: "inherit", env: { ...process.env, CB_DONNEES: ".local/brouillon", CB_APERCU: "1" }
});
process.on("exit", () => { site.kill(); apercu.kill(); });
process.on("SIGINT", () => process.exit(0));
