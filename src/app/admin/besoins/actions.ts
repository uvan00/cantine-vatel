"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { besoinsDuJour } from "@/lib/besoins";
import { MOYENS_DEPENSE } from "@/lib/comptabilite";
import { vueBesoins } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { basculerSortie, compterIngredient, enregistrerFiche, livrerIngredient, retirerLivraison } from "@/lib/operations";
import { autorise } from "@/lib/session";

// La fiche recette d'un plat : la cantine dit, pour une portion, la quantité de chaque ingrédient. Le serveur revalide
// tout (src/lib/besoins.ts, refusFiche) et écrit (src/lib/operations.ts, enregistrerFiche).

const Id = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i);
const Lignes = z.array(z.object({ nom: z.string().max(80), unite: z.string().max(10), quantite: z.number() })).max(40);

export async function enregistrerFicheRecette(platId: string, lignes: { nom: string; unite: string; quantite: number }[]): Promise<{ ok: true } | { ok: false; erreur: string }> {
  if (!(await autorise("admin"))) return { ok: false, erreur: "Reconnecte-toi avec le compte de la cantine" };
  const id = Id.safeParse(platId);
  const v = Lignes.safeParse(lignes);
  if (!id.success || !v.success) return { ok: false, erreur: "Une fiche incomplète" };
  const r = await enregistrerFiche(id.data, v.data);
  if (r.ok) revalidatePath("/admin/besoins");
  return r;
}

/* ── La réserve (lot 2) : livraisons, inventaire, sorties ───────────────────── */

type Resultat = { ok: true } | { ok: false; erreur: string };
const RECONNECTE = { ok: false as const, erreur: "Reconnecte-toi avec le compte de la cantine" };

/** Après une écriture de la réserve : la page des besoins, et la comptabilité quand une dépense a été notée. */
function rafraichir(depense = false) {
  revalidatePath("/admin/besoins");
  if (depense) revalidatePath("/admin/recharges", "layout");
}

const Livraison = z.object({
  ingredientId: Id,
  quantite: z.number().int(),
  prix: z.number().int().nullable(),
  jour: z.string().max(10),
  fournisseur: z.string().max(80),
  moyen: z.enum(MOYENS_DEPENSE.map((m) => m.id) as [string, ...string[]]),
});

/** Une livraison : la réserve monte ; payée, la dépense se note aussi dans la comptabilité. */
export async function noterLivraison(saisie: z.input<typeof Livraison>): Promise<Resultat> {
  const m = await autorise("admin");
  if (!m) return RECONNECTE;
  const v = Livraison.safeParse(saisie);
  if (!v.success) return { ok: false, erreur: "Une livraison incomplète" };
  const r = await livrerIngredient(v.data, m.nom);
  if (r.ok) rafraichir(v.data.prix !== null);
  return r;
}

/** L'inventaire d'un ingrédient : ce qui a été compté dans la réserve. */
export async function noterInventaire(ingredientId: string, compte: number): Promise<{ ok: true; ecart: number } | { ok: false; erreur: string }> {
  const m = await autorise("admin");
  if (!m) return RECONNECTE;
  const id = Id.safeParse(ingredientId);
  if (!id.success || !Number.isInteger(compte)) return { ok: false, erreur: "Un comptage incomplet" };
  const r = await compterIngredient(id.data, compte, m.nom);
  if (r.ok) rafraichir();
  return r;
}

/**
 * La case « Sorti » de la liste du jour. La quantité ne vient jamais de l'écran : le serveur relit les besoins de ce
 * jour et sort ce que ses réservations demandent.
 */
export async function basculerSortieDuJour(cle: "aujourdhui" | "demain", ingredientId: string): Promise<{ ok: true; sorti: boolean } | { ok: false; erreur: string }> {
  const m = await autorise("admin");
  if (!m) return RECONNECTE;
  const id = Id.safeParse(ingredientId);
  const jour = z.enum(["aujourdhui", "demain"]).safeParse(cle);
  if (!id.success || !jour.success) return { ok: false, erreur: "Une case incomplète" };
  const vue = await vueBesoins(jour.data, maintenant());
  const besoin = besoinsDuJour(vue.plats).besoins.find((b) => b.ingredientId === id.data);
  const r = await basculerSortie(id.data, vue.jour, besoin?.total ?? 0, m.nom);
  if (r.ok) rafraichir();
  return r;
}

/** Retirer une livraison notée par erreur : sa dépense part avec elle. */
export async function retirerUneLivraison(id: string): Promise<Resultat> {
  if (!(await autorise("admin"))) return RECONNECTE;
  const v = Id.safeParse(id);
  if (!v.success) return { ok: false, erreur: "Cette livraison n'existe plus" };
  const r = await retirerLivraison(v.data);
  if (r.ok) rafraichir(true);
  return r;
}
