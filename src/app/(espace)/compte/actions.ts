"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { IDS_ALLERGENES, IDS_REGIMES } from "@/lib/listes";
import { fcfa } from "@/lib/format";
import { creerCodeFamille, enregistrerProfilAlimentaire, reglerPlafond, reglerSeuilAlerte, retirerParent, type RepasEnCause } from "@/lib/operations";
import { autorise } from "@/lib/session";
import { SEUIL_ALERTE_MAX } from "@/lib/solde";

// Les réglages du convive : ce qu'il ne mange pas, et le solde sous lequel il veut être prévenu. Il ne règle que son
// propre compte : l'identifiant vient de sa session, jamais du navigateur.

type Reponse = { ok: true } | { ok: false; erreur: string };
const PHRASE_SESSION = "Ta session est finie, reconnecte-toi";
const SESSION_FINIE: Reponse = { ok: false, erreur: PHRASE_SESSION };

const parmi = (permis: readonly string[]) => z.array(z.string().max(40)).max(permis.length).refine((valeurs) => valeurs.every((v) => permis.includes(v)));
const Profil = z.object({ allergenes: parmi(IDS_ALLERGENES), regimes: parmi(IDS_REGIMES) });

/** `repasEnCause` : les repas déjà réservés que ce profil écarte maintenant, à dire tout de suite. */
export async function enregistrerProfil(saisi: { allergenes: string[]; regimes: string[] }): Promise<{ ok: true; repasEnCause: RepasEnCause[] } | { ok: false; erreur: string }> {
  const moi = await autorise("convive");
  if (!moi) return { ok: false, erreur: PHRASE_SESSION };
  const v = Profil.safeParse(saisi);
  if (!v.success) return { ok: false, erreur: "Choisis dans la liste de la cantine" };
  const r = await enregistrerProfilAlimentaire(moi, moi.id, v.data);
  // Le profil change ce qui se réserve au menu.
  if (r.ok) { revalidatePath("/compte"); revalidatePath("/menu"); }
  return r;
}

const Seuil = z.number().int().min(0).max(SEUIL_ALERTE_MAX);

export async function enregistrerSeuil(seuil: number): Promise<Reponse> {
  const moi = await autorise("convive");
  if (!moi) return SESSION_FINIE;
  const v = Seuil.safeParse(seuil);
  if (!v.success) return { ok: false, erreur: `Un seuil entre 0 et ${fcfa(SEUIL_ALERTE_MAX)}, sans centimes` };
  const r = await reglerSeuilAlerte(moi, moi.id, v.data);
  // Le seuil décide du bandeau de solde bas, au menu comme ici.
  if (r.ok) { revalidatePath("/compte"); revalidatePath("/menu"); }
  return r;
}

/** Le plafond des repas de la semaine de ce convive ; null le retire. Refusé quand c'est son parent qui le règle. */
export async function enregistrerPlafond(plafond: number | null): Promise<Reponse> {
  const moi = await autorise("convive");
  if (!moi) return SESSION_FINIE;
  const v = z.number().int().nullable().safeParse(plafond);
  if (!v.success) return { ok: false, erreur: "Un plafond en F CFA, sans centimes" };
  const r = await reglerPlafond(moi, moi.id, v.data);
  // Le plafond décide de ce qui se réserve au menu.
  if (r.ok) { revalidatePath("/compte"); revalidatePath("/menu"); }
  return r;
}

/* ── Relier un parent ──────────────────────────────────────────────────────── */

/** Crée le code à donner à son parent : un seul à la fois, valable 15 minutes, pour un seul parent. */
export async function creerMonCodeFamille(): Promise<{ ok: true; code: string; expire: number } | { ok: false; erreur: string }> {
  const moi = await autorise("convive");
  if (!moi) return { ok: false, erreur: PHRASE_SESSION };
  return creerCodeFamille(moi.id);
}

/** Retire un parent de son compte : il ne voit plus rien et ne peut plus rien pour ce convive. */
export async function retirerMonParent(parentId: string): Promise<Reponse> {
  const moi = await autorise("convive");
  if (!moi) return SESSION_FINIE;
  const v = z.string().min(1).max(60).safeParse(parentId);
  if (!v.success) return { ok: false, erreur: "Ce parent n'est plus relié à ton compte" };
  const r = await retirerParent(moi.id, v.data);
  if (r.ok) { revalidatePath("/compte"); revalidatePath("/parent"); }
  return r;
}
