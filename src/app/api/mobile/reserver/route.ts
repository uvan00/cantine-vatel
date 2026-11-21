import { z } from "zod";
import { heureValable } from "@/lib/creneaux";
import { lireCorps, refus, reponse, erreur } from "@/lib/mobile";
import { reserver } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Réserver un plat, comme `reserverPlat` du site (src/app/(espace)/menu/actions.ts) : le téléphone n'envoie que
// l'identifiant du plat du jour et l'heure de passage ; le prix, le solde, la clôture et le profil sont relus en base.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ menuJourId: z.string().min(1).max(40).regex(/^[a-z0-9]+$/i), creneau: z.string().max(5).nullable().default(null) });

export async function POST(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Ce plat n'est plus au menu");
  if (!corps.ok) return corps.reponse;
  const { menuJourId, creneau } = corps.donnees;
  if (creneau !== null && !heureValable(creneau)) return erreur(requete, "Cette heure de passage n'existe pas");
  const r = await reserver(moi.id, menuJourId, Date.now(), false, creneau);
  return r.ok ? reponse(requete, { jeton: r.jeton }) : erreur(requete, r.erreur, 409);
}
