import { vueRecharges } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { autorise } from "@/lib/session";

// Les recharges qui attendent la cantine et les dernières closes, relues toutes les 3 secondes.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await autorise("admin"))) return Response.json({ erreur: "Réservé à la cantine" }, { status: 401 });
  return Response.json(await vueRecharges(maintenant()));
}
