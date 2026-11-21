"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ajouterDepense, retirerDepense } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Les dépenses de la cantine : le serveur revérifie tout (src/lib/comptabilite.ts, refusDepense) et écrit
// (src/lib/operations.ts). Rien ne touche les soldes des élèves.

const REFUS = "Reconnecte-toi avec le compte de la cantine";
const Saisie = z.object({
  jour: z.string().max(10),
  categorie: z.string().max(20),
  libelle: z.string().max(200),
  montant: z.number(),
  fournisseur: z.string().max(200),
  moyen: z.string().max(20),
});

export async function noterDepense(saisie: z.infer<typeof Saisie>): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const m = await autorise("admin");
  if (!m) return { ok: false, erreur: REFUS };
  const v = Saisie.safeParse(saisie);
  if (!v.success) return { ok: false, erreur: "Une dépense incomplète" };
  const r = await ajouterDepense(v.data, m.nom);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  revalidatePath("/admin/recharges", "layout");
  return { ok: true };
}

export async function supprimerDepense(id: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (!(await autorise("admin"))) return { ok: false, erreur: REFUS };
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return { ok: false, erreur: "Cette dépense n'existe plus" };
  const r = await retirerDepense(id);
  if (!r.ok) return { ok: false, erreur: r.erreur };
  revalidatePath("/admin/recharges", "layout");
  return { ok: true };
}
