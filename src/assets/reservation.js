// Demande de réservation : estimation du prix et brouillon de message (adresse de Belle masquée aux robots)
const CONFIG = {
  user: "chez.belle.pontaillac", domain: "gmail.com",
  chienCourt: 15, chienLong: 25, chienSeuil: 3
};
const EMAIL = CONFIG.user + "@" + CONFIG.domain;

// Nuits concernées : dates de début et de fin incluses (la nuit du 2027-05-01 va du 1er au 2 mai)
const PERIODS = [
  ["2027-05-01", "2027-05-01", "pont"],    ["2027-05-02", "2027-05-05", "basse"],
  ["2027-05-06", "2027-05-08", "pont"],    ["2027-05-09", "2027-05-13", "basse"],
  ["2027-05-14", "2027-05-16", "pont"],    ["2027-05-17", "2027-06-20", "basse"],
  ["2027-06-21", "2027-07-06", "juillet"], ["2027-07-07", "2027-08-27", "coeur"],
  ["2027-08-28", "2027-09-04", "fin"],     ["2027-09-05", "2027-09-24", "basse"],
  ["2027-12-18", "2027-12-31", "noel"]
];
const RATES = {
  basse:   { label: "Mai, juin, septembre", min: 3, price: 80 },
  pont:    { label: "Pont de mai",           min: 3, price: 95 },
  juillet: { label: "Début juillet",         min: 4, price: 105 },
  coeur:   { label: "Cœur de l’été",         min: 7, price: 115 },
  fin:     { label: "Fin d’été",             min: 4, price: 90 },
  noel:    { label: "Noël",                  min: 7, price: 85 }
};
const NOEL_ARRIVEES = ["2027-12-18", "2027-12-25"];
const DAY = 86400000;
const toUTC = s => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const iso = t => new Date(t).toISOString().slice(0, 10);
const frDate = s => new Date(toUTC(s)).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const eur = n => n.toLocaleString("fr-FR") + " €";
const periodOf = s => { const t = toUTC(s); const p = PERIODS.find(([a, b]) => t >= toUTC(a) && t <= toUTC(b)); return p ? p[2] : null; };
const $ = id => document.getElementById(id);

function estimate(arr, dep, pet) {
  const res = { nights: 0, total: 0, lines: [], warn: "", out: false };
  if (!arr || !dep) { res.warn = "Indiquez vos dates d’arrivée et de départ."; return res; }
  const a = toUTC(arr), d = toUTC(dep), n = Math.round((d - a) / DAY);
  if (n <= 0) { res.warn = "La date de départ doit suivre la date d’arrivée."; return res; }
  res.nights = n;
  const groups = {};
  for (let t = a; t < d; t += DAY) {
    const k = periodOf(iso(t));
    if (!k) { res.out = true; res.warn = "Une partie de ces dates sort des périodes affichées. Écrivez à Belle : elle vous répondra pour ces dates."; return res; }
    const p = RATES[k].price, key = k + p;
    groups[key] = groups[key] || { label: RATES[k].label, price: p, count: 0 };
    groups[key].count++; res.total += p;
  }
  res.lines = Object.values(groups).map(l => `${l.label} : ${l.count} × ${l.price} €`);
  if (pet) { const f = n <= CONFIG.chienSeuil ? CONFIG.chienCourt : CONFIG.chienLong; res.total += f; res.lines.push(`Chien : ${f} €`); }
  const r0 = RATES[periodOf(arr)];
  if (r0 === RATES.noel && (n !== 7 || !NOEL_ARRIVEES.includes(arr))) res.warn = "À Noël, le séjour dure une semaine : du 18 au 25 décembre ou du 25 décembre au 1er janvier.";
  else if (n < r0.min) res.warn = `En période « ${r0.label} », le séjour minimum est de ${r0.min} nuits.`;
  return res;
}
function render(envoi) {
  const r = estimate($("arr").value, $("dep").value, $("pet").checked);
  const vide = !$("arr").value || !$("dep").value;
  $("total").textContent = r.total && !r.out ? eur(r.total) : "—";
  $("detail").textContent = r.nights > 0 && !r.out ? `${r.nights} nuit${r.nights > 1 ? "s" : ""}, linge et ménage compris` : (vide ? "Choisissez vos dates pour voir le prix." : "");
  $("lines").innerHTML = "";
  if (!r.out) r.lines.forEach(t => { const li = document.createElement("li"); li.textContent = t; $("lines").appendChild(li); });
  const w = vide && !envoi ? "" : r.warn;
  $("warn").hidden = !w; $("warn").textContent = w;
  return r;
}
function draft(r) {
  const pax = +$("pax").value, kids = Math.min(+$("kids").value, pax - 1);
  const who = `${pax} personne${pax > 1 ? "s" : ""}${kids ? ` dont ${kids} enfant${kids > 1 ? "s" : ""}` : ""}`;
  return [
    "Bonjour Belle,", "",
    `Je souhaiterais séjourner Chez Belle du ${frDate($("arr").value)} au ${frDate($("dep").value)} (${r.nights} nuit${r.nights > 1 ? "s" : ""}), pour ${who}.`,
    r.total && !r.out ? `Estimation indiquée sur votre page : ${eur(r.total)}, taxe de séjour en sus.` : null,
    $("pet").checked ? "Nous viendrons avec notre chien." : null,
    $("msg").value.trim() ? "\n" + $("msg").value.trim() : null,
    "", "Merci de me dire si ces dates sont disponibles.",
    `${$("nom").value.trim() || "[votre nom]"} · ${$("contact").value.trim() || "[votre e-mail ou téléphone]"}`
  ].filter(l => l !== null).join("\n");
}
["arr", "dep", "pet"].forEach(id => $(id).addEventListener("input", () => render()));
$("f").addEventListener("submit", e => {
  e.preventDefault();
  const r = render(true); if (!r.nights) return;
  const t = draft(r);
  $("draft").textContent = t;
  $("mail").href = `mailto:${EMAIL}?subject=${encodeURIComponent("Demande de séjour Chez Belle")}&body=${encodeURIComponent(t)}`;
  $("out").hidden = false; $("copied").hidden = true;
});
$("copy").addEventListener("click", () => {
  const sel = () => { const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($("draft")); s.removeAllRanges(); s.addRange(rg); };
  try { navigator.clipboard.writeText($("draft").textContent).then(() => { $("copied").hidden = false; }, sel); } catch (err) { sel(); }
});
$("belle-mail").textContent = EMAIL;
render();
