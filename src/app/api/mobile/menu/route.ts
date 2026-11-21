import { lireReglages, plafondDe, profilDe, soldeDuCompte } from "@/lib/donnees";
import { demandeDuJour, joursAuMenu, mesFavoris, platsAuMenu, prisParCreneau, repasDuJour } from "@/lib/donnees-convive";
import { creneauLisible, etatsCreneaux } from "@/lib/creneaux";
import { estNouveau, favoriAuMenu } from "@/lib/favoris";
import { liste } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { cloturePassee, clotureLisible, jourCourt, jourIso, jourLong, jourProche, numeroDuJour } from "@/lib/jours";
import { etiquettesRegimes, nomAllergene } from "@/lib/listes";
import { MARQUE } from "@/lib/marque";
import { refus, reponse } from "@/lib/mobile";
import { etiquettesDuPlat, etiquettesEnCause, incompatibilites } from "@/lib/profil-alimentaire";
import { heuresDePassage } from "@/lib/reglages";
import { LIBELLE_ETAT, etatAffiche, peutAnnuler, peutDemanderHorsDelai, peutReserver, portionsRestantes } from "@/lib/reservation";
import { autorise } from "@/lib/session";
import { proposerSemaine } from "@/lib/semaine";
import { SEUIL_ALERTE_DEFAUT, mouvementRepas, soldeBas, soldeDe } from "@/lib/solde";

// Le menu de la semaine pour l'application : exactement ce que calcule la page /menu du site (src/app/(espace)/menu/page.tsx),
// avec les mêmes fonctions. Chaque plat arrive avec son verdict (peutReserver) et sa phrase de refus ; le téléphone
// affiche, il ne décide rien. Les dates arrivent déjà écrites en mots.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

function titreDuJour(jour: string, instant: number) {
  const proche = jourProche(jour, instant);
  return majuscule(proche === jourLong(jour) ? proche : `${proche}, ${jourLong(jour)}`);
}

