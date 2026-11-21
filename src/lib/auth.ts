import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { bearer } from "better-auth/plugins";
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
  // Les routes de Better Auth (/api/auth/...) dont la cantine ne se sert pas sont fermées : elles laissaient créer un
  // compte sans profil, ou changer son nom et sa photo hors de la liste des avatars. L'inscription, l'avatar et le reste
  // passent par src/lib/operations.ts, qui appelle Better Auth côté serveur (ces appels-là ne sont pas concernés).
  disabledPaths: [
    "/sign-up/email", "/update-user", "/change-email", "/change-password", "/set-password", "/delete-user", "/delete-user/callback",
    "/forget-password", "/request-password-reset", "/reset-password", "/verify-email", "/send-verification-email",
    "/sign-in/social", "/link-social", "/unlink-account", "/list-accounts", "/account-info", "/refresh-token", "/get-access-token",
    "/list-sessions", "/revoke-session", "/revoke-sessions", "/revoke-other-sessions",
  ],
  // `bearer()` : l'application mobile se connecte avec un jeton (`Authorization: Bearer ...`) au lieu d'un cookie.
  // En dernier : pose les cookies de session quand la connexion se fait dans une action serveur.
  plugins: [bearer(), nextCookies()],
});
