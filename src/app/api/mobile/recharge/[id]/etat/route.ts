import { verifierRecharge } from "@/lib/cartflox-serveur";
import { Identifiant, rechargeEnDirect, rechargeVisiblePar } from "@/lib/donnees-parent";
import { erreur, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// L'état d'une recharge et le solde du compte rechargé, relus toutes les 3 secondes par l'écran d'attente (comme
// /api/recharge/<id> du site). Seulement pour celui qui l'a demandée ou pour son bénéficiaire.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const id = Identifiant.safeParse((await params).id);
  let r = id.success ? await rechargeVisiblePar(id.data, moi.id) : null;
  if (!r) return erreur(requete, "Recharge introuvable", 404);
  if (r.etat === "en_attente" && (await verifierRecharge(r.id)) === "confirmee") r = (await rechargeVisiblePar(r.id, moi.id)) ?? r;
  return reponse(requete, await rechargeEnDirect(r));
}
