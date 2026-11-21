import "server-only";
import { prisma } from "@/lib/db";
import { ajouterJours, cloturePassee, clotureLisible, jourIso, joursAPartirDe, lundiDe } from "@/lib/jours";
import { lireReglages } from "@/lib/donnees";
import { etatsCreneaux, type EtatCreneau } from "@/lib/creneaux";
import { heuresDePassage } from "@/lib/reglages";
import { etiquettesAllergenes, IDS_ALLERGENES, lireListe, type Etiquette } from "@/lib/listes";
import { convivesEcartes, etiquettesEnCause, type Ecartes, type ProfilAlimentaire } from "@/lib/profil-alimentaire";
import { bilanRestes, type BilanRestes } from "@/lib/restes";
import { moyenne, peutRetirer } from "@/lib/menu";
import type { MoyenRecharge } from "@/lib/recharge";
import type { PeseeDuRapport, RechargeDuRapport, RepasDuRapport } from "@/lib/rapport";
import { estComplet, etatAffiche, portionsRestantes, resteAPayer, scanner, type EtatAffiche, type Scan } from "@/lib/reservation";
import {
  chiffresDuService, classer, nonRetires, notesParPlat, rechargesConfirmees, repasParJour, repasParPlat, septDerniersJours,
  type ChiffresService, type LignePlat,
} from "@/lib/statistiques";
import { lireCle } from "@/lib/ticket";
import { restesParPlat, type AllergieDuJour, type PlatDuJour, type Unite } from "@/lib/besoins";
import { sortisDuJour, stocksEtPrix } from "@/lib/donnees-stock";

// Les lectures de la base pour l'administrateur de la cantine (tableau de bord, menus, commandes, scanner, recharges).
// Rien n'écrit ici : tout ce qui écrit passe par src/lib/operations.ts. Les calculs sont dans src/lib/statistiques.ts.
// Ces fonctions ne vérifient pas QUI appelle : la page fait `exiger("admin")`, l'action et la route `autorise("admin")`.

/** « Bachelor 2 », « Accueil », ou à défaut « Élève » ou « Employé ». */
const groupeDe = (profil: { classe: string; genre: string } | null) => profil?.classe || (profil?.genre === "employe" ? "Employé" : "Élève");

const parNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, "fr");

/** Les allergènes d'un convive, d'après son profil, en étiquettes (un dessin et un nom). Ses régimes n'y sont pas. */
const allergiesDe = (texte: string | undefined) => etiquettesAllergenes(lireListe(texte ?? ""));

/**
 * Ce que ce plat contient et que ce convive ne mange pas, en étiquettes (la règle de la réservation, sans rien d'autre).
 * Réserver le refuse ; un profil réglé après, ou un plat modifié, peut pourtant laisser le cas : la cuisine et le
 * comptoir doivent le voir avant de servir.
 */
const enCauseDe = (profil: { allergenes: string; regimes: string } | null | undefined, plat: { allergenes: string; porc: boolean; vegetarien: boolean }) =>
  etiquettesEnCause(
    { allergenes: lireListe(profil?.allergenes ?? ""), regimes: lireListe(profil?.regimes ?? "") },
    { allergenes: lireListe(plat.allergenes), porc: plat.porc, vegetarien: plat.vegetarien },
  );

/* ── Tableau de bord ───────────────────────────────────────────────────────── */

export type VueTableau = {
  aujourdhui: string;
  service: ChiffresService;
  rechargesEnAttente: number;
  /** Du lundi au dimanche de la semaine en cours. */
  semaine: { jour: string; repas: number }[];
  demain: { jour: string; total: number; plats: { id: string; nom: string; repas: number; portions: number | null }[] };
  /** Les sept jours terminés avant aujourd'hui. */
  septJours: {
    debut: string; fin: string; plats: (LignePlat & { photo: string })[]; nonRetires: { nombre: number; total: number }; recharges: number;
    /** Les restes pesés après le service (src/lib/restes.ts). */
    restes: BilanRestes;
  };
  rechargesAujourdhui: number;
  /** Toutes les notes données, depuis le début. */
  notes: { moyenne: number | null; avis: number };
};

