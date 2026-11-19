// Jetons, codes courts et références : tout ce qui se tire au hasard, par le module de cryptographie.
// Le jeton d'un ticket doit être impossible à deviner : c'est lui que porte le QR.

/** Sans les signes qu'on confond : pas de O ni de 0, pas de I, de 1 ni de L. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const auHasard = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (o) => ALPHABET[o % ALPHABET.length]).join("");

/** 32 caractères hexadécimaux (128 bits). */
export const nouveauJeton = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (o) => o.toString(16).padStart(2, "0")).join("");

/** Le code court d'un ticket, à taper au comptoir si la caméra ne lit pas. */
export const nouveauCode = () => auHasard(6);

/** Le code famille d'un convive : son parent le saisit pour le relier. */
export const nouveauCodeFamille = () => auHasard(6);

/** La référence d'une recharge (« R-7K2M »), écrite dans le QR de paiement. */
export const nouvelleReference = () => `R-${auHasard(4)}`;

/** Un identifiant de compte créé par l'application (les données de démonstration). */
export const nouvelId = (prefixe: string) => `${prefixe}${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

/** Un code tapé à la main, remis au propre : majuscules, sans espace ni signe. */
export const nettoyerCode = (texte: string) => texte.toUpperCase().replace(/[^A-Z0-9]/g, "");

/**
 * Ce que le comptoir a lu ou tapé : l'adresse d'un ticket (« …/ticket/<jeton> »), un jeton seul, ou un code court.
 * Rend null si ce n'est rien de tout ça.
 */
export function lireCle(texte: string): { jeton: string } | { code: string } | null {
  const t = texte.trim();
  const m = t.match(/\/ticket\/([0-9a-f]{32})(?:[/?#]|$)/i) ?? t.match(/^([0-9a-f]{32})$/i);
  if (m) return { jeton: m[1].toLowerCase() };
  const c = nettoyerCode(t);
  return c.length === 6 ? { code: c } : null;
}
