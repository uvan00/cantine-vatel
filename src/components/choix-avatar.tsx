"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Fenetre } from "@/components/fenetre";
import { Pencil } from "@/components/icons";
import { SAlert, SBtn } from "@/components/sneat";
import { changerAvatar } from "@/app/(espace)/actions-avatar";
import { AVATARS } from "@/lib/avatars";

// Le visage d'un compte, qu'on touche pour le changer : une fenêtre avec les seize avatars dessinés de la cantine, et de
// quoi revenir aux initiales. L'élève choisit le sien, le parent le sien et celui de son enfant ; le serveur vérifie qui
// a le droit (src/lib/operations.ts, choisirAvatar).

export function ChoixAvatar({ id, nom, photo, titre, sousTitre, taille = 56 }: {
  id: string;
  nom: string;
  photo: string | null;
  /** « Choisis ton avatar », « L'avatar d'Awa » */
  titre: string;
  sousTitre: string;
  taille?: number;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [actuel, setActuel] = useState(photo);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const choisir = (avatar: string | null) => {
    setErreur(null);
    demarrer(async () => {
      const r = await changerAvatar({ pour: id, avatar });
      if (!r.ok) { setErreur(r.erreur); return; }
      setActuel(avatar);
      setOuvert(false);
    });
  };

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} aria-label={titre} title={titre}
        className="relative shrink-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]">
        <Avatar id={id} nom={nom} photo={actuel} taille={taille} />
        <span aria-hidden="true" className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full bg-surface text-encre/90 shadow-[0_0_0_1px_var(--h-filet),var(--h-ombre-1)]">
          <Pencil className="size-3.5" strokeWidth={1.8} />
        </span>
      </button>
      {ouvert && (
        <Fenetre titre={titre} sousTitre={sousTitre} onClose={() => setOuvert(false)}>
          <div className="grid grid-cols-4 gap-3" role="radiogroup" aria-label="Les avatars de la cantine">
            {AVATARS.map((a, i) => {
              const choisi = actuel === a;
              return (
                <button key={a} type="button" role="radio" aria-checked={choisi} aria-label={`Avatar ${i + 1}`} disabled={enCours} onClick={() => choisir(a)}
                  className={`rounded-full p-1 transition-shadow disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${choisi ? "shadow-[0_0_0_2px_rgb(var(--h-marque))]" : "hover:shadow-[0_0_0_2px_var(--h-filet)]"}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- petits fichiers de public/avatars */}
                  <img src={a} alt="" className="aspect-square w-full rounded-full" />
                </button>
              );
            })}
          </div>
          {erreur && <div className="mt-4"><SAlert tone="error">{erreur}</SAlert></div>}
          {actuel && (
            <div className="mt-4 text-center">
              <SBtn variant="text" tone="secondary" size="sm" disabled={enCours} onClick={() => choisir(null)}>Revenir aux initiales</SBtn>
            </div>
          )}
        </Fenetre>
      )}
    </>
  );
}
