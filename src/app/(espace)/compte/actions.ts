"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IDS_ALLERGENES, IDS_REGIMES } from "@/lib/listes";
import { enregistrerProfilAlimentaire, reglerSeuilAlerte } from "@/lib/operations";
import { autorise } from "@/lib/session";
import { SEUIL_ALERTE_MAX } from "@/lib/solde";

// Les réglages du convive : ce qu'il ne mange pas, et le solde sous lequel il veut être prévenu. Il ne règle que son
// propre compte : l'identifiant vient de sa session, jamais du navigateur.

type Reponse = { ok: true } | { ok: false; erreur: string };
const SESSION_FINIE: Reponse = { ok: false, erreur: "Ta session est finie, reconnecte-toi" };

const parmi = (permis: readonly string[]) => z.array(z.string().max(40)).max(permis.length).refine((valeurs) => valeurs.every((v) => permis.includes(v)));
const Profil = z.object({ allergenes: parmi(IDS_ALLERGENES), regimes: parmi(IDS_REGIMES) });

export async function enregistrerProfil(saisi: { allergenes: string[]; regimes: string[] }): Promise<Reponse> {
  const moi = await autorise("convive");
  if (!moi) return SESSION_FINIE;
  const v = Profil.safeParse(saisi);
  if (!v.success) return { ok: false, erreur: "Choisis dans la liste de la cantine" };
  const r = await enregistrerProfilAlimentaire(moi, moi.id, v.data);
  // Le profil change ce qui se réserve au menu.
  if (r.ok) { revalidatePath("/compte"); revalidatePath("/menu"); }
  return r;
}

const Seuil = z.number().int().min(0).max(SEUIL_ALERTE_MAX);

export async function enregistrerSeuil(seuil: number): Promise<Reponse> {
  const moi = await autorise("convive");
  if (!moi) return SESSION_FINIE;
  const v = Seuil.safeParse(seuil);
  if (!v.success) return { ok: false, erreur: `Un seuil entre 0 et ${SEUIL_ALERTE_MAX.toLocaleString("fr-FR")} francs, sans centimes` };
  const r = await reglerSeuilAlerte(moi, moi.id, v.data);
  // Le seuil décide du bandeau de solde bas, au menu comme ici.
  if (r.ok) { revalidatePath("/compte"); revalidatePath("/menu"); }
  return r;
}
