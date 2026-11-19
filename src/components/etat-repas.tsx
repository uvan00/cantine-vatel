import { SChip, type Ton } from "@/components/sneat";
import { LIBELLE_ETAT, type EtatAffiche } from "@/lib/reservation";

// L'état d'un repas, toujours écrit en mots (la couleur ne porte jamais le sens à elle seule).
// « Réservé » est neutre, à filet : seul « Servi » est vert, pour qu'on ne les confonde pas d'un coup d'œil.
const TON: Record<Exclude<EtatAffiche, "reservee">, Ton> = {
  servie: "success",
  annulee: "secondary",
  non_retiree: "warning",
};

export function EtatRepas({ etat, taille = "md" }: { etat: EtatAffiche; taille?: "sm" | "md" }) {
  if (etat === "reservee") {
    return (
      <span className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[8px] px-2 font-medium text-encre/90 shadow-[inset_0_0_0_1px_var(--h-filet)] ${taille === "sm" ? "min-h-5 py-0.5 text-[12px] leading-4" : "min-h-6 py-0.5 text-[14px] leading-5"}`}>
        {LIBELLE_ETAT.reservee}
      </span>
    );
  }
  return <SChip tone={TON[etat]} size={taille}>{LIBELLE_ETAT[etat]}</SChip>;
}