export async function GET(requete: Request) {
  const moi = await autorise("convive");
  if (!moi) return refus(requete);
  const demande = new URL(requete.url).searchParams.get("jour");
  const instant = maintenant();
  const aujourdhui = jourIso(instant);

  const [jours, solde, profil, reglages, favoris] = await Promise.all([joursAuMenu(moi.id, aujourdhui), soldeDuCompte(moi.id), profilDe(moi.id), lireReglages(), mesFavoris(moi.id)]);
  const h = reglages.heureCloture;
  const choisi = (jours.find((j) => j.jour === demande) ?? jours.find((j) => j.jour === aujourdhui) ?? jours[0])?.jour ?? null;
  const [plats, repas, pris, maDemande, plafond] = choisi
    ? await Promise.all([platsAuMenu(choisi), repasDuJour(moi.id, choisi), prisParCreneau(choisi), demandeDuJour(moi.id, choisi), plafondDe(moi.id, choisi)])
    : [[], null, {}, null, null];
  const heures = heuresDePassage(reglages);
  const creneaux = choisi && heures.length > 0 && !cloturePassee(choisi, instant, h) ? etatsCreneaux(heures, pris, reglages.creneauCapacite) : null;

  const ceQuIlNeMangePas = { allergenes: profil?.allergenes ?? [], regimes: profil?.regimes ?? [] };
  const aProposer = jours.filter((j) => !j.reserve && !cloturePassee(j.jour, instant, h));
  const ouverts = await Promise.all(aProposer.map(async (j) => ({ jour: j.jour, plats: await platsAuMenu(j.jour) })));
  const semaine = proposerSemaine(ouverts, solde, ceQuIlNeMangePas);
  const favori = favoriAuMenu(ouverts, favoris);

  const cartes = choisi === null ? [] : plats.map((p) => {
    const verdict = peutReserver({
      maintenant: instant,
      jour: choisi,
      dejaReserve: repas !== null,
      epuise: p.epuise,
      portions: p.portions,
      reservees: p.reservees,
      incompatibilites: incompatibilites(ceQuIlNeMangePas, p),
      solde,
      prix: p.prix,
      heureCloture: h,
      plafond: plafond ? { max: plafond.plafond, depense: plafond.depense } : undefined,
    });
    const demandable = !verdict.ok && verdict.refus === "cloture" && choisi === aujourdhui && peutDemanderHorsDelai({
      maintenant: instant, jour: choisi, heureCloture: h, dejaReserve: repas !== null, demandeEnCours: maDemande?.etat === "en_attente",
      epuise: p.epuise, portions: p.portions, reservees: p.reservees, incompatibilites: incompatibilites(ceQuIlNeMangePas, p), solde, prix: p.prix,
    }).ok;
    return {
      id: p.id,
      platId: p.platId,
      favori: favoris.has(p.platId),
      nouveau: estNouveau(p.creeLe, instant),
      nom: p.nom,
      description: p.description,
      photo: p.photo,
      prix: p.prix,
      contient: liste([...p.allergenes.map(nomAllergene), ...(p.porc ? ["porc"] : [])]),
      // Ce que le plat déclare, et ce qui l'écarte pour ce convive (vide sinon) : un dessin et un nom chacun.
      etiquettes: etiquettesDuPlat(p),
      enCause: etiquettesEnCause(ceQuIlNeMangePas, p),
      vegetarien: p.vegetarien,
      // Le régime végétarien en étiquette (un dessin et un nom), quand le plat l'est.
      etiquetteVegetarien: p.vegetarien ? (etiquettesRegimes(["vegetarien"])[0] ?? null) : null,
      note: p.note === null ? null : p.note.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
      avis: p.avis,
      restantes: portionsRestantes(p),
      soldeApres: soldeDe([{ montant: solde }, mouvementRepas(p.prix)]),
      refus: verdict.ok ? null : { genre: verdict.refus, phrase: verdict.phrase },
      demandable,
    };
  });
  const etatRepas = repas ? etatAffiche(repas, instant) : null;

  return reponse(requete, {
    ecole: MARQUE.ecole,
    solde,
    soldeBas: soldeBas(solde, profil?.seuilAlerte ?? SEUIL_ALERTE_DEFAUT),
    jours: jours.map((j) => ({ jour: j.jour, reserve: j.reserve, nom: jourCourt(j.jour).replace(numeroDuJour(j.jour), "").trim(), numero: numeroDuJour(j.jour) })),
    choisi,
    titre: choisi ? titreDuJour(choisi, instant) : null,
    jourEnLettres: choisi ? jourLong(choisi) : null,
    clotureLisible: clotureLisible(h),
    phraseCloture: choisi === null ? null : cloturePassee(choisi, instant, h)
      ? choisi === aujourdhui ? "Les réservations sont closes : la cantine peut encore accepter une demande" : "Les réservations de ce jour sont closes"
      : `Réserve jusqu'à ${clotureLisible(h)} ${choisi === aujourdhui ? "ce matin" : "ce jour-là"}`,
    favori: favori && favori.jour !== choisi ? { jour: favori.jour, nom: favori.nom, quand: jourProche(favori.jour, instant) } : null,
    semaine: { ...semaine, propositions: semaine.propositions.map((p) => ({ ...p, jourCourt: jourCourt(p.jour) })) },
    creneaux: creneaux?.map((c) => ({ ...c, lisible: creneauLisible(c.heure) })) ?? null,
    plats: cartes,
    repas: repas && etatRepas && {
      id: repas.id,
      jeton: repas.jeton,
      plat: repas.plat,
      prix: repas.prix,
      etat: etatRepas,
      libelleEtat: LIBELLE_ETAT[etatRepas],
      annulable: peutAnnuler(repas, instant, h).ok,
      creneau: repas.creneau ? creneauLisible(repas.creneau) : null,
    },
    demande: maDemande,
  });
}
