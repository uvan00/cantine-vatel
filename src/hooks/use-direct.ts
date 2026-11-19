"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * « En direct » sans WebSocket : l'écran relit une route JSON toutes les `ms` millisecondes, et tout de suite
 * quand l'onglet redevient visible. Robuste sur un wifi de salle de hackathon (rien à reconnecter).
 * `recharger()` relit immédiatement (après un geste du convive).
 */
export function useDirect<T>(url: string, initial: T, ms = 2000): [T, () => Promise<void>] {
  const [donnees, setDonnees] = useState<T>(initial);
  const enVol = useRef(false);

  const recharger = useCallback(async () => {
    if (enVol.current) return;
    enVol.current = true;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) setDonnees((await res.json()) as T);
    } catch {
      // Réseau coupé : on garde le dernier état connu et on réessaie au prochain tour.
    } finally {
      enVol.current = false;
    }
  }, [url]);

  useEffect(() => {
    const id = setInterval(() => { if (document.visibilityState === "visible") void recharger(); }, ms);
    const auRetour = () => { if (document.visibilityState === "visible") void recharger(); };
    document.addEventListener("visibilitychange", auRetour);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", auRetour); };
  }, [recharger, ms]);

  return [donnees, recharger];
}

/** L'heure qui avance (pour « il y a 4 min »), rafraîchie toutes les 30 secondes. */
export function useMaintenant(ms = 30_000) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setT(Date.now()), ms); return () => clearInterval(id); }, [ms]);
  return t;
}
