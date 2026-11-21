import type { Metadata } from "next";
import { z } from "zod";
import { commandesDuJour, demandesEnAttente } from "@/lib/donnees-admin";
import { aujourdhui, maintenant } from "@/lib/horloge";
import { exiger } from "@/lib/session";
import { CommandesClient } from "./commandes-client";
import { DemandesHorsDelai } from "./demandes-hors-delai";

export const metadata: Metadata = { title: "Commandes" };

/** `?jour=demain` montre demain ; tout le reste montre aujourd'hui. */
const Jour = z.enum(["aujourdhui", "demain"]).catch("aujourdhui");

export default async function PageCommandes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exiger("admin");
  const cle = Jour.parse((await searchParams).jour);
  // La clé remonte l'écran quand on change de jour : il repart des commandes de ce jour-là, sans montrer celles de l'autre.
  // Aujourd'hui seulement : les demandes hors délai, sous les chiffres du service.
  // `key` : le compilateur de React range cet élément venu du serveur dans une liste ; sans clé, React s'en plaint.
  const encart = cle === "aujourdhui" ? <DemandesHorsDelai key="demandes" initial={await demandesEnAttente(aujourdhui())} /> : null;
  return <CommandesClient key={cle} initial={await commandesDuJour(cle, maintenant())} encart={encart} />;
}
