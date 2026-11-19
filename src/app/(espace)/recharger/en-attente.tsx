import Link from "next/link";
import { ChevronRight } from "@/components/icons";
import type { RechargeEnAttente } from "@/lib/donnees-parent";
import { dateLongue, depuis, fcfa } from "@/lib/format";
import { prenomDe } from "@/lib/session";

// Les recharges qui attendent encore la cantine, en lignes de même hauteur : chacune mène à sa page (le QR, l'état).
// Sert au parent (ses enfants) comme au convive (son compte, que la demande vienne de lui ou de son parent).

const JOUR = 86_400_000;
/** « il y a 12 min » le jour même, « le 19 novembre 2026 » ensuite. */
const quand = (d: Date, maintenant: number) => (maintenant - d.getTime() < JOUR ? depuis(d, maintenant) : `le ${dateLongue(d)}`);

export function RechargesEnAttente({ recharges, moiId, maintenant }: { recharges: RechargeEnAttente[]; moiId: string; maintenant: number }) {
  return (
    <ul className="divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
      {recharges.map((r) => {
        const pourMoi = r.beneficiaire.id === moiId;
        const parMoi = r.demandeur.id === moiId;
        return (
          <li key={r.id}>
            <Link href={`/recharger/${r.id}`} className="flex h-16 items-center gap-3 px-4 transition-colors hover:bg-[color:var(--h-filet-doux)]">
              <span className="min-w-0 flex-1">
                <span className="chiffres block truncate text-[15px] leading-5 font-medium text-encre/95">
                  {fcfa(r.montant)}{!pourMoi && ` pour ${prenomDe(r.beneficiaire.nom)}`}
                </span>
                <span className="chiffres block truncate text-[13px] leading-5 text-texte-2">
                  {r.reference}, {parMoi ? "demandée" : `demandée par ${prenomDe(r.demandeur.nom)}`} {quand(r.creeLe, maintenant)}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-encre/40" strokeWidth={1.8} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
