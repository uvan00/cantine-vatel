// Les comptes de l'accueil de la cantine qui ne sont pas déjà ailleurs (src/lib/comptabilite.ts fait l'argent,
// src/lib/statistiques.ts les repas) : comparer un mois commencé aux mêmes jours du mois d'avant, et faire la caisse
// de chaque personne de la cantine. Pur et testé (tableau.test.ts).
import { ajouterJours } from "./jours.ts";
import { periodeDe, periodePrecedente, type Periode } from "./comptabilite.ts";

/**
 * Le mois en cours jusqu'à aujourd'hui, et les mêmes jours du mois d'avant (du 1er au même quantième, au plus jusqu'à
 * son dernier jour) : on compare ce qui se compare, pas un mois commencé à un mois entier.
 */
export function moisCompare(aujourdhui: string): { mois: Periode; avant: Periode } {
  const entier = periodeDe("mois", aujourdhui);
  const precedent = periodePrecedente(entier);
  const fin = ajouterJours(precedent.debut, Number(aujourdhui.slice(8, 10)) - 1);
  return {
    mois: { type: "dates", debut: entier.debut, fin: aujourdhui },
    avant: { type: "dates", debut: precedent.debut, fin: fin > precedent.fin ? precedent.fin : fin },
  };
}

/** Une recharge confirmée, vue de la caisse : qui l'a confirmée (une personne, ou « cartflox »), combien, par quel moyen. */
export type RechargeCaisse = { confirmeePar: string | null; montant: number; moyen: string };

/**
 * La journée de chaque personne de la cantine : les espèces qu'elle a encaissées et les repas qu'elle a servis. À part :
 * les repas validés à la borne, ceux servis avant qu'on note qui sert (`sansNom`), et le Mobile Money confirmé tout seul.
 */
export function caisses<M extends { id: string }>(membres: M[], recharges: RechargeCaisse[], servisPar: (string | null)[]) {
  const especes = recharges.filter((r) => r.moyen === "especes");
  const mobile = recharges.filter((r) => r.moyen === "cartflox");
  const somme = (l: RechargeCaisse[]) => l.reduce((s, r) => s + r.montant, 0);
  return {
    membres: membres.map((m) => {
      const lignes = especes.filter((r) => r.confirmeePar === m.id);
      return { ...m, especes: { nombre: lignes.length, montant: somme(lignes) }, servis: servisPar.filter((p) => p === m.id).length };
    }),
    borne: servisPar.filter((p) => p === "borne").length,
    sansNom: servisPar.filter((p) => p === null).length,
    mobileMoney: { nombre: mobile.length, montant: somme(mobile) },
  };
}
