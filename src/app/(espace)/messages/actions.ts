"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { mesMessages } from "@/lib/donnees-messages";
import { marquerLus } from "@/lib/operations";
import { autorise } from "@/lib/session";

const Ids = z.array(z.string().min(1).max(40).regex(/^[a-z0-9]+$/i)).min(1).max(100);

/** Les messages affichés passent lus pour la personne connectée, seulement ceux qui lui sont adressés. */
export async function marquerMesLus(ids: string[]): Promise<void> {
  const moi = await autorise("convive", "parent");
  const v = Ids.safeParse(ids);
  if (!moi || !v.success) return;
  const siens = new Set((await mesMessages(moi)).map((m) => m.id));
  await marquerLus(moi.id, v.data.filter((id) => siens.has(id)));
  // La pastille de l'onglet vit dans la mise en page de l'espace.
  revalidatePath("/", "layout");
}
