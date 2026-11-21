"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { enregistrerReglages } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Les réglages de la cantine : l'heure de clôture des réservations et les heures de passage. Le serveur revalide tout
// (src/lib/reglages.ts, erreurReglages) avant d'écrire.

const Reglages = z.object({
  heureCloture: z.number().int(),
  creneauxActifs: z.boolean(),
  creneauDebut: z.string().max(5),
  creneauFin: z.string().max(5),
  creneauMinutes: z.number().int(),
  creneauCapacite: z.number().int(),
  remiseReduit: z.number().int(),
  remisePersonnel: z.number().int(),
});

export async function enregistrer(saisi: z.infer<typeof Reglages>): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (!(await autorise("admin"))) return { ok: false, erreur: "Reconnecte-toi avec le compte de la cantine" };
  const v = Reglages.safeParse(saisi);
  if (!v.success) return { ok: false, erreur: "Des réglages incomplets" };
  const r = await enregistrerReglages(v.data);
  // L'heure de clôture se lit partout : l'accueil, le menu, les tickets, le tableau de bord.
  if (r.ok) revalidatePath("/", "layout");
  return r;
}
