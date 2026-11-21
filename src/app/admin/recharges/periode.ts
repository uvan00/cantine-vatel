import { estTypePeriode, periodeDe, periodeEntre, type Periode } from "@/lib/comptabilite";
import { estUnJour } from "@/lib/jours";

// La période des pages de comptes, lue dans l'adresse : `?p=jour|semaine|mois&j=AAAA-MM-JJ` (un jour de la période), ou
// `?p=dates&du=AAAA-MM-JJ&au=AAAA-MM-JJ` (choisie à la main). Autre chose, ou rien : la semaine en cours.

type Params = Record<string, string | string[] | undefined>;

const jourValable = (v: unknown) => (typeof v === "string" && estUnJour(v) && v >= "2000-01-01" && v <= "2099-12-31" ? v : null);

export function lirePeriode(params: Params, aujourdhui: string): Periode {
  const p = typeof params.p === "string" && estTypePeriode(params.p) ? params.p : "semaine";
  if (p === "dates") {
    const du = jourValable(params.du);
    const au = jourValable(params.au);
    return du && au ? periodeEntre(du, au) : periodeDe("semaine", aujourdhui);
  }
  return periodeDe(p, jourValable(params.j) ?? aujourdhui);
}

/** La période dans une adresse : ce que `lirePeriode` relit. */
export const requetePeriode = (p: Periode) => (p.type === "dates" ? `p=dates&du=${p.debut}&au=${p.fin}` : `p=${p.type}&j=${p.debut}`);
export const lienPeriode = (base: string, p: Periode) => `${base}?${requetePeriode(p)}`;
