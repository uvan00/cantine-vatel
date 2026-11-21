import { z } from "zod";
import { relierEnfant } from "@/app/(espace)/parent/actions";
import { erreur, lireCorps, refus, reponse } from "@/lib/mobile";
import { autorise } from "@/lib/session";

// Relier un enfant avec son code famille : la même action que le site (relierEnfant, qui valide le code et laisse
// src/lib/operations.ts écrire le lien).
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ code: z.string().max(40) });

export async function POST(requete: Request) {
  const moi = await autorise("parent");
  if (!moi) return refus(requete);
  const corps = await lireCorps(requete, Corps, "Le code famille fait 6 caractères");
  if (!corps.ok) return corps.reponse;
  const r = await relierEnfant(corps.donnees.code);
  return r.ok ? reponse(requete, { message: r.message }) : erreur(requete, r.erreur, 409);
}
