import { z } from "zod";
import { DESCRIPTION_MAX } from "@/lib/menu";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { noter } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Noter un repas servi, comme `noterRepas` du site : src/lib/operations.ts vérifie que le repas est le sien et servi.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({
  reservationId: z.string().min(1).max(40).regex(/^[a-z0-9]+$/i),
  note: z.number().int().min(1).max(5),
  mot: z.string().trim().max(DESCRIPTION_MAX).default(""),
});

export async function POST(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, `Une note de 1 à 5, et un mot de ${DESCRIPTION_MAX} caractères au plus`);
  if (!corps.ok) return corps.reponse;
  const r = await noter(moi.id, corps.donnees.reservationId, corps.donnees.note, corps.donnees.mot);
  return r.ok ? reponse(requete, { ok: true }) : erreur(requete, r.erreur, 409);
}
