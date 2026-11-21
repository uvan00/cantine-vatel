import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import { fcfa } from "@/lib/format";
import { jourCourt } from "@/lib/jours";
import type { Proposition } from "@/lib/semaine";

// « Ta semaine avec ton solde » (cahier des charges, section 11, bonus 1) : la proposition de src/lib/semaine.ts, repliée
// sous le solde pour laisser le menu du jour en haut. Chaque jour mène à son menu : rien ne se réserve tout seul.

export function TaSemaine({ propositions, total, reste }: { propositions: Proposition[]; total: number; reste: number }) {
  if (propositions.length === 0) return null;
  const couverts = propositions.filter((p) => p.plat).length;
  return (
    <details className="group rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-[16px] px-4 py-3 transition-colors hover:bg-[color:var(--h-filet-doux)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] leading-5 font-medium text-encre/95">Ta semaine avec ton solde</span>
          <span className="chiffres block text-[13px] leading-5 text-texte-2">
            {couverts > 0 ? `${couverts} repas pour ${fcfa(total)}, il te resterait ${fcfa(reste)}` : "Ton solde ne couvre pas encore un repas"}
          </span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-encre/40 transition-transform group-open:rotate-90" strokeWidth={1.8} aria-hidden="true" />
      </summary>
      <div className="border-t border-[color:var(--h-filet)] px-4 pb-3">
        <p className="pt-3 text-[13px] leading-5 text-texte-2">Un plat par jour, choisi selon ton solde, ce que tu ne manges pas et les notes des autres. Touche un jour pour réserver</p>
        <ul className="mt-1 divide-y divide-[color:var(--h-filet)]">
          {propositions.map((p) => (
            <li key={p.jour}>
              <Link href={`/menu?jour=${p.jour}`} replace scroll={false} className="flex min-h-12 items-center gap-3 py-2">
                <span className="w-16 shrink-0 text-[14px] leading-5 text-texte-2 first-letter:uppercase">{jourCourt(p.jour)}</span>
                <span className={`min-w-0 flex-1 truncate text-[15px] leading-5 ${p.plat ? "text-encre/95" : "text-texte-2"}`}>
                  {p.plat ? p.plat.nom : p.raison === "solde" ? "Recharge pour ce jour" : "Rien qui te convienne"}
                </span>
                {p.plat && <span className="chiffres shrink-0 text-[14px] leading-5 text-encre/90">{fcfa(p.plat.prix)}</span>}
                <ChevronRight className="size-4 shrink-0 text-encre/40" strokeWidth={1.8} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
