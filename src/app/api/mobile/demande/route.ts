import { z } from "zod";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { demanderHorsDelai } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Après la clôture : demander un plat à la cantine, comme `demanderRepas` du site. Rien n'est payé avant sa réponse.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ menuJourId: z.string().min(1).max(40).regex(/^[a-z0-9]+$/i) });

export async function POST(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Ce plat n'est plus au menu");
  if (!corps.ok) return corps.reponse;
  const r = await demanderHorsDelai(moi.id, corps.donnees.menuJourId);
  return r.ok ? reponse(requete, { ok: true }) : erreur(requete, r.erreur, 409);
}
