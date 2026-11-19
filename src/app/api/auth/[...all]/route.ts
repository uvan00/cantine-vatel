import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

// Les routes de Better Auth (session, déconnexion). La connexion et l'inscription passent par des actions serveur.
export const { GET, POST } = toNextJsHandler(auth);
