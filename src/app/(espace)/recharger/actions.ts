"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { messageOperateur, telephoneIvoirien, type Operateur } from "@/lib/mobile-money";
import { configCartflox, debiterTelephone, operateursDuPaiement, ouvrirNouveauPaiement, paiementPourRecharge, verifierRecharge } from "@/lib/cartflox-serveur";
import { prisma } from "@/lib/db";
import { Identifiant, rechargeVisiblePar } from "@/lib/donnees-parent";
import { fcfa } from "@/lib/format";
import { annulerRecharge, demanderRecharge } from "@/lib/operations";
import { qrSvg } from "@/lib/qr";
import { RECHARGE_MAX, RECHARGE_MIN, montantValable } from "@/lib/recharge";
import { autorise, origine } from "@/lib/session";

// Demander une recharge, l'annuler. Le serveur valide le montant (bornes de src/lib/recharge.ts) et vérifie pour qui
// on recharge : un convive pour lui-même, un parent pour son enfant (src/lib/operations.ts, `peutAgirPour`).

const SESSION = "Ta session a expiré, reconnecte-toi";
const phraseMontant = `Un montant entre ${fcfa(RECHARGE_MIN)} et ${fcfa(RECHARGE_MAX)}, sans centimes`;

const Demande = z.object({
  /** L'enfant à recharger, pour un parent. Un convive recharge toujours son propre compte : ce champ est alors ignoré. */
  pour: z.string().max(64),
  // Le montant arrive tel qu'il a été choisi ou tapé : des chiffres, avec ou sans espaces.
  montant: z.string().max(20, phraseMontant).transform((t) => t.replace(/\s/g, ""))
    .pipe(z.string().min(1, "Choisis un montant").regex(/^\d{1,7}$/, phraseMontant)).transform(Number).refine(montantValable, phraseMontant),
});

/** Crée la demande, puis ouvre sa page (le QR, l'attente de la cantine). Ne revient que pour dire une erreur. */
export async function demanderUneRecharge(d: { pour: string; montant: string }): Promise<{ erreur: string }> {
  const m = await autorise("convive", "parent");
  if (!m) return { erreur: SESSION };
  const v = Demande.safeParse(d);
  if (!v.success) return { erreur: v.error.issues[0].message };
  let beneficiaireId = m.id;
  if (m.role === "parent") {
    const enfant = Identifiant.safeParse(v.data.pour);
    if (!enfant.success) return { erreur: "Choisis d'abord pour qui tu recharges" };
    beneficiaireId = enfant.data;
  }
  const r = await demanderRecharge(m, beneficiaireId, v.data.montant, configCartflox() ? "cartflox" : "pispi");
  if (!r.ok) return { erreur: r.erreur };
  revalidatePath("/recharger");
  redirect(`/recharger/${r.id}`);
}

/**
 * Celui qui a demandé la recharge l'annule, tant qu'elle n'est pas confirmée. Avant d'annuler, on relit ses paiements
 * Cartflox : un paiement déjà passé crédite la recharge au lieu de la laisser annuler.
 */
export async function annulerMaRecharge(id: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const m = await autorise("convive", "parent");
  if (!m) return { ok: false, erreur: SESSION };
  const v = Identifiant.safeParse(id);
  if (!v.success) return { ok: false, erreur: "Recharge introuvable" };
  if ((await verifierRecharge(v.data, { force: true })) === "confirmee") {
    revalidatePath("/recharger");
    return { ok: false, erreur: "Ton paiement est déjà arrivé : la recharge est créditée, plus rien à annuler" };
  }
  const r = await annulerRecharge(m.id, v.data);
  if (r.ok) revalidatePath("/recharger");
  return r;
}

const Session = z.string().regex(/^[a-z0-9]{12,40}$/, "Paiement inconnu");

type Echec = { ok: false; erreur: string };
const indisponible: Echec = { ok: false, erreur: "Le paiement en ligne ne répond pas pour l'instant, réessaie dans un instant" };

/** La recharge de cette personne, si elle attend encore son paiement. */
async function rechargeAPayer(m: { id: string }, rechargeId: string) {
  const id = Identifiant.safeParse(rechargeId);
  if (!id.success) return null;
  const r = await rechargeVisiblePar(id.data, m.id);
  return r && r.etat === "en_attente" ? r : null;
}

/**
 * Ouvre le paiement en ligne d'une recharge (comme le paiement natif de LinkAfr) : un paiement Cartflox pour le montant
 * de la recharge, lu dans la base, et les opérateurs de Côte d'Ivoire que le compte ouvre.
 */
