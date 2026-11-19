"use client";

import { useActionState, useState } from "react";
import { SAlert, SBtn, SField, SInput } from "@/components/sneat";
import { connecter, creerCompte, type EtatFormulaire } from "./actions";

// Les deux formulaires d'entrée. L'action serveur renvoie l'erreur en une phrase et les champs déjà saisis.

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(connecter, {});
  return (
    <form action={action} className="space-y-4" noValidate>
      <div aria-live="polite">{etat.erreur && <SAlert tone="error">{etat.erreur}</SAlert>}</div>
      <SField label="E-mail">
        <SInput name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" defaultValue={etat.champs?.email ?? ""} required />
      </SField>
      <SField label="Mot de passe">
        <SInput name="motDePasse" type="password" autoComplete="current-password" required />
      </SField>
      <SBtn type="submit" tone="secondary" block disabled={enCours}>{enCours ? "Connexion en cours" : "Se connecter"}</SBtn>
    </form>
  );
}

const QUI = [
  { id: "eleve", nom: "Élève" },
  { id: "employe", nom: "Employé" },
  { id: "parent", nom: "Parent" },
] as const;

export function FormulaireInscription() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(creerCompte, {});
  const [qui, setQui] = useState<string>(etat.champs?.qui || "eleve");
  return (
    <form action={action} className="space-y-4" noValidate>
      <div aria-live="polite">{etat.erreur && <SAlert tone="error">{etat.erreur}</SAlert>}</div>

      <fieldset>
        <legend className="mb-2 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Tu es</legend>
        <div className="grid grid-cols-3 gap-2">
          {QUI.map((q) => (
            <label key={q.id}
              className="flex h-12 cursor-pointer items-center justify-center rounded-[12px] bg-surface text-[15px] font-medium text-encre/90 shadow-[0_0_0_1px_var(--h-filet)] transition-colors has-[:checked]:bg-[rgb(var(--sn-cta))] has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgb(var(--h-marque-texte))]">
              <input type="radio" name="qui" value={q.id} checked={qui === q.id} onChange={() => setQui(q.id)} className="sr-only" />
              {q.nom}
            </label>
          ))}
        </div>
      </fieldset>

      <SField label="Prénom et nom">
        <SInput name="nom" autoComplete="name" defaultValue={etat.champs?.nom ?? ""} required />
      </SField>
      {qui !== "parent" && (
        <SField label={qui === "employe" ? "Service" : "Classe"} hint="Tu peux laisser vide">
          <SInput name="classe" defaultValue={etat.champs?.classe ?? ""} />
        </SField>
      )}
      <SField label="E-mail">
        <SInput name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" defaultValue={etat.champs?.email ?? ""} required />
      </SField>
      <SField label="Mot de passe" hint="8 caractères au moins">
        <SInput name="motDePasse" type="password" autoComplete="new-password" required />
      </SField>
      <SBtn type="submit" tone="secondary" block disabled={enCours}>{enCours ? "Création en cours" : "Créer mon compte"}</SBtn>
    </form>
  );
}
