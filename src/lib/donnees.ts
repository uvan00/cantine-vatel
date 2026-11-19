import "server-only";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { lireListe } from "@/lib/listes";
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
  codeFamille: string;
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
    codeFamille: p.codeFamille,
    seuilAlerte: p.seuilAlerte,
  };
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
