import { z } from "zod";
import { AVATARS } from "@/lib/avatars";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { choisirAvatar } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Choisir son avatar dessiné (ou revenir aux initiales avec null), comme `changerAvatar` du site, pour soi seulement.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ avatar: z.enum(AVATARS as [string, ...string[]]).nullable() });

export async function POST(requete: Request) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Choisis un des avatars de la cantine");
  if (!corps.ok) return corps.reponse;
  const r = await choisirAvatar(moi, moi.id, corps.donnees.avatar);
  return r.ok ? reponse(requete, { ok: true }) : erreur(requete, r.erreur, 409);
}
