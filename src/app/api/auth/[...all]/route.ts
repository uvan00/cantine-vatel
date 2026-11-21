import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { TROP_D_ESSAIS, clesConnexion, connexionBloquee, noterConnexion } from "@/lib/tentatives";

// Les routes de Better Auth encore ouvertes (session, connexion, déconnexion ; les autres sont fermées dans
// src/lib/auth.ts). La connexion et l'inscription du site passent par des actions serveur. La connexion par cette
// route (les scripts d'essai s'en servent) passe derrière le même compteur de tentatives que le site et l'application.
const { GET, POST: versBetterAuth } = toNextJsHandler(auth);
export { GET };

export async function POST(requete: Request) {
  if (!new URL(requete.url).pathname.endsWith("/sign-in/email")) return versBetterAuth(requete);
  const corps = (await requete.clone().json().catch(() => null)) as { email?: unknown } | null;
  const cles = clesConnexion(typeof corps?.email === "string" ? corps.email : "", requete.headers);
  if (connexionBloquee(cles, Date.now())) return Response.json({ code: "TROP_D_ESSAIS", message: TROP_D_ESSAIS }, { status: 429 });
  const reponse = await versBetterAuth(requete);
  noterConnexion(cles, reponse.ok, Date.now());
  return reponse;
}
