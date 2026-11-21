"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { heureValable } from "@/lib/creneaux";
import { annuler, basculerFavori, demanderHorsDelai, reserver } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Réserver et annuler. Le navigateur n'envoie qu'un identifiant : le prix, le solde, la clôture et le profil alimentaire
// sont relus dans la base par src/lib/operations.ts, qui applique la même règle pure que l'écran (peutReserver).

const Id = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i);
const SESSION_FINIE = "Ta session est finie, reconnecte-toi";

/** Ce que ces deux gestes changent : le menu, les tickets, le solde et l'historique du compte. */
function rafraichir() {
  revalidatePath("/menu");
  revalidatePath("/ticket");
  revalidatePath("/(espace)/ticket/[jeton]", "page");
  revalidatePath("/compte");
}

/**
 * Réserve ce plat du jour pour le convive connecté, à l'heure de passage choisie quand la cantine a ouvert des créneaux.
 * `auComptoir` : il réserve sans payer, la caisse encaissera au scan (file réservation) ; sinon le prix part de son solde
 * tout de suite (file express). Rend le jeton de son ticket, ou le refus en une phrase.
 */
export async function reserverPlat(menuJourId: string, creneau: string | null = null, auComptoir = false): Promise<{ ok: true; jeton: string } | { ok: false; erreur: string }> {
  const moi = await autorise("convive");
  if (!moi) return { ok: false, erreur: SESSION_FINIE };
  const id = Id.safeParse(menuJourId);
  if (!id.success) return { ok: false, erreur: "Ce plat n'est plus au menu" };
  if (creneau !== null && !heureValable(creneau)) return { ok: false, erreur: "Cette heure de passage n'existe pas" };
  const r = await reserver(moi.id, id.data, Date.now(), false, creneau, false, { paiement: auComptoir === true ? "a_payer" : "solde" });
  rafraichir();
  return r;
}

/** Après la clôture : demande ce plat à la cantine, qui accepte ou refuse. Rien n'est payé avant sa réponse. */
export async function demanderRepas(menuJourId: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const moi = await autorise("convive");
  if (!moi) return { ok: false, erreur: SESSION_FINIE };
  const id = Id.safeParse(menuJourId);
  if (!id.success) return { ok: false, erreur: "Ce plat n'est plus au menu" };
  const r = await demanderHorsDelai(moi.id, id.data);
  revalidatePath("/menu");
  revalidatePath("/admin/commandes");
  return r.ok ? { ok: true } : r;
}

/** Annule un repas du convive connecté : il est remboursé dans la même transaction. */
export async function annulerRepas(reservationId: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const moi = await autorise("convive");
  if (!moi) return { ok: false, erreur: SESSION_FINIE };
  const id = Id.safeParse(reservationId);
  if (!id.success) return { ok: false, erreur: "Réservation introuvable" };
  const r = await annuler(moi.id, id.data);
  rafraichir();
  return r;
}

/** L'étoile d'un plat : le met en favori, ou l'en retire. Rend vrai s'il est maintenant favori. */
export async function basculerMonFavori(platId: string): Promise<{ ok: true; favori: boolean } | { ok: false; erreur: string }> {
  const moi = await autorise("convive");
  if (!moi) return { ok: false, erreur: SESSION_FINIE };
  const id = Id.safeParse(platId);
  if (!id.success) return { ok: false, erreur: "Ce plat n'existe plus" };
  const r = await basculerFavori(moi.id, id.data);
  revalidatePath("/menu");
  return r;
}
