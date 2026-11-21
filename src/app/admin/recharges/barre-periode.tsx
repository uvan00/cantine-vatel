import Link from "next/link";
import { ArrowDownToLine, ChevronLeft, ChevronRight } from "@/components/icons";
import { TYPES_PERIODE, periodeDe, periodeEntre, periodeLisible, periodePrecedente, periodeSuivante, type Periode, type TypePeriode } from "@/lib/comptabilite";
import { ChoixDates } from "./choix-dates";
import { lienPeriode, requetePeriode } from "./periode";

// La barre des pages de comptes : jour, semaine, mois, ou des dates choisies à la main ; la période d'avant et d'après ;
// l'export pour le comptable.

const LIEN_ICONE = "grid size-10 shrink-0 place-items-center rounded-[12px] text-encre/90 transition-colors hover:bg-[color:var(--h-survol)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]";

export function BarrePeriode({ base, periode, aujourdhui, vue }: { base: string; periode: Periode; aujourdhui: string; vue: string }) {
  const enCours = periode.debut <= aujourdhui && aujourdhui <= periode.fin;
  const suivante = periodeSuivante(periode);
  // Passer à « Dates » part de la période affichée ; revenir à jour, semaine ou mois part d'aujourd'hui si on y est.
  const vers = (t: TypePeriode) => (t === "dates" ? periodeEntre(periode.debut, periode.fin) : periodeDe(t, enCours ? aujourdhui : periode.debut));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Période" className="inline-flex gap-0.5 rounded-[32px] p-0.5" style={{ background: "var(--h-surface)" }}>
          {TYPES_PERIODE.map((t) => {
            const actif = t.id === periode.type;
            return (
              <Link key={t.id} href={lienPeriode(base, vers(t.id))} aria-current={actif ? "true" : undefined}
                className={`flex h-9 items-center rounded-[32px] px-4 text-[14px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${actif ? "bg-white text-[#101011] shadow-[var(--h-ombre-1),inset_0_0_0_1px_var(--h-filet-doux)]" : "text-texte-2 hover:text-encre"}`}>
                {t.libelle}
              </Link>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <Link href={lienPeriode(base, periodePrecedente(periode))} aria-label="Période précédente" title="Période précédente" className={LIEN_ICONE}>
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </Link>
          <p className="chiffres min-w-[176px] text-center text-[15px] leading-5 font-semibold text-encre/95 first-letter:uppercase">{periodeLisible(periode)}</p>
          {suivante.debut <= aujourdhui ? (
            <Link href={lienPeriode(base, suivante)} aria-label="Période suivante" title="Période suivante" className={LIEN_ICONE}>
              <ChevronRight className="size-5" strokeWidth={1.8} />
            </Link>
          ) : <span className="size-10" aria-hidden="true" />}
        </div>
        {periode.type === "dates" && <ChoixDates key={`${periode.debut}-${periode.fin}`} base={base} du={periode.debut} au={periode.fin} aujourdhui={aujourdhui} />}
        {!enCours && periode.type !== "dates" && <Link href={lienPeriode(base, periodeDe(periode.type, aujourdhui))} className="hb hb--filet hb--petit">Revenir à aujourd&apos;hui</Link>}
      </div>
      <a href={`/api/admin/compta?vue=${vue}&${requetePeriode(periode)}`} className="hb hb--filet hb--petit">
        <ArrowDownToLine className="size-4" strokeWidth={1.8} />Exporter en CSV
      </a>
    </div>
  );
}
