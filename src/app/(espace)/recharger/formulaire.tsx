"use client";

import { useState, useTransition } from "react";
import { Users } from "@/components/icons";
import { SAlert, SBtn, SBtnLink, SEmpty, SField, SInput } from "@/components/sneat";
import { de, fcfa } from "@/lib/format";
import { MONTANTS_RAPIDES, RECHARGE_MAX, RECHARGE_MIN } from "@/lib/recharge";
import { demanderUneRecharge } from "./actions";

// Choisir pour qui (le parent, s'il a plusieurs enfants) et combien : trois montants rapides, ou un autre montant.
// Le serveur revalide tout et crée la demande (src/app/(espace)/recharger/actions.ts) : ici, on ne fait que choisir.

export type CompteARecharger = { id: string; nom: string; prenom: string; classe: string; solde: number };

const LEGENDE = "pl-0.5 text-[14px] leading-5 font-semibold text-encre/95";
const CONTOUR = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgb(var(--h-marque-texte))]";

/** Le parent n'a encore relié aucun enfant : on l'envoie le faire. */
export function AucunCompte() {
  return (
    <SEmpty Icon={Users} title="Relie d'abord ton enfant" hint="Tu recharges le compte d'un enfant relié au tien : son code famille suffit"
      action={<SBtnLink href="/parent" tone="secondary">Relier un enfant</SBtnLink>} />
  );
}

export function FormulaireRecharge({ comptes, choisi, pourSoi }: {
  comptes: CompteARecharger[];
  /** Le compte choisi d'avance (« ?pour= », ou le seul possible), sinon vide. */
  choisi: string;
  /** Vrai pour un convive, qui recharge son propre compte. */
  pourSoi: boolean;
}) {
  const [pour, setPour] = useState(choisi);
  const [rapide, setRapide] = useState("");
  const [autre, setAutre] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const compte = comptes.find((c) => c.id === pour);
  const montant = autre || rapide;

  const continuer = () => {
    setErreur(null);
    demarrer(async () => {
      // En cas de réussite, le serveur ouvre la page de la recharge : on ne revient ici que pour une erreur.
      const r = await demanderUneRecharge({ pour, montant });
      if (r?.erreur) setErreur(r.erreur);
    });
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); continuer(); }} noValidate>
      {comptes.length > 1 && (
        <fieldset>
          <legend className={LEGENDE}>Pour qui</legend>
          <div className="mt-2 divide-y divide-[color:var(--h-filet)] rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
            {comptes.map((c) => (
              <label key={c.id} className={`flex h-14 cursor-pointer items-center gap-3 px-4 first:rounded-t-[16px] last:rounded-b-[16px] ${CONTOUR}`}>
                <input type="radio" name="pour" value={c.id} checked={pour === c.id} onChange={() => { setPour(c.id); setErreur(null); }} className="peer sr-only" />
                <span aria-hidden="true" className="size-5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--h-repere)] transition-shadow peer-checked:shadow-[inset_0_0_0_6px_rgb(var(--h-marque-texte))]" />
                <span className="min-w-0 flex-1 truncate text-[15px] leading-5 font-medium text-encre/95">{c.nom}</span>
                {c.classe && <span className="shrink-0 text-[14px] leading-5 text-texte-2">{c.classe}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {compte && (
        <div className={`flex h-14 items-center justify-between gap-3 rounded-[16px] bg-[color:var(--h-surface)] px-4 ${comptes.length > 1 ? "mt-4" : ""}`}>
          <span className="text-[14px] leading-5 text-texte-2">{pourSoi ? "Ton solde actuel" : `Solde actuel ${de(compte.prenom)}`}</span>
          <span className="chiffres text-[18px] leading-6 font-medium text-encre/95">{fcfa(compte.solde)}</span>
        </div>
      )}

      <fieldset className="mt-6">
        <legend className={LEGENDE}>Montant</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {MONTANTS_RAPIDES.map((v) => (
            <label key={v} className={`chiffres flex h-12 cursor-pointer items-center justify-center rounded-[12px] bg-surface text-[15px] font-medium text-encre/90 shadow-[0_0_0_1px_var(--h-filet)] transition-colors has-[:checked]:bg-[rgb(var(--sn-cta))] has-[:checked]:text-white ${CONTOUR}`}>
              <input type="radio" name="montant" value={v} checked={rapide === String(v)} onChange={() => { setRapide(String(v)); setAutre(""); setErreur(null); }} className="sr-only" />
              {fcfa(v)}
            </label>
          ))}
        </div>
        <SField label="Un autre montant" hint={`Entre ${fcfa(RECHARGE_MIN)} et ${fcfa(RECHARGE_MAX)}`} className="mt-4">
          <SInput value={autre} onChange={(e) => { setAutre(e.target.value.replace(/\D/g, "").slice(0, 6)); setRapide(""); setErreur(null); }}
            inputMode="numeric" autoComplete="off" enterKeyHint="done" className="chiffres" />
        </SField>
      </fieldset>

      <div aria-live="polite">{erreur && <div className="mt-4"><SAlert tone="error">{erreur}</SAlert></div>}</div>
      <SBtn type="submit" tone="secondary" block disabled={enCours} className={`mt-6 min-h-12 text-[16px] ${montant ? "justify-between" : ""}`}>
        <span>{enCours ? "Un instant" : "Continuer"}</span>
        {montant && <span className="chiffres">{fcfa(Number(montant))}</span>}
      </SBtn>
    </form>
  );
}
