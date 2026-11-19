"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jourDuMenu } from "@/lib/donnees-admin";
import { fcfa } from "@/lib/format";
import { aujourdhui } from "@/lib/horloge";
import { estUnJour } from "@/lib/jours";
import { IDS_ALLERGENES } from "@/lib/listes";
import { DESCRIPTION_MAX, NOM_MAX, PORTIONS_MAX, PRIX_MAX, PRIX_MIN } from "@/lib/menu";
import { ajouterAuMenu, creerPlat, modifierMenuJour, modifierPlat, retirerDuMenu } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Planifier les menus : mettre un plat au menu d'un jour (un plat de la carte ou un nouveau), régler son prix du jour,
// ses portions et son état épuisé, le retirer, corriger la fiche d'un plat. Chaque geste vérifie que c'est la cantine
// qui appelle, valide ce qu'il reçoit, refuse de toucher à un jour passé, puis laisse src/lib/operations.ts écrire.

export type Retour = { ok: true } | { ok: false; erreur: string };
const echec = (erreur: string): Retour => ({ ok: false, erreur });
const REFUS = echec("Reconnecte-toi avec le compte de la cantine");
const JOUR_PASSE = "Ce jour est passé : son menu ne se modifie plus";
const PAGE = "/admin/menus";

const PHRASE_PRIX = `Un prix entre ${fcfa(PRIX_MIN)} et ${fcfa(PRIX_MAX)}, sans centimes`;
const PHRASE_PORTIONS = `Des portions entre 1 et ${PORTIONS_MAX.toLocaleString("fr-FR")}, ou rien`;
const PHRASE_NOM = `Un nom de plat de 2 à ${NOM_MAX} caractères`;
const PHRASE_ALLERGENE = "Cet allergène n'est pas dans la liste";
/** Ce que l'écran n'envoie jamais : une demande qui n'a pas la bonne forme. */
const ILLISIBLE = "Cette demande ne se lit pas, recharge la page";

const Id = z.string("Ce plat est introuvable").min(1, "Ce plat est introuvable").max(64, "Ce plat est introuvable");
const Jour = z.string("Ce jour n'existe pas").refine(estUnJour, "Ce jour n'existe pas");
const Prix = z.number(PHRASE_PRIX).int(PHRASE_PRIX).min(PRIX_MIN, PHRASE_PRIX).max(PRIX_MAX, PHRASE_PRIX);
const Portions = z.number(PHRASE_PORTIONS).int(PHRASE_PORTIONS).min(1, PHRASE_PORTIONS).max(PORTIONS_MAX, PHRASE_PORTIONS).nullable();
const Plat = z.object({
  nom: z.string(PHRASE_NOM).trim().min(2, PHRASE_NOM).max(NOM_MAX, PHRASE_NOM),
  description: z.string("Cette description ne se lit pas").trim().max(DESCRIPTION_MAX, `Une description de ${DESCRIPTION_MAX} caractères au plus`),
  photo: z.string("Cette photo n'est pas dans la liste").max(200, "Cette photo n'est pas dans la liste"),
  prix: Prix,
  allergenes: z.array(z.string(PHRASE_ALLERGENE).refine((v) => IDS_ALLERGENES.includes(v), PHRASE_ALLERGENE), "Coche les allergènes dans la liste").max(IDS_ALLERGENES.length, PHRASE_ALLERGENE),
  porc: z.boolean("Dis si le plat contient du porc"),
  vegetarien: z.boolean("Dis si le plat est végétarien"),
}, ILLISIBLE);

export type SaisiePlat = z.infer<typeof Plat>;

const AjoutExistant = z.object({ jour: Jour, platId: Id, prix: Prix, portions: Portions }, ILLISIBLE);

/** Met un plat de la carte au menu d'un jour (aujourd'hui ou plus tard), à son prix de ce jour-là. */
export async function ajouterPlatAuMenu(entree: z.infer<typeof AjoutExistant>): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = AjoutExistant.safeParse(entree);
  if (!v.success) return echec(v.error.issues[0].message);
  if (v.data.jour < aujourdhui()) return echec(JOUR_PASSE);
  const r = await ajouterAuMenu(v.data.jour, v.data.platId, v.data.prix, v.data.portions);
  if (!r.ok) return r;
  revalidatePath(PAGE);
  return { ok: true };
}

const AjoutNouveau = z.object({ jour: Jour, plat: Plat, portions: Portions }, ILLISIBLE);

/** Crée un plat, puis le met au menu de ce jour à son prix. Tout est vérifié avant de créer quoi que ce soit. */
export async function creerPlatAuMenu(entree: z.infer<typeof AjoutNouveau>): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = AjoutNouveau.safeParse(entree);
  if (!v.success) return echec(v.error.issues[0].message);
  if (v.data.jour < aujourdhui()) return echec(JOUR_PASSE);
  const cree = await creerPlat(v.data.plat);
  if (!cree.ok) return cree;
  const r = await ajouterAuMenu(v.data.jour, cree.id, v.data.plat.prix, v.data.portions);
  revalidatePath(PAGE);
  return r.ok ? { ok: true } : r;
}

const MenuJour = z.object({ id: Id, prix: Prix, portions: Portions, epuise: z.boolean("Dis si le plat est épuisé") }, ILLISIBLE);

/** Le prix du jour (pour les prochaines réservations), les portions prévues, l'état épuisé. */
export async function enregistrerMenuJour(entree: z.infer<typeof MenuJour>): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = MenuJour.safeParse(entree);
  if (!v.success) return echec(v.error.issues[0].message);
  const jour = await jourDuMenu(v.data.id);
  if (!jour) return echec("Ce plat n'est plus au menu");
  if (jour < aujourdhui()) return echec(JOUR_PASSE);
  const r = await modifierMenuJour(v.data.id, { prix: v.data.prix, portions: v.data.portions, epuise: v.data.epuise });
  if (!r.ok) return r;
  revalidatePath(PAGE);
  return { ok: true };
}

/** Retire un plat du menu d'un jour, s'il n'a jamais été réservé (src/lib/operations.ts le revérifie). */
export async function retirerPlatDuMenu(id: string): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = Id.safeParse(id);
  if (!v.success) return echec(v.error.issues[0].message);
  const jour = await jourDuMenu(v.data);
  if (!jour) return echec("Ce plat n'est plus au menu");
  if (jour < aujourdhui()) return echec(JOUR_PASSE);
  const r = await retirerDuMenu(v.data);
  if (!r.ok) return r;
  revalidatePath(PAGE);
  return { ok: true };
}

const FichePlat = z.object({ id: Id, plat: Plat }, ILLISIBLE);

/** Corrige la fiche d'un plat. Son prix est celui proposé à l'avenir : les jours déjà planifiés gardent le leur. */
export async function enregistrerPlat(entree: z.infer<typeof FichePlat>): Promise<Retour> {
  if (!(await autorise("admin"))) return REFUS;
  const v = FichePlat.safeParse(entree);
  if (!v.success) return echec(v.error.issues[0].message);
  const r = await modifierPlat(v.data.id, v.data.plat);
  if (!r.ok) return r;
  revalidatePath(PAGE);
  return { ok: true };
}
