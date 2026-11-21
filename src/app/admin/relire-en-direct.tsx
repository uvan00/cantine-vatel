"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// L'accueil du tableau de bord en direct (demande du propriétaire du 21/11/2026) : la page se relit toute seule, comme
// Commandes et Recharges. Un ticket scanné au comptoir, depuis le site ou l'application mobile, fait bouger « Servis »
// et « À servir » sans recharger. Rien ne se relit quand l'onglet est caché ; quand on y revient, la page se relit tout
// de suite. router.refresh() redemande la page au serveur et garde l'état de l'écran (rien ne clignote).
export function RelireEnDirect({ ms = 5000 }: { ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    const relire = () => { if (document.visibilityState === "visible") router.refresh(); };
    const id = window.setInterval(relire, ms);
    document.addEventListener("visibilitychange", relire);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", relire);
    };
  }, [router, ms]);
  return null;
}
