import type { Metadata } from "next";
import { z } from "zod";
import { lireReglages, photosDisponibles } from "@/lib/donnees";
import { menusDeLaSemaine, tousLesPlats } from "@/lib/donnees-admin";
import { aujourdhui, maintenant } from "@/lib/horloge";
import { cloturePassee, clotureLisible, estUnJour, lundiDe } from "@/lib/jours";
import { exiger } from "@/lib/session";
import { MenusClient } from "./menus-client";

export const metadata: Metadata = { title: "Menus" };

/** `?semaine=AAAA-MM-JJ` : n'importe quel jour de la semaine voulue. Autre chose, ou une date hors du siècle : cette semaine. */
const Semaine = z.string().refine((v) => estUnJour(v) && v >= "2000-01-01" && v <= "2099-12-31").catch("");

export default async function PageMenus({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const jour = aujourdhui();
  const lundi = lundiDe(Semaine.parse((await searchParams).semaine) || jour);
  const [semaine, plats, photos, reglages] = await Promise.all([menusDeLaSemaine(lundi), tousLesPlats(), photosDisponibles(), lireReglages()]);
  // `key` : changer de semaine remet le jour choisi à zéro (aujourd'hui, ou le lundi).
  return (
    <MenusClient key={lundi} aujourdhui={jour} lundi={lundi} semaine={semaine} plats={plats} photos={photos}
      cloture={clotureLisible(reglages.heureCloture)} closAujourdhui={cloturePassee(jour, maintenant(), reglages.heureCloture)} />
  );
}
