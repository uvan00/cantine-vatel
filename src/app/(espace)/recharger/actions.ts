"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { configCartflox, verifierRecharge } from "@/lib/cartflox-serveur";
import { Identifiant, rechargeVisiblePar } from "@/lib/donnees-parent";
import { fcfa } from "@/lib/format";
import { annulerRecharge, demanderRecharge, lierSessionCartflox } from "@/lib/operations";
import { RECHARGE_MAX, RECHARGE_MIN, montantValable } from "@/lib/recharge";
import { autorise } from "@/lib/session";

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

/**
 * Le cadre de paiement vient de créer un paiement chez Cartflox : on le relie à la recharge, pour pouvoir le relire même
 * si la page se ferme. Seulement pour celui qui a demandé la recharge ou pour son bénéficiaire.
 */
export async function lierPaiement(rechargeId: string, sessionId: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const m = await autorise("convive", "parent");
  if (!m) return { ok: false, erreur: SESSION };
  const id = Identifiant.safeParse(rechargeId), s = Session.safeParse(sessionId);
  if (!id.success || !s.success || !(await rechargeVisiblePar(id.data, m.id))) return { ok: false, erreur: "Recharge introuvable" };
  return lierSessionCartflox(id.data, s.data);
}

/**
 * Cartflox annonce la réussite dans la page : on ne le croit pas sur parole, on relit le paiement chez Cartflox avec la clé
 * secrète. Rend l'état de la recharge après la vérification.
 */
export async function verifierMonPaiement(rechargeId: string, sessionId: string): Promise<{ etat: string } | { erreur: string }> {
  const m = await autorise("convive", "parent");
  if (!m) return { erreur: SESSION };
  const id = Identifiant.safeParse(rechargeId), s = Session.safeParse(sessionId);
  if (!id.success || !s.success || !(await rechargeVisiblePar(id.data, m.id))) return { erreur: "Recharge introuvable" };
  // La session a pu naître avant que le lien soit posé (page rechargée) : on la relie d'abord, sans erreur si c'est fait.
  await lierSessionCartflox(id.data, s.data);
  const etat = await verifierRecharge(id.data, { force: true });
  if (etat === "confirmee") revalidatePath("/recharger");
  return { etat: etat ?? "en_attente" };
}
