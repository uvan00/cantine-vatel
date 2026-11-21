import { plafondDe } from "@/lib/donnees";
import { JOURS_PASSES, ficheEnfant, type RepasEnfant } from "@/lib/donnees-parent";
import { dateLongue, de, fcfa } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourIso, jourLong } from "@/lib/jours";
import { ALLERGENES, REGIMES } from "@/lib/listes";
import { MARQUE } from "@/lib/marque";
import { erreur, refus, reponse } from "@/lib/mobile";
import { etiquettesDuProfil } from "@/lib/profil-alimentaire";
import { LIBELLE_ETAT, heureH } from "@/lib/reservation";
import { autorise, prenomDe } from "@/lib/session";
import { soldeBas } from "@/lib/solde";
import { enfantDuParent } from "../../commun";

// La fiche d'un enfant, comme la page /parent/enfant/<id> du site : son solde, ses repas (14 derniers jours et jours à
// venir), son profil alimentaire, son seuil d'alerte, son plafond de la semaine et ses 20 derniers mouvements.
// Seulement pour son parent : pour tout autre, un refus 403.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Un repas en mots ; à côté de l'état, la note d'un repas servi ou le remboursement d'un repas annulé (comme le site). */
const repasEnMots = (r: RepasEnfant) => ({
  id: r.id,
  jour: majuscule(jourLong(r.jour)),
  plat: r.plat,
  prix: r.prix,
  etat: r.etat,
  libelleEtat: LIBELLE_ETAT[r.etat],
  plus: r.etat === "annulee" ? "remboursé" : r.note !== null ? `noté ${r.note} sur 5` : null,
});

export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await autorise("parent");
  if (!moi) return refus(requete);
  const enfant = await enfantDuParent(requete, moi.id, (await params).id);
  if (!enfant.ok) return enfant.reponse;
  const instant = maintenant();
  const aujourdhui = jourIso(instant);
  const [fiche, plafond] = await Promise.all([ficheEnfant(enfant.id, instant), plafondDe(enfant.id, aujourdhui)]);
  if (!fiche) return erreur(requete, "Cet enfant est introuvable", 404);

  const { nom, profil, solde, repas, historique } = fiche;
  const prenom = prenomDe(nom);
  return reponse(requete, {
    id: enfant.id,
    nom,
    prenom,
    photo: fiche.photo,
    sousTitre: [profil.genre === "employe" ? "Employé" : "Élève", profil.classe].filter(Boolean).join(", "),
    solde,
    soldeBas: soldeBas(solde, profil.seuilAlerte),
    titreSoldeBas: `Le solde ${de(prenom)} est bas`,
    // Les repas arrivent du plus récent au plus ancien : ceux qui viennent se lisent dans l'ordre du calendrier.
    aVenir: repas.filter((r) => r.jour >= aujourdhui).reverse().map(repasEnMots),
    passes: repas.filter((r) => r.jour < aujourdhui).map(repasEnMots),
    titrePasses: `Les ${JOURS_PASSES} derniers jours`,
    profil: { allergenes: profil.allergenes, regimes: profil.regimes },
    allergenes: ALLERGENES.map((a) => ({ id: a.id, nom: majuscule(a.nom), image: a.image })),
    regimes: REGIMES.map((r) => ({ id: r.id, nom: majuscule(r.nom), image: r.image })),
    neMangePas: etiquettesDuProfil(profil),
    nomLogiciel: MARQUE.nom,
    seuil: profil.seuilAlerte,
    aideSeuil: `${prenom} voit la même alerte dans son compte`,
    plafond: { plafond: plafond.plafond, depense: plafond.depense, phrase: `${prenom} a réservé ${fcfa(plafond.depense)} de repas cette semaine` },
    historique: historique.map((l) => ({ id: l.id, libelle: l.libelle, montant: l.montant, quand: `${dateLongue(l.creeLe)} à ${heureH(l.creeLe)}` })),
  });
}
