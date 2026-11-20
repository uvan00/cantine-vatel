import "server-only";
import { prisma } from "@/lib/db";
import { ajouterJours, cloturePassee, jourIso, joursAPartirDe, lundiDe } from "@/lib/jours";
import { lireListe } from "@/lib/listes";
import { moyenne, peutRetirer } from "@/lib/menu";
import type { MoyenRecharge } from "@/lib/recharge";
import { estComplet, etatAffiche, portionsRestantes, scanner, type EtatAffiche, type Scan } from "@/lib/reservation";
import {
  chiffresDuService, classer, nonRetires, notesParPlat, rechargesConfirmees, repasParJour, repasParPlat, septDerniersJours,
  type ChiffresService, type LignePlat,
} from "@/lib/statistiques";
import { lireCle } from "@/lib/ticket";

// Les lectures de la base pour l'administrateur de la cantine (tableau de bord, menus, commandes, scanner, recharges).
// Rien n'écrit ici : tout ce qui écrit passe par src/lib/operations.ts. Les calculs sont dans src/lib/statistiques.ts.
// Ces fonctions ne vérifient pas QUI appelle : la page fait `exiger("admin")`, l'action et la route `autorise("admin")`.

/** « Bachelor 2 », « Accueil », ou à défaut « Élève » ou « Employé ». */
const groupeDe = (profil: { classe: string; genre: string } | null) => profil?.classe || (profil?.genre === "employe" ? "Employé" : "Élève");

const parNom = (a: { nom: string }, b: { nom: string }) => a.nom.localeCompare(b.nom, "fr");

/* ── Tableau de bord ───────────────────────────────────────────────────────── */

