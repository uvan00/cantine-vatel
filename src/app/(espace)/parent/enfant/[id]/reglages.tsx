"use client";

import { useState, useTransition } from "react";
import { Check } from "@/components/icons";
import { SAlert, SBtn, SCheckbox, SField, SInput } from "@/components/sneat";
import { ALLERGENES, REGIMES } from "@/lib/listes";
import { MARQUE } from "@/lib/marque";
import { reglerProfil, reglerSeuil, type Reponse } from "../../actions";

// Ce que le parent règle pour son enfant : le profil alimentaire (cases à cocher) et le seuil d'alerte. Mêmes blocs que
// dans le compte du convive, pour que les deux écrans se lisent pareil. Le serveur revérifie tout
// (src/app/(espace)/parent/actions.ts) : ici, on ne fait que saisir.

const CARTE = "rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4";
const LEGENDE = "text-[14px] leading-5 font-semibold text-encre/95";
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

/** Le bouton d'un bloc et ce qui s'est passé : « C'est noté », ou la raison du refus. */
function Enregistrer({ enCours, reponse }: { enCours: boolean; reponse: Reponse | null }) {
  return (
    <div className="mt-4">
      <div aria-live="polite">
        {reponse && !reponse.ok && <div className="mb-4"><SAlert tone="error">{reponse.erreur}</SAlert></div>}
      </div>
      <div className="flex items-center gap-3">
        <SBtn type="submit" tone="secondary" disabled={enCours}>{enCours ? "Un instant" : "Enregistrer"}</SBtn>
        <p aria-live="polite" className="flex items-center gap-1 text-[14px] leading-5 text-texte-2">
          {reponse?.ok && <><Check className="size-5" strokeWidth={1.8} aria-hidden="true" /> {reponse.message}</>}
        </p>
      </div>
    </div>
  );
}

export function ProfilAlimentaire({ enfantId, allergenes, regimes }: { enfantId: string; allergenes: string[]; regimes: string[] }) {
  const [coches, setCoches] = useState({ allergenes, regimes });
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [enCours, demarrer] = useTransition();

  const basculer = (liste: "allergenes" | "regimes", id: string, oui: boolean) => {
    setReponse(null);
    setCoches((c) => ({ ...c, [liste]: oui ? [...c[liste], id] : c[liste].filter((v) => v !== id) }));
  };
  const enregistrer = () => demarrer(async () => setReponse(await reglerProfil({ enfantId, ...coches })));

  return (
    <form className={CARTE} onSubmit={(e) => { e.preventDefault(); enregistrer(); }} noValidate>
      <fieldset>
        <legend className={LEGENDE}>Allergènes</legend>
        <div className="mt-1 grid grid-cols-2 gap-x-4">
          {ALLERGENES.map((a) => (
            <div key={a.id} className="[&>label]:h-11">
              <SCheckbox checked={coches.allergenes.includes(a.id)} onChange={(oui) => basculer("allergenes", a.id, oui)} label={majuscule(a.nom)} />
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className={LEGENDE}>Régimes</legend>
        <div className="mt-1 grid grid-cols-2 gap-x-4">
          {REGIMES.map((r) => (
            <div key={r.id} className="[&>label]:h-11">
              <SCheckbox checked={coches.regimes.includes(r.id)} onChange={(oui) => basculer("regimes", r.id, oui)} label={majuscule(r.nom)} />
            </div>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-[14px] leading-5 text-texte-2">
        D&apos;après ce que la cantine a déclaré : {MARQUE.nom} répète sa liste, elle ne garantit pas la composition des plats.
      </p>
      <Enregistrer enCours={enCours} reponse={reponse} />
    </form>
  );
}

export function SeuilAlerte({ enfantId, seuil, prenom }: { enfantId: string; seuil: number; prenom: string }) {
  const [valeur, setValeur] = useState(String(seuil));
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [enCours, demarrer] = useTransition();

  const enregistrer = () => demarrer(async () => setReponse(await reglerSeuil({ enfantId, seuil: valeur })));

  return (
    <form className={CARTE} onSubmit={(e) => { e.preventDefault(); enregistrer(); }} noValidate>
      <SField label="Préviens-moi quand son solde passe sous" hint={`${prenom} voit la même alerte dans son compte`}>
        <span className="relative block">
          <SInput name="seuil" inputMode="numeric" autoComplete="off" enterKeyHint="done" value={valeur} className="chiffres pr-20"
            onChange={(e) => { setReponse(null); setValeur(e.target.value.replace(/\D/g, "").slice(0, 6)); }} />
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] leading-5 text-texte-2">F&nbsp;CFA</span>
        </span>
      </SField>
      <Enregistrer enCours={enCours} reponse={reponse} />
    </form>
  );
}