export async function tableauDeBord(maintenant: number): Promise<VueTableau> {
  const aujourdhui = jourIso(maintenant);
  const semaine = joursAPartirDe(lundiDe(aujourdhui), 7);
  const demain = ajouterJours(aujourdhui, 1);
  const fenetre = septDerniersJours(aujourdhui);
  const dernierJour = semaine[6] > demain ? semaine[6] : demain;

  const [lignes, menusDemain, rechargesEnAttente, recharges, notes, pesees] = await Promise.all([
    prisma.reservation.findMany({
      where: { jour: { gte: fenetre.debut, lte: dernierJour }, etat: { not: "annulee" } },
      select: { jour: true, etat: true, menuJourId: true, menuJour: { select: { platId: true, plat: { select: { nom: true, photo: true } } } } },
    }),
    prisma.menuJour.findMany({ where: { jour: demain }, select: { id: true, portions: true, plat: { select: { nom: true } } } }),
    prisma.recharge.count({ where: { etat: "en_attente" } }),
    prisma.recharge.findMany({
      where: { etat: "confirmee", confirmeeLe: { gte: new Date(`${fenetre.debut}T00:00:00Z`) } },
      select: { montant: true, confirmeeLe: true },
    }),
    prisma.note.findMany({ select: { note: true } }),
    prisma.menuJour.findMany({
      where: { jour: { gte: fenetre.debut, lte: fenetre.fin }, restes: { not: null } },
      select: { platId: true, restes: true, plat: { select: { nom: true } }, _count: { select: { reservations: { where: { etat: "servie" } } } } },
    }),
  ]);

  const repas = lignes.map((l) => ({ jour: l.jour, etat: l.etat, menuJourId: l.menuJourId, platId: l.menuJour.platId, nom: l.menuJour.plat.nom }));
  const deDemain = repas.filter((r) => r.jour === demain);
  const desSeptJours = repas.filter((r) => r.jour >= fenetre.debut && r.jour <= fenetre.fin);
  const confirmees = recharges.flatMap((r) => (r.confirmeeLe ? [{ montant: r.montant, confirmeeLe: r.confirmeeLe }] : []));
  const comptes = repasParJour(semaine, repas);
  const photos = new Map(lignes.map((l) => [l.menuJour.platId, l.menuJour.plat.photo]));

  return {
    aujourdhui,
    service: chiffresDuService(repas.filter((r) => r.jour === aujourdhui)),
    rechargesEnAttente,
    semaine: semaine.map((jour, i) => ({ jour, repas: comptes[i] })),
    demain: {
      jour: demain,
      total: deDemain.length,
      plats: classer(menusDemain.map((m) => ({ id: m.id, nom: m.plat.nom, portions: m.portions, repas: deDemain.filter((r) => r.menuJourId === m.id).length }))),
    },
    septJours: {
      ...fenetre,
      plats: classer(repasParPlat(desSeptJours), 5).map((p) => ({ ...p, photo: photos.get(p.platId) ?? "" })),
      nonRetires: nonRetires(desSeptJours, maintenant),
      recharges: rechargesConfirmees(confirmees, fenetre.debut, fenetre.fin),
      restes: bilanRestes(pesees.map((m) => ({ platId: m.platId, nom: m.plat.nom, restes: m.restes, servis: m._count.reservations }))),
    },
    rechargesAujourdhui: rechargesConfirmees(confirmees, aujourdhui, aujourdhui),
    notes: { moyenne: moyenne(notes.map((n) => n.note)), avis: notes.length },
  };
}

/* ── Rapport de la semaine (bonus 4) ────────────────────────────────────────── */

/**
 * Les lignes de la semaine qui commence ce lundi, pour le rapport (src/lib/rapport.ts, qui fait les comptes) : les
 * repas, les recharges confirmées, les notes de ces repas, et les restes pesés.
 */
export async function donneesDuRapport(lundi: string): Promise<{ repas: RepasDuRapport[]; recharges: RechargeDuRapport[]; notes: { platId: string; note: number }[]; pesees: PeseeDuRapport[] }> {
  const semaine = { gte: lundi, lte: ajouterJours(lundi, 6) };
  const [reservations, recharges, notes, pesees] = await Promise.all([
    prisma.reservation.findMany({ where: { jour: semaine }, select: { jour: true, etat: true, prix: true, paiement: true, menuJour: { select: { platId: true, plat: { select: { nom: true } } } } } }),
    prisma.recharge.findMany({
      where: { etat: "confirmee", confirmeeLe: { gte: new Date(`${lundi}T00:00:00Z`), lt: new Date(`${ajouterJours(lundi, 7)}T00:00:00Z`) } },
      select: { montant: true, moyen: true, confirmeeLe: true },
    }),
    prisma.note.findMany({ where: { reservation: { jour: semaine } }, select: { platId: true, note: true } }),
    prisma.menuJour.findMany({
      where: { jour: semaine, restes: { not: null } },
      select: { jour: true, platId: true, restes: true, plat: { select: { nom: true } }, _count: { select: { reservations: { where: { etat: "servie" } } } } },
    }),
  ]);
  return {
    repas: reservations.map((r) => ({ jour: r.jour, etat: r.etat, prix: r.prix, paiement: r.paiement, platId: r.menuJour.platId, nom: r.menuJour.plat.nom })),
    recharges: recharges.flatMap((r) => (r.confirmeeLe ? [{ montant: r.montant, moyen: r.moyen, confirmeeLe: r.confirmeeLe }] : [])),
    notes,
    pesees: pesees.map((m) => ({ jour: m.jour, platId: m.platId, nom: m.plat.nom, restes: m.restes, servis: m._count.reservations })),
  };
}

