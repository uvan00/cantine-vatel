import "server-only";
import { prisma } from "@/lib/db";
import { DEVISE_CARTFLOX, PAYS_CARTFLOX, modeDesCles, sessionValable, verdictPaiement, type ModeCartflox, type StatutSession } from "@/lib/cartflox";
import { operateursIvoiriens, telephoneCartflox, type MoyenCartflox, type Operateur } from "@/lib/mobile-money";
import { MARQUE } from "@/lib/marque";
import { crediterParCartflox, lierSessionCartflox, noterSessionCartflox } from "@/lib/operations";

// Cartflox côté serveur, comme le paiement natif de LinkAfr : le serveur ouvre le paiement (le montant vient de la base),
// liste les opérateurs de Côte d'Ivoire, déclenche le débit sur le téléphone, puis relit le paiement chez Cartflox avant
// de créditer. Tout passe par la clé SECRÈTE, qui ne quitte jamais le serveur : la page n'a aucune clé.
// La clé arrive par l'environnement (CARTFLOX_CLE_SECRETE, et CARTFLOX_CLE_PUBLIQUE en option), posée par le
// propriétaire avec scripts/cle-cartflox.sh en local, ou dans l'environnement du serveur. Jamais dans le code ni dans git.

const api = () => (process.env.CARTFLOX_API || "https://cartflox.com").replace(/\/+$/, "");

/** Ce que la page a le droit de savoir : le mode (essai ou production). Jamais une clé. */
export type ConfigCartflox = { mode: ModeCartflox; pays: typeof PAYS_CARTFLOX; devise: typeof DEVISE_CARTFLOX };

/** Le paiement en ligne est-il branché ? null sans clé secrète valable (ou avec deux clés de modes différents). */
export function configCartflox(): ConfigCartflox | null {
  const mode = modeDesCles(process.env.CARTFLOX_CLE_PUBLIQUE, process.env.CARTFLOX_CLE_SECRETE);
  if (!mode) return null;
  return { mode, pays: PAYS_CARTFLOX, devise: DEVISE_CARTFLOX };
}

/** La clé secrète, seulement quand la configuration est complète. Elle signe aussi les webhooks de Cartflox. */
export const cleSecreteCartflox = () => (configCartflox() ? (process.env.CARTFLOX_CLE_SECRETE ?? "").trim() : null);

/* ── Ouvrir un paiement, lister les opérateurs, débiter le téléphone ─────── */

/** Un paiement ouvert depuis moins de 20 minutes, et encore en attente chez Cartflox, se réutilise. */
const REUTILISABLE_MS = 20 * 60_000;

/**
 * Le paiement Cartflox où débiter cette recharge : le dernier ouvert s'il est récent et toujours en attente, sinon un
 * nouveau. Le montant est celui de la recharge, lu dans la base : la page ne le choisit pas.
 */
export async function paiementPourRecharge(r: { id: string; montant: number; reference: string }, payeur: string, retour: string, maintenant = Date.now()): Promise<string> {
  const dernier = await prisma.paiementCartflox.findFirst({ where: { rechargeId: r.id }, orderBy: { creeLe: "desc" }, select: { sessionId: true, creeLe: true } });
  if (dernier && maintenant - dernier.creeLe.getTime() < REUTILISABLE_MS) {
    const s = await lireStatut(dernier.sessionId).catch(() => null);
    if (s && String(s.status ?? "").toUpperCase() === "PENDING") return dernier.sessionId;
  }
  return ouvrirNouveauPaiement(r, payeur, retour);
}

