"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SBtn, SInput } from "@/components/sneat";
import { estUnJour } from "@/lib/jours";

// La période choisie à la main (demande du propriétaire du 21/11/2026) : la date de début, la date de fin, « Afficher ».
// Dans le désordre, les deux dates se remettent dans l'ordre ; le serveur borne la période à un an.

export function ChoixDates({ base, du, au, aujourdhui }: { base: string; du: string; au: string; aujourdhui: string }) {
  const router = useRouter();
  const [debut, setDebut] = useState(du);
  const [fin, setFin] = useState(au);
  const [enCours, demarrer] = useTransition();
  const pret = estUnJour(debut) && estUnJour(fin) && (debut !== du || fin !== au);
  const afficher = () => {
    const [a, b] = debut <= fin ? [debut, fin] : [fin, debut];
    demarrer(() => router.push(`${base}?p=dates&du=${a}&au=${b}`));
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-2 text-[14px] leading-5 text-texte-2">
        Du
        <span className="w-[168px]"><SInput type="date" className="h-champ--moyen" value={debut} max={aujourdhui} onChange={(e) => setDebut(e.target.value)} /></span>
      </label>
      <label className="flex items-center gap-2 text-[14px] leading-5 text-texte-2">
        au
        <span className="w-[168px]"><SInput type="date" className="h-champ--moyen" value={fin} max={aujourdhui} onChange={(e) => setFin(e.target.value)} /></span>
      </label>
      <SBtn size="sm" tone="secondary" disabled={!pret || enCours} onClick={afficher}>{enCours ? "Un instant" : "Afficher"}</SBtn>
    </div>
  );
}