/* ── Menus ─────────────────────────────────────────────────────────────────── */

export type VueMenuJour = {
  id: string;
  jour: string;
  platId: string;
  nom: string;
  photo: string;
  prix: number;
  portions: number | null;
  epuise: boolean;
  /** Repas réservés ce jour-là pour ce plat, annulations déduites. */
  reservees: number;
  /** Vrai tant que le plat n'a jamais été réservé ce jour-là (une réservation annulée laisse sa trace : il reste). */
  retirable: boolean;
  /** Les convives qui ne pourront pas le réserver, d'après leur profil alimentaire. */
  ecartes: Ecartes;
};

/** Le profil alimentaire de chaque convive (élève ou employé) : de quoi dire qui ne pourra pas prendre un plat. */
async function profilsDesConvives(): Promise<ProfilAlimentaire[]> {
  const profils = await prisma.profil.findMany({ select: { allergenes: true, regimes: true } });
  return profils.map((p) => ({ allergenes: lireListe(p.allergenes), regimes: lireListe(p.regimes) }));
}

const declare = (p: { allergenes: string; porc: boolean; vegetarien: boolean }) => ({ allergenes: lireListe(p.allergenes), porc: p.porc, vegetarien: p.vegetarien });

export type VueJourMenu = { jour: string; plats: VueMenuJour[] };

/** Les sept jours à partir de ce lundi, chacun avec ses plats (par ordre alphabétique) et leurs réservations. */
export async function menusDeLaSemaine(lundi: string): Promise<VueJourMenu[]> {
  const jours = joursAPartirDe(lundi, 7);
  const [menus, comptes, profils] = await Promise.all([
    prisma.menuJour.findMany({ where: { jour: { in: jours } }, include: { plat: { select: { nom: true, photo: true, allergenes: true, porc: true, vegetarien: true } } } }),
    prisma.reservation.groupBy({ by: ["menuJourId", "etat"], where: { jour: { in: jours } }, _count: { _all: true } }),
    profilsDesConvives(),
  ]);
  const compter = (menuJourId: string, garde: (etat: string) => boolean) =>
    comptes.filter((c) => c.menuJourId === menuJourId && garde(c.etat)).reduce((s, c) => s + c._count._all, 0);
  const plats = menus.map((m): VueMenuJour => ({
    id: m.id,
    jour: m.jour,
    platId: m.platId,
    nom: m.plat.nom,
    photo: m.plat.photo,
    prix: m.prix,
    portions: m.portions,
    epuise: m.epuise,
    reservees: compter(m.id, (etat) => etat !== "annulee"),
    retirable: peutRetirer(compter(m.id, () => true)),
    ecartes: convivesEcartes(profils, declare(m.plat)),
  }));
  return jours.map((jour) => ({ jour, plats: plats.filter((p) => p.jour === jour).sort(parNom) }));
}

export type VuePlat = {
  id: string;
  nom: string;
  description: string;
  photo: string;
  /** Le prix proposé quand on l'ajoute à un jour. */
  prix: number;
  allergenes: string[];
  porc: boolean;
  vegetarien: boolean;
  /** La moyenne de ses notes, null tant que personne ne l'a noté. */
  note: number | null;
  avis: number;
  /** Les convives qui ne pourront pas le réserver, d'après leur profil alimentaire. */
  ecartes: Ecartes;
};

/** Tous les plats de la carte, par ordre alphabétique, avec leur note moyenne. */
export async function tousLesPlats(): Promise<VuePlat[]> {
  const [plats, notes, profils] = await Promise.all([
    prisma.plat.findMany(),
    prisma.note.findMany({ select: { platId: true, note: true } }),
    profilsDesConvives(),
  ]);
  const parPlat = notesParPlat(notes);
  return plats.map((p): VuePlat => ({
    id: p.id,
    nom: p.nom,
    description: p.description,
    photo: p.photo,
    prix: p.prix,
    allergenes: lireListe(p.allergenes),
    porc: p.porc,
    vegetarien: p.vegetarien,
    note: parPlat.get(p.id)?.moyenne ?? null,
    avis: parPlat.get(p.id)?.avis ?? 0,
    ecartes: convivesEcartes(profils, declare(p)),
  })).sort(parNom);
}

/** Le jour d'un plat du menu, pour refuser de toucher à un jour passé. Null s'il n'est plus au menu. */
export async function jourDuMenu(id: string): Promise<string | null> {
  return (await prisma.menuJour.findUnique({ where: { id }, select: { jour: true } }))?.jour ?? null;
}

/* ── Commandes ─────────────────────────────────────────────────────────────── */

export type CleJour = "aujourdhui" | "demain";

