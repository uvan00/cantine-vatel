import { Identifiant, rechargeEnDirect, rechargeVisiblePar } from "@/lib/donnees-parent";
import { autorise } from "@/lib/session";

// L'état d'une recharge et le solde du compte rechargé, relus toutes les 3 secondes par la page d'attente.
// Seulement pour celui qui a demandé la recharge ou pour son bénéficiaire : pour tout autre, elle n'existe pas.
export const dynamic = "force-dynamic";

const reponse = (corps: unknown, status = 200) => Response.json(corps, { status, headers: { "cache-control": "no-store" } });

export async function GET(_requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = await autorise();
  if (!m) return reponse({ erreur: "Connecte-toi" }, 401);
  const id = Identifiant.safeParse((await params).id);
  const r = id.success ? await rechargeVisiblePar(id.data, m.id) : null;
  if (!r) return reponse({ erreur: "Recharge introuvable" }, 404);
  return reponse(await rechargeEnDirect(r));
}
