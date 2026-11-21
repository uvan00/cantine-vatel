import { creerMonCodeFamille } from "@/app/(espace)/compte/actions";
import { DUREE_CODE_MIN } from "@/lib/code-famille";
import { erreur, refus, reponse } from "@/lib/mobile";
import { heureH } from "@/lib/reservation";
import { autorise } from "@/lib/session";

// Créer le code à donner à son parent : la même action que le site (creerMonCodeFamille). Un seul code à la fois,
// valable 15 minutes, pour un seul parent.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function POST(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const r = await creerMonCodeFamille();
  return r.ok ? reponse(requete, { code: r.code, valableJusqua: heureH(new Date(r.expire)), minutes: DUREE_CODE_MIN }) : erreur(requete, r.erreur, 409);
}
