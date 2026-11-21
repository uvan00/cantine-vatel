"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { reserver, peserRestes } from "@/lib/operations";
import { lireKilos } from "@/lib/restes";
import type { Etiquette } from "@/lib/listes";
import { autorise } from "@/lib/session";

// Deux gestes de la cantine sur la page des commandes : peser les restes d'un plat après le service, et réserver pour
// un convive (l'élève sans téléphone, au comptoir). Chacun vérifie que c'est la cantine qui appelle, valide ce qu'il
// reçoit, puis laisse src/lib/operations.ts écrire avec les règles de src/lib/restes.ts et src/lib/reservation.ts.

export type Retour = { ok: true } | { ok: false; erreur: string };
const REFUS = { ok: false as const, erreur: "Reconnecte-toi avec le compte de la cantine" };
const ILLISIBLE = { ok: false as const, erreur: "Cette demande ne se lit pas, recharge la page" };

const Id = z.string().min(1).max(64);

/** Les restes d'un plat, tapés en kilos (« 1,3 ») ; un champ vide efface la pesée. */
export async function peserLesRestes(d: { menuJourId: string; kilos: string }): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = z.object({ menuJourId: Id, kilos: z.string().max(20) }).safeParse(d);
  if (!v.success) return ILLISIBLE;
  const vide = v.data.kilos.trim() === "";
  const grammes = vide ? null : lireKilos(v.data.kilos);
  if (!vide && grammes === null) return { ok: false, erreur: "Un poids en kilos, comme sur la balance : 1,3 ou 0,45" };
  const r = await peserRestes(v.data.menuJourId, grammes);
  if (r.ok) revalidatePath("/admin");
  return r;
}

/** `enCause` : quand le profil alimentaire du convive écarte ce plat, ce qui l'écarte, avec son dessin. */
export type RetourReservation = { ok: true; plat: string; code: string } | { ok: false; erreur: string; enCause?: Etiquette[] };

/** La cantine réserve pour un convive, avec les règles de toujours (solde, profil, portions), même après la clôture du jour. */
export async function reserverPourConvive(d: { conviveId: string; menuJourId: string }): Promise<RetourReservation> {
  if (!(await autorise("admin"))) return REFUS;
  const v = z.object({ conviveId: Id, menuJourId: Id }).safeParse(d);
  if (!v.success) return ILLISIBLE;
  const r = await reserver(v.data.conviveId, v.data.menuJourId, Date.now(), true);
  if (!r.ok) return r;
  revalidatePath("/admin");
  return { ok: true, plat: r.plat, code: r.code };
}
