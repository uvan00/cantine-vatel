import { enfantsDuParent, rechargesEnAttenteDe, semaineDesEnfants } from "@/lib/donnees-parent";
import { de } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourCourt, jourIso } from "@/lib/jours";
import { refus, reponse } from "@/lib/mobile";
import { etiquettesDuProfil } from "@/lib/profil-alimentaire";
import { LIBELLE_ETAT } from "@/lib/reservation";
import { autorise, prenomDe } from "@/lib/session";
import { soldeBas } from "@/lib/solde";
import { lignesEnAttente } from "../recharge/commun";

// L'accueil du parent, comme la page /parent du site : une carte par enfant (son solde, l'alerte de solde bas, ses repas
// de la semaine en mots), les recharges qui attendent la cantine. Les enfants viennent toujours du parent connecté
// (enfantsDuParent) : le téléphone ne choisit rien.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function GET(requete: Request) {
  const moi = await autorise("parent");
  if (!moi) return refus(requete);
  const instant = maintenant();
  const aujourdhui = jourIso(instant);
  const enfants = await enfantsDuParent(moi.id);
  const [semaines, enAttente] = await Promise.all([semaineDesEnfants(enfants.map((e) => e.id), instant), rechargesEnAttenteDe(moi.id)]);

  return reponse(requete, {
    moi,
    sousTitre: enfants.length > 1 ? "Les repas de la semaine et le solde de chacun" : enfants.length === 1 ? "Ses repas de la semaine et son solde" : null,
    enfants: enfants.map((e) => ({
      id: e.id,
      nom: e.nom,
      prenom: prenomDe(e.nom),
      classe: e.classe,
      photo: e.photo,
      neMangePas: etiquettesDuProfil(e),
      solde: e.solde,
      soldeBas: soldeBas(e.solde, e.seuil),
      titreSoldeBas: `Le solde ${de(prenomDe(e.nom))} est bas`,
      semaine: (semaines.get(e.id) ?? []).map((j) => ({
        jour: j.jour,
        libelle: j.jour === aujourdhui ? "aujourd'hui" : jourCourt(j.jour),
        aujourdhui: j.jour === aujourdhui,
        etat: j.etat,
        libelleEtat: j.etat ? LIBELLE_ETAT[j.etat] : "Rien de réservé",
      })),
    })),
    enAttente: lignesEnAttente(enAttente, moi.id, instant),
  });
}
