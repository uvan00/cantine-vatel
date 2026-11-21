import "server-only";
import { prisma } from "@/lib/db";
import { ajouterJours } from "@/lib/jours";
import { lireListe } from "@/lib/listes";
import { moyenne } from "@/lib/menu";

// Les lectures de la base propres au convive : le menu des jours qui viennent, ses tickets, son journal.
// Rien n'écrit ici : tout ce qui écrit passe par src/lib/operations.ts.

/** Le menu montre sept jours, aujourd'hui compris. */
const JOURS_AU_MENU = 7;

export type JourAuMenu = {
  jour: string;
  /** Le convive a déjà un repas, non annulé, ce jour-là. */
  reserve: boolean;
};

/** Les jours qui ont un menu, d'aujourd'hui à six jours plus tard, avec ceux où ce convive a déjà réservé. */
export async function joursAuMenu(conviveId: string, aujourdhui: string): Promise<JourAuMenu[]> {
  const periode = { gte: aujourdhui, lte: ajouterJours(aujourdhui, JOURS_AU_MENU - 1) };
  const [menus, repas] = await Promise.all([
    prisma.menuJour.findMany({ where: { jour: periode }, select: { jour: true }, distinct: ["jour"], orderBy: { jour: "asc" } }),
    prisma.reservation.findMany({ where: { conviveId, jour: periode, etat: { not: "annulee" } }, select: { jour: true } }),
  ]);
  const reserves = new Set(repas.map((r) => r.jour));
  return menus.map((m) => ({ jour: m.jour, reserve: reserves.has(m.jour) }));
}

export type PlatAuMenu = {
  /** Le plat au menu de ce jour (MenuJour) : c'est lui qu'on réserve. */
  id: string;
  /** Le plat lui-même : c'est lui qu'on met en favori. */
  platId: string;
  /** Son arrivée à la carte : « Nouveau » pendant deux semaines (src/lib/favoris.ts). */
  creeLe: Date;
  nom: string;
  description: string;
  photo: string;
  /** Le prix de ce jour-là. */
  prix: number;
  allergenes: string[];
  porc: boolean;
  vegetarien: boolean;
  portions: number | null;
  epuise: boolean;
  /** Repas déjà réservés pour ce plat ce jour-là, annulés exclus. */
  reservees: number;
  /** La moyenne des notes de ce plat, tous jours confondus (table Note) ; null tant que personne ne l'a noté. */
  note: number | null;
  avis: number;
};

/** Les plats que ce convive a mis en favori (l'étoile du menu). */
export async function mesFavoris(userId: string): Promise<Set<string>> {
  return new Set((await prisma.favori.findMany({ where: { userId }, select: { platId: true } })).map((f) => f.platId));
}

/** Les plats d'un jour, dans l'ordre où la cantine les a mis au menu. */
export async function platsAuMenu(jour: string): Promise<PlatAuMenu[]> {
  const menus = await prisma.menuJour.findMany({
    where: { jour },
    orderBy: { id: "asc" },
    include: { plat: true, _count: { select: { reservations: { where: { etat: { not: "annulee" } } } } } },
  });
  const notes = await prisma.note.findMany({ where: { platId: { in: menus.map((m) => m.platId) } }, select: { platId: true, note: true } });
  const parPlat = new Map<string, number[]>();
  for (const n of notes) parPlat.set(n.platId, [...(parPlat.get(n.platId) ?? []), n.note]);
  return menus.map((m) => {
    const recues = parPlat.get(m.platId) ?? [];
    return {
      id: m.id,
      platId: m.platId,
      creeLe: m.plat.creeLe,
      nom: m.plat.nom,
      description: m.plat.description,
      photo: m.plat.photo,
      prix: m.prix,
      allergenes: lireListe(m.plat.allergenes),
      porc: m.plat.porc,
      vegetarien: m.plat.vegetarien,
      portions: m.portions,
      epuise: m.epuise,
      reservees: m._count.reservations,
      note: moyenne(recues),
      avis: recues.length,
    };
  });
}

/** Un repas réservé, tel que les écrans du convive le montrent. */
export type Repas = {
  id: string;
  jeton: string;
  code: string;
  jour: string;
  plat: string;
  /** Le prix payé, figé à la réservation. */
  prix: number;
  /** reservee, servie ou annulee, comme dans la base. « Non retiré » se calcule : etatAffiche de src/lib/reservation.ts. */
  etat: string;
  reserveLe: string;
  serviLe: string | null;
  /** La note que le convive a donnée à ce repas, s'il l'a noté. */
  note: number | null;
  mot: string;
  /** L'heure de passage choisie (« 12:15 ») ; null sans créneaux. */
  creneau: string | null;
};

const AVEC = { menuJour: { select: { plat: { select: { nom: true } } } }, note: { select: { note: true, mot: true } } } as const;

type Ligne = {
  id: string; jeton: string; code: string; jour: string; prix: number; etat: string; creeLe: Date; serviLe: Date | null; creneau: string | null;
  menuJour: { plat: { nom: string } };
  note: { note: number; mot: string } | null;
};

