import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { ajouterJours, lundiDe } from "@/lib/jours";
import { lireListe } from "@/lib/listes";
import { REGLAGES_DEFAUT, type Reglages } from "@/lib/reglages";
import type { Moi } from "@/lib/session";
import { soldeDe } from "@/lib/solde";

// Les lectures de la base partagées par plusieurs écrans. Chaque écran ajoute les siennes à côté de sa page.

/** Le solde d'un compte : la somme de son journal (la règle est dans src/lib/solde.ts). */
export async function soldeDuCompte(conviveId: string) {
  return soldeDe(await prisma.mouvement.findMany({ where: { conviveId }, select: { montant: true } }));
}

/** Les soldes de plusieurs comptes d'un coup (même somme, faite par la base). Un compte sans mouvement vaut 0. */
export async function soldesDesComptes(conviveIds: string[]): Promise<Map<string, number>> {
  const soldes = new Map(conviveIds.map((id) => [id, 0]));
  if (conviveIds.length === 0) return soldes;
  const sommes = await prisma.mouvement.groupBy({ by: ["conviveId"], where: { conviveId: { in: conviveIds } }, _sum: { montant: true } });
  for (const s of sommes) soldes.set(s.conviveId, s._sum.montant ?? 0);
  return soldes;
}

export type VueProfil = {
  genre: "eleve" | "employe";
  classe: string;
  allergenes: string[];
  regimes: string[];
  seuilAlerte: number;
};

/** Le profil d'un convive (élève ou employé) ; null pour un parent ou un administrateur. */
export async function profilDe(conviveId: string): Promise<VueProfil | null> {
  const p = await prisma.profil.findUnique({ where: { userId: conviveId } });
  if (!p) return null;
  return {
    genre: p.genre === "employe" ? "employe" : "eleve",
    classe: p.classe,
    allergenes: lireListe(p.allergenes),
    regimes: lireListe(p.regimes),
    seuilAlerte: p.seuilAlerte,
  };
}

/** Les parents reliés au compte de ce convive, du plus ancien au plus récent. */
export async function parentsDe(conviveId: string): Promise<{ id: string; nom: string }[]> {
  const liens = await prisma.lienParent.findMany({ where: { enfantId: conviveId }, orderBy: { creeLe: "asc" }, select: { parent: { select: { id: true, name: true } } } });
  return liens.map((l) => ({ id: l.parent.id, nom: l.parent.name }));
}

/**
 * Le plafond de la semaine d'un convive, ce qu'il a déjà réservé cette semaine-là (du lundi au dimanche, annulés
 * exclus, le même compte que la réservation), et s'il a un parent relié (c'est alors lui qui règle le plafond).
 */
export async function plafondDe(conviveId: string, jour: string): Promise<{ plafond: number | null; depense: number; parParent: boolean }> {
  const lundi = lundiDe(jour);
  const [profil, somme, parents] = await Promise.all([
    prisma.profil.findUnique({ where: { userId: conviveId }, select: { plafondSemaine: true } }),
    prisma.reservation.aggregate({ where: { conviveId, jour: { gte: lundi, lte: ajouterJours(lundi, 6) }, etat: { not: "annulee" } }, _sum: { prix: true } }),
    prisma.lienParent.count({ where: { enfantId: conviveId } }),
  ]);
  return { plafond: profil?.plafondSemaine ?? null, depense: somme._sum.prix ?? 0, parParent: parents > 0 };
}

/** Ce que montre la carte de cantine : le nom, la photo ou l'avatar, la classe ou le service. */
export async function identiteDe(userId: string): Promise<{ nom: string; photo: string | null; classe: string } | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, image: true, profil: { select: { classe: true } } } });
  return u && { nom: u.name, photo: u.image ?? null, classe: u.profil?.classe ?? "" };
}

export async function estParentDe(parentId: string, enfantId: string) {
  return (await prisma.lienParent.count({ where: { parentId, enfantId } })) > 0;
}

/**
 * Vrai si cette personne peut agir sur ce compte de convive : c'est le sien, celui de son enfant, ou elle est la
 * cantine. Un parent ne voit et ne touche que ses enfants.
 */
export async function peutAgirPour(acteur: Pick<Moi, "id" | "role">, conviveId: string) {
  if (acteur.role === "admin") return true;
  if (acteur.role === "convive") return acteur.id === conviveId;
  return estParentDe(acteur.id, conviveId);
}

/** Les photos de plats rangées dans public/plats (« /plats/attieke.jpg »), pour le choix côté administrateur. */
export async function photosDisponibles(): Promise<string[]> {
  try {
    const fichiers = await readdir(path.join(process.cwd(), "public", "plats"));
    return fichiers.filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort().map((f) => `/plats/${f}`);
  } catch {
    return [];
  }
}

/** Les réglages de la cantine (heure de clôture, créneaux, remises) ; les valeurs par défaut tant que rien n'est réglé. */
export async function lireReglages(): Promise<Reglages> {
  const r = await prisma.reglages.findUnique({ where: { id: 1 } });
  if (!r) return REGLAGES_DEFAUT;
  return {
    heureCloture: r.heureCloture, creneauxActifs: r.creneauxActifs, creneauDebut: r.creneauDebut, creneauFin: r.creneauFin,
    creneauMinutes: r.creneauMinutes, creneauCapacite: r.creneauCapacite, remiseReduit: r.remiseReduit, remisePersonnel: r.remisePersonnel,
  };
}
