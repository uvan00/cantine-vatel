import { z } from "zod";
import { commandesDuJour, type VueCommandes } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { jourLong } from "@/lib/jours";
import { erreur, refus, reponse } from "@/lib/mobile";
import { LIBELLE_ETAT, heureH } from "@/lib/reservation";
import { autorise } from "@/lib/session";

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
  if (!(await autorise("admin"))) return refus(requete);
  const jour = Jour.safeParse(new URL(requete.url).searchParams.get("jour") ?? "aujourdhui");
  if (!jour.success) return erreur(requete, "Ce jour ne se lit pas ici : aujourd'hui ou demain");
  const d = await commandesDuJour(jour.data, maintenant());
  return reponse(requete, {
    cle: d.cle,
    jour: d.jour,
    jourLong: jourLong(d.jour),
    phraseCloture: phraseCloture(d),
    service: d.service,
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
        allergies: c.allergies,
        enCause: c.enCause,
      })),
    })),
  });
}
