"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { refaireCarte } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Les badges de cantine : refaire celui d'un convive (perdu, prêté, photographié). L'ancien QR ne passe plus au
// comptoir dès cet instant ; le nouveau badge s'imprime depuis la même page.

const Id = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i);

export async function refaireBadge(conviveId: string): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (!(await autorise("admin"))) return { ok: false, erreur: "Reconnecte-toi avec le compte de la cantine" };
  const id = Id.safeParse(conviveId);
  if (!id.success) return { ok: false, erreur: "Ce convive n'existe plus" };
  const r = await refaireCarte(id.data);
  if (r.ok) revalidatePath("/admin/badges");
  return r;
}
