"use client";

import { useEffect } from "react";
import { marquerMesLus } from "./actions";

/** Une fois les messages affichés, ceux qui n'étaient pas lus le deviennent ; la pastille de l'onglet s'éteint. */
export function MarquerLus({ ids }: { ids: string[] }) {
  const cle = ids.join(",");
  useEffect(() => { void marquerMesLus(cle.split(",")); }, [cle]);
  return null;
}
