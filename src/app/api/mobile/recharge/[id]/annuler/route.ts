import { annulerMaRecharge } from "@/app/(espace)/recharger/actions";
import { erreur, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Annuler sa demande de recharge : la même action que le site (annulerMaRecharge relit d'abord le paiement en ligne,
// puis src/lib/operations.ts n'annule que pour celui qui l'a demandée, tant qu'elle attend).
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function POST(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const r = await annulerMaRecharge((await params).id);
  return r.ok ? reponse(requete, { ok: true }) : erreur(requete, r.erreur, 409);
}
