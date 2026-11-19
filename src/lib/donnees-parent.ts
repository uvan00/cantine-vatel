import "server-only";
import { z } from "zod";
import { unRepasParJour } from "@/app/(espace)/parent/repas";
import { prisma } from "@/lib/db";
import { profilDe, soldeDuCompte, soldesDesComptes, type VueProfil } from "@/lib/donnees";
import { ajouterJours, jourIso, lundiDe } from "@/lib/jours";
import type { EtatRecharge } from "@/lib/recharge";
import { etatAffiche, type EtatAffiche } from "@/lib/reservation";
import { SEUIL_ALERTE_DEFAUT } from "@/lib/solde";

// Les lectures de la base pour l'espace du parent et pour la recharge. Elles ne vérifient pas QUI demande : la page,
// l'action ou la route le fait avant (`exiger`, `autorise`, `estParentDe`). Deux exceptions, pour qu'on ne puisse pas
// oublier la règle : `enfantsDuParent` part toujours du parent connecté, et `rechargeVisiblePar` ne rend une recharge
// qu'à celui qui l'a demandée ou à son bénéficiaire.

/** Un identifiant de compte ou de recharge reçu du navigateur (adresse, formulaire) : rien d'autre ne part vers la base. */
export const Identifiant = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Introuvable");

/* Les enfants d'un parent */

export type Enfant = { id: string; nom: string; classe: string; solde: number; seuil: number };

/** Les enfants reliés à ce parent, par ordre alphabétique, avec leur solde et leur seuil d'alerte. */
export async function enfantsDuParent(parentId: string): Promise<Enfant[]> {
  const liens = await prisma.lienParent.findMany({
    where: { parentId },
    select: { enfant: { select: { id: true, name: true, profil: { select: { classe: true, seuilAlerte: true } } } } },
  });
  // Le tri se fait ici : la base rangerait « Élodie » après « Zoé ».
  liens.sort((a, b) => a.enfant.name.localeCompare(b.enfant.name, "fr"));
  const soldes = await soldesDesComptes(liens.map((l) => l.enfant.id));
  return liens.map(({ enfant }) => ({
    id: enfant.id,
    nom: enfant.name,
    classe: enfant.profil?.classe ?? "",
    solde: soldes.get(enfant.id) ?? 0,
    seuil: enfant.profil?.seuilAlerte ?? SEUIL_ALERTE_DEFAUT,
  }));
}

/** Un jour servi de la semaine : l'état du repas de l'enfant ce jour-là, ou null s'il n'a rien réservé. */
export type JourDeSemaine = { jour: string; etat: EtatAffiche | null };

/**
 * Pour chaque enfant, les jours servis de la semaine en cours (du lundi au dimanche) et l'état de son repas.
 * Un jour « servi » est un jour où la cantine a mis au moins un plat au menu.
 */
export async function semaineDesEnfants(enfantIds: string[], maintenant: number): Promise<Map<string, JourDeSemaine[]>> {
  if (enfantIds.length === 0) return new Map();
  const lundi = lundiDe(jourIso(maintenant));
  const semaine = { gte: lundi, lte: ajouterJours(lundi, 6) };
  const [servis, reservations] = await Promise.all([
    prisma.menuJour.findMany({ where: { jour: semaine }, distinct: ["jour"], orderBy: { jour: "asc" }, select: { jour: true } }),
    prisma.reservation.findMany({ where: { conviveId: { in: enfantIds }, jour: semaine }, orderBy: { creeLe: "desc" }, select: { conviveId: true, jour: true, etat: true } }),
  ]);
  const cle = (conviveId: string, jour: string) => `${conviveId} ${jour}`;
  const retenus = new Map(unRepasParJour(reservations, (r) => cle(r.conviveId, r.jour)).map((r) => [cle(r.conviveId, r.jour), r]));
  return new Map(enfantIds.map((id) => [id, servis.map(({ jour }) => {
    const r = retenus.get(cle(id, jour));
    return { jour, etat: r ? etatAffiche(r, maintenant) : null };
  })]));
}

/* La page d'un enfant */

export type RepasEnfant = { id: string; jour: string; plat: string; prix: number; etat: EtatAffiche; note: number | null };
export type LigneHistorique = { id: string; libelle: string; montant: number; creeLe: Date };
export type FicheEnfant = { nom: string; profil: VueProfil; solde: number; repas: RepasEnfant[]; historique: LigneHistorique[] };

