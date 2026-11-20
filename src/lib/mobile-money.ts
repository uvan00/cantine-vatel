// Le Mobile Money de Côte d'Ivoire pour le paiement natif (comme LinkAfr) : le numéro, les opérateurs que Cartflox
// ouvre, et ses messages dits en clair. Règles pures, sans rien de propre au serveur : la page s'en sert aussi.
// Testées par `npm test` (mobile-money.test.ts).

/**
 * Un numéro de Côte d'Ivoire tel que tapé (« 07 07 07 07 07 », « +225 0707070707 », « 2250707070707 ») ramené à ses
 * 10 chiffres (« 0707070707 »). null si ce n'est pas un numéro ivoirien à 10 chiffres.
 */
export function telephoneIvoirien(saisie: string): string | null {
  let c = saisie.replace(/\D/g, "");
  if (c.length === 13 && c.startsWith("225")) c = c.slice(3);
  if (c.length === 15 && c.startsWith("00225")) c = c.slice(5);
  return /^0\d{9}$/.test(c) ? c : null;
}

/** Le numéro au format que Cartflox attend : indicatif compris (« +2250707070707 »). */
export const telephoneCartflox = (dixChiffres: string) => `+225${dixChiffres}`;

/** Un moyen de paiement tel que Cartflox le décrit (GET /api/v1/checkout/sessions/<id>/methods). */
export type MoyenCartflox = { code: string; gatewayId: string; name: string; country?: string | null; type?: string | null; logo?: string | null };
/** Un opérateur tel que la page le montre. */
export type Operateur = { code: string; gatewayId: string; nom: string; logo: string | null };

/** Les opérateurs de Côte d'Ivoire, du plus courant au moins courant (même ordre que LinkAfr). */
const ORDRE_CI = ["wave", "orange", "mtn", "moov"];

/** « Wave CI » → « Wave », « Orange Money Côte d'Ivoire » → « Orange Money ». */
export const nomOperateur = (nom: string) => nom.replace(/\s*(côte d'ivoire|cote d'ivoire|ci)\s*$/i, "").trim() || nom;

/** Une carte bancaire ou un moyen valable hors du pays : on ne le propose pas, le paiement est ivoirien seulement. */
export const estCarteOuHorsPays = (m: MoyenCartflox) => {
  const t = (m.type ?? "").toLowerCase(), c = (m.country ?? "").toLowerCase(), n = m.name.toLowerCase();
  return t === "card" || /visa|mastercard|carte/.test(n) || ["uemoa", "cemac", "international", "global", "europe"].some((g) => c.includes(g));
};

/**
 * Les opérateurs à proposer : le Mobile Money de Côte d'Ivoire seulement, dans l'ordre habituel, un seul par opérateur,
 * avec leur logo en adresse complète (Cartflox donne souvent un chemin, à compléter par son adresse).
 */
export function operateursIvoiriens(liste: MoyenCartflox[], origineCartflox: string): Operateur[] {
  const rang = (m: MoyenCartflox) => {
    const i = ORDRE_CI.findIndex((op) => m.name.toLowerCase().includes(op));
    return i === -1 ? ORDRE_CI.length : i;
  };
  const vus = new Set<string>();
  return liste
    .filter((m) => m.code && m.gatewayId && !estCarteOuHorsPays(m))
    .filter((m) => { const c = (m.country ?? "").toLowerCase(); return !c || c.includes("ivoire") || c === "ci"; })
    .sort((a, b) => rang(a) - rang(b))
    .filter((m) => { const n = nomOperateur(m.name).toLowerCase(); if (vus.has(n)) return false; vus.add(n); return true; })
    .map((m) => ({
      code: m.code,
      gatewayId: m.gatewayId,
      nom: nomOperateur(m.name),
      logo: !m.logo ? null : /^https?:\/\//.test(m.logo) ? m.logo : `${origineCartflox}${m.logo.startsWith("/") ? "" : "/"}${m.logo}`,
    }));
}

/** Le code à composer pour obtenir un code de paiement Orange Money en Côte d'Ivoire. */
export const CODE_ORANGE_CI = "#144*82#";

/** Ce que dit l'opérateur, en clair et en « tu ». */
export function messageOperateur(brut: string | null | undefined): string {
  const r = (brut ?? "").toLowerCase();
  if (r.includes("insufficient") || r.includes("insuffisant")) return "Solde insuffisant sur ce compte Mobile Money";
  if (r.includes("payer_not_found") || r.includes("does not have a mobile money")) return "Ce numéro n'a pas de compte Mobile Money chez cet opérateur";
  if (r.includes("minimum")) return "Montant trop petit pour ce moyen de paiement";
  const propre = (brut ?? "").trim().replace(/[.!]+$/, "");
  return propre || "Paiement refusé. Essaie un autre numéro ou un autre opérateur";
}
