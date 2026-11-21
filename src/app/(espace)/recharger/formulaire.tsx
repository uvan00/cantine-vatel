"use client";

import { useState, useTransition } from "react";
import { Avatar } from "@/components/avatar";
import { Users } from "@/components/icons";
import { SAlert, SBtn, SBtnLink, SEmpty, SField, SInput } from "@/components/sneat";
import { fcfa } from "@/lib/format";
import { MONTANTS_RAPIDES, RECHARGE_MAX, RECHARGE_MIN } from "@/lib/recharge";
import { demanderUneRecharge } from "./actions";

// Choisir pour qui (le parent, s'il a plusieurs enfants) et combien : trois montants rapides, ou un autre montant.
// Chaque compte se montre avec son visage (sa photo, sinon ses initiales), sa classe et son solde, en cartes comme les
// moyens de paiement de la page suivante. Le serveur revalide tout et crée la demande
// (src/app/(espace)/recharger/actions.ts) : ici, on ne fait que choisir.

export type CompteARecharger = { id: string; nom: string; prenom: string; classe: string; solde: number; photo: string | null };

const LEGENDE = "text-[16px] leading-6 font-medium text-encre/95";
const CONTOUR = "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgb(var(--h-marque-texte))]";

/** Sous le nom : « Bachelor 2, solde 2 000 F CFA », ou « Solde 1 500 F CFA » sans classe. */
const detail = (c: CompteARecharger) => (c.classe ? `${c.classe}, solde ${fcfa(c.solde)}` : `Solde ${fcfa(c.solde)}`);

/** Le visage, le nom et le détail d'un compte, sur une ligne de 64 px. */
function Personne({ c }: { c: CompteARecharger }) {
  return (
    <>
      <Avatar id={c.id} nom={c.nom} photo={c.photo} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] leading-5 font-medium text-encre/95">{c.nom}</span>
        <span className="chiffres block truncate text-[13px] leading-5 text-texte-2">{detail(c)}</span>
      </span>
    </>
  );
}

/** Le parent n'a encore relié aucun enfant : on l'envoie le faire. */
export function AucunCompte() {
  return (
    <SEmpty Icon={Users} title="Relie d'abord ton enfant" hint="Tu recharges le compte d'un enfant relié au tien : son code famille suffit"
      action={<SBtnLink href="/parent" tone="secondary">Relier un enfant</SBtnLink>} />
  );
}

export function FormulaireRecharge({ comptes, choisi }: {
  comptes: CompteARecharger[];
  /** Le compte choisi d'avance (« ?pour= », ou le seul possible), sinon vide. */
  choisi: string;
}) {
  const [pour, setPour] = useState(choisi);
  const [rapide, setRapide] = useState("");
  const [autre, setAutre] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
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
      {comptes.length > 1 ? (
        <fieldset>
          <legend className={LEGENDE}>Pour qui</legend>
          <div className="mt-3 space-y-2">
            {comptes.map((c) => (
              <label key={c.id} className={`flex h-16 cursor-pointer items-center gap-3 rounded-[16px] bg-surface px-4 shadow-[inset_0_0_0_1px_var(--h-filet)] transition-shadow has-[:checked]:shadow-[inset_0_0_0_2px_rgb(var(--h-marque))] ${CONTOUR}`}>
                <input type="radio" name="pour" value={c.id} checked={pour === c.id} onChange={() => { setPour(c.id); setErreur(null); }} className="peer sr-only" />
                <span aria-hidden="true" className="size-5 shrink-0 rounded-full shadow-[inset_0_0_0_1.5px_var(--h-repere)] transition-shadow peer-checked:shadow-[inset_0_0_0_6px_rgb(var(--h-marque-texte))]" />
                <Personne c={c} />
              </label>
            ))}
          </div>
        </fieldset>
      ) : comptes[0] && (
        <div className="flex h-16 items-center gap-3 rounded-[16px] bg-surface px-4 shadow-[inset_0_0_0_1px_var(--h-filet)]">
          <Personne c={comptes[0]} />
        </div>
      )}

      <fieldset className="mt-6">
        <legend className={LEGENDE}>Montant</legend>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {MONTANTS_RAPIDES.map((v) => (
            <label key={v} className={`chiffres flex h-12 cursor-pointer items-center justify-center rounded-[12px] bg-surface text-[15px] font-medium text-encre/90 shadow-[0_0_0_1px_var(--h-filet)] transition-colors has-[:checked]:bg-[rgb(var(--sn-cta))] has-[:checked]:text-white ${CONTOUR}`}>
              <input type="radio" name="montant" value={v} checked={rapide === String(v)} onChange={() => { setRapide(String(v)); setAutre(""); setErreur(null); }} className="sr-only" />
              {fcfa(v)}
            </label>
          ))}
        </div>
        <SField label="Un autre montant" hint={`Entre ${fcfa(RECHARGE_MIN)} et ${fcfa(RECHARGE_MAX)}`} className="mt-4">
          <span className="relative block">
            <SInput value={autre} onChange={(e) => { setAutre(e.target.value.replace(/\D/g, "").slice(0, 6)); setRapide(""); setErreur(null); }}
              inputMode="numeric" autoComplete="off" enterKeyHint="done" className="chiffres pr-16 text-[16px]" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[15px] text-texte-2">F CFA</span>
          </span>
        </SField>
      </fieldset>

      <div aria-live="polite">{erreur && <div className="mt-4"><SAlert tone="error">{erreur}</SAlert></div>}</div>
      <SBtn type="submit" tone="secondary" block disabled={enCours} className={`mt-6 min-h-14 rounded-[16px] text-[16px] ${montant ? "justify-between" : ""}`}>
        <span>{enCours ? "Un instant" : "Continuer"}</span>
        {montant && <span className="chiffres">{fcfa(Number(montant))}</span>}
      </SBtn>
    </form>
  );
}
