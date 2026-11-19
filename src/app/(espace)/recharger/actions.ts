"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Identifiant } from "@/lib/donnees-parent";
import { fcfa } from "@/lib/format";
import { annulerRecharge, demanderRecharge } from "@/lib/operations";
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
  const r = await demanderRecharge(m, beneficiaireId, v.data.montant);
  if (!r.ok) return { erreur: r.erreur };
  revalidatePath("/recharger");
  redirect(`/recharger/${r.id}`);
}

/** Celui qui a demandé la recharge l'annule, tant que la cantine ne l'a pas confirmée. */
export async function annulerMaRecharge(id: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const m = await autorise("convive", "parent");
  if (!m) return { ok: false, erreur: SESSION };
  const v = Identifiant.safeParse(id);
  if (!v.success) return { ok: false, erreur: "Recharge introuvable" };
  const r = await annulerRecharge(m.id, v.data);
  if (r.ok) revalidatePath("/recharger");
  return r;
}
