import "server-only";
import type { z } from "zod";
import { jourLong } from "@/lib/jours";
import type { RepasEnCause } from "@/lib/operations";
import { autorise } from "@/lib/session";

// Les petites aides des routes de l'application mobile (src/app/api/mobile/**) : réponse JSON sans cache, corps lu et
// validé par zod, refus en une phrase, et CORS pour l'aperçu web de l'application seulement.
// Le téléphone s'authentifie par `Authorization: Bearer <jeton>` (greffon bearer de src/lib/auth.ts) : chaque route
// appelle ensuite `autorise(...)` comme une action serveur, et le rôle vient toujours de la session.

/** Les origines web permises (variable MOBILE_ORIGINES_WEB, séparées par des virgules). Vide : aucun en-tête CORS. */
const originesWeb = () => (process.env.MOBILE_ORIGINES_WEB || "").split(",").map((o) => o.trim()).filter(Boolean);

/** Les en-têtes CORS, seulement si la requête vient d'une origine permise. Un téléphone n'envoie pas d'origine. */
function enTetesCors(requete: Request): Record<string, string> {
  const origine = requete.headers.get("origin");
  if (!origine || !originesWeb().includes(origine)) return {};
  return {
    "Access-Control-Allow-Origin": origine,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/** Une réponse JSON, jamais gardée en cache, avec CORS si l'origine est permise. */
export function reponse(requete: Request, donnees: unknown, status = 200) {
  return Response.json(donnees, { status, headers: { "Cache-Control": "no-store", ...enTetesCors(requete) } });
}

/** Un refus en une phrase française, lue telle quelle par l'application. */
export const erreur = (requete: Request, phrase: string, status = 400) => reponse(requete, { erreur: phrase }, status);

/** La réponse à la question préalable du navigateur (aperçu web) : à exporter en `OPTIONS` par chaque route. */
export function OPTIONS(requete: Request) {
  return new Response(null, { status: 204, headers: enTetesCors(requete) });
}

/**
 * Après un `autorise(...)` qui a dit non : 401 si personne n'est connecté (jeton absent ou périmé), 403 si la personne
 * est connectée mais que cet espace n'est pas le sien.
 */
export async function refus(requete: Request) {
  return (await autorise())
    ? erreur(requete, "Cet espace n'est pas le tien", 403)
    : erreur(requete, "Ta session est finie, reconnecte-toi", 401);
}

/** Le corps JSON de la requête, validé par le schéma ; sinon la phrase de refus donnée. */
export async function lireCorps<S extends z.ZodType>(requete: Request, schema: S, phrase: string): Promise<{ ok: true; donnees: z.infer<S> } | { ok: false; reponse: Response }> {
  let brut: unknown;
  try {
    brut = await requete.json();
  } catch {
    return { ok: false, reponse: erreur(requete, phrase) };
  }
  const v = schema.safeParse(brut);
  return v.success ? { ok: true, donnees: v.data } : { ok: false, reponse: erreur(requete, phrase) };
}

/** Les repas déjà réservés qu'un profil alimentaire écarte, avec leur jour écrit en mots (« samedi 21 novembre »). */
export const repasEnMots = (repas: RepasEnCause[]) => repas.map((r) => ({ jour: jourLong(r.jour), plat: r.plat, enCause: r.enCause }));
