"use client";

import { useLinkStatus } from "next/link";

/**
 * Dans l'onglet d'un jour : un voile clair sur l'onglet qu'on vient de toucher, le temps que son menu arrive du serveur.
 * Toujours rendu, à taille fixe : seule son opacité change, rien ne bouge.
 */
export function VoileAttente() {
  const { pending } = useLinkStatus();
  return <span aria-hidden="true" className={`pointer-events-none absolute inset-0 rounded-t-[12px] bg-white/15 transition-opacity duration-150 ${pending ? "opacity-100" : "opacity-0"}`} />;
}
