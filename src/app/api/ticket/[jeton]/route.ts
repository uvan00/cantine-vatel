import { z } from "zod";
import { etatDuTicket } from "@/lib/donnees-convive";
import { estCantine, autorise } from "@/lib/session";

// Où en est un ticket : l'écran du convive relit cette route toutes les 3 secondes, pour que le tampon « SERVI » tombe
// dès que le comptoir a scanné. Seuls le propriétaire du ticket et la cantine ont une réponse.
export const dynamic = "force-dynamic";

const Jeton = z.string().regex(/^[0-9a-f]{32}$/);
const sansCache = { "Cache-Control": "no-store" };

export async function GET(_requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const moi = await autorise();
  if (!moi) return Response.json({ erreur: "Connecte-toi pour voir ce ticket" }, { status: 401, headers: sansCache });

  const jeton = Jeton.safeParse((await params).jeton);
  const ticket = jeton.success ? await etatDuTicket(jeton.data) : null;
  // Un ticket qui n'est pas le sien répond comme un ticket qui n'existe pas.
  if (!ticket || (!estCantine(moi.role) && ticket.conviveId !== moi.id)) return Response.json({ erreur: "Ticket inconnu" }, { status: 404, headers: sansCache });

  return Response.json({ etat: ticket.etat, serviLe: ticket.serviLe, paiement: ticket.paiement }, { headers: sansCache });
}
