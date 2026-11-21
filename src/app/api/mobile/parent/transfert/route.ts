import { z } from "zod";
import { transferer } from "@/app/(espace)/parent/actions";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Faire passer de l'argent d'un enfant à l'autre : la même action que le site. src/lib/operations.ts vérifie que les
// deux sont des enfants de ce parent et relit les soldes dans la transaction (refusTransfert de src/lib/solde.ts).
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ deId: z.string().max(64), versId: z.string().max(64), montant: z.number().int().min(1).max(10_000_000) });

export async function POST(requete: Request) {
  const moi = await autorise("parent");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Choisis deux enfants et un montant");
  if (!corps.ok) return corps.reponse;
  const r = await transferer(corps.donnees);
  return r.ok ? reponse(requete, { message: r.message }) : erreur(requete, r.erreur, 409);
}
