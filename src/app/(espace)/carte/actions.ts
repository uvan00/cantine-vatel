"use server";

import { revalidatePath } from "next/cache";
import { estParentDe } from "@/lib/donnees";
import { Identifiant } from "@/lib/donnees-parent";
import { refaireCarte } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Refaire une carte de cantine : le convive refait la sienne, le parent celle de son enfant. L'ancienne ne passe plus
// au comptoir dès cet instant (src/lib/operations.ts, refaireCarte).

export async function refaireLaCarte(pour: string | null): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const moi = await autorise("convive", "parent");
  if (!moi) return { ok: false, erreur: "Ta session est finie, reconnecte-toi" };
  let id = moi.id;
  if (moi.role === "parent") {
    const enfant = Identifiant.safeParse(pour);
    if (!enfant.success || !(await estParentDe(moi.id, enfant.data))) return { ok: false, erreur: "Tu ne refais que la carte de ton enfant" };
    id = enfant.data;
  }
  const r = await refaireCarte(id);
  if (r.ok) revalidatePath("/carte");
  return r;
}
