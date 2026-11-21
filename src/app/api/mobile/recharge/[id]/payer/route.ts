import { z } from "zod";
import { payerParMobileMoney } from "@/app/(espace)/recharger/actions";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Débiter le téléphone : la même action que le site (payerParMobileMoney). Le montant n'est pas reçu : c'est celui du
// paiement ouvert pour cette recharge. Le serveur relit le paiement avec sa clé secrète avant de créditer.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({
  sessionId: z.string().max(40),
  gatewayId: z.string().max(80),
  methodCode: z.string().max(80),
  telephone: z.string().max(30),
  otp: z.string().max(8).optional(),
});

export async function POST(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Choisis un opérateur et écris ton numéro");
  if (!corps.ok) return corps.reponse;
  const r = await payerParMobileMoney({ rechargeId: (await params).id, ...corps.donnees });
  if (!r.ok) return erreur(requete, r.erreur, 409);
  return reponse(requete, { sessionId: r.sessionId, statut: r.statut, message: r.message, redirection: r.redirection, ussd: r.ussd, etat: r.etat });
}
