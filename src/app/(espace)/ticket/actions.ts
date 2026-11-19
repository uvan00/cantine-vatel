"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DESCRIPTION_MAX } from "@/lib/menu";
import { noter } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Noter un repas servi. Le serveur vérifie que le repas est bien celui du convive connecté et qu'il a été servi
// (src/lib/operations.ts) : l'écran n'envoie que la note et le mot.

const Note = z.object({
  reservationId: z.string().min(1).max(40).regex(/^[a-z0-9]+$/i),
  note: z.number().int().min(1).max(5),
  mot: z.string().max(DESCRIPTION_MAX),
});

export async function noterRepas(reservationId: string, note: number, mot: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const moi = await autorise("convive");
  if (!moi) return { ok: false, erreur: "Ta session est finie, reconnecte-toi" };
  const v = Note.safeParse({ reservationId, note, mot });
  if (!v.success) return { ok: false, erreur: `Une note de 1 à 5, et un mot de ${DESCRIPTION_MAX} caractères au plus` };
  const r = await noter(moi.id, v.data.reservationId, v.data.note, v.data.mot);
  if (!r.ok) return r;
  // La note se lit sur les tickets, et sa moyenne sur le menu.
  revalidatePath("/ticket");
  revalidatePath("/(espace)/ticket/[jeton]", "page");
  revalidatePath("/menu");
  return r;
}
