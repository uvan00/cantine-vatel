"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SAlert, SBtn } from "@/components/sneat";
import { refaireLaCarte } from "./actions";

// Refaire la carte, pour une carte perdue, prêtée ou photographiée : un nouveau QR, l'ancien ne passe plus. En deux
// touches, la seconde confirme : une carte déjà imprimée est à réimprimer.

export function RefaireCarte({ pour }: { /** L'enfant dont le parent refait la carte ; null pour sa propre carte. */ pour: string | null }) {
  const router = useRouter();
  const [confirme, setConfirme] = useState(false);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, lancer] = useTransition();

  const refaire = () => {
    if (!confirme) { setConfirme(true); setRetour(null); return; }
    lancer(async () => {
      try {
        const r = await refaireLaCarte(pour);
        setRetour(r.ok ? { ok: true, texte: "Nouvelle carte : l'ancienne ne passe plus au comptoir" } : { ok: false, texte: r.erreur });
        if (r.ok) router.refresh();
      } catch {
        setRetour({ ok: false, texte: "Ça n'est pas passé, réessaie dans un instant" });
      }
      setConfirme(false);
    });
  };

  return (
    <div className="mx-auto mt-8 max-w-[360px] text-center print:hidden">
      <p className="text-[14px] leading-5 text-texte-2">Carte perdue, prêtée ou photographiée ? Refais-la : l&apos;ancienne ne passera plus au comptoir</p>
      <div className="mt-3 flex justify-center">
        <SBtn variant="outlined" size="sm" disabled={envoi} onClick={refaire}>{envoi ? "Un instant" : confirme ? "Confirmer, l'ancienne ne passera plus" : "Refaire la carte"}</SBtn>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {retour && <div className="mt-3 text-left"><SAlert tone={retour.ok ? "success" : "error"}>{retour.texte}</SAlert></div>}
      </div>
    </div>
  );
}
