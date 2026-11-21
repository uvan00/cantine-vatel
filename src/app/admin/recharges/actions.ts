"use server";

import { z } from "zod";
import { soldeDuCompte, soldesDesComptes } from "@/lib/donnees";
import { comptesDesConvives, type VueCompteTrouve } from "@/lib/donnees-admin";
import { fcfa } from "@/lib/format";
import { verifierRecharge } from "@/lib/cartflox-serveur";
import { confirmerRecharge, crediterParCartflox, rechargerEnEspeces } from "@/lib/operations";
import { prisma } from "@/lib/db";
import { RECHARGE_MAX, RECHARGE_MIN } from "@/lib/recharge";
import { CANTINE, autorise } from "@/lib/session";
import { chercher } from "./recherche";

// Les gestes de la cantine sur les recharges : confirmer qu'un paiement est arrivé, créditer des espèces reçues
// au comptoir. Le montant d'une demande est lu dans la base ; celui des espèces est borné ici puis par
// src/lib/operations.ts. L'argent ne passe jamais par l'application : elle note ce que la cantine confirme.

type Echec = { ok: false; erreur: string };
const REFUS: Echec = { ok: false, erreur: "Reconnecte-toi avec le compte de la cantine" };

const Id = z.string().min(1).max(64);

/** « Paiement reçu » : la cantine a vu l'argent arriver sur son compte, le solde du convive monte. */
export async function paiementRecu(id: string): Promise<{ ok: true } | Echec> {
  const admin = await autorise(...CANTINE);
  if (!admin) return REFUS;
  const v = Id.safeParse(id);
  if (!v.success) return { ok: false, erreur: "Recharge introuvable" };
  return confirmerRecharge(admin.id, v.data);
}

const PHRASE_MONTANT = `Un montant entre ${fcfa(RECHARGE_MIN)} et ${fcfa(RECHARGE_MAX)}, sans centimes`;

const Especes = z.object({
  beneficiaireId: z.string("Choisis d'abord un convive").min(1, "Choisis d'abord un convive").max(64, "Ce compte n'existe pas"),
  montant: z.number(PHRASE_MONTANT).int(PHRASE_MONTANT).min(RECHARGE_MIN, PHRASE_MONTANT).max(RECHARGE_MAX, PHRASE_MONTANT),
}, "Cette demande ne se lit pas, recharge la page");

/** La cantine a encaissé des espèces : le compte est crédité tout de suite. Rend la référence et le nouveau solde. */
export async function encaisserEspeces(entree: { beneficiaireId: string; montant: number }): Promise<{ ok: true; reference: string; solde: number } | Echec> {
  const admin = await autorise(...CANTINE);
  if (!admin) return REFUS;
  const v = Especes.safeParse(entree);
  if (!v.success) return { ok: false, erreur: v.error.issues[0].message };
  const r = await rechargerEnEspeces(admin.id, v.data.beneficiaireId, v.data.montant);
  if (!r.ok) return r;
  return { ok: true, reference: r.reference, solde: await soldeDuCompte(v.data.beneficiaireId) };
}

const Recherche = z.string().trim().min(2).max(60);
const TROUVES_AU_PLUS = 8;

/**
 * Chercher un convive par son nom, pour le créditer : son nom, sa classe ou son service, son solde. Rien avant deux
 * lettres, huit comptes au plus. Une action (et non une adresse avec le nom dedans) : un nom ne traîne dans aucun journal.
 */
export async function chercherConvives(recherche: string): Promise<VueCompteTrouve[]> {
  if (!(await autorise(...CANTINE))) return [];
  const v = Recherche.safeParse(recherche);
  if (!v.success) return [];
  const trouves = chercher(await comptesDesConvives(), v.data, TROUVES_AU_PLUS);
  const soldes = await soldesDesComptes(trouves.map((c) => c.id));
  return trouves.map((c) => ({ ...c, solde: soldes.get(c.id) ?? 0 }));
}

/** « Vérifier chez Cartflox » : relit tout de suite les paiements en ligne d'une demande, et la crédite s'ils sont passés. */
export async function verifierChezCartflox(id: string): Promise<{ ok: true; etat: string } | Echec> {
  if (!(await autorise(...CANTINE))) return REFUS;
  const v = Id.safeParse(id);
  if (!v.success) return { ok: false, erreur: "Recharge introuvable" };
  const etat = await verifierRecharge(v.data, { force: true });
  return etat ? { ok: true, etat } : { ok: false, erreur: "Recharge introuvable" };
}

/**
 * La cantine crédite à la main un paiement Cartflox qui ne s'est pas crédité tout seul (montant inattendu, ou arrivé
 * après l'annulation de la demande), après l'avoir regardé dans son espace Cartflox. Le montant crédité est celui de la
 * demande, lu dans la base.
 */
export async function crediterPaiement(sessionId: string): Promise<{ ok: true } | Echec> {
  const admin = await autorise(...CANTINE);
  if (!admin) return REFUS;
  const v = z.string().regex(/^[a-z0-9]{12,40}$/).safeParse(sessionId);
  if (!v.success) return { ok: false, erreur: "Paiement introuvable" };
  const p = await prisma.paiementCartflox.findUnique({ where: { sessionId: v.data }, select: { rechargeId: true, statut: true } });
  if (!p) return { ok: false, erreur: "Paiement introuvable" };
  if (p.statut !== "SUCCESS") return { ok: false, erreur: "Cartflox ne dit pas que ce paiement est passé" };
  return crediterParCartflox(p.rechargeId, v.data, admin.id, Date.now(), true);
}
