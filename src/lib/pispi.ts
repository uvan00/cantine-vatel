import "server-only";
import { generateQrCodeSvg } from "@pi-spi/qrcode";

// Le QR universel de paiement PI-SPI (BCEAO), fabriqué par la bibliothèque officielle, strictement standard : aucun
// champ ajouté (un QR qui mêle deux formats est refusé par les applications, essai du 18/11/2026).
// Il porte l'adresse de paiement de la cantine, le montant et la référence de la recharge. L'argent va directement sur
// le compte de la cantine : l'application ne le touche jamais.

const ADRESSE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** L'adresse de paiement de la cantine (variable PISPI_ALIAS, posée sur le serveur), ou null si elle manque. */
export function aliasPispi() {
  const a = (process.env.PISPI_ALIAS ?? "").trim();
  return ADRESSE.test(a) ? a : null;
}

/** Faux si PISPI_SANS_MONTANT vaut "1" : le QR ne porte alors que l'adresse et la référence, le payeur tape le montant. */
export const pispiAvecMontant = () => process.env.PISPI_SANS_MONTANT !== "1";

/** Le QR d'une recharge, en SVG. null si l'adresse de paiement de la cantine n'est pas configurée. */
export async function qrRecharge(r: { montant: number; reference: string }, taille = 320): Promise<string | null> {
  const alias = aliasPispi();
  if (!alias) return null;
  return generateQrCodeSvg(
    pispiAvecMontant()
      ? { alias, countryCode: "CI", qrType: "DYNAMIC", referenceLabel: r.reference, amount: r.montant }
      : { alias, countryCode: "CI", qrType: "STATIC", referenceLabel: r.reference },
    { size: taille },
  );
}
