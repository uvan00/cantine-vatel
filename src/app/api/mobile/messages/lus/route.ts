import { z } from "zod";
import { mesMessages } from "@/lib/donnees-messages";
import { lireCorps, refus, reponse } from "@/lib/mobile";
import { marquerLus } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Les messages affichés passent lus, comme `marquerMesLus` du site : seulement ceux qui sont adressés à cette personne.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ ids: z.array(z.string().min(1).max(40).regex(/^[a-z0-9]+$/i)).min(1).max(100) });

export async function POST(requete: Request) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Ces messages n'existent pas");
  if (!corps.ok) return corps.reponse;
  const siens = new Set((await mesMessages(moi)).map((m) => m.id));
  await marquerLus(moi.id, corps.donnees.ids.filter((id) => siens.has(id)));
  return reponse(requete, { ok: true });
}
