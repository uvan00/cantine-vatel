import type { Metadata } from "next";
import { z } from "zod";
import { photosDisponibles } from "@/lib/donnees";
import { menusDeLaSemaine, tousLesPlats } from "@/lib/donnees-admin";
import { aujourdhui } from "@/lib/horloge";
import { estUnJour, lundiDe } from "@/lib/jours";
import { exiger } from "@/lib/session";
import { MenusClient } from "./menus-client";

export const metadata: Metadata = { title: "Menus" };

/** `?semaine=AAAA-MM-JJ` : n'importe quel jour de la semaine voulue. Autre chose, ou une date hors du siècle : cette semaine. */
const Semaine = z.string().refine((v) => estUnJour(v) && v >= "2000-01-01" && v <= "2099-12-31").catch("");

export default async function PageMenus({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const jour = aujourdhui();
  const lundi = lundiDe(Semaine.parse((await searchParams).semaine) || jour);
  const [semaine, plats, photos] = await Promise.all([menusDeLaSemaine(lundi), tousLesPlats(), photosDisponibles()]);
  return <MenusClient aujourdhui={jour} lundi={lundi} semaine={semaine} plats={plats} photos={photos} />;
}
