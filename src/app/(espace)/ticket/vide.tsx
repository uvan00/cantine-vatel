"use client";

import { Receipt } from "@/components/icons";
import { SBtnLink, SEmpty } from "@/components/sneat";

/** L'état vide de la liste des tickets (côté navigateur : l'icône ne passe pas du serveur au kit). */
export function AucunTicket() {
  return (
    <SEmpty Icon={Receipt} title="Aucun ticket pour l'instant" hint="Réserve un plat au menu : ton ticket arrive ici, avec son QR à montrer au comptoir"
      action={<SBtnLink href="/menu" tone="secondary">Voir le menu</SBtnLink>} />
  );
}
