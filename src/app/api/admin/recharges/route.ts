import { verifierRechargesEnAttente } from "@/lib/cartflox-serveur";
import { vueRecharges } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { CANTINE, autorise } from "@/lib/session";

// Les recharges qui attendent la cantine et les dernières closes, relues toutes les 3 secondes. Avant de lire, les
// paiements Cartflox en cours sont relus chez Cartflox : un paiement passé se crédite tout seul sous les yeux de la cantine.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await autorise(...CANTINE))) return Response.json({ erreur: "Réservé à la cantine" }, { status: 401 });
  await verifierRechargesEnAttente().catch(() => {});
  return Response.json(await vueRecharges(maintenant()));
}
