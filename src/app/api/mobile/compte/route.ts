import { AVATARS } from "@/lib/avatars";
import { parentsDe, profilDe, soldeDuCompte } from "@/lib/donnees";
import { journalDe } from "@/lib/donnees-convive";
import { dateLongue } from "@/lib/format";
import { ALLERGENES, REGIMES } from "@/lib/listes";
import { MARQUE } from "@/lib/marque";
import { refus, reponse } from "@/lib/mobile";
import { heureH } from "@/lib/reservation";
import { etiquettesDuProfil } from "@/lib/profil-alimentaire";
import { autorise } from "@/lib/session";
import { SEUIL_ALERTE_DEFAUT, soldeBas } from "@/lib/solde";

// Le compte du convive, comme la page /compte du site : son solde (la somme de son journal, src/lib/solde.ts), son
// profil alimentaire avec les listes de la cantine, ses parents reliés, son avatar et ses 30 derniers mouvements. Le code
// famille ne sort plus d'ici : il se crée à la demande, pour 15 minutes (route code-famille).
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

/** L'historique montre les 30 derniers mouvements, comme sur le site. */
const MOUVEMENTS = 30;
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

export async function GET(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const [solde, profil, journal, parents] = await Promise.all([soldeDuCompte(moi.id), profilDe(moi.id), journalDe(moi.id, MOUVEMENTS), parentsDe(moi.id)]);
  return reponse(requete, {
    moi,
    solde,
    soldeBas: soldeBas(solde, profil?.seuilAlerte ?? SEUIL_ALERTE_DEFAUT),
    profil: profil && { allergenes: profil.allergenes, regimes: profil.regimes },
    parents,
    allergenes: ALLERGENES.map((a) => ({ id: a.id, nom: majuscule(a.nom), image: a.image })),
    regimes: REGIMES.map((r) => ({ id: r.id, nom: majuscule(r.nom), image: r.image })),
    // Ce qu'il ne mange pas, en étiquettes (un dessin et un nom) : ses allergènes, puis ses régimes.
    neMangePas: profil ? etiquettesDuProfil(profil) : [],
    nomLogiciel: MARQUE.nom,
    avatars: AVATARS,
    journal: journal.map((l) => ({ id: l.id, libelle: l.libelle, montant: l.montant, quand: `${dateLongue(l.quand)} à ${heureH(l.quand)}` })),
  });
}
