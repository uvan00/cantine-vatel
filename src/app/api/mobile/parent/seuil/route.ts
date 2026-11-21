import { z } from "zod";
import { reglerSeuil } from "@/app/(espace)/parent/actions";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";
import { enfantDuParent } from "../commun";

// Le seuil d'alerte d'un enfant, tel qu'il a été tapé : la même action que le site (reglerSeuil le valide, puis
// src/lib/operations.ts écrit).
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ enfantId: z.string().max(64), seuil: z.string().max(20) });

export async function POST(requete: Request) {
  const moi = await autorise("parent");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Un seuil en francs, sans centimes");
  if (!corps.ok) return corps.reponse;
  const enfant = await enfantDuParent(requete, moi.id, corps.donnees.enfantId);
  if (!enfant.ok) return enfant.reponse;
  const r = await reglerSeuil({ enfantId: enfant.id, seuil: corps.donnees.seuil });
  return r.ok ? reponse(requete, { message: r.message }) : erreur(requete, r.erreur, 409);
}