export type VueConvive = {
  /** L'identifiant de la réservation. */
  id: string;
  nom: string;
  /** Le convive : son identifiant et sa photo de profil, pour son visage. */
  personneId: string;
  photo: string | null;
  /** Sa classe ou son service. */
  groupe: string;
  etat: EtatAffiche;
  /** Le code court de son ticket. */
  code: string;
  serviLe: string | null;
  /** Sa file au comptoir (express, reservation, classique) et comment son repas est payé (src/lib/reservation.ts). */
  file: string;
  paiement: string;
  /** Ses allergènes (pas ses régimes), pour la cuisine et le comptoir ; vide s'il n'en a pas. */
  allergies: Etiquette[];
  /** Ce que son plat réservé contient et qu'il ne mange pas : à vérifier avant de servir. Vide quand le plat lui convient. */
  enCause: Etiquette[];
};

export type VuePlatCommande = {
  id: string;
  nom: string;
  /** La photo du plat (public/plats), ou vide. */
  photo: string;
  portions: number | null;
  /** Portions encore libres ; null : pas de limite. */
  restantes: number | null;
  epuise: boolean;
  complet: boolean;
  reserves: number;
  servis: number;
  aServir: number;
  /** Les restes pesés après le service, en grammes ; null tant que rien n'est pesé. */
  restes: number | null;
  convives: VueConvive[];
};

export type VueCommandes = {
  cle: CleJour;
  jour: string;
  /** L'instant de la lecture, à l'heure du serveur. */
  maintenant: number;
  /** Vrai quand les réservations de ce jour sont closes : les nombres réservés ne bougent plus. */
  cloturee: boolean;
  /** « 9 h » : l'heure de clôture réglée par la cantine. */
  clotureLisible: string;
  /** Les passages de chaque créneau de ce jour, quand la cantine en a ouvert ; vide sinon. */
  creneaux: EtatCreneau[];
  service: ChiffresService;
  plats: VuePlatCommande[];
};

/** Ce que la cuisine prépare : par plat, les repas réservés, servis, à servir, et les convives. */
export async function commandesDuJour(cle: CleJour, maintenant: number): Promise<VueCommandes> {
  const reglages = await lireReglages();
  const jour = cle === "demain" ? ajouterJours(jourIso(maintenant), 1) : jourIso(maintenant);
  const menus = await prisma.menuJour.findMany({
    where: { jour },
    include: {
      plat: { select: { nom: true, photo: true, allergenes: true, porc: true, vegetarien: true } },
      reservations: {
        where: { etat: { not: "annulee" } },
        select: { id: true, etat: true, jour: true, code: true, serviLe: true, file: true, paiement: true, convive: { select: { id: true, name: true, image: true, profil: { select: { classe: true, genre: true, allergenes: true, regimes: true } } } } },
      },
    },
  });
  const plats = menus.map((m): VuePlatCommande => {
    const convives = m.reservations
      .map((r): VueConvive => ({ id: r.id, nom: r.convive.name, personneId: r.convive.id, photo: r.convive.image ?? null, groupe: groupeDe(r.convive.profil), etat: etatAffiche(r, maintenant), code: r.code, serviLe: r.serviLe?.toISOString() ?? null, file: r.file, paiement: r.paiement, allergies: allergiesDe(r.convive.profil?.allergenes), enCause: enCauseDe(r.convive.profil, m.plat) }))
      // Ceux qu'il reste à servir d'abord, chacun par ordre alphabétique.
      .sort((a, b) => Number(a.etat === "servie") - Number(b.etat === "servie") || parNom(a, b));
    const service = chiffresDuService(m.reservations);
    return {
      id: m.id,
      nom: m.plat.nom,
      photo: m.plat.photo,
      portions: m.portions,
      restantes: portionsRestantes({ portions: m.portions, reservees: service.reserves }),
      epuise: m.epuise,
      complet: estComplet({ epuise: m.epuise, portions: m.portions, reservees: service.reserves }),
      ...service,
      restes: m.restes,
      convives,
    };
  });
  const parCreneau = await prisma.reservation.groupBy({ by: ["creneau"], where: { jour, etat: { not: "annulee" }, creneau: { not: null } }, _count: { _all: true } });
  const prisParHeure = Object.fromEntries(parCreneau.map((g) => [g.creneau as string, g._count._all]));
  return {
    cle,
    jour,
    maintenant,
    cloturee: cloturePassee(jour, maintenant, reglages.heureCloture),
    clotureLisible: clotureLisible(reglages.heureCloture),
    creneaux: etatsCreneaux(heuresDePassage(reglages), prisParHeure, reglages.creneauCapacite),
    service: chiffresDuService(menus.flatMap((m) => m.reservations)),
    // Le plat le plus réservé d'abord, comme sur le tableau de bord.
    plats: plats.sort((a, b) => b.reserves - a.reserves || parNom(a, b)),
  };
}

/* ── Repas non retirés ─────────────────────────────────────────────────────── */

export type VueNonRetire = {
  /** L'identifiant de la réservation. */
  id: string;
  jour: string;
  plat: string;
  prix: number;
  nom: string;
  personneId: string;
  photo: string | null;
  groupe: string;
  /** Faux quand le repas était à payer au comptoir : rien n'a été encaissé. */
  paye: boolean;
};

