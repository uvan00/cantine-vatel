"use server";

import { z } from "zod";
import { serviceDuJour } from "@/lib/donnees-admin";
import { aujourdhui } from "@/lib/horloge";
import { servir } from "@/lib/operations";
import type { GenreScan } from "@/lib/reservation";
import { autorise, prenomDe } from "@/lib/session";
import type { ChiffresService } from "@/lib/statistiques";

// Servir un ticket, depuis le scanner (le QR ou le code tapé) ou depuis la liste des commandes (le code du convive).
// La règle est dans src/lib/reservation.ts (scanner), l'écriture dans src/lib/operations.ts (servir).

export type ReponseService = {
  /** « refuse » : celui qui appelle n'est pas la cantine. */
  genre: GenreScan | "refuse";
  phrase: string;
  /** Le convive et son plat, quand le ticket existe. */
  convive?: string;
  prenom?: string;
  plat?: string;
  code?: string;
  /** Les repas d'aujourd'hui après ce geste. */
  service?: ChiffresService;
};

const Cle = z.string().trim().min(1).max(300);

export async function servirTicket(cle: string): Promise<ReponseService> {
  if (!(await autorise("admin"))) return { genre: "refuse", phrase: "Reconnecte-toi avec le compte de la cantine" };
  const v = Cle.safeParse(cle);
  if (!v.success) return { genre: "inconnu", phrase: "Ticket inconnu" };
  const reponse = await servir(v.data);
  return { ...reponse, prenom: reponse.convive ? prenomDe(reponse.convive) : undefined, service: await serviceDuJour(aujourdhui()) };
}
