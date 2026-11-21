import { z } from "zod";
import { retirerMonParent } from "@/app/(espace)/compte/actions";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Retirer un parent de son compte : la même action que le site (retirerMonParent). Le convive ne retire que de son
// propre compte : son identifiant vient de sa session.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ parentId: z.string().min(1).max(64) });

export async function POST(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Ce parent n'est plus relié à ton compte");
  if (!corps.ok) return corps.reponse;
  const r = await retirerMonParent(corps.donnees.parentId);
  return r.ok ? reponse(requete, { ok: true }) : erreur(requete, r.erreur, 409);
}
