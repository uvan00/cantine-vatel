import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/db";

// Connexion par e-mail et mot de passe (Better Auth), sessions gardées en base.
// Le rôle est un champ fermé à la saisie (`input: false`) : le navigateur ne peut pas le choisir, seul le serveur le
// pose, à l'inscription (src/lib/operations.ts). Un administrateur ne se crée jamais par l'inscription publique.
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || undefined,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "sqlite" }),
  // Adresses en plus de `baseURL` d'où l'on peut se connecter (séparées par des virgules), par exemple le wifi en essai.
  trustedOrigins: (process.env.ORIGINES_DE_CONFIANCE || "").split(",").map((o) => o.trim()).filter(Boolean),
  user: {
    additionalFields: {
      role: { type: "string", required: false, input: false, defaultValue: "convive" },
    },
  },
  emailAndPassword: { enabled: true, minPasswordLength: 8, autoSignIn: true },
  advanced: { cookiePrefix: "cantine" },
  // En dernier : pose les cookies de session quand la connexion se fait dans une action serveur.
  plugins: [nextCookies()],
});
