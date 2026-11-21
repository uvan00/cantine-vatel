// Cartflox, la passerelle de paiement de l'écosystème, branchée dans la recharge (choix du propriétaire du 20/11/2026) :
// Mobile Money de Côte d'Ivoire seulement, en francs CFA, payé dans notre propre formulaire, comme le paiement natif de
// LinkAfr (le serveur ouvre le paiement, liste les opérateurs, déclenche le débit sur le téléphone).
// Ce fichier ne contient que des règles pures, testées par `npm test` : les clés, le numéro, les opérateurs, ce qu'on
// fait d'un statut de paiement, et si un webhook est bien signé. Les appels réseau sont dans cartflox-serveur.ts.
import { createHmac, timingSafeEqual } from "node:crypto";
import { fcfa } from "./format.ts";
import { messageOperateur } from "./mobile-money.ts";

/** Le pays et la monnaie servis : la Côte d'Ivoire, en francs CFA (XOF). */
export const PAYS_CARTFLOX = "CI";
export const DEVISE_CARTFLOX = "XOF";

export type ModeCartflox = "test" | "live";

/**
 * Le mode des clés : test (af_test_sec_) ou production (af_live_sec_). Seule la clé secrète sert, et elle reste sur le
 * serveur. La clé publique est facultative ; si elle est là, elle doit être du même mode. null si la clé secrète manque,
 * n'a pas la bonne forme, ou si les deux clés mêlent les deux modes : Cartflox reste alors éteint.
 */
export function modeDesCles(publique: string | undefined, secrete: string | undefined): ModeCartflox | null {
  const p = (publique ?? "").trim(), s = (secrete ?? "").trim();
  const n = /^af_(test|live)_sec_[A-Za-z0-9]{16,}$/.exec(s);
  if (!n) return null;
  if (!p) return n[1] as ModeCartflox;
  const m = /^af_(test|live)_pub_[A-Za-z0-9]{16,}$/.exec(p);
  if (!m || m[1] !== n[1]) return null;
  return n[1] as ModeCartflox;
}

/** Un identifiant de session tel que Cartflox les fabrique (lettres minuscules et chiffres). */
export const sessionValable = (id: string) => /^[a-z0-9]{12,40}$/.test(id);

/** Ce que l'API de Cartflox rend pour une session (GET /api/v1/checkout/sessions/<id>/status). */
export type StatutSession = {
  status?: string;
  paid?: boolean;
  amount?: number;
  currency?: string;
  livemode?: boolean;
  failure_message?: string | null;
};

export type VerdictPaiement =
  /** Payé, en francs CFA, au moins le montant de la recharge : on crédite. */
  | { genre: "crediter" }
  /** Pas encore fini : on relira. */
  | { genre: "attendre" }
  /** Fini sans paiement : rien à créditer, la personne peut réessayer. */
  | { genre: "echec"; phrase: string }
  /** Payé, mais pas comme prévu (montant, monnaie) : la cantine regarde à la main, rien n'est crédité tout seul. */
  | { genre: "a_verifier"; phrase: string };

const FINIS_SANS_PAIEMENT = ["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"];

/**
 * Que faire d'une session de paiement, d'après ce que Cartflox en dit. Le montant crédité est toujours celui de la
 * recharge : Cartflox peut encaisser un peu plus (des frais à la charge du payeur), jamais moins.
 */
export function verdictPaiement(s: StatutSession, montantRecharge: number): VerdictPaiement {
  const statut = String(s.status ?? "").toUpperCase();
  // Le statut passe avant « paid » : un paiement remboursé garde parfois « paid » à vrai, il n'est plus à créditer.
  if (FINIS_SANS_PAIEMENT.includes(statut)) {
    const message = (s.failure_message ?? "").trim();
    return { genre: "echec", phrase: message ? messageOperateur(message) : "Le paiement n'a pas abouti" };
  }
  if (statut === "SUCCESS" || s.paid === true) {
    if (String(s.currency ?? "").toUpperCase() !== DEVISE_CARTFLOX) {
      return { genre: "a_verifier", phrase: `Paiement reçu dans une autre monnaie (${s.currency ?? "inconnue"}) : à vérifier à la main` };
    }
    const encaisse = Number(s.amount);
    if (!Number.isFinite(encaisse) || encaisse < montantRecharge) {
      return { genre: "a_verifier", phrase: `Cartflox a encaissé ${Number.isFinite(encaisse) ? fcfa(encaisse) : "un montant inconnu"} au lieu de ${fcfa(montantRecharge)} : à vérifier à la main` };
    }
    return { genre: "crediter" };
  }
  return { genre: "attendre" };
}

/** Un webhook plus vieux que 5 minutes est refusé : on ne rejoue pas un ancien message. */
export const TOLERANCE_WEBHOOK_S = 300;

/**
 * Vrai si le webhook vient bien de Cartflox : l'en-tête X-Afriflow-Signature vaut « t=<secondes>,v1=<signature> », où la
 * signature est le HMAC SHA-256, en hexadécimal, de « <secondes>.<corps brut> » avec la clé secrète du compte (c'est
 * ainsi que Cartflox signe, voir src/lib/webhook-dispatch.ts de Cartflox). Comparaison en temps constant.
 */
export function signatureValide(corps: string, entete: string | null, secret: string, maintenantS: number): boolean {
  if (!entete || !secret) return false;
  const parts = Object.fromEntries(entete.split(",").map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }));
  const t = Number(parts.t);
  const v1 = String(parts.v1 ?? "");
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(v1)) return false;
  if (Math.abs(maintenantS - t) > TOLERANCE_WEBHOOK_S) return false;
  const attendu = createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex");
  return timingSafeEqual(Buffer.from(attendu, "hex"), Buffer.from(v1, "hex"));
}

/** Fabrique l'en-tête de signature d'un corps : sert aux essais (et à rejouer un webhook à la main). */
export const signer = (corps: string, secret: string, t: number) => `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${corps}`).digest("hex")}`;