/** Les repas non retirés des sept derniers jours (réservés, jamais servis), du plus récent au plus ancien. */
export async function repasNonRetires(maintenant: number): Promise<{ debut: string; fin: string; repas: VueNonRetire[] }> {
  const fenetre = septDerniersJours(jourIso(maintenant));
  const lignes = await prisma.reservation.findMany({
    where: { jour: { gte: fenetre.debut, lte: fenetre.fin }, etat: "reservee" },
    select: {
      id: true, jour: true, prix: true, paiement: true,
      menuJour: { select: { plat: { select: { nom: true } } } },
      convive: { select: { id: true, name: true, image: true, profil: { select: { classe: true, genre: true } } } },
    },
  });
  const repas = lignes.map((r): VueNonRetire => ({
    id: r.id, jour: r.jour, plat: r.menuJour.plat.nom, prix: r.prix, nom: r.convive.name, personneId: r.convive.id,
    photo: r.convive.image ?? null, groupe: groupeDe(r.convive.profil), paye: !resteAPayer(r),
  }));
  return { ...fenetre, repas: repas.sort((a, b) => b.jour.localeCompare(a.jour) || parNom(a, b)) };
}

/* ── Scanner ───────────────────────────────────────────────────────────────── */

/** Réservés, servis et à servir d'un jour. */
export async function serviceDuJour(jour: string): Promise<ChiffresService> {
  return chiffresDuService(await prisma.reservation.findMany({ where: { jour, etat: { not: "annulee" } }, select: { etat: true } }));
}

export type VueTicket = {
  /** Le jeton du ticket : c'est lui qu'on renvoie pour le servir. */
  cle: string;
  convive: string;
  plat: string;
  jour: string;
  code: string;
  /** Les allergènes du convive (pas ses régimes) ; vide s'il n'en a pas. */
  allergies: Etiquette[];
  /** Ce que ce plat contient et que ce convive ne mange pas ; vide quand le plat lui convient. */
  enCause: Etiquette[];
  /** Ce que le comptoir répondrait à ce ticket maintenant, sans rien changer (src/lib/reservation.ts, scanner). */
  apercu: Scan;
};

/**
 * Le ticket désigné par une adresse, un jeton ou un code court, SANS le servir : une page ouverte par un lien ne change
 * rien dans la base. La recherche suit celle de `servir` (src/lib/operations.ts) : le jeton, sinon le code d'aujourd'hui,
 * sinon le plus récent. Null si rien ne correspond.
 */
export async function ticketPourScan(cle: string, maintenant: number): Promise<VueTicket | null> {
  const lue = lireCle(cle);
  if (!lue) return null;
  const avec = { convive: { select: { name: true, profil: { select: { allergenes: true, regimes: true } } } }, menuJour: { select: { plat: { select: { nom: true, allergenes: true, porc: true, vegetarien: true } } } } } as const;
  // La carte de cantine : le repas du jour de son élève.
  if ("carte" in lue) {
    const profil = await prisma.profil.findUnique({ where: { carte: lue.carte }, select: { userId: true } });
    const duJour = profil && await prisma.reservation.findFirst({ where: { conviveId: profil.userId, jour: jourIso(maintenant), etat: { not: "annulee" } }, include: avec });
    return duJour ? { cle: duJour.jeton, convive: duJour.convive.name, plat: duJour.menuJour.plat.nom, jour: duJour.jour, code: duJour.code, allergies: allergiesDe(duJour.convive.profil?.allergenes), enCause: enCauseDe(duJour.convive.profil, duJour.menuJour.plat), apercu: scanner(duJour, maintenant) } : null;
  }
  const r = "jeton" in lue
    ? await prisma.reservation.findUnique({ where: { jeton: lue.jeton }, include: avec })
    : (await prisma.reservation.findFirst({ where: { code: lue.code, jour: jourIso(maintenant) }, include: avec }))
      ?? (await prisma.reservation.findFirst({ where: { code: lue.code }, orderBy: { jour: "desc" }, include: avec }));
  if (!r) return null;
  return { cle: r.jeton, convive: r.convive.name, plat: r.menuJour.plat.nom, jour: r.jour, code: r.code, allergies: allergiesDe(r.convive.profil?.allergenes), enCause: enCauseDe(r.convive.profil, r.menuJour.plat), apercu: scanner(r, maintenant) };
}

/* ── Recharges ─────────────────────────────────────────────────────────────── */

export type VueRechargeEnAttente = {
  id: string;
  reference: string;
  beneficiaire: string;
  /** Le bénéficiaire : son identifiant et sa photo de profil, pour son visage. */
  beneficiaireId: string;
  photo: string | null;
  groupe: string;
  /** Celui qui a demandé la recharge, quand ce n'est pas le bénéficiaire lui-même (son parent). */
  demandeur: string | null;
  montant: number;
  creeLe: string;
  /** Le dernier paiement Cartflox ouvert pour cette demande : son statut et sa remarque. null sans paiement en ligne. */
  cartflox: { statut: string; remarque: string | null } | null;
};

