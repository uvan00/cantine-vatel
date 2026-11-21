"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ReponseService } from "@/app/admin/actions";
import { COOKIE_BORNE, DUREE_BORNE_MS, signerBorne } from "@/lib/borne";
import { borneLancee, secretBorne } from "@/lib/borne-serveur";
import { serviceDuJour } from "@/lib/donnees-admin";
import { aujourdhui } from "@/lib/horloge";
import { seDeconnecter, servir } from "@/lib/operations";
import { CANTINE, autorise, prenomDe } from "@/lib/session";

// La borne d'entrée ne tourne pas sur la session de la cantine. La cantine la lance sur l'appareil : sa session s'y
// ferme, et l'appareil garde un laissez-passer signé (src/lib/borne.ts) qui ne permet qu'un geste, valider un ticket.
// Un élève devant la tablette ne peut donc rien ouvrir de l'espace de la cantine.

/** La cantine lance la borne sur cet appareil : laissez-passer posé pour la journée, session de la cantine fermée. */
export async function lancerBorne() {
  if (!(await autorise(...CANTINE)) || !secretBorne()) redirect("/connexion");
  const expire = Date.now() + DUREE_BORNE_MS;
  (await cookies()).set(COOKIE_BORNE, signerBorne(secretBorne(), expire), {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(expire),
  });
  await seDeconnecter();
  redirect("/borne");
}

/** Arrêter la borne : le laissez-passer s'en va, l'appareil revient à la connexion. */
export async function quitterBorne() {
  (await cookies()).delete(COOKIE_BORNE);
  redirect("/connexion");
}

const Cle = z.string().trim().min(1).max(300);

/**
 * Valider un ticket à la borne. La réponse ne porte ni les allergies ni ce qui écarte le plat : la borne est tournée
 * vers la file. Si le plat ne convient pas au profil de l'élève, elle dit seulement de passer voir la cantine.
 */
export async function servirALaBorne(cle: string): Promise<ReponseService> {
  if (!(await borneLancee())) return { genre: "refuse", phrase: "La borne n'est plus lancée, appelle la cantine" };
  const v = Cle.safeParse(cle);
  if (!v.success) return { genre: "inconnu", phrase: "Ticket inconnu" };
  const r = await servir(v.data, "borne");
  // La borne n'encaisse pas : un ticket à payer, ou un badge sans repas réservé, passe par la caisse, dans sa file.
  const phrase = r.genre === "a_payer" ? "Ton repas est à payer : passe par la file réservation"
    : r.genre === "sans_repas" ? "Pas de repas réservé : passe par la file classique"
    : r.phrase;
  return {
    genre: r.genre, phrase, convive: r.convive, conviveId: r.conviveId, photo: r.photo, plat: r.plat, creneau: r.creneau,
    prenom: r.convive ? prenomDe(r.convive) : undefined,
    voirLaCantine: (r.enCause?.length ?? 0) > 0,
    service: await serviceDuJour(aujourdhui()),
  };
}
