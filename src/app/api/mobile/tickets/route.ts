import { ticketsDe, type Repas } from "@/lib/donnees-convive";
import { maintenant } from "@/lib/horloge";
import { jourIso, jourLong, jourProche } from "@/lib/jours";
import { refus, reponse } from "@/lib/mobile";
import { LIBELLE_ETAT, etatAffiche, heureH } from "@/lib/reservation";
import { autorise } from "@/lib/session";

// Les tickets du convive, comme la page /ticket du site : celui d'aujourd'hui, ceux qui arrivent, les dix derniers repas
// passés. Chaque repas arrive avec son état affiché (« non retiré » se calcule ici, par etatAffiche) et ses dates en mots.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

function enLigne(r: Repas, instant: number) {
  const etat = etatAffiche(r, instant);
  return {
    id: r.id,
    jeton: r.jeton,
    code: r.code,
    plat: r.plat,
    prix: r.prix,
    jour: r.jour,
    jourLong: jourLong(r.jour),
    quand: majuscule(jourProche(r.jour, instant)),
    etat,
    libelleEtat: LIBELLE_ETAT[etat],
    serviA: r.serviLe ? heureH(r.serviLe) : null,
    note: r.note,
    mot: r.mot,
  };
}

export async function GET(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const instant = maintenant();
  const { duJour, aVenir, passes } = await ticketsDe(moi.id, jourIso(instant));
  return reponse(requete, {
    duJour: duJour && enLigne(duJour, instant),
    aVenir: aVenir.map((r) => enLigne(r, instant)),
    passes: passes.map((r) => enLigne(r, instant)),
  });
}