/**
 * Un paiement Cartflox qui demande l'œil de la cantine : payé mais pas crédité tout seul (montant inattendu, ou arrivé
 * après l'annulation de la demande).
 */
export type VuePaiementAVerifier = {
  sessionId: string;
  rechargeId: string;
  reference: string;
  beneficiaire: string;
  /** Le bénéficiaire : son identifiant et sa photo de profil, pour son visage. */
  beneficiaireId: string;
  photo: string | null;
  /** Le montant de la recharge, et ce que Cartflox dit avoir encaissé. */
  montant: number;
  encaisse: number | null;
  etatRecharge: "en_attente" | "annulee";
  remarque: string;
};

export type VueRechargePassee = {
  id: string;
  reference: string;
  beneficiaire: string;
  /** Le bénéficiaire : son identifiant et sa photo de profil, pour son visage. */
  beneficiaireId: string;
  photo: string | null;
  montant: number;
  moyen: MoyenRecharge;
  etat: "confirmee" | "annulee";
  /** L'instant où elle a été confirmée ou annulée. */
  quand: string;
};

export type VueRecharges = {
  /** L'instant de la lecture, à l'heure du serveur (pour « il y a 4 min »). */
  maintenant: number;
  enAttente: VueRechargeEnAttente[];
  aVerifier: VuePaiementAVerifier[];
  dernieres: VueRechargePassee[];
};

const DERNIERES = 20;

/** Les demandes qui attendent la cantine (la plus ancienne d'abord) et les vingt dernières recharges closes. */
export async function vueRecharges(maintenant: number): Promise<VueRecharges> {
  const beneficiaire = { select: { id: true, name: true, image: true, profil: { select: { classe: true, genre: true } } } } as const;
  const dernierPaiement = { orderBy: { creeLe: "desc" }, take: 1, select: { statut: true, remarque: true } } as const;
  const [attente, confirmees, annulees, aVerifier] = await Promise.all([
    prisma.recharge.findMany({ where: { etat: "en_attente" }, orderBy: { creeLe: "asc" }, include: { beneficiaire, demandeur: { select: { name: true } }, paiements: dernierPaiement } }),
    prisma.recharge.findMany({ where: { etat: "confirmee" }, orderBy: { confirmeeLe: "desc" }, take: DERNIERES, include: { beneficiaire } }),
    prisma.recharge.findMany({ where: { etat: "annulee" }, orderBy: { annuleeLe: "desc" }, take: DERNIERES, include: { beneficiaire } }),
    prisma.paiementCartflox.findMany({
      where: { statut: "SUCCESS", remarque: { not: null }, recharge: { etat: { in: ["en_attente", "annulee"] } } },
      orderBy: { luLe: "desc" },
      take: DERNIERES,
      include: { recharge: { select: { id: true, reference: true, montant: true, etat: true, beneficiaire: { select: { id: true, name: true, image: true } } } } },
    }),
  ]);
  const dernieres = [...confirmees, ...annulees]
    .map((r): VueRechargePassee => ({
      id: r.id,
      reference: r.reference,
      beneficiaire: r.beneficiaire.name,
      beneficiaireId: r.beneficiaire.id,
      photo: r.beneficiaire.image ?? null,
      montant: r.montant,
      moyen: r.moyen === "especes" ? "especes" : r.moyen === "cartflox" ? "cartflox" : "pispi",
      etat: r.etat === "annulee" ? "annulee" : "confirmee",
      quand: (r.confirmeeLe ?? r.annuleeLe ?? r.creeLe).toISOString(),
    }))
    .sort((a, b) => b.quand.localeCompare(a.quand))
    .slice(0, DERNIERES);
  return {
    maintenant,
    // Une demande dont le paiement Cartflox est passé sans pouvoir se créditer tout seul est dans « À regarder », pas ici.
    enAttente: attente.filter((r) => !(r.paiements[0]?.statut === "SUCCESS" && r.paiements[0]?.remarque)).map((r): VueRechargeEnAttente => ({
      id: r.id,
      reference: r.reference,
      beneficiaire: r.beneficiaire.name,
      beneficiaireId: r.beneficiaire.id,
      photo: r.beneficiaire.image ?? null,
      groupe: groupeDe(r.beneficiaire.profil),
      demandeur: r.demandeurId === r.beneficiaireId ? null : r.demandeur.name,
      montant: r.montant,
      creeLe: r.creeLe.toISOString(),
      cartflox: r.paiements[0] ? { statut: r.paiements[0].statut, remarque: r.paiements[0].remarque } : null,
    })),
    aVerifier: aVerifier.map((p): VuePaiementAVerifier => ({
      sessionId: p.sessionId,
      rechargeId: p.recharge.id,
      reference: p.recharge.reference,
      beneficiaire: p.recharge.beneficiaire.name,
      beneficiaireId: p.recharge.beneficiaire.id,
      photo: p.recharge.beneficiaire.image ?? null,
      montant: p.recharge.montant,
      encaisse: p.montant,
      etatRecharge: p.recharge.etat === "annulee" ? "annulee" : "en_attente",
      remarque: p.remarque ?? "",
    })),
    dernieres,
  };
}

