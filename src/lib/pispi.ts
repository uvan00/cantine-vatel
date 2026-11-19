import "server-only";
import { DEFAULT_PISPI_LOGO_DATA_URL, buildPayloadString } from "@pi-spi/qrcode";
import QRCode from "qrcode";

// Le QR universel de paiement PI-SPI (BCEAO). Son contenu est fabriqué par la bibliothèque officielle, strictement
// standard : aucun champ ajouté (un QR qui mêle deux formats est refusé par les applications, essai du 18/11/2026).
// Il porte l'adresse de paiement de la cantine, le montant et la référence de la recharge. L'argent va directement sur
// le compte de la cantine : l'application ne le touche jamais.
// Le dessin, lui, est le plus lisible possible : des modules carrés classiques, le logo PI-SPI au centre, et le niveau
// de correction le plus haut pour que le logo ne gêne aucune lecture.

/** Une adresse de paiement PI-SPI : un identifiant de 36 caractères (UUID version 4, la bibliothèque n'accepte que ça). */
const ADRESSE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** L'adresse de paiement de la cantine (variable PISPI_ALIAS, posée sur le serveur), ou null si elle manque. */
export function aliasPispi() {
  const a = (process.env.PISPI_ALIAS ?? "").trim();
  return ADRESSE.test(a) ? a : null;
}

/** Faux si PISPI_SANS_MONTANT vaut "1" : le QR ne porte alors que l'adresse et la référence, le payeur tape le montant. */
export const pispiAvecMontant = () => process.env.PISPI_SANS_MONTANT !== "1";

/** Le contenu du QR d'une recharge (la suite de champs de la norme), ou null sans adresse de paiement. */
export function chargeRecharge(r: { montant: number; reference: string }): string | null {
  const alias = aliasPispi();
  if (!alias) return null;
  return buildPayloadString(
    pispiAvecMontant()
      ? { alias, countryCode: "CI", qrType: "DYNAMIC", referenceLabel: r.reference, amount: r.montant }
      : { alias, countryCode: "CI", qrType: "STATIC", referenceLabel: r.reference },
  );
}

/** La part du côté que prend le logo, et celle de son pavé blanc. */
const LOGO = 0.18;
const PAVE = 0.24;

/** Le QR d'une recharge, en SVG. null si l'adresse de paiement de la cantine n'est pas configurée. */
export async function qrRecharge(r: { montant: number; reference: string }, taille = 320): Promise<string | null> {
  const charge = chargeRecharge(r);
  if (!charge) return null;
  const svg = await QRCode.toString(charge, { type: "svg", margin: 0, errorCorrectionLevel: "H", color: { dark: "#1A1A1A", light: "#FFFFFF" } });
  const cote = Number(svg.match(/viewBox="0 0 (\d+(?:\.\d+)?) /)?.[1] ?? 0);
  if (!cote) return svg;
  const pave = cote * PAVE, logo = cote * LOGO;
  const centre = (c: number) => (cote - c) / 2;
  const milieu =
    `<rect x="${centre(pave)}" y="${centre(pave)}" width="${pave}" height="${pave}" rx="${pave / 2}" fill="#FFFFFF"/>` +
    `<image href="${DEFAULT_PISPI_LOGO_DATA_URL}" x="${centre(logo)}" y="${centre(logo)}" width="${logo}" height="${logo}"/>`;
  return svg.replace("<svg ", `<svg width="${taille}" height="${taille}" `).replace("</svg>", `${milieu}</svg>`);
}
