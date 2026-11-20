import "server-only";
import { prisma } from "@/lib/db";
import { DEVISE_CARTFLOX, PAYS_CARTFLOX, modeDesCles, sessionValable, verdictPaiement, type ModeCartflox, type StatutSession } from "@/lib/cartflox";
import { crediterParCartflox, lierSessionCartflox, noterSessionCartflox } from "@/lib/operations";

// Cartflox côté serveur : les clés, la lecture du statut d'un paiement, et la décision de créditer.
// La page de paiement (SoftPay, dans un cadre servi par Cartflox) ne reçoit que la clé PUBLIQUE : elle permet de créer et
// de suivre un paiement, rien d'autre. Le serveur ne croit jamais la page sur parole : il relit chaque paiement chez
// Cartflox avec la clé SECRÈTE, qui ne quitte jamais le serveur, avant de créditer quoi que ce soit.
// Les clés arrivent par l'environnement (CARTFLOX_CLE_PUBLIQUE, CARTFLOX_CLE_SECRETE), posées par le propriétaire avec
// scripts/cle-cartflox.sh en local, ou dans l'environnement du serveur. Jamais dans le code ni dans git.

const api = () => (process.env.CARTFLOX_API || "https://cartflox.com").replace(/\/+$/, "");

/** Ce que la page a le droit de savoir pour afficher le paiement. Jamais la clé secrète. */
export type ConfigCartflox = { clePublique: string; mode: ModeCartflox; api: string; pays: typeof PAYS_CARTFLOX; devise: typeof DEVISE_CARTFLOX };

/** Le paiement en ligne est-il branché ? null si les deux clés ne sont pas là, ou ne vont pas ensemble. */
export function configCartflox(): ConfigCartflox | null {
  const mode = modeDesCles(process.env.CARTFLOX_CLE_PUBLIQUE, process.env.CARTFLOX_CLE_SECRETE);
  if (!mode) return null;
  return { clePublique: (process.env.CARTFLOX_CLE_PUBLIQUE ?? "").trim(), mode, api: api(), pays: PAYS_CARTFLOX, devise: DEVISE_CARTFLOX };
}

/** La clé secrète, seulement quand la configuration est complète. Elle signe aussi les webhooks de Cartflox. */
export const cleSecreteCartflox = () => (configCartflox() ? (process.env.CARTFLOX_CLE_SECRETE ?? "").trim() : null);

/** Le statut d'un paiement chez Cartflox ; null si Cartflox ne le connaît pas pour ces clés (autre compte, autre mode). */
async function lireStatut(sessionId: string): Promise<StatutSession | null> {
  const cle = cleSecreteCartflox();
  if (!cle) throw new Error("Cartflox n'est pas branché");
  const res = await fetch(`${api()}/api/v1/checkout/sessions/${encodeURIComponent(sessionId)}/status`, {
    headers: { Authorization: `Bearer ${cle}` },
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
