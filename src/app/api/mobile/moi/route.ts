import { nombreNonLus } from "@/lib/donnees-messages";
import { refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Qui est connecté avec ce jeton, et combien de messages il n'a pas lus (la pastille de l'onglet « Messages »).
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function GET(requete: Request) {
  const moi = await autorise();
  if (!moi) return refus(requete);
  return reponse(requete, { moi, nonLus: await nombreNonLus(moi) });
}
