import { z } from "zod";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { confirmerRecharge } from "@/lib/operations";
import { autorise } from "@/lib/session";

// « Paiement reçu », comme `paiementRecu` du site : src/lib/operations.ts (confirmerRecharge) passe la recharge de « en
// attente » à « confirmée » une seule fois, écrit le mouvement et monte le solde, dans la même transaction.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ id: z.string().min(1).max(64) });

export async function POST(requete: Request) {
  const admin = await autorise("admin");
  if (!admin) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Recharge introuvable");
  if (!corps.ok) return corps.reponse;
  const r = await confirmerRecharge(admin.id, corps.donnees.id);
  return r.ok ? reponse(requete, { ok: true }) : erreur(requete, r.erreur, 409);
}
