import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Déconnexion de l'application mobile : la session du jeton est effacée en base, comme « Se déconnecter » du site.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function POST(requete: Request) {
  const moi = await autorise();
  if (!moi) return refus(requete);
  await auth.api.signOut({ headers: await headers() }).catch(() => {});
  return reponse(requete, { ok: true });
}