export async function ouvrirPaiement(rechargeId: string): Promise<{ ok: true; sessionId: string; operateurs: Operateur[] } | Echec> {
  const m = await autorise("convive", "parent");
  if (!m) return { ok: false, erreur: SESSION };
  if (!configCartflox()) return { ok: false, erreur: "Le paiement en ligne n'est pas branché" };
  const r = await rechargeAPayer(m, rechargeId);
  if (!r) return { ok: false, erreur: "Cette recharge n'attend plus de paiement" };
  try {
    const sessionId = await paiementPourRecharge(r, m.nom, `${await origine()}/recharger/${r.id}`);
    return { ok: true, sessionId, operateurs: await operateursDuPaiement(sessionId) };
  } catch (e) {
    console.error("Cartflox, ouverture d'un paiement :", e);
    return indisponible;
  }
}

const Debit = z.object({
  rechargeId: z.string().max(64),
  sessionId: Session,
  gatewayId: z.string().min(1).max(80),
  methodCode: z.string().min(1).max(80),
  telephone: z.string().max(30),
  otp: z.string().regex(/^\d{4,8}$/, "Un code de 4 à 8 chiffres").optional(),
});

export type ReponsePaiement = {
  ok: true;
  /** Le paiement en cours (il change si le précédent n'était plus payable). */
  sessionId: string;
  statut: string;
  message: string | null;
  redirection: string | null;
  /** Le QR de l'adresse à ouvrir, pour la scanner avec son téléphone quand on paie depuis un ordinateur. */
  qrRedirection: string | null;
  ussd: string | null;
  /** L'état de la recharge après le débit (« confirmee » si le paiement est passé tout de suite). */
  etat: string;
};

/**
 * Déclenche le débit sur le téléphone, avec l'opérateur choisi et un numéro de Côte d'Ivoire. Le montant n'est pas reçu
 * du navigateur : c'est celui du paiement ouvert pour cette recharge. Un paiement qui n'est plus payable est remplacé
 * par un neuf, une fois.
 */
export async function payerParMobileMoney(entree: { rechargeId: string; sessionId: string; gatewayId: string; methodCode: string; telephone: string; otp?: string }): Promise<ReponsePaiement | Echec> {
  const m = await autorise("convive", "parent");
  if (!m) return { ok: false, erreur: SESSION };
  const v = Debit.safeParse(entree);
  if (!v.success) return { ok: false, erreur: v.error.issues[0].message };
  const telephone = telephoneIvoirien(v.data.telephone);
  if (!telephone) return { ok: false, erreur: "Un numéro de Côte d'Ivoire à 10 chiffres, par exemple 07 07 07 07 07" };
  const r = await rechargeAPayer(m, v.data.rechargeId);
  if (!r) return { ok: false, erreur: "Cette recharge n'attend plus de paiement" };
  const lien = await prisma.paiementCartflox.findUnique({ where: { sessionId: v.data.sessionId }, select: { rechargeId: true } });
  if (lien?.rechargeId !== r.id) return { ok: false, erreur: "Ce paiement n'est pas celui de cette recharge" };

  try {
    let sessionId = v.data.sessionId;
    const debit = { gatewayId: v.data.gatewayId, methodCode: v.data.methodCode, telephone, nom: m.nom, otp: v.data.otp };
    let d = await debiterTelephone(sessionId, debit);
    if (d.statut === "EXPIRE") {
      sessionId = await ouvrirNouveauPaiement(r, m.nom, `${await origine()}/recharger/${r.id}`);
      d = await debiterTelephone(sessionId, debit);
    }
    const etat = d.statut === "SUCCESS" ? ((await verifierRecharge(r.id, { force: true })) ?? "en_attente") : "en_attente";
    return {
      ok: true,
      sessionId,
      statut: d.statut,
      // Un débit en route (ou passé) n'a rien à dire ; un refus se dit en clair.
      message: ["SUCCESS", "PENDING", "REQUIRE_OTP", "OTP", "APP_LINK", "REDIRECT"].includes(d.statut) ? null : messageOperateur(d.message),
      redirection: d.redirection,
      qrRedirection: d.redirection ? await qrSvg(d.redirection) : null,
      ussd: d.ussd,
      etat,
    };
  } catch (e) {
    console.error("Cartflox, débit d'un téléphone :", e);
    return indisponible;
  }
}

/** « J'ai payé, vérifier » : on relit tout de suite le paiement chez Cartflox. Rend l'état de la recharge. */
export async function verifierMonPaiement(rechargeId: string): Promise<{ etat: string } | { erreur: string }> {
  const m = await autorise("convive", "parent");
  if (!m) return { erreur: SESSION };
  const id = Identifiant.safeParse(rechargeId);
  if (!id.success || !(await rechargeVisiblePar(id.data, m.id))) return { erreur: "Recharge introuvable" };
  const etat = await verifierRecharge(id.data, { force: true });
  if (etat === "confirmee") revalidatePath("/recharger");
  return { etat: etat ?? "en_attente" };
}
