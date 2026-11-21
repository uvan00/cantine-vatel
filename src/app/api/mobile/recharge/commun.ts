import "server-only";
import type { RechargeEnAttente } from "@/lib/donnees-parent";
import { dateLongue, depuis, fcfa } from "@/lib/format";
import { prenomDe } from "@/lib/session";

// Ce que les routes de la recharge et de l'espace du parent partagent : une recharge en attente écrite en mots, comme
// les lignes de src/app/(espace)/recharger/en-attente.tsx du site. Rien ne se décide ici : on recopie les phrases.

const JOUR = 86_400_000;
/** « il y a 12 min » le jour même, « le 19 novembre 2026 » ensuite (comme le site). */
const quand = (d: Date, maintenant: number) => (maintenant - d.getTime() < JOUR ? depuis(d, maintenant) : `le ${dateLongue(d)}`);

export type LigneEnAttente = {
  id: string;
  montant: number;
  /** « 10 000 F CFA pour Ismaël », ou le montant seul pour son propre compte. */
  titre: string;
  /** « R-7KQ2, demandée il y a 8 min » */
  detail: string;
  /** Le visage du bénéficiaire, quand la liste mélange plusieurs comptes ; null sinon. */
  visage: { id: string; nom: string; photo: string | null } | null;
};

export function lignesEnAttente(recharges: RechargeEnAttente[], moiId: string, maintenant: number): LigneEnAttente[] {
  const visages = recharges.some((r) => r.beneficiaire.id !== moiId);
  return recharges.map((r) => {
    const pourMoi = r.beneficiaire.id === moiId;
    const parMoi = r.demandeur.id === moiId;
    return {
      id: r.id,
      montant: r.montant,
      titre: `${fcfa(r.montant)}${pourMoi ? "" : ` pour ${prenomDe(r.beneficiaire.nom)}`}`,
      detail: `${r.reference}, ${parMoi ? "demandée" : `demandée par ${prenomDe(r.demandeur.nom)}`} ${quand(r.creeLe, maintenant)}`,
      visage: visages ? r.beneficiaire : null,
    };
  });
}
