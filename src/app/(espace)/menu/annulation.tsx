"use client";

import { useState, useTransition } from "react";
import { useConfirmation } from "@/components/fenetre";
import { fcfa } from "@/lib/format";
import { annulerRepas } from "./actions";

/** Le serveur n'a pas répondu (réseau coupé, base occupée) : on le dit, et le geste se refait. */
export const RATE = "Ça n'est pas passé, réessaie dans un instant";

/**
 * Annuler un repas, depuis le menu ou depuis le ticket : on demande confirmation dans une fenêtre du kit, puis le serveur
 * décide (peutAnnuler) et rembourse. Rendre `fenetre` dans la page, hors de l'ardoise (ses couleurs y sont inversées).
 */
export function useAnnulation() {
  const { confirmer, fenetre } = useConfirmation();
  const [enCours, lancer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);

  const annuler = async (repas: { id: string; plat: string; prix: number; paiement?: string }, fait?: () => void) => {
    const oui = await confirmer({
      titre: "Annuler ce repas",
      message: repas.paiement === "a_payer"
        ? `Tu annules « ${repas.plat} ». Tu n'avais rien payé : il n'y a rien à rendre.`
        : `Tu annules « ${repas.plat} ». Tu es remboursé tout de suite : ${fcfa(repas.prix)} reviennent sur ton solde.`,
      libelle: "Annuler le repas",
      refus: "Garder mon repas",
      corbeille: false,
    });
    if (!oui) return;
    lancer(async () => {
      try {
        const r = await annulerRepas(repas.id);
        if (r.ok) { setErreur(null); fait?.(); } else setErreur(r.erreur);
      } catch {
        setErreur(RATE);
      }
    });
  };

  return { annuler, enCours, erreur, fenetre };
}
