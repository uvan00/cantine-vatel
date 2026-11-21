import { z } from "zod";
import { IDS_ALLERGENES, IDS_REGIMES } from "@/lib/listes";
import { erreur, lireCorps, refus, repasEnMots, reponse } from "@/lib/mobile";
import { enregistrerProfilAlimentaire } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Enregistrer ce que le convive ne mange pas, comme `enregistrerProfil` du site. Il ne règle que son propre compte :
// l'identifiant vient de sa session, jamais du téléphone.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const parmi = (permis: readonly string[]) => z.array(z.string().max(40)).max(permis.length).refine((valeurs) => valeurs.every((v) => permis.includes(v)));
const Corps = z.object({ allergenes: parmi(IDS_ALLERGENES), regimes: parmi(IDS_REGIMES) });

export async function POST(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Choisis dans la liste de la cantine");
  if (!corps.ok) return corps.reponse;
  const r = await enregistrerProfilAlimentaire(moi, moi.id, corps.donnees);
  // `repasEnCause` : les repas déjà réservés que ce profil écarte, à dire tout de suite.
  return r.ok ? reponse(requete, { ok: true, repasEnCause: repasEnMots(r.repasEnCause) }) : erreur(requete, r.erreur, 409);
}