export type VueCompte = { id: string; nom: string; groupe: string; photo: string | null };
/** Un compte trouvé par la recherche, avec son solde du moment. */
export type VueCompteTrouve = VueCompte & { solde: number };

/** Tous les comptes qui se rechargent (élèves et employés), par ordre alphabétique : la recherche par nom s'y fait. */
export async function comptesDesConvives(): Promise<VueCompte[]> {
  const profils = await prisma.profil.findMany({ select: { userId: true, classe: true, genre: true, user: { select: { name: true, image: true } } } });
  return profils.map((p): VueCompte => ({ id: p.userId, nom: p.user.name, groupe: groupeDe(p), photo: p.user.image ?? null })).sort(parNom);
}

/* ── Demandes hors délai ───────────────────────────────────────────────────── */

export type VueDemande = { id: string; convive: string; conviveId: string; photo: string | null; groupe: string; plat: string; prix: number; creeLe: string };

/** Les demandes hors délai de ce jour qui attendent la réponse de la cantine, la plus ancienne d'abord. */
export async function demandesEnAttente(jour: string): Promise<VueDemande[]> {
  const demandes = await prisma.demandeRepas.findMany({
    where: { jour, etat: "en_attente" },
    orderBy: { creeLe: "asc" },
    include: { convive: { select: { name: true, image: true, profil: { select: { classe: true, genre: true } } } }, menuJour: { select: { prix: true, plat: { select: { nom: true } } } } },
  });
  return demandes.map((d) => ({
    id: d.id,
    convive: d.convive.name,
    conviveId: d.conviveId,
    photo: d.convive.image ?? null,
    groupe: groupeDe(d.convive.profil),
    plat: d.menuJour.plat.nom,
    prix: d.menuJour.prix,
    creeLe: d.creeLe.toISOString(),
  }));
}

/* ── Les tickets du jour, gardés par le scanner pour servir sans réseau ─────── */

export type TicketLocal = {
  jeton: string; code: string; etat: string; jour: string; serviLe: string | null;
  /** Comment le repas est payé, et son prix : sans réseau, un ticket « a_payer » ne se sert pas. */
  paiement: string; prix: number;
  conviveId: string; convive: string; photo: string | null; plat: string; creneau: string | null;
  /** Le jeton de la carte de cantine de l'élève, pour servir sa carte sans réseau. */
  carte: string | null;
  /** Ses allergènes (pas ses régimes), pour les dire au comptoir même sans réseau. */
  allergies: Etiquette[];
  /** Ce que son plat contient et qu'il ne mange pas, pour le dire au comptoir même sans réseau. */
  enCause: Etiquette[];
};

/** Tous les tickets de ce jour, annulés compris (pour dire « Ticket annulé » sans réseau). */
export async function ticketsDuJour(jour: string): Promise<TicketLocal[]> {
  const rs = await prisma.reservation.findMany({
    where: { jour },
    select: { jeton: true, code: true, etat: true, jour: true, serviLe: true, creneau: true, paiement: true, prix: true, convive: { select: { id: true, name: true, image: true, profil: { select: { carte: true, allergenes: true, regimes: true } } } }, menuJour: { select: { plat: { select: { nom: true, allergenes: true, porc: true, vegetarien: true } } } } },
  });
  return rs.map((r) => ({
    jeton: r.jeton, code: r.code, etat: r.etat, jour: r.jour, serviLe: r.serviLe?.toISOString() ?? null,
    paiement: r.paiement, prix: r.prix,
    conviveId: r.convive.id, convive: r.convive.name, photo: r.convive.image ?? null, plat: r.menuJour.plat.nom, creneau: r.creneau,
    carte: r.convive.profil?.carte ?? null,
    allergies: allergiesDe(r.convive.profil?.allergenes),
    enCause: enCauseDe(r.convive.profil, r.menuJour.plat),
  }));
}

/* ── Les besoins de la cuisine (cahier des charges, section 11, bonus 2) ───────── */

/** Un plat du jour dans les besoins : sa fiche, ses réservations, et de quoi bâtir son plan de production. */
export type PlatBesoins = PlatDuJour & {
  menuJourId: string;
  /** La photo du plat (public/plats), ou vide. */
  photo: string;
  /** Les portions prévues par la cantine ; null : pas de limite. */
  portions: number | null;
  /** Les grammes de restes par repas servi de ce plat, ses pesées des 7 jours d'avant additionnées ; null sans pesée. */
  restesParRepas: number | null;
  /** Son prix ce jour-là, en F CFA. */
  prixVente: number;
};

