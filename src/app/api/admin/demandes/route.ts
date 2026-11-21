import { demandesEnAttente } from "@/lib/donnees-admin";
import { aujourdhui } from "@/lib/horloge";
import { CANTINE, autorise } from "@/lib/session";

// Les demandes hors délai d'aujourd'hui qui attendent une réponse, relues par l'écran des commandes.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await autorise(...CANTINE))) return Response.json({ erreur: "Réservé à la cantine" }, { status: 401 });
  return Response.json(await demandesEnAttente(aujourdhui()));
}
