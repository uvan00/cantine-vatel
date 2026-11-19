"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Identifiant } from "@/lib/donnees-parent";
import { fcfa } from "@/lib/format";
import { IDS_ALLERGENES, IDS_REGIMES } from "@/lib/listes";
import { enregistrerProfilAlimentaire, lierEnfant, reglerSeuilAlerte } from "@/lib/operations";
import { autorise } from "@/lib/session";
import { SEUIL_ALERTE_MAX, seuilValable } from "@/lib/solde";
import { nettoyerCode } from "@/lib/ticket";

// Les gestes du parent : relier un enfant, régler son profil alimentaire et son seuil d'alerte. Chaque action vérifie
// la session et le rôle, valide ce qu'elle reçoit, puis laisse src/lib/operations.ts écrire : c'est là que
// `peutAgirPour` refuse un enfant qui n'est pas le sien.

export type Reponse = { ok: true; message: string } | { ok: false; erreur: string };

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
  return { ok: true, message: "C'est noté" };
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