export type VueTableau = {
  aujourdhui: string;
  service: ChiffresService;
  rechargesEnAttente: number;
  /** Du lundi au dimanche de la semaine en cours. */
  semaine: { jour: string; repas: number }[];
  demain: { jour: string; total: number; plats: { id: string; nom: string; repas: number; portions: number | null }[] };
  /** Les sept jours terminés avant aujourd'hui. */
  septJours: { debut: string; fin: string; plats: (LignePlat & { photo: string })[]; nonRetires: { nombre: number; total: number }; recharges: number };
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

  const [lignes, menusDemain, rechargesEnAttente, recharges, notes] = await Promise.all([
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
    },
    rechargesAujourdhui: rechargesConfirmees(confirmees, aujourdhui, aujourdhui),
    notes: { moyenne: moyenne(notes.map((n) => n.note)), avis: notes.length },
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
};

export type VueJourMenu = { jour: string; plats: VueMenuJour[] };

/** Les sept jours à partir de ce lundi, chacun avec ses plats (par ordre alphabétique) et leurs réservations. */
export async function menusDeLaSemaine(lundi: string): Promise<VueJourMenu[]> {
  const jours = joursAPartirDe(lundi, 7);
  const [menus, comptes] = await Promise.all([
    prisma.menuJour.findMany({ where: { jour: { in: jours } }, include: { plat: { select: { nom: true, photo: true } } } }),
    prisma.reservation.groupBy({ by: ["menuJourId", "etat"], where: { jour: { in: jours } }, _count: { _all: true } }),
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
};

/** Tous les plats de la carte, par ordre alphabétique, avec leur note moyenne. */
export async function tousLesPlats(): Promise<VuePlat[]> {
  const [plats, notes] = await Promise.all([
    prisma.plat.findMany(),
    prisma.note.findMany({ select: { platId: true, note: true } }),
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
  /** Sa classe ou son service. */
  groupe: string;
  etat: EtatAffiche;
  /** Le code court de son ticket. */
  code: string;
  serviLe: string | null;
};

export type VuePlatCommande = {
  id: string;
  nom: string;
  portions: number | null;
  /** Portions encore libres ; null : pas de limite. */
  restantes: number | null;
  epuise: boolean;
  complet: boolean;
  reserves: number;
  servis: number;
  aServir: number;
  convives: VueConvive[];
};

export type VueCommandes = {
  cle: CleJour;
  jour: string;
  /** L'instant de la lecture, à l'heure du serveur. */
  maintenant: number;
  /** Vrai quand les réservations de ce jour sont closes : les nombres réservés ne bougent plus. */
  cloturee: boolean;
  service: ChiffresService;
  plats: VuePlatCommande[];
};

/** Ce que la cuisine prépare : par plat, les repas réservés, servis, à servir, et les convives. */
export async function commandesDuJour(cle: CleJour, maintenant: number): Promise<VueCommandes> {
  const jour = cle === "demain" ? ajouterJours(jourIso(maintenant), 1) : jourIso(maintenant);
  const menus = await prisma.menuJour.findMany({
    where: { jour },
    include: {
      plat: { select: { nom: true } },
      reservations: {
        where: { etat: { not: "annulee" } },
        select: { id: true, etat: true, jour: true, code: true, serviLe: true, convive: { select: { name: true, profil: { select: { classe: true, genre: true } } } } },
      },
    },
  });
  const plats = menus.map((m): VuePlatCommande => {
    const convives = m.reservations
      .map((r): VueConvive => ({ id: r.id, nom: r.convive.name, groupe: groupeDe(r.convive.profil), etat: etatAffiche(r, maintenant), code: r.code, serviLe: r.serviLe?.toISOString() ?? null }))
      // Ceux qu'il reste à servir d'abord, chacun par ordre alphabétique.
      .sort((a, b) => Number(a.etat === "servie") - Number(b.etat === "servie") || parNom(a, b));
    const service = chiffresDuService(m.reservations);
    return {
      id: m.id,
      nom: m.plat.nom,
      portions: m.portions,
      restantes: portionsRestantes({ portions: m.portions, reservees: service.reserves }),
      epuise: m.epuise,
      complet: estComplet({ epuise: m.epuise, portions: m.portions, reservees: service.reserves }),
      ...service,
      convives,
    };
  });
  return {
    cle,
    jour,
    maintenant,
    cloturee: cloturePassee(jour, maintenant),
    service: chiffresDuService(menus.flatMap((m) => m.reservations)),
    // Le plat le plus réservé d'abord, comme sur le tableau de bord.
    plats: plats.sort((a, b) => b.reserves - a.reserves || parNom(a, b)),
  };
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
  const avec = { convive: { select: { name: true } }, menuJour: { select: { plat: { select: { nom: true } } } } } as const;
  const r = "jeton" in lue
    ? await prisma.reservation.findUnique({ where: { jeton: lue.jeton }, include: avec })
    : (await prisma.reservation.findFirst({ where: { code: lue.code, jour: jourIso(maintenant) }, include: avec }))
      ?? (await prisma.reservation.findFirst({ where: { code: lue.code }, orderBy: { jour: "desc" }, include: avec }));
  if (!r) return null;
  return { cle: r.jeton, convive: r.convive.name, plat: r.menuJour.plat.nom, jour: r.jour, code: r.code, apercu: scanner(r, maintenant) };
}

/* ── Recharges ─────────────────────────────────────────────────────────────── */

export type VueRechargeEnAttente = {
  id: string;
  reference: string;
  beneficiaire: string;
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
  const beneficiaire = { select: { name: true, profil: { select: { classe: true, genre: true } } } } as const;
  const dernierPaiement = { orderBy: { creeLe: "desc" }, take: 1, select: { statut: true, remarque: true } } as const;
  const [attente, confirmees, annulees, aVerifier] = await Promise.all([
    prisma.recharge.findMany({ where: { etat: "en_attente" }, orderBy: { creeLe: "asc" }, include: { beneficiaire, demandeur: { select: { name: true } }, paiements: dernierPaiement } }),
    prisma.recharge.findMany({ where: { etat: "confirmee" }, orderBy: { confirmeeLe: "desc" }, take: DERNIERES, include: { beneficiaire } }),
    prisma.recharge.findMany({ where: { etat: "annulee" }, orderBy: { annuleeLe: "desc" }, take: DERNIERES, include: { beneficiaire } }),
    prisma.paiementCartflox.findMany({
      where: { statut: "SUCCESS", remarque: { not: null }, recharge: { etat: { in: ["en_attente", "annulee"] } } },
      orderBy: { luLe: "desc" },
      take: DERNIERES,
      include: { recharge: { select: { id: true, reference: true, montant: true, etat: true, beneficiaire: { select: { name: true } } } } },
    }),
  ]);
  const dernieres = [...confirmees, ...annulees]
    .map((r): VueRechargePassee => ({
      id: r.id,
      reference: r.reference,
      beneficiaire: r.beneficiaire.name,
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
      montant: p.recharge.montant,
      encaisse: p.montant,
      etatRecharge: p.recharge.etat === "annulee" ? "annulee" : "en_attente",
      remarque: p.remarque ?? "",
    })),
    dernieres,
  };
}

export type VueCompte = { id: string; nom: string; groupe: string };
/** Un compte trouvé par la recherche, avec son solde du moment. */
export type VueCompteTrouve = VueCompte & { solde: number };

/** Tous les comptes qui se rechargent (élèves et employés), par ordre alphabétique : la recherche par nom s'y fait. */
export async function comptesDesConvives(): Promise<VueCompte[]> {
  const profils = await prisma.profil.findMany({ select: { userId: true, classe: true, genre: true, user: { select: { name: true } } } });
  return profils.map((p): VueCompte => ({ id: p.userId, nom: p.user.name, groupe: groupeDe(p) })).sort(parNom);
}
