"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { traiterDemande } from "@/lib/operations";
import { CANTINE, autorise } from "@/lib/session";

// Répondre à une demande hors délai : accepter, c'est réserver pour le convive (payé sur son solde) ; refuser ne coûte
// rien. Les règles et l'écriture sont dans src/lib/operations.ts (traiterDemande).

const Id = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i);

export async function repondreDemande(demandeId: string, accepter: boolean): Promise<{ ok: true; phrase: string } | { ok: false; erreur: string }> {
  if (!(await autorise(...CANTINE))) return { ok: false, erreur: "Reconnecte-toi avec le compte de la cantine" };
  const id = Id.safeParse(demandeId);
  if (!id.success) return { ok: false, erreur: "Demande introuvable" };
  const r = await traiterDemande(id.data, accepter === true);
  if (!r.ok) return r;
  revalidatePath("/admin/commandes");
  revalidatePath("/menu");
  return { ok: true, phrase: r.code ? `${r.convive} : ${r.plat}, ticket ${r.code}` : `${r.convive} : demande refusée` };
}
