"use client";

import { Printer } from "@/components/icons";

/** Le bouton qui lance l'impression ; il ne sort pas sur le papier. */
export function BoutonImprimer() {
  return (
    <button type="button" onClick={() => window.print()} className="hb hb--encre hb--petit shrink-0 print:hidden">
      <Printer className="size-4" strokeWidth={1.8} />Imprimer
    </button>
  );
}
