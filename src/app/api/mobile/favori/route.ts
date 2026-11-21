import { z } from "zod";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { basculerFavori } from "@/lib/operations";
import { autorise } from "@/lib/session";

// L'étoile d'un plat, comme `basculerMonFavori` du site : le met en favori ou l'en retire.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ platId: z.string().min(1).max(40).regex(/^[a-z0-9]+$/i) });

export async function POST(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Ce plat n'existe plus");
  if (!corps.ok) return corps.reponse;
  const r = await basculerFavori(moi.id, corps.donnees.platId);
  return r.ok ? reponse(requete, { favori: r.favori }) : erreur(requete, r.erreur, 409);
}
