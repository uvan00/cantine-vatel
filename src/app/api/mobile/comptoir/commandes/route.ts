import { z } from "zod";
import { commandesDuJour, type VueCommandes } from "@/lib/donnees-admin";
import { estimationDuJour } from "@/lib/donnees-comptoir";
import { maintenant } from "@/lib/horloge";
import { jourLong } from "@/lib/jours";
import { erreur, refus, reponse } from "@/lib/mobile";
import { FILES, LIBELLE_ETAT, estimationLisible, heureH, lireFile, nomDeLaFile } from "@/lib/reservation";
import { CANTINE, autorise } from "@/lib/session";

// Les commandes d'aujourd'hui ou de demain, comme la page /admin/commandes du site (relue toutes les 3 secondes) : par
// plat, les repas réservés, servis, à servir, et les convives avec leur état en mots. Les phrases arrivent écrites.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Jour = z.enum(["aujourdhui", "demain"]);

/** L'état de la clôture en une phrase, la même que sur la page des commandes du site. */
function phraseCloture(d: VueCommandes) {
  if (d.cle === "demain") return `Réservations ouvertes jusqu'à demain ${d.clotureLisible} : ces nombres peuvent encore monter`;
  return d.cloturee ? `Réservations closes depuis ${d.clotureLisible} : ces nombres ne bougent plus` : `Réservations ouvertes jusqu'à ${d.clotureLisible}`;
}

export async function GET(requete: Request) {
  if (!(await autorise(...CANTINE))) return refus(requete);
  const jour = Jour.safeParse(new URL(requete.url).searchParams.get("jour") ?? "aujourdhui");
  if (!jour.success) return erreur(requete, "Ce jour ne se lit pas ici : aujourd'hui ou demain");
  const d = await commandesDuJour(jour.data, maintenant());
  const estimation = await estimationDuJour(d.jour);
  // Les trois files du comptoir, comptées sur les repas de ce jour, comme sur la page des commandes du site.
  const convives = d.plats.flatMap((p) => p.convives);
  const files = FILES.map((f) => {
    const les = convives.filter((c) => lireFile(c.file) === f.id);
    const servis = les.filter((c) => c.etat === "servie").length;
    return { id: f.id, nom: f.nom, pour: f.pour, reserves: les.length, servis, aServir: les.length - servis };
  });
  return reponse(requete, {
    cle: d.cle,
    jour: d.jour,
    jourLong: jourLong(d.jour),
    phraseCloture: phraseCloture(d),
    service: d.service,
    files,
    // Les repas sans réservation à prévoir en plus : la moyenne des derniers jours de service ; `repas` vide sans historique.
    estimation: { repas: estimation.estimation, services: estimation.services, phrase: estimationLisible(estimation.estimation, estimation.services) },
    plats: d.plats.map((p) => ({
      id: p.id,
      nom: p.nom,
      reserves: p.reserves,
      servis: p.servis,
      aServir: p.aServir,
      portions: p.portions,
      restantes: p.restantes,
      epuise: p.epuise,
      complet: p.complet,
      convives: p.convives.map((c) => ({
        id: c.id,
        nom: c.nom,
        photo: c.photo,
        groupe: c.groupe,
        code: c.code,
        etat: c.etat,
        libelleEtat: LIBELLE_ETAT[c.etat],
        serviA: c.serviLe ? heureH(c.serviLe) : null,
        // Sa file et son paiement : « a_payer » tant que la caisse n'a pas encaissé (« Servir » devient « Encaisser »).
        file: c.file,
        nomFile: nomDeLaFile(c.file),
        paiement: c.paiement,
        allergies: c.allergies,
        enCause: c.enCause,
      })),
    })),
  });
}
