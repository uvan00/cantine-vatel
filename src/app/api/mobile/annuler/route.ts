import { z } from "zod";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { annuler } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Annuler un repas, comme `annulerRepas` du site : src/lib/operations.ts décide (peutAnnuler) et rembourse dans la
// même transaction.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ reservationId: z.string().min(1).max(40).regex(/^[a-z0-9]+$/i) });

export async function POST(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Réservation introuvable");
  if (!corps.ok) return corps.reponse;
  const r = await annuler(moi.id, corps.donnees.reservationId);
  return r.ok ? reponse(requete, { ok: true }) : erreur(requete, r.erreur, 409);
}