/** Ouvre un paiement Cartflox pour la recharge, et le relie à elle. */
export async function ouvrirNouveauPaiement(r: { id: string; montant: number; reference: string }, payeur: string, retour: string): Promise<string> {
  const cle = cleSecreteCartflox();
  if (!cle) throw new Error("Cartflox n'est pas branché");
  const res = await fetch(`${api()}/api/v1/checkout/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": cle },
    body: JSON.stringify({
      amount: r.montant,
      currency: DEVISE_CARTFLOX,
      customer_name: payeur.slice(0, 80),
      description: `Recharge ${r.reference}, ${MARQUE.cantine}`,
      metadata: { cantine_recharge: r.id, reference: r.reference, source: "cantine" },
      merchant_name: MARQUE.cantine,
      success_url: retour,
      cancel_url: retour,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const d = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !d.id || !sessionValable(d.id)) throw new Error(d.error || `Cartflox a répondu ${res.status}`);
  const lie = await lierSessionCartflox(r.id, d.id);
  if (!lie.ok) throw new Error(lie.erreur);
  return d.id;
}

/** Les opérateurs de Côte d'Ivoire que le compte Cartflox ouvre pour ce paiement, dans l'ordre habituel. */
export async function operateursDuPaiement(sessionId: string): Promise<Operateur[]> {
  const cle = cleSecreteCartflox();
  if (!cle || !sessionValable(sessionId)) return [];
  const res = await fetch(`${api()}/api/v1/checkout/sessions/${encodeURIComponent(sessionId)}/methods?country=${PAYS_CARTFLOX.toLowerCase()}`, {
    headers: { "x-api-key": cle },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!res?.ok) return [];
  const d = (await res.json().catch(() => ({}))) as { methods?: MoyenCartflox[] };
  return operateursIvoiriens(Array.isArray(d.methods) ? d.methods : [], api());
}

export type ReponseDebit = {
  /** SUCCESS, PENDING, REQUIRE_OTP, APP_LINK, REDIRECT, EXPIRE (paiement plus payable), FAILED, UNAVAILABLE, SANDBOX… */
  statut: string;
  message: string | null;
  /** L'adresse à ouvrir (Wave, certaines pages d'opérateur), ou null. */
  redirection: string | null;
  /** Le code à composer pour obtenir un code de paiement, quand l'opérateur le donne. */
  ussd: string | null;
};

/** Déclenche le débit sur le téléphone : une demande de validation, un code à usage unique, ou l'appli de l'opérateur. */
export async function debiterTelephone(sessionId: string, e: { gatewayId: string; methodCode: string; telephone: string; nom: string; otp?: string }): Promise<ReponseDebit> {
  const res = await fetch(`${api()}/api/checkout/initiate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transactionId: sessionId,
      gatewayId: e.gatewayId.slice(0, 80),
      methodCode: e.methodCode.slice(0, 80),
      customerDetails: { name: e.nom.slice(0, 120), phone: telephoneCartflox(e.telephone), country: PAYS_CARTFLOX, otp: e.otp || undefined },
    }),
    signal: AbortSignal.timeout(35_000),
  }).catch(() => null);
  if (!res) return { statut: "FAILED", message: "Cartflox ne répond pas, réessaie dans un instant", redirection: null, ussd: null };
  const d = (await res.json().catch(() => ({}))) as { success?: boolean; status?: string; message?: string; redirectUrl?: string; redirect_url?: string; ussdCode?: string; rawData?: { url?: string; message?: string } };
  // 409 : ce paiement n'est plus payable (expiré, déjà échoué) ; on en ouvrira un autre.
  if (res.status === 409) return { statut: "EXPIRE", message: d.message ?? null, redirection: null, ussd: null };
  const statut = String(d.status || (d.success ? "PENDING" : "FAILED")).toUpperCase();
  const redirection = d.redirectUrl ?? d.redirect_url ?? d.rawData?.url ?? null;
  return { statut, message: d.message ?? d.rawData?.message ?? null, redirection: redirection && /^https?:\/\//.test(redirection) ? redirection : null, ussd: d.ussdCode ?? null };
}

