"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "@/components/icons";
import { SAlert, SBtn, SField, SInput, SSwitch } from "@/components/sneat";
import { fcfa } from "@/lib/format";
import { PLAFOND_MAX, PLAFOND_MIN, plafondValable } from "@/lib/solde";

// Le plafond des repas d'une semaine (bonus du lot 2) : au-delà, le menu refuse
// de réserver. Le convive le règle pour lui quand il n'a pas de parent relié, sinon c'est son parent (peutReglerPlafond
// de src/lib/solde.ts). Le serveur relit tout avant d'écrire.

type Reponse = { ok: true } | { ok: false; erreur: string };

const PHRASE = `Un plafond entre ${fcfa(PLAFOND_MIN)} et ${fcfa(PLAFOND_MAX)}, sans centimes`;

export function PlafondSemaine({ plafond, depense, qui, enregistrer }: {
  plafond: number | null;
  /** Ce qui est déjà réservé cette semaine, annulés exclus. */
  depense: number;
  /** « Tu as réservé », « Awa a réservé » */
  qui: string;
  enregistrer: (plafond: number | null) => Promise<Reponse>;
}) {
  const [actif, setActif] = useState(plafond !== null);
  const [valeur, setValeur] = useState(plafond === null ? "" : String(plafond));
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, lancer] = useTransition();

  const envoyer = () => {
    const choisi = actif ? Number(valeur) : null;
    if (actif && (valeur === "" || !plafondValable(choisi))) { setRetour({ ok: false, texte: PHRASE }); return; }
    lancer(async () => {
      const r = await enregistrer(choisi).catch((): Reponse => ({ ok: false, erreur: "Le serveur ne répond pas, réessaie" }));
      setRetour(r.ok ? { ok: true, texte: choisi === null ? "Plus de plafond" : "C'est noté" } : { ok: false, texte: r.erreur });
    });
  };

  return (
    <form className="rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4" onSubmit={(e) => { e.preventDefault(); envoyer(); }} noValidate>
      <SSwitch checked={actif} onChange={(v) => { setActif(v); setRetour(null); }} label="Plafonner les repas de la semaine"
        hint="Au-delà, le menu refuse de réserver jusqu'au lundi suivant" />
      {actif && (
        <SField label="Au plus, par semaine" className="mt-4" hint={<span className="chiffres">{qui} {fcfa(depense)} de repas cette semaine</span>}>
          <span className="relative block">
            <SInput name="plafond" inputMode="numeric" autoComplete="off" value={valeur} className="chiffres pr-20"
              onChange={(e) => { setRetour(null); setValeur(e.target.value.replace(/\D/g, "").slice(0, 6)); }} />
            <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] leading-5 text-texte-2">F CFA</span>
          </span>
        </SField>
      )}
      <div aria-live="polite" className="mt-4 empty:hidden">
        {retour && (retour.ok ? <SAlert tone="success" Icon={CheckCircle2}>{retour.texte}</SAlert> : <SAlert tone="error">{retour.texte}</SAlert>)}
      </div>
      <SBtn type="submit" tone="secondary" className="mt-4" disabled={envoi}>{envoi ? "Un instant" : "Enregistrer"}</SBtn>
    </form>
  );
}
