"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ajouterResponsable, changerActif, nouveauMotDePasse } from "@/lib/operations";
import { autorise } from "@/lib/session";

// L'équipe de la cantine (demande du propriétaire du 21/11/2026) : seul l'admin crée un responsable de cantine, le
// désactive ou lui donne un nouveau mot de passe. Les règles sont dans src/lib/equipe.ts, l'écriture dans
// src/lib/operations.ts.

type Retour = { ok: true } | { ok: false; erreur: string };
const REFUS: Retour = { ok: false, erreur: "Seul l'admin de la cantine gère l'équipe" };

const Nouveau = z.object({ nom: z.string().max(200), email: z.string().max(200), motDePasse: z.string().max(200) });

export async function ajouterUnResponsable(d: z.infer<typeof Nouveau>): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = Nouveau.safeParse(d);
  if (!v.success) return { ok: false, erreur: "Son nom, son e-mail et un mot de passe" };
  const r = await ajouterResponsable(v.data);
  if (r.ok) revalidatePath("/admin/reglages");
  return r;
}

const Id = z.string().min(1).max(100);

export async function activerResponsable(userId: string, actif: boolean): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = Id.safeParse(userId);
  if (!v.success) return { ok: false, erreur: "Ce compte n'existe plus" };
  const r = await changerActif(v.data, actif === true);
  if (r.ok) revalidatePath("/admin/reglages");
  return r;
}

export async function changerMotDePasse(userId: string, motDePasse: string): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = z.object({ userId: Id, motDePasse: z.string().max(200) }).safeParse({ userId, motDePasse });
  if (!v.success) return { ok: false, erreur: "Un mot de passe d'au moins 8 caractères" };
  return nouveauMotDePasse(v.data.userId, v.data.motDePasse);
}
