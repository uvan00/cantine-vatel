import { mesMessages } from "@/lib/donnees-messages";
import { refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Les messages de la cantine pour la personne connectée, comme la page /messages du site : les épinglés d'abord.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function GET(requete: Request) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  return reponse(requete, { messages: await mesMessages(moi) });
}
