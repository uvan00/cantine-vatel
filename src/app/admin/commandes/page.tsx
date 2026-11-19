import type { Metadata } from "next";
import { z } from "zod";
import { commandesDuJour } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { exiger } from "@/lib/session";
import { CommandesClient } from "./commandes-client";

export const metadata: Metadata = { title: "Commandes" };

/** `?jour=demain` montre demain ; tout le reste montre aujourd'hui. */
const Jour = z.enum(["aujourdhui", "demain"]).catch("aujourdhui");

export default async function PageCommandes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const cle = Jour.parse((await searchParams).jour);
  // La clé remonte l'écran quand on change de jour : il repart des commandes de ce jour-là, sans montrer celles de l'autre.
  return <CommandesClient key={cle} initial={await commandesDuJour(cle, maintenant())} />;
}
