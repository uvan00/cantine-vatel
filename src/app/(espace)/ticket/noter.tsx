"use client";

import { useState, useTransition } from "react";
import { Fenetre } from "@/components/fenetre";
import { Star } from "@/components/icons";
import { SAlert, SBtn, SField, STextarea } from "@/components/sneat";
import { DESCRIPTION_MAX } from "@/lib/menu";
import { RATE } from "@/app/(espace)/menu/annulation";
import { noterRepas } from "./actions";

// Noter un repas servi : de 1 à 5, avec un mot en option. La même fenêtre sert dans la liste des tickets (un geste en
// bout de ligne) et sous le ticket (un bouton). Renoter remplace la note.

/** Ce que veut dire chaque note, en mots. */
const EN_MOTS = ["", "à oublier", "bof", "ça passe", "c'est bon", "un régal"];

export function NoterRepas({ reservationId, plat, note, mot, forme }: {
  reservationId: string;
  plat: string;
  /** La note déjà donnée, ou null. */
  note: number | null;
  mot: string;
  /** « ligne » : un geste discret en bout de ligne ; « bouton » : le geste principal sous le ticket. */
  forme: "ligne" | "bouton";
}) {
  const [ouverte, setOuverte] = useState(false);
  const ouvrir = () => setOuverte(true);
  return (
    <>
      {forme === "ligne" ? (
        // Au-dessus du lien qui couvre la ligne, avec une zone à toucher plus haute que le texte.
        <button type="button" onClick={ouvrir}
          className="chiffres relative z-10 -my-2 inline-flex items-center gap-1 rounded-[8px] py-2 pl-2 text-[14px] leading-5 font-medium text-marque-texte underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[rgb(var(--h-marque-texte))]">
          {note === null ? "Noter" : <><Star className="size-4" strokeWidth={1.8} fill="currentColor" aria-hidden="true" /> {note} sur 5</>}
        </button>
      ) : note === null ? (
        <SBtn tone="secondary" block className="min-h-12 text-[16px]" onClick={ouvrir}>Noter ce repas</SBtn>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4">
          <div className="min-w-0">
            <p className="chiffres flex items-center gap-1 text-[15px] leading-5 font-medium text-encre/95">
              <Star className="size-5 shrink-0" strokeWidth={1.8} fill="currentColor" aria-hidden="true" /> Ta note : {note} sur 5
            </p>
            {mot && <p className="mt-1 text-[14px] leading-5 text-texte-2">« {mot} »</p>}
          </div>
          <SBtn variant="outlined" size="sm" onClick={ouvrir}>Modifier</SBtn>
        </div>
      )}
      {ouverte && <FenetreNote reservationId={reservationId} plat={plat} noteDonnee={note} motDonne={mot} fermer={() => setOuverte(false)} />}
    </>
  );
}

function FenetreNote({ reservationId, plat, noteDonnee, motDonne, fermer }: {
  reservationId: string; plat: string; noteDonnee: number | null; motDonne: string; fermer: () => void;
}) {
  const [note, setNote] = useState(noteDonnee ?? 0);
  const [mot, setMot] = useState(motDonne);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, lancer] = useTransition();

  const envoyer = () => lancer(async () => {
    try {
      const r = await noterRepas(reservationId, note, mot.trim());
      if (r.ok) fermer(); else setErreur(r.erreur);
    } catch {
      setErreur(RATE);
    }
  });

  return (
    <Fenetre titre="Noter ce repas" sousTitre={plat} onClose={fermer}>
      <div role="radiogroup" aria-label="Ta note sur 5" className="flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={note === n} aria-label={`${n} sur 5, ${EN_MOTS[n]}`} onClick={() => setNote(n)}
            className={`grid size-12 place-items-center rounded-[12px] transition-colors hover:bg-[color:var(--h-survol)] focus-visible:outline-2 focus-visible:outline-[rgb(var(--h-marque-texte))] ${n <= note ? "text-encre/90" : "text-[color:var(--h-texte-pale)]"}`}>
            <Star className="size-8" strokeWidth={1.8} fill={n <= note ? "currentColor" : "none"} aria-hidden="true" />
          </button>
        ))}
      </div>
      <p className="chiffres mt-2 text-center text-[15px] leading-5 text-texte-2" aria-live="polite">
        {note > 0 ? `${note} sur 5, ${EN_MOTS[note]}` : "Touche une étoile"}
      </p>
      <SField label="Un mot pour la cuisine" hint="Si tu veux" className="mt-6">
        <STextarea value={mot} onChange={(e) => setMot(e.target.value)} maxLength={DESCRIPTION_MAX} rows={3} />
      </SField>
      <div aria-live="polite" className="mt-4 empty:hidden">{erreur && <SAlert tone="error">{erreur}</SAlert>}</div>
      <SBtn tone="secondary" block className="mt-4 min-h-12 text-[16px]" disabled={note === 0 || envoi} onClick={envoyer}>
        {envoi ? "Envoi en cours" : "Envoyer ma note"}
      </SBtn>
    </Fenetre>
  );
}
