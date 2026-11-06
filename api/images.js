// Contrôle des photos envoyées par l'admin : on n'accepte que du WebP ou du JPEG réels (signature vérifiée)
// et on lit leurs dimensions dans l'en-tête, sans dépendance externe (octets = Uint8Array).

const ascii = (b, i, j) => String.fromCharCode(...b.subarray(i, j));
const u16le = (b, i) => b[i] | (b[i + 1] << 8);
const u24le = (b, i) => b[i] | (b[i + 1] << 8) | (b[i + 2] << 16);
const u32le = (b, i) => (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0;
const u16be = (b, i) => (b[i] << 8) | b[i + 1];

export function dimensionsImage(b) {
  if (!b || b.length < 30) return null;
  // WebP : RIFF....WEBP
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") {
    const bloc = ascii(b, 12, 16);
    if (bloc === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a)
      return { type: "webp", largeur: u16le(b, 26) & 0x3fff, hauteur: u16le(b, 28) & 0x3fff };
    if (bloc === "VP8L" && b[20] === 0x2f) {
      const bits = u32le(b, 21);
      return { type: "webp", largeur: (bits & 0x3fff) + 1, hauteur: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (bloc === "VP8X")
      return { type: "webp", largeur: 1 + u24le(b, 24), hauteur: 1 + u24le(b, 27) };
    return null;
  }
  // JPEG : FFD8, puis recherche du segment SOF (dimensions)
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const marqueur = b[i + 1];
      if (marqueur === 0xd8 || marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd7)) { i += 2; continue; }
      const longueur = u16be(b, i + 2);
      if (marqueur >= 0xc0 && marqueur <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marqueur))
        return { type: "jpg", hauteur: u16be(b, i + 5), largeur: u16be(b, i + 7) };
      i += 2 + longueur;
    }
  }
  return null;
}

// Nom de fichier sûr à partir d'un texte libre (« La Cuisine d'été » → « la-cuisine-d-ete »)
export function nomFichier(texte) {
  const s = String(texte || "photo").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return s || "photo";
}
