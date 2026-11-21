import { verifierMonPaiement } from "@/app/(espace)/recharger/actions";
import { erreur, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// « J'ai payé, vérifier » : la même action que le site (verifierMonPaiement relit tout de suite le paiement chez
// Cartflox). Rend l'état de la recharge.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function POST(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const r = await verifierMonPaiement((await params).id);
  return "etat" in r ? reponse(requete, { etat: r.etat }) : erreur(requete, r.erreur, 404);
}
