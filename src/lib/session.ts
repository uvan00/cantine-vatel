import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Qui est connecté, et ce qu'il a le droit de voir. Chaque page et chaque action serveur passe par ici :
// la vérification se fait côté serveur, jamais dans le navigateur.

export type Role = "convive" | "parent" | "admin";
export type Moi = { id: string; nom: string; email: string; role: Role };

const ROLES: readonly string[] = ["convive", "parent", "admin"];

/** La personne connectée, ou null. */
export async function moi(): Promise<Moi | null> {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  const role = (s.user as { role?: string | null }).role ?? "convive";
  return { id: s.user.id, nom: s.user.name, email: s.user.email, role: (ROLES.includes(role) ? role : "convive") as Role };
}

/** La page d'accueil de chaque rôle. */
export const accueilDe = (role: Role) => (role === "admin" ? "/admin" : role === "parent" ? "/parent" : "/menu");

/**
 * Pour une page : exige une personne connectée, avec l'un de ces rôles. Sinon, renvoie vers la connexion ou vers
 * l'accueil de son propre rôle.
 */
export async function exiger(...roles: Role[]): Promise<Moi> {
  const m = await moi();
  if (!m) redirect("/connexion");
  if (roles.length > 0 && !roles.includes(m.role)) redirect(accueilDe(m.role));
  return m;
}

/** Pour une action serveur ou une route JSON : la personne connectée si son rôle convient, sinon null (à refuser). */
export async function autorise(...roles: Role[]): Promise<Moi | null> {
  const m = await moi();
  if (!m) return null;
  return roles.length === 0 || roles.includes(m.role) ? m : null;
}

/** Le prénom : le premier mot du nom (« Awa Koné » → « Awa »). */
export const prenomDe = (nom: string) => nom.trim().split(/\s+/)[0] ?? nom;

/** L'adresse publique de l'application, d'après la requête (pour le QR du ticket). */
export async function origine() {
  const h = await headers();
  const hote = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3700";
  const local = /^(localhost|127\.|10\.|192\.168\.|172\.)/.test(hote);
  const proto = h.get("x-forwarded-proto") ?? (local ? "http" : "https");
  return `${proto}://${hote}`;
}
