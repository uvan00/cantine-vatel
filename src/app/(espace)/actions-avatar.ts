"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AVATARS } from "@/lib/avatars";
import { Identifiant } from "@/lib/donnees-parent";
import { choisirAvatar } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Choisir son avatar dessiné, ou celui de son enfant (src/components/choix-avatar.tsx). L'action vérifie la session et
// ce qu'elle reçoit ; src/lib/operations.ts vérifie qu'on touche bien à son compte ou à celui de son enfant.

type Reponse = { ok: true } | { ok: false; erreur: string };

const Choix = z.object({ pour: Identifiant, avatar: z.enum(AVATARS as [string, ...string[]]).nullable() });

export async function changerAvatar(saisi: { pour: string; avatar: string | null }): Promise<Reponse> {
  const moi = await autorise("convive", "parent");
  if (!moi) return { ok: false, erreur: "Ta session est finie, reconnecte-toi" };
  const v = Choix.safeParse(saisi);
  if (!v.success) return { ok: false, erreur: "Choisis un des avatars de la cantine" };
  const r = await choisirAvatar(moi, v.data.pour, v.data.avatar);
  // Le visage se voit partout : l'espace, la fiche de l'enfant, et les écrans de la cantine.
  if (r.ok) revalidatePath("/", "layout");
  return r.ok ? { ok: true } : r;
}
