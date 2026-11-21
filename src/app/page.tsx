import { redirect } from "next/navigation";
import { accueilDe, moi } from "@/lib/session";

// L'entrée : la connexion, tout de suite, sans page d'accueil (choix du propriétaire du 21/11/2026). Déjà connecté, on
// file vers l'accueil de son rôle.
export const dynamic = "force-dynamic";

export default async function Entree() {
  const m = await moi();
  redirect(m ? accueilDe(m.role) : "/connexion");
}
