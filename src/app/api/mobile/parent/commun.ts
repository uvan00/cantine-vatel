import "server-only";
import { estParentDe } from "@/lib/donnees";
import { Identifiant } from "@/lib/donnees-parent";
import { erreur } from "@/lib/mobile";

// La garde des routes qui visent UN enfant : l'identifiant reçu doit être bien formé et celui d'un enfant relié à ce
// parent (comme la page /parent/enfant/<id> du site). Sinon, un refus 403 : un parent ne voit que ses enfants.

export async function enfantDuParent(requete: Request, parentId: string, brut: unknown): Promise<{ ok: true; id: string } | { ok: false; reponse: Response }> {
  const id = Identifiant.safeParse(brut);
  if (!id.success || !(await estParentDe(parentId, id.data))) return { ok: false, reponse: erreur(requete, "Cet enfant n'est pas relié à ton compte", 403) };
  return { ok: true, id: id.data };
}
