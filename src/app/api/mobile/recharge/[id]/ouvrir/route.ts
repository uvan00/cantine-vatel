import { ouvrirPaiement } from "@/app/(espace)/recharger/actions";
import { erreur, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Ouvrir le paiement Mobile Money d'une recharge : la même action que le site (ouvrirPaiement). Le serveur ouvre un
// paiement Cartflox pour le montant lu dans la base et rend les opérateurs de Côte d'Ivoire. Sans clés, il le dit.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function POST(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const r = await ouvrirPaiement((await params).id);
  return r.ok ? reponse(requete, { sessionId: r.sessionId, operateurs: r.operateurs }) : erreur(requete, r.erreur, 409);
}
