"use server";

import { z } from "zod";
import { serviceDuJour } from "@/lib/donnees-admin";
import { platsAuComptoir, type PlatAuComptoir } from "@/lib/donnees-comptoir";
import { aujourdhui } from "@/lib/horloge";
import { jourIso } from "@/lib/jours";
import type { Etiquette } from "@/lib/listes";
import { servir, servirAuBadge, type ReponseScan } from "@/lib/operations";
import { estMoyenComptoir, type GenreScan } from "@/lib/reservation";
import { CANTINE, autorise, prenomDe } from "@/lib/session";
import type { ChiffresService } from "@/lib/statistiques";

// Servir un ticket, depuis le scanner (le QR ou le code tapé) ou depuis la liste des commandes (le code du convive).
// La règle est dans src/lib/reservation.ts (scanner), l'écriture dans src/lib/operations.ts (servir).

export type ReponseService = {
  /** « refuse » : celui qui appelle n'est pas la cantine. */
  genre: GenreScan | "refuse";
  phrase: string;
  /** Le convive et son plat, quand le ticket existe. */
  convive?: string;
  /** Son identifiant et sa photo de profil, pour montrer son visage au comptoir. */
  conviveId?: string;
  photo?: string | null;
  /** Son heure de passage (« 12:15 »), quand la cantine a ouvert des créneaux. */
  creneau?: string | null;
  prenom?: string;
  plat?: string;
  code?: string;
  /** Ses allergènes (pas ses régimes), dès qu'un convive est identifié ; vide s'il n'en a pas. */
  allergies?: Etiquette[];
  /** Ce que CE plat contient et que ce convive ne mange pas : à vérifier avant de servir. Vide quand le plat lui convient. */
  enCause?: Etiquette[];
  /** À la borne seulement : le plat ne convient pas à son profil, l'élève passe voir la cantine (sans dire pourquoi). */
  voirLaCantine?: boolean;
  /** Les repas d'aujourd'hui après ce geste. */
  service?: ChiffresService;
  /** La file du repas (express, reservation, classique) et comment il est payé, dès qu'un repas est trouvé. */
  file?: string;
  paiement?: string;
  /** « a_payer » : ce qu'il reste à encaisser. `solde` : celui du convive, pour proposer de payer avec. */
  prix?: number;
  solde?: number;
  /** « sans_repas » (un badge sans réservation) : les plats du jour que ce convive peut prendre, ou pourquoi non. */
  plats?: PlatAuComptoir[];
};

/** La réponse du comptoir, avec le prénom, les chiffres du jour, et les plats à proposer à un badge sans repas. */
async function reponseDuComptoir(reponse: ReponseScan): Promise<ReponseService> {
  return {
    ...reponse,
    prenom: reponse.convive ? prenomDe(reponse.convive) : undefined,
    plats: reponse.genre === "sans_repas" && reponse.conviveId ? await platsAuComptoir(reponse.conviveId, Date.now()) : undefined,
    service: await serviceDuJour(aujourdhui()),
  };
}

const Cle = z.string().trim().min(1).max(300);

export async function servirTicket(cle: string): Promise<ReponseService> {
  const qui = await autorise(...CANTINE);
  if (!qui) return { genre: "refuse", phrase: "Reconnecte-toi avec le compte de la cantine" };
  const v = Cle.safeParse(cle);
  if (!v.success) return { genre: "inconnu", phrase: "Ticket inconnu" };
  return reponseDuComptoir(await servir(v.data, qui.id));
}

const REFUS: ReponseService = { genre: "refuse", phrase: "Reconnecte-toi avec le compte de la cantine" };
const Id = z.string().min(1).max(40).regex(/^[a-z0-9]+$/i);

/**
 * La file réservation : ce ticket était à payer, la caisse a encaissé par ce moyen (espèces, Mobile Money, ou le solde
 * du convive). Le repas est payé et servi dans le même geste ; la caisse qui encaisse est notée (serviPar).
 */
export async function encaisserTicket(cle: string, moyen: string): Promise<ReponseService> {
  const qui = await autorise(...CANTINE);
  if (!qui) return REFUS;
  const v = Cle.safeParse(cle);
  if (!v.success) return { genre: "inconnu", phrase: "Ticket inconnu" };
  if (!estMoyenComptoir(moyen)) return { genre: "a_payer", phrase: "Choisis comment le repas est payé" };
  return reponseDuComptoir(await servir(v.data, qui.id, Date.now(), moyen));
}

/**
 * La file classique : un badge sans repas réservé. Le convive a choisi son plat, la caisse a choisi le moyen : le repas
 * est créé, payé et servi d'un coup, au nom de ce convive (src/lib/operations.ts, servirAuBadge).
 */
export async function servirBadge(cle: string, menuJourId: string, moyen: string): Promise<ReponseService> {
  const qui = await autorise(...CANTINE);
  if (!qui) return REFUS;
  const v = Cle.safeParse(cle);
  const plat = Id.safeParse(menuJourId);
  if (!v.success || !plat.success) return { genre: "inconnu", phrase: "Carte inconnue" };
  if (!estMoyenComptoir(moyen)) return { genre: "sans_repas", phrase: "Choisis comment le repas est payé" };
  return reponseDuComptoir(await servirAuBadge(v.data, plat.data, moyen, qui.id));
}

/* ── Les services faits sans réseau, envoyés au retour du réseau ─────────────── */

const EnRetard = z.array(z.object({ cle: Cle, instant: z.number().int() })).max(500);

export type ReponseEnRetard = { cle: string; genre: ReponseService["genre"]; phrase: string; convive?: string };

/**
 * Le scanner a servi ces tickets hors ligne, d'après sa copie des tickets du jour : le serveur les sert à son tour, à
 * l'heure où ils l'ont été, avec la même règle. Un ticket déjà servi ailleurs revient en « Déjà servi » : à vérifier.
 */
export async function servirEnRetard(liste: { cle: string; instant: number }[]): Promise<ReponseEnRetard[] | null> {
  const qui = await autorise(...CANTINE);
  if (!qui) return null;
  const v = EnRetard.safeParse(liste);
  if (!v.success) return [];
  const maintenantMs = Date.now();
  const resultats: ReponseEnRetard[] = [];
  for (const { cle, instant } of v.data) {
    // L'heure du service hors ligne : aujourd'hui, jamais dans le futur.
    const quand = Math.min(instant, maintenantMs);
    const r = jourIso(quand) === jourIso(maintenantMs) ? await servir(cle, qui.id, quand) : { genre: "autre_jour" as const, phrase: "Servi hors ligne un autre jour" };
    resultats.push({ cle, genre: r.genre, phrase: r.phrase, convive: "convive" in r ? r.convive : undefined });
  }
  return resultats;
}
