import { z } from "zod";
import { erreur, lireCorps, reponse } from "@/lib/mobile";
import { seConnecterMobile } from "@/lib/operations";
import { TROP_D_ESSAIS } from "@/lib/tentatives";

// Connexion de l'application mobile : e-mail et mot de passe, par la même porte que la page de connexion du site
// (src/lib/operations.ts, derrière le compteur de tentatives). Better Auth rend le jeton de session, que le téléphone
// renvoie ensuite en `Authorization: Bearer <jeton>`. Le rôle vient de la base.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

const Corps = z.object({ email: z.string().trim().min(3).max(200), motDePasse: z.string().min(1).max(200) });

export async function POST(requete: Request) {
  const corps = await lireCorps(requete, Corps, "Écris ton e-mail et ton mot de passe");
  if (!corps.ok) return corps.reponse;
  const r = await seConnecterMobile(corps.donnees.email, corps.donnees.motDePasse);
  if (!r.ok) return erreur(requete, r.erreur, r.erreur === TROP_D_ESSAIS ? 429 : 401);
  return reponse(requete, { jeton: r.jeton, moi: r.moi });
}