const enRepas = (r: Ligne): Repas => ({
  id: r.id,
  jeton: r.jeton,
  code: r.code,
  jour: r.jour,
  plat: r.menuJour.plat.nom,
  prix: r.prix,
  etat: r.etat,
  reserveLe: r.creeLe.toISOString(),
  serviLe: r.serviLe?.toISOString() ?? null,
  note: r.note?.note ?? null,
  mot: r.note?.mot ?? "",
  creneau: r.creneau,
});

/** Le repas de ce convive pour ce jour (un seul par jour, annulés exclus), ou null. */
export async function repasDuJour(conviveId: string, jour: string): Promise<Repas | null> {
  const r = await prisma.reservation.findFirst({ where: { conviveId, jour, etat: { not: "annulee" } }, include: AVEC });
  return r ? enRepas(r) : null;
}

/** Combien de repas passés la liste des tickets montre. */
const REPAS_PASSES = 10;

/**
 * Les tickets d'un convive : celui d'aujourd'hui, ceux qui arrivent, puis les dix derniers repas passés, quel que soit
 * leur état (servi, annulé, non retiré). Un repas annulé pour aujourd'hui ou plus tard n'est plus à venir : il rejoint
 * les repas passés une fois son jour fini, et son remboursement se lit tout de suite dans l'historique du compte.
 */
export async function ticketsDe(conviveId: string, aujourdhui: string): Promise<{ duJour: Repas | null; aVenir: Repas[]; passes: Repas[] }> {
  const [duJour, aVenir, passes] = await Promise.all([
    repasDuJour(conviveId, aujourdhui),
    prisma.reservation.findMany({ where: { conviveId, jour: { gt: aujourdhui }, etat: { not: "annulee" } }, orderBy: { jour: "asc" }, include: AVEC }),
    prisma.reservation.findMany({ where: { conviveId, jour: { lt: aujourdhui } }, orderBy: [{ jour: "desc" }, { creeLe: "desc" }], take: REPAS_PASSES, include: AVEC }),
  ]);
  return { duJour, aVenir: aVenir.map(enRepas), passes: passes.map(enRepas) };
}

/** Le ticket que porte ce jeton, avec son propriétaire ; null si le jeton n'existe pas. */
export async function ticketDe(jeton: string): Promise<(Repas & { conviveId: string; convive: string }) | null> {
  const r = await prisma.reservation.findUnique({ where: { jeton }, include: { ...AVEC, convive: { select: { name: true } } } });
  return r ? { ...enRepas(r), conviveId: r.conviveId, convive: r.convive.name } : null;
}

/** Où en est un ticket, pour la relecture en direct : son propriétaire, son état, l'heure où il a été servi. */
export async function etatDuTicket(jeton: string): Promise<{ conviveId: string; etat: string; serviLe: string | null } | null> {
  const r = await prisma.reservation.findUnique({ where: { jeton }, select: { conviveId: true, etat: true, serviLe: true } });
  return r ? { conviveId: r.conviveId, etat: r.etat, serviLe: r.serviLe?.toISOString() ?? null } : null;
}

export type LigneJournal = { id: string; genre: string; montant: number; libelle: string; quand: string };

/** Les derniers mouvements du compte, du plus récent au plus ancien. */
export async function journalDe(conviveId: string, combien: number): Promise<LigneJournal[]> {
  const lignes = await prisma.mouvement.findMany({
    where: { conviveId },
    orderBy: [{ creeLe: "desc" }, { id: "desc" }],
    take: combien,
    select: { id: true, genre: true, montant: true, libelle: true, creeLe: true },
  });
  return lignes.map((l) => ({ id: l.id, genre: l.genre, montant: l.montant, libelle: l.libelle, quand: l.creeLe.toISOString() }));
}

/** Les places prises à chaque heure de passage d'un jour (réservations annulées exclues). */
export async function prisParCreneau(jour: string): Promise<Record<string, number>> {
  const groupes = await prisma.reservation.groupBy({ by: ["creneau"], where: { jour, etat: { not: "annulee" }, creneau: { not: null } }, _count: { _all: true } });
  return Object.fromEntries(groupes.map((g) => [g.creneau as string, g._count._all]));
}

export type DemandeDuJour = { id: string; plat: string; etat: string; jeton: string | null };

/** La dernière demande hors délai de ce convive pour ce jour, avec le ticket si la cantine l'a acceptée. */
export async function demandeDuJour(conviveId: string, jour: string): Promise<DemandeDuJour | null> {
  const d = await prisma.demandeRepas.findFirst({ where: { conviveId, jour }, orderBy: { creeLe: "desc" }, include: { menuJour: { select: { plat: { select: { nom: true } } } } } });
  if (!d) return null;
  const r = d.reservationId ? await prisma.reservation.findUnique({ where: { id: d.reservationId }, select: { jeton: true } }) : null;
  return { id: d.id, plat: d.menuJour.plat.nom, etat: d.etat, jeton: r?.jeton ?? null };
}
