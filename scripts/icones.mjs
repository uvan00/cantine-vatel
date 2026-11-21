// Fabrique les icônes de l'application posée sur l'écran d'accueil (bonus 3 du cahier) : la marque de Vatel
// (public/vatel/vatel-marque.svg), jamais retouchée, au centre d'un fond blanc. À relancer si la marque change :
//   node scripts/icones.mjs
// sharp vient avec Next, qui s'en sert pour ses images.
import { mkdirSync } from "node:fs"
import sharp from "sharp"

const MARQUE = "public/vatel/vatel-marque.svg"

/** Une icône carrée de `cote` pixels : la marque, large de `part` du côté, sur un fond blanc aux coins arrondis de `arrondi`. */
async function icone(fichier, cote, part, arrondi = 0) {
  const marque = await sharp(MARQUE, { density: 600 }).resize(Math.round(cote * part)).png().toBuffer()
  const fond = `<svg xmlns="http://www.w3.org/2000/svg" width="${cote}" height="${cote}"><rect width="${cote}" height="${cote}" rx="${cote * arrondi}" fill="#FFFFFF"/></svg>`
  await sharp(Buffer.from(fond)).composite([{ input: marque, gravity: "center" }]).png().toFile(fichier)
  console.log(fichier)
}

mkdirSync("public/icones", { recursive: true })
// L'icône telle quelle (ordinateur, réglages du téléphone) : un carré blanc arrondi.
await icone("public/icones/icone-192.png", 192, 0.72, 0.2)
await icone("public/icones/icone-512.png", 512, 0.72, 0.2)
// Android découpe l'icône « masquable » à sa forme (rond, goutte) : la marque tient dans le cercle central de 80 %.
await icone("public/icones/icone-masquable-512.png", 512, 0.56)
// L'iPhone arrondit lui-même les coins et noircit la transparence : un fond blanc plein.
await icone("src/app/apple-icon.png", 180, 0.76)
