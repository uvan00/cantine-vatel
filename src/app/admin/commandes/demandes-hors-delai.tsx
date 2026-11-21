"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { CheckCircle2 } from "@/components/icons";
import { SAlert, SBtn } from "@/components/sneat";
import { useDirect } from "@/hooks/use-direct";
import type { VueDemande } from "@/lib/donnees-admin";
import { depuis, fcfa } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { repondreDemande } from "../demandes/actions";

// Les demandes hors délai d'aujourd'hui (les demandes urgentes), relues toutes les 4 secondes :
// accepter réserve le repas pour le convive, payé sur son solde, et donne le code de son ticket ; refuser ne coûte rien.

export function DemandesHorsDelai({ initial }: { initial: VueDemande[] }) {
  const [demandes, relire] = useDirect<VueDemande[]>("/api/admin/demandes", initial, 4000);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();

  const repondre = (d: VueDemande, accepter: boolean) => demarrer(async () => {
    const r = await repondreDemande(d.id, accepter).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
    setMessage(r.ok ? { ok: true, texte: r.phrase } : { ok: false, texte: r.erreur });
    await relire();
  });

  if (demandes.length === 0 && !message) return null;
  return (
    <section aria-label="Demandes hors délai" className="space-y-3">
      <div aria-live="polite">
        {message && (message.ok ? <SAlert tone="success" Icon={CheckCircle2}>{message.texte}</SAlert> : <SAlert tone="error">{message.texte}</SAlert>)}
      </div>
      {demandes.length > 0 && (
        <div className="rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
          <p className="border-b border-[color:var(--h-filet)] px-4 py-3 text-[15px] leading-5 font-semibold text-encre/95">
            Demandes après la clôture <span className="chiffres ml-1 font-normal text-texte-2">{demandes.length}</span>
          </p>
          <ul className="divide-y divide-[color:var(--h-filet)]">
            {demandes.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar id={d.conviveId} nom={d.convive} photo={d.photo} taille={36} />
                <div className="min-w-0 flex-1 basis-[180px]">
                  <p className="truncate text-[15px] leading-5 font-semibold text-encre/95">{d.convive}</p>
                  <p className="chiffres truncate text-[13px] leading-5 text-texte-2">{d.plat}, {fcfa(d.prix)}, {depuis(new Date(d.creeLe), maintenant())}{d.groupe ? `, ${d.groupe}` : ""}</p>
                </div>
                <div className="flex gap-2">
                  <SBtn size="sm" tone="secondary" disabled={enCours} onClick={() => repondre(d, true)}>Accepter</SBtn>
                  <SBtn size="sm" variant="text" tone="secondary" disabled={enCours} onClick={() => repondre(d, false)}>Refuser</SBtn>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
