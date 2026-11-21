"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Identifiant } from "@/lib/donnees-parent";
import { de, fcfa } from "@/lib/format";
import { IDS_ALLERGENES, IDS_REGIMES } from "@/lib/listes";
import { enregistrerProfilAlimentaire, lierEnfant, reglerPlafond, reglerSeuilAlerte, transfererSolde, type RepasEnCause } from "@/lib/operations";
import { autorise, prenomDe } from "@/lib/session";
import { SEUIL_ALERTE_MAX, seuilValable } from "@/lib/solde";
import { nettoyerCode } from "@/lib/ticket";

// Les gestes du parent : relier un enfant, régler son profil alimentaire, son seuil d'alerte et son plafond de la
// semaine, faire passer de l'argent d'un enfant à l'autre. Chaque action vérifie
// la session et le rôle, valide ce qu'elle reçoit, puis laisse src/lib/operations.ts écrire : c'est là que
// `peutAgirPour` refuse un enfant qui n'est pas le sien.

/** `repasEnCause` : après le réglage du profil, les repas déjà réservés de l'enfant que ce profil écarte. */
export type Reponse = { ok: true; message: string; repasEnCause?: RepasEnCause[] } | { ok: false; erreur: string };

const refus = (erreur: string): Reponse => ({ ok: false, erreur });
const SESSION = "Ta session a expiré, reconnecte-toi";

const Code = z.string().max(40, "Le code famille fait 6 caractères").transform(nettoyerCode)
  .refine((c) => c.length === 6, "Le code famille fait 6 caractères");

export async function relierEnfant(code: string): Promise<Reponse> {
  const m = await autorise("parent");
  if (!m) return refus(SESSION);
  const v = Code.safeParse(code);
  if (!v.success) return refus(v.error.issues[0].message);
  const r = await lierEnfant(m.id, v.data);
  if (!r.ok) return r;
  revalidatePath("/parent");
  return { ok: true, message: `${r.enfant} est maintenant dans ta liste` };
}

const parmi = (permis: readonly string[], phrase: string) =>
  z.array(z.string()).max(permis.length, phrase).refine((valeurs) => valeurs.every((v) => permis.includes(v)), phrase);

const Profil = z.object({
  enfantId: Identifiant,
  allergenes: parmi(IDS_ALLERGENES, "Cet allergène n'est pas dans la liste"),
  regimes: parmi(IDS_REGIMES, "Ce régime n'est pas dans la liste"),
});

export async function reglerProfil(d: { enfantId: string; allergenes: string[]; regimes: string[] }): Promise<Reponse> {
  const m = await autorise("parent");
  if (!m) return refus(SESSION);
  const v = Profil.safeParse(d);
  if (!v.success) return refus(v.error.issues[0].message);
  const r = await enregistrerProfilAlimentaire(m, v.data.enfantId, { allergenes: v.data.allergenes, regimes: v.data.regimes });
  if (!r.ok) return r;
  revalidatePath(`/parent/enfant/${v.data.enfantId}`);
  return { ok: true, message: "C'est noté", repasEnCause: r.repasEnCause };
}

const phraseSeuil = `Un seuil entre 0 et ${fcfa(SEUIL_ALERTE_MAX)}, sans centimes`;
const Seuil = z.object({
  enfantId: Identifiant,
  // Le seuil arrive tel qu'il a été tapé : des chiffres, avec ou sans espaces.
  seuil: z.string().max(20, phraseSeuil).transform((t) => t.replace(/\s/g, "")).pipe(z.string().regex(/^\d{1,6}$/, phraseSeuil)).transform(Number).refine(seuilValable, phraseSeuil),
});

export async function reglerSeuil(d: { enfantId: string; seuil: string }): Promise<Reponse> {
  const m = await autorise("parent");
  if (!m) return refus(SESSION);
  const v = Seuil.safeParse(d);
  if (!v.success) return refus(v.error.issues[0].message);
  const r = await reglerSeuilAlerte(m, v.data.enfantId, v.data.seuil);
  if (!r.ok) return r;
  revalidatePath(`/parent/enfant/${v.data.enfantId}`);
  return { ok: true, message: "C'est noté" };
}

const Transfert = z.object({ deId: Identifiant, versId: Identifiant, montant: z.number().int().min(1).max(10_000_000) });

/** Fait passer de l'argent du compte d'un enfant à celui d'un autre ; src/lib/operations.ts relit les soldes. */
export async function transferer(d: { deId: string; versId: string; montant: number }): Promise<Reponse> {
  const m = await autorise("parent");
  if (!m) return refus(SESSION);
  const v = Transfert.safeParse(d);
  if (!v.success) return refus("Choisis deux enfants et un montant");
  const r = await transfererSolde(m.id, v.data.deId, v.data.versId, v.data.montant);
  if (!r.ok) return r;
  revalidatePath("/parent");
  revalidatePath(`/parent/enfant/${v.data.deId}`);
  revalidatePath(`/parent/enfant/${v.data.versId}`);
  return { ok: true, message: `${fcfa(v.data.montant)} sont passés du compte ${de(prenomDe(r.de))} à celui ${de(prenomDe(r.vers))}` };
}

const Plafond = z.object({ enfantId: Identifiant, plafond: z.number().int().nullable() });

/** Le plafond des repas d'une semaine pour cet enfant ; null le retire. */
export async function reglerPlafondEnfant(enfantId: string, plafond: number | null): Promise<{ ok: true } | { ok: false; erreur: string }> {
  const m = await autorise("parent");
  if (!m) return refus(SESSION);
  const v = Plafond.safeParse({ enfantId, plafond });
  if (!v.success) return refus("Un plafond en francs, sans centimes");
  const r = await reglerPlafond(m, v.data.enfantId, v.data.plafond);
  if (r.ok) revalidatePath(`/parent/enfant/${v.data.enfantId}`);
  return r;
}
