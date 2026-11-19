"use client";

import { useState, useTransition } from "react";
import { Users } from "@/components/icons";
import { SAlert, SBtn, SEmpty, SField, SInput } from "@/components/sneat";
import { nettoyerCode } from "@/lib/ticket";
import { relierEnfant, type Reponse } from "./actions";

// Relier un enfant : le parent saisit le code famille que son enfant lit dans son compte (6 caractères).

/** Ce qu'on montre tant qu'aucun enfant n'est relié. */
export function AucunEnfant() {
  return <SEmpty Icon={Users} title="Aucun enfant relié pour l'instant" hint="Demande à ton enfant son code famille : il est dans son compte" />;
}

export function RelierEnfant() {
  const [code, setCode] = useState("");
  const [reponse, setReponse] = useState<Reponse | null>(null);
  const [enCours, demarrer] = useTransition();

  const relier = () => demarrer(async () => {
    const r = await relierEnfant(code);
    setReponse(r);
    if (r.ok) setCode("");
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); relier(); }} noValidate>
      <div className="flex items-end gap-2">
        <SField label="Code famille" className="min-w-0 flex-1">
          <SInput value={code} onChange={(e) => setCode(nettoyerCode(e.target.value).slice(0, 6))}
            autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} enterKeyHint="done"
            className="chiffres tracking-[0.08em]" />
        </SField>
        <SBtn type="submit" tone="secondary" className="h-12" disabled={enCours}>{enCours ? "Un instant" : "Relier"}</SBtn>
      </div>
      <div aria-live="polite">
        {reponse && <div className="mt-3"><SAlert tone={reponse.ok ? "success" : "error"}>{reponse.ok ? reponse.message : reponse.erreur}</SAlert></div>}
      </div>
    </form>
  );
}
