"use client";

import { useSyncExternalStore } from "react";

/** Vrai quand la requête média correspond (faux côté serveur, puis la vraie valeur dès l'hydratation). */
export function useMedia(requete: string) {
  return useSyncExternalStore(
    (rappel) => { const m = window.matchMedia(requete); m.addEventListener("change", rappel); return () => m.removeEventListener("change", rappel); },
    () => window.matchMedia(requete).matches,
    () => false,
  );
}
