import { z } from "zod";
import { reglerPlafondEnfant } from "@/app/(espace)/parent/actions";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";
import { enfantDuParent } from "../commun";

// Le plafond des repas d'une semaine pour un enfant (null le retire) : la même action que le site, qui laisse
// src/lib/operations.ts relire les bornes (plafondValable) avant d'écrire.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ enfantId: z.string().max(64), plafond: z.number().int().nullable() });

export async function POST(requete: Request) {
  const moi = await autorise("parent");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Un plafond en francs, sans centimes");
  if (!corps.ok) return corps.reponse;
  const enfant = await enfantDuParent(requete, moi.id, corps.donnees.enfantId);
  if (!enfant.ok) return enfant.reponse;
  const r = await reglerPlafondEnfant(enfant.id, corps.donnees.plafond);
  return r.ok ? reponse(requete, { message: corps.donnees.plafond === null ? "Plus de plafond" : "C'est noté" }) : erreur(requete, r.erreur, 409);
}
