import { z } from "zod";
import { reglerProfil } from "@/app/(espace)/parent/actions";
import { erreur, lireCorps, refus, repasEnMots, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";
import { enfantDuParent } from "../commun";

// Le profil alimentaire d'un enfant : la même action que le site (reglerProfil valide les listes, puis
// src/lib/operations.ts écrit après `peutAgirPour`).
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ enfantId: z.string().max(64), allergenes: z.array(z.string().max(40)).max(40), regimes: z.array(z.string().max(40)).max(40) });

export async function POST(requete: Request) {
  const moi = await autorise("parent");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Ce profil ne se lit pas");
  if (!corps.ok) return corps.reponse;
  const enfant = await enfantDuParent(requete, moi.id, corps.donnees.enfantId);
  if (!enfant.ok) return enfant.reponse;
  const r = await reglerProfil({ ...corps.donnees, enfantId: enfant.id });
  return r.ok ? reponse(requete, { message: r.message, repasEnCause: repasEnMots(r.repasEnCause ?? []) }) : erreur(requete, r.erreur, 409);
}