export const JOURS_PASSES = 14;
const LIGNES_HISTORIQUE = 20;

/**
 * Tout ce que montre la page d'un enfant : son solde, ses repas des 14 derniers jours et des jours à venir (un par
 * jour, du plus récent au plus ancien), ses 20 derniers mouvements. null si ce compte n'est pas celui d'un convive.
 */
export async function ficheEnfant(conviveId: string, maintenant: number): Promise<FicheEnfant | null> {
  const [compte, profil] = await Promise.all([
    prisma.user.findUnique({ where: { id: conviveId }, select: { name: true } }),
    profilDe(conviveId),
  ]);
  if (!compte || !profil) return null;
  const [solde, reservations, historique] = await Promise.all([
    soldeDuCompte(conviveId),
    prisma.reservation.findMany({
      where: { conviveId, jour: { gte: ajouterJours(jourIso(maintenant), -JOURS_PASSES) } },
      orderBy: [{ jour: "desc" }, { creeLe: "desc" }],
      select: { id: true, jour: true, prix: true, etat: true, menuJour: { select: { plat: { select: { nom: true } } } }, note: { select: { note: true } } },
    }),
    prisma.mouvement.findMany({
      where: { conviveId },
      orderBy: { creeLe: "desc" },
      take: LIGNES_HISTORIQUE,
      select: { id: true, libelle: true, montant: true, creeLe: true },
    }),
  ]);
  return {
    nom: compte.name,
    profil,
    solde,
    repas: unRepasParJour(reservations, (r) => r.jour).map((r) => ({ id: r.id, jour: r.jour, plat: r.menuJour.plat.nom, prix: r.prix, etat: etatAffiche(r, maintenant), note: r.note?.note ?? null })),
    historique,
  };
}

/* Les recharges */

export type RechargeEnAttente = { id: string; montant: number; reference: string; creeLe: Date; beneficiaire: { id: string; nom: string }; demandeur: { id: string; nom: string } };

/** Les recharges que cette personne a demandées, ou qui lui sont destinées, et qui attendent encore la cantine. */
export async function rechargesEnAttenteDe(personneId: string): Promise<RechargeEnAttente[]> {
  const recharges = await prisma.recharge.findMany({
    where: { etat: "en_attente", OR: [{ demandeurId: personneId }, { beneficiaireId: personneId }] },
    orderBy: { creeLe: "desc" },
    select: { id: true, montant: true, reference: true, creeLe: true, beneficiaire: { select: { id: true, name: true } }, demandeur: { select: { id: true, name: true } } },
  });
  return recharges.map((r) => ({
    id: r.id, montant: r.montant, reference: r.reference, creeLe: r.creeLe,
    beneficiaire: { id: r.beneficiaire.id, nom: r.beneficiaire.name },
    demandeur: { id: r.demandeur.id, nom: r.demandeur.name },
  }));
}

export type VueRecharge = { id: string; montant: number; reference: string; etat: EtatRecharge; demandeurId: string; demandeur: string; beneficiaireId: string; beneficiaire: string };

/**
 * Une recharge, seulement pour celui qui l'a demandée ou pour son bénéficiaire : pour tout autre, elle n'existe pas.
 * C'est la règle d'accès de la page d'attente et de sa route relue en direct.
 */
export async function rechargeVisiblePar(id: string, personneId: string): Promise<VueRecharge | null> {
  const r = await prisma.recharge.findFirst({
    where: { id, OR: [{ demandeurId: personneId }, { beneficiaireId: personneId }] },
    select: { id: true, montant: true, reference: true, etat: true, demandeurId: true, beneficiaireId: true, demandeur: { select: { name: true } }, beneficiaire: { select: { name: true } } },
  });
  if (!r) return null;
  return { id: r.id, montant: r.montant, reference: r.reference, etat: r.etat as EtatRecharge, demandeurId: r.demandeurId, demandeur: r.demandeur.name, beneficiaireId: r.beneficiaireId, beneficiaire: r.beneficiaire.name };
}

/** Ce que la page d'attente relit toutes les 3 secondes : l'état de la recharge et le solde du compte rechargé. */
export type RechargeEnDirect = { etat: EtatRecharge; solde: number };

export async function rechargeEnDirect(r: Pick<VueRecharge, "etat" | "beneficiaireId">): Promise<RechargeEnDirect> {
  return { etat: r.etat, solde: await soldeDuCompte(r.beneficiaireId) };
}
