import { z } from "zod";
import { etatDuTicket } from "@/lib/donnees-convive";
import { erreur, refus, reponse } from "@/lib/mobile";
import { heureH } from "@/lib/reservation";
import { autorise } from "@/lib/session";

// Où en est un ticket, relu toutes les 3 secondes par l'application (comme /api/ticket/<jeton> pour le site) : le tampon
// « SERVI » tombe dès que le comptoir a scanné. Un ticket qui n'est pas le sien répond comme un ticket qui n'existe pas.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Jeton = z.string().regex(/^[0-9a-f]{32}$/);

export async function GET(requete: Request, { params }: { params: Promise<{ jeton: string }> }) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const jeton = Jeton.safeParse((await params).jeton);
  const ticket = jeton.success ? await etatDuTicket(jeton.data) : null;
  if (!ticket || ticket.conviveId !== moi.id) return erreur(requete, "Ticket inconnu", 404);
  return reponse(requete, { etat: ticket.etat, serviA: ticket.serviLe ? heureH(ticket.serviLe) : null });
}
