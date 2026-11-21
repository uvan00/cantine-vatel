import { z } from "zod";
import { commandesDuJour } from "@/lib/donnees-admin";
import { maintenant } from "@/lib/horloge";
import { CANTINE, autorise } from "@/lib/session";

// Les commandes d'aujourd'hui ou de demain, relues toutes les 3 secondes par l'écran de la cuisine.
export const dynamic = "force-dynamic";

const Jour = z.enum(["aujourdhui", "demain"]);

export async function GET(requete: Request) {
  if (!(await autorise(...CANTINE))) return Response.json({ erreur: "Réservé à la cantine" }, { status: 401 });
  const jour = Jour.safeParse(new URL(requete.url).searchParams.get("jour") ?? "aujourdhui");
  if (!jour.success) return Response.json({ erreur: "Ce jour ne se lit pas ici : aujourd'hui ou demain" }, { status: 400 });
  return Response.json(await commandesDuJour(jour.data, maintenant()));
}
