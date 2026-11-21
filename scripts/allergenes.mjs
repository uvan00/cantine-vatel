// Découpe la planche des allergènes (docs/allergenes-planche.png) en un dessin par allergène et par régime, rangés dans
// public/allergenes. La planche a été dessinée par Codex le 21/11/2026, dans la main des avatars (style choisi par le
// propriétaire) : une grille de 4 sur 4, dans l'ordre de CASES. À relancer si la planche change :
//   node scripts/allergenes.mjs
// sharp vient avec Next, qui s'en sert pour ses images.
import { mkdirSync } from "node:fs"
import sharp from "sharp"

const PLANCHE = "docs/allergenes-planche.png"
/** Les seize cases, ligne par ligne : les quatorze allergènes de src/lib/listes.ts, puis le porc et le végétarien. */
const CASES = [
  "arachide", "poisson", "crustaces", "oeuf",
  "lait", "gluten", "soja", "fruits-a-coque",
  "sesame", "celeri", "moutarde", "sulfites",
  "lupin", "mollusques", "porc", "vegetarien",
]
const COTE = 256
/** Deux pixels rognés sur chaque bord, pour que le fond de la case voisine ne déborde pas. */
const MARGE = 2

const { width, height } = await sharp(PLANCHE).metadata()
const pas = { x: width / 4, y: height / 4 }
mkdirSync("public/allergenes", { recursive: true })
for (const [i, nom] of CASES.entries()) {
  const zone = {
    left: Math.round((i % 4) * pas.x) + MARGE,
    top: Math.round(Math.floor(i / 4) * pas.y) + MARGE,
    width: Math.round(pas.x) - 2 * MARGE,
    height: Math.round(pas.y) - 2 * MARGE,
  }
  await sharp(PLANCHE).extract(zone).resize(COTE, COTE).webp({ quality: 88 }).toFile(`public/allergenes/${nom}.webp`)
  console.log(`public/allergenes/${nom}.webp`)
}
