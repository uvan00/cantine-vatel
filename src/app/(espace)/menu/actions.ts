"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { annuler, reserver } from "@/lib/operations";
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

/** Réserve ce plat du jour pour le convive connecté. Rend le jeton de son ticket, ou le refus en une phrase. */
export async function reserverPlat(menuJourId: string): Promise<{ ok: true; jeton: string } | { ok: false; erreur: string }> {
  const moi = await autorise("convive");
  if (!moi) return { ok: false, erreur: SESSION_FINIE };
  const id = Id.safeParse(menuJourId);
  if (!id.success) return { ok: false, erreur: "Ce plat n'est plus au menu" };
  const r = await reserver(moi.id, id.data);
  rafraichir();
  return r;
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