export type VueBesoins = {
  cle: CleJour;
  jour: string;
  /** Les plats du jour, les plus réservés d'abord. */
  plats: PlatBesoins[];
  /** Tous les ingrédients déjà connus, pour les proposer en remplissant une fiche. */
  ingredients: { id: string; nom: string; unite: string }[];
  /** Les allergènes des plats du jour, quand au moins un convive allergique mange ce jour-là (l'alerte de la cuisine). */
  allergies: AllergieDuJour[];
  /** Le stock de chaque ingrédient, dans son unité (lot 2 : la réserve). */
  stocks: Record<string, number>;
  /** Le prix d'une unité de chaque ingrédient, en F CFA ; null tant qu'aucune livraison payée n'est notée. */
  prix: Record<string, number | null>;
  /** Les ingrédients déjà sortis de la réserve pour ce jour (la case « Sorti »). */
  sortis: string[];
};

/**
 * Les plats d'aujourd'hui ou de demain, leurs réservations et leur fiche recette ; pour chacun, sa photo, ses portions
 * prévues et ses restes moyens des 7 jours d'avant ; et l'alerte allergies (cahier des charges, section 11, bonus 2).
 */
export async function vueBesoins(cle: CleJour, maintenant: number): Promise<VueBesoins> {
  const jour = cle === "demain" ? ajouterJours(jourIso(maintenant), 1) : jourIso(maintenant);
  const [menus, ingredients, mangeurs, reserve, sortis] = await Promise.all([
    prisma.menuJour.findMany({
      where: { jour },
      orderBy: { id: "asc" },
      include: {
        plat: { select: { id: true, nom: true, photo: true, allergenes: true, recette: { include: { ingredient: true } } } },
        _count: { select: { reservations: { where: { etat: { not: "annulee" } } } } },
      },
    }),
    prisma.ingredient.findMany({ orderBy: { nom: "asc" }, select: { id: true, nom: true, unite: true } }),
    // Ceux qui mangent ce jour-là (une réservation non annulée), une fois chacun, avec leurs allergies.
    prisma.reservation.findMany({ where: { jour, etat: { not: "annulee" } }, distinct: ["conviveId"], select: { convive: { select: { profil: { select: { allergenes: true } } } } } }),
    stocksEtPrix(),
    sortisDuJour(jour),
  ]);

  // Les pesées des 7 jours d'avant, pour les plats de ce jour : ce qu'il reste d'habitude, par repas servi.
  const pesees = await prisma.menuJour.findMany({
    where: { platId: { in: menus.map((m) => m.platId) }, jour: { gte: ajouterJours(jour, -7), lt: jour }, restes: { not: null } },
    select: { platId: true, restes: true, plat: { select: { nom: true } }, _count: { select: { reservations: { where: { etat: "servie" } } } } },
  });
  const restes = restesParPlat(pesees.map((p) => ({ platId: p.platId, nom: p.plat.nom, restes: p.restes, servis: p._count.reservations })));

  // L'alerte : chaque allergène des plats du jour, et combien de convives qui y sont allergiques mangent ce jour-là.
  const allergiesDesMangeurs = mangeurs.map((r) => lireListe(r.convive.profil?.allergenes ?? ""));
  const platsParAllergene = new Map<string, string[]>();
  for (const m of menus) for (const a of lireListe(m.plat.allergenes)) platsParAllergene.set(a, [...(platsParAllergene.get(a) ?? []), m.plat.nom]);
  const allergies = [...platsParAllergene]
    .map(([allergene, plats]) => ({ allergene, plats, convives: allergiesDesMangeurs.filter((l) => l.includes(allergene)).length }))
    .filter((x) => x.convives > 0)
    .sort((x, y) => IDS_ALLERGENES.indexOf(x.allergene) - IDS_ALLERGENES.indexOf(y.allergene));

  return {
    cle,
    jour,
    ingredients,
    allergies,
    stocks: Object.fromEntries(reserve.stocks),
    prix: Object.fromEntries(reserve.prix),
    sortis,
    plats: menus
      .map((m): PlatBesoins => ({
        menuJourId: m.id,
        platId: m.plat.id,
        nom: m.plat.nom,
        photo: m.plat.photo,
        portions: m.portions,
        restesParRepas: restes.get(m.platId) ?? null,
        prixVente: m.prix,
        reservations: m._count.reservations,
        lignes: m.plat.recette
          .map((l) => ({ ingredientId: l.ingredientId, nom: l.ingredient.nom, unite: l.ingredient.unite as Unite, quantite: l.quantite }))
          .sort((x, y) => x.nom.localeCompare(y.nom, "fr")),
      }))
      .sort((x, y) => y.reservations - x.reservations || x.nom.localeCompare(y.nom, "fr")),
  };
}