/** Le statut d'un paiement chez Cartflox ; null si Cartflox ne le connaît pas pour ces clés (autre compte, autre mode). */
async function lireStatut(sessionId: string): Promise<StatutSession | null> {
  const cle = cleSecreteCartflox();
  if (!cle) throw new Error("Cartflox n'est pas branché");
  const res = await fetch(`${api()}/api/v1/checkout/sessions/${encodeURIComponent(sessionId)}/status`, {
    headers: { "x-api-key": cle },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Cartflox a répondu ${res.status}`);
  return (await res.json()) as StatutSession;
}

/** Les statuts après lesquels Cartflox ne changera plus rien. */
const FINIS = ["SUCCESS", "FAILED", "CANCELLED", "EXPIRED", "REFUNDED", "INCONNUE"];

/** Deux lectures d'une même recharge sont espacées d'au moins 4 secondes (la page et la cantine relisent toutes les 3). */
const ECART_MS = 4000;
const dernieresLectures = new Map<string, number>();

export type EtatApresVerification = "en_attente" | "confirmee" | "annulee";

/**
 * Relit chez Cartflox les paiements d'une recharge, et la crédite dès qu'un paiement est arrivé comme prévu (francs CFA,
 * au moins le montant). Un paiement arrivé sur une demande annulée n'est jamais crédité tout seul : il reste visible chez
 * la cantine, qui décide. Sans effet si Cartflox n'est pas branché. Rend l'état de la recharge après la vérification.
 * `force` : sans attendre l'écart entre deux lectures (le retour de la page de paiement, un webhook).
 */
export async function verifierRecharge(rechargeId: string, { force = false, maintenant = Date.now() } = {}): Promise<EtatApresVerification | null> {
  const r = await prisma.recharge.findUnique({
    where: { id: rechargeId },
    select: { id: true, etat: true, montant: true, paiements: { orderBy: { creeLe: "desc" }, take: 5, select: { sessionId: true, statut: true } } },
  });
  if (!r) return null;
  const etat = r.etat as EtatApresVerification;
  // Rien à relire : déjà créditée, ou aucun paiement ouvert, ou plus aucun paiement en cours chez Cartflox.
  const aRelire = r.paiements.filter((p) => !FINIS.includes(p.statut) || (p.statut === "SUCCESS" && etat === "en_attente"));
  if (!configCartflox() || etat === "confirmee" || aRelire.length === 0) return etat;
  if (!force && maintenant - (dernieresLectures.get(rechargeId) ?? 0) < ECART_MS) return etat;
  dernieresLectures.set(rechargeId, maintenant);

  for (const p of aRelire) {
    let s: StatutSession | null;
    try {
      s = await lireStatut(p.sessionId);
    } catch {
      continue; // Cartflox ne répond pas : la prochaine lecture réessaiera.
    }
    if (!s) {
      await noterSessionCartflox(p.sessionId, { statut: "INCONNUE", montant: null, devise: null, remarque: "Cartflox ne connaît pas ce paiement pour ces clés" }, maintenant);
      continue;
    }
    const v = verdictPaiement(s, r.montant);
    const encaisse = Number(s.amount);
    const remarque = v.genre === "echec" || v.genre === "a_verifier" ? v.phrase
      : v.genre === "crediter" && etat === "annulee" ? "Payé après l'annulation de la demande : à créditer ou à rendre" : null;
    await noterSessionCartflox(p.sessionId, {
      statut: String(s.status ?? (s.paid ? "SUCCESS" : "PENDING")).toUpperCase(),
      montant: Number.isFinite(encaisse) ? Math.round(encaisse) : null,
      devise: s.currency ?? null,
      remarque,
    }, maintenant);
    if (v.genre === "crediter" && etat === "en_attente") {
      await crediterParCartflox(r.id, p.sessionId, "cartflox", maintenant);
      return "confirmee";
    }
  }
  const apres = await prisma.recharge.findUnique({ where: { id: rechargeId }, select: { etat: true } });
  return (apres?.etat ?? etat) as EtatApresVerification;
}

/**
 * Pour la page de la cantine, relue toutes les 3 secondes : relit les paiements Cartflox encore en cours depuis moins
 * d'un jour, sur les demandes en attente et sur celles annulées entre-temps. Ainsi une recharge payée se crédite même si
 * la personne a fermé sa page et qu'aucun webhook n'est branché, et un paiement arrivé après une annulation se voit.
 */
export async function verifierRechargesEnAttente(maintenant = Date.now()) {
  if (!configCartflox()) return;
  const depuis = new Date(maintenant - 86_400_000);
  const enAttente = await prisma.recharge.findMany({
    where: {
      OR: [{ etat: "en_attente", creeLe: { gte: depuis } }, { etat: "annulee", annuleeLe: { gte: depuis } }],
      paiements: { some: { statut: { notIn: FINIS } } },
    },
    select: { id: true },
    orderBy: { creeLe: "desc" },
    take: 20,
  });
  await Promise.all(enAttente.map((r) => verifierRecharge(r.id, { maintenant })));
}

/**
 * Un webhook de Cartflox, signature déjà vérifiée : le paiement `sessionId` a changé. S'il n'est relié à aucune recharge,
 * on le relie à celle que ses métadonnées désignent (la page l'avait posée en créant le paiement), même si elle n'attend
 * plus : un paiement arrivé après une annulation doit rester visible. Puis on relit son statut chez Cartflox.
 */
export async function traiterWebhookCartflox(sessionId: string, rechargeIndiquee: string | null) {
  if (!sessionValable(sessionId)) return;
  let p = await prisma.paiementCartflox.findUnique({ where: { sessionId }, select: { rechargeId: true } });
  if (!p && rechargeIndiquee && /^[A-Za-z0-9_-]{1,64}$/.test(rechargeIndiquee)) {
    const lie = await lierSessionCartflox(rechargeIndiquee, sessionId, true);
    if (lie.ok) p = { rechargeId: rechargeIndiquee };
  }
  if (p) await verifierRecharge(p.rechargeId, { force: true });
}
