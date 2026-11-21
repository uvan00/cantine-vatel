"use client";

import { useState, useTransition } from "react";
import { SAlert, SBtn } from "@/components/sneat";
import type { Suggestion } from "@/lib/suggestion";
import { suggerer } from "./actions";

// La suggestion de la semaine (bonus 5 du cahier) : à la demande, l'IA lit les chiffres de ce rapport et propose
// quelques gestes pour la semaine qui vient. Sans chiffre (ils sont au-dessus), et sans nom d'élève : rien de tel ne lui
// est envoyé. Une fois rédigée, elle sort aussi sur le papier ; le bouton, non.

export function SuggestionDeLaSemaine({ semaine, branchee }: { semaine: string; branchee: boolean }) {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, lancer] = useTransition();

  const rediger = () => {
    setErreur(null);
    lancer(async () => {
      const r = await suggerer(semaine).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
      if (r.ok) setSuggestions(r.suggestions);
      else setErreur(r.erreur);
    });
  };

  return (
    <section className={`sn-card p-6 print:break-inside-avoid ${suggestions ? "" : "print:hidden"}`} aria-labelledby="titre-suggestion">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 max-w-[640px]">
          <h2 id="titre-suggestion" className="text-[18px] leading-6">Une suggestion pour la semaine prochaine</h2>
          <p className="mt-1 text-[14px] leading-5 text-texte-2">
            {branchee
              ? "Rédigée par l'IA à partir des chiffres de ce rapport, sans aucun nom d'élève. Relis-la avant d'agir."
              : "Rédigée par l'IA à partir des chiffres de ce rapport. Elle s'allume quand la cantine a posé sa clé d'IA."}
          </p>
        </div>
        {branchee && (
          <div className="print:hidden">
            <SBtn tone="secondary" size="sm" disabled={enCours} onClick={rediger}>
              {enCours ? "Rédaction en cours" : suggestions ? "Rédiger à nouveau" : "Rédiger la suggestion"}
            </SBtn>
          </div>
        )}
      </div>
      <div aria-live="polite" className="empty:hidden">
        {erreur && <div className="mt-4"><SAlert tone="error">{erreur}</SAlert></div>}
        {suggestions && (
          <ol className="mt-4 divide-y divide-[color:var(--h-filet)]">
            {suggestions.map((s) => (
              <li key={s.titre} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[15px] leading-6 font-medium text-encre/95">{s.titre}</p>
                <p className="mt-0.5 text-[14px] leading-5 text-encre/85">{s.texte}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}
