import { ticketsDuJour } from "@/lib/donnees-admin";
import { aujourdhui } from "@/lib/horloge";
import { autorise } from "@/lib/session";

// Les tickets d'aujourd'hui : le scanner en garde une copie sur l'appareil de la cantine, pour servir si le réseau tombe.
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await autorise("admin"))) return Response.json({ erreur: "Réservé à la cantine" }, { status: 401 });
  return Response.json({ jour: aujourdhui(), tickets: await ticketsDuJour(aujourdhui()) });
}
