"use client";

import { useState } from "react";
import { initiales } from "@/lib/format";

// Le visage d'une personne : sa photo de profil si son compte en a une, sinon ses initiales en blanc sur une pastille de
// couleur. Les teintes sont celles des pastilles des convives de Tablée (teintes de pagne, toutes lisibles avec des
// initiales blanches, de 5,4:1 à 8,8:1, mesuré le 16/11/2026). La teinte suit la personne, d'une page à l'autre, et son
// nom est toujours écrit à côté : la couleur n'est jamais seule. Une image qui ne se charge pas (le scanner hors ligne)
// laisse la place aux initiales.

const TEINTES = ["#3949AB", "#B3472B", "#136F78", "#8A5A00", "#7B3F6E", "#B0345B", "#2C4A7E", "#6D4C33"];

/** Toujours la même teinte pour la même personne, tirée de son identifiant. */
function teinteDe(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return TEINTES[h % TEINTES.length];
}

export function Avatar({ id, nom, photo, taille = 40 }: { id: string; nom: string; photo?: string | null; taille?: number }) {
  const [rate, setRate] = useState(false);
  const s = { width: taille, height: taille };
  if (photo && !rate) {
    // eslint-disable-next-line @next/next/no-img-element -- photo de profil, à n'importe quelle adresse
    return <img src={photo} alt="" style={s} onError={() => setRate(true)} className="shrink-0 rounded-full object-cover shadow-[0_0_0_1px_var(--h-filet)]" />;
  }
  return (
    <span aria-hidden="true" style={{ ...s, background: teinteDe(id), fontSize: Math.round(taille * 0.38) }}
      className="grid shrink-0 place-items-center rounded-full leading-none font-semibold text-white">
      {initiales(nom)}
    </span>
  );
}
