"use client";

import { useActionState, useId, useState } from "react";
import { Briefcase, Eye, EyeOff, GraduationCap, Lock, Mail, User, type LucideIcon } from "@/components/icons";
import { SAlert } from "@/components/sneat";
import { connecter, creerCompte, type EtatFormulaire } from "./actions";

// Les deux formulaires d'entrée, dans le dessin des modèles du 21/11/2026 : le libellé au-dessus, l'icône dans le champ,
// l'œil pour voir son mot de passe, le grand bouton marine (en pilule au téléphone). L'action serveur renvoie l'erreur
// en une phrase et les champs déjà saisis.

/** Un champ du modèle. `apres` : un geste posé au bout du champ (l'œil du mot de passe). */
function Champ({ label, Icon, aide, apres, ...input }: {
  label: string;
  Icon: LucideIcon;
  aide?: string;
  apres?: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-2 block pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">{label}</label>
      <div className="relative">
        <Icon aria-hidden="true" strokeWidth={1.6} className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-texte-2" />
        <input id={id} {...input} aria-describedby={aide ? `${id}-aide` : undefined}
          className={`h-champ h-[52px] pl-12 text-[15px] ${apres ? "pr-12" : ""}`} />
        {apres}
      </div>
      {aide && <p id={`${id}-aide`} className="mt-2 pl-0.5 text-[12px] leading-4 text-texte-2">{aide}</p>}
    </div>
  );
}

function ChampMotDePasse({ nouveau = false }: { nouveau?: boolean }) {
  const [voir, setVoir] = useState(false);
  return (
    <Champ label="Mot de passe" Icon={Lock} name="motDePasse" type={voir ? "text" : "password"} required
      autoComplete={nouveau ? "new-password" : "current-password"} aide={nouveau ? "8 caractères au moins" : undefined}
      apres={
        <button type="button" onClick={() => setVoir((v) => !v)} aria-pressed={voir} aria-label={voir ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center rounded-[10px] text-texte-2 transition-colors hover:bg-[color:var(--h-survol)] hover:text-encre focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))]">
          {voir ? <EyeOff aria-hidden="true" strokeWidth={1.6} className="size-5" /> : <Eye aria-hidden="true" strokeWidth={1.6} className="size-5" />}
        </button>
      } />
  );
}

/** Le grand bouton du modèle : coins de 12 à l'ordinateur, pilule au téléphone (les deux modèles). */
function Valider({ enCours, children }: { enCours: boolean; children: React.ReactNode }) {
  return (
    <button type="submit" disabled={enCours}
      className="flex h-14 w-full items-center justify-center rounded-full bg-[rgb(var(--sn-cta))] px-6 text-[16px] font-semibold text-white transition-[background-color,transform] hover:bg-[rgb(var(--sn-cta)/0.9)] active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--h-marque-texte))] disabled:opacity-60 lg:h-[52px] lg:rounded-[12px]">
      {children}
    </button>
  );
}

export function FormulaireConnexion() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(connecter, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      <div aria-live="polite" className="empty:hidden">{etat.erreur && <SAlert tone="error">{etat.erreur}</SAlert>}</div>
      <Champ label="Adresse e-mail" Icon={Mail} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
        defaultValue={etat.champs?.email ?? ""} required />
      <ChampMotDePasse />
      {/* Coché, la session tient sept jours, renouvelés à l'usage ; décoché, elle finit quand le navigateur se ferme
          (rememberMe de Better Auth). */}
      <label className="flex w-fit cursor-pointer items-center gap-3 py-0.5 text-[15px] leading-5 font-medium text-encre/90">
        <input type="checkbox" name="resterConnecte" defaultChecked className="size-[18px] cursor-pointer accent-[rgb(var(--sn-cta))]" />
        Rester connecté
      </label>
      <Valider enCours={enCours}>{enCours ? "Connexion en cours" : "Se connecter"}</Valider>
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
    <form action={action} className="space-y-5" noValidate>
      <div aria-live="polite" className="empty:hidden">{etat.erreur && <SAlert tone="error">{etat.erreur}</SAlert>}</div>

      <fieldset>
        <legend className="mb-2 pl-0.5 text-[14px] leading-5 font-semibold text-encre/95">Tu es</legend>
        <div className="grid grid-cols-3 gap-2">
          {QUI.map((q) => (
            <label key={q.id}
              className="flex h-[52px] cursor-pointer items-center justify-center rounded-[12px] bg-surface text-[15px] font-medium text-encre/90 shadow-[0_0_0_1px_var(--h-filet)] transition-colors has-[:checked]:bg-[rgb(var(--sn-cta))] has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[rgb(var(--h-marque-texte))]">
              <input type="radio" name="qui" value={q.id} checked={qui === q.id} onChange={() => setQui(q.id)} className="sr-only" />
              {q.nom}
            </label>
          ))}
        </div>
      </fieldset>

      <Champ label="Prénom et nom" Icon={User} name="nom" autoComplete="name" defaultValue={etat.champs?.nom ?? ""} required />
      {qui !== "parent" && (
        <Champ label={qui === "employe" ? "Service" : "Classe"} Icon={qui === "employe" ? Briefcase : GraduationCap} name="classe"
          aide="Tu peux laisser vide" defaultValue={etat.champs?.classe ?? ""} />
      )}
      <Champ label="Adresse e-mail" Icon={Mail} name="email" type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
        defaultValue={etat.champs?.email ?? ""} required />
      <ChampMotDePasse nouveau />
      <Valider enCours={enCours}>{enCours ? "Création en cours" : "Créer mon compte"}</Valider>
    </form>
  );
}
