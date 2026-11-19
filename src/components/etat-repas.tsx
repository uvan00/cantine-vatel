import { SChip, type Ton } from "@/components/sneat";
import { LIBELLE_ETAT, type EtatAffiche } from "@/lib/reservation";

// L'état d'un repas, toujours écrit en mots (la couleur ne porte jamais le sens à elle seule).
const TON: Record<EtatAffiche, Ton> = {
  reservee: "info",
  servie: "success",
  annulee: "secondary",
  non_retiree: "warning",
};

export function EtatRepas({ etat, taille = "md" }: { etat: EtatAffiche; taille?: "sm" | "md" }) {
  return <SChip tone={TON[etat]} size={taille}>{LIBELLE_ETAT[etat]}</SChip>;
}
