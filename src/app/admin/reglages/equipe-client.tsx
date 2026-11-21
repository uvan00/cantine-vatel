"use client";

import { useState, useTransition } from "react";
import { useConfirmation } from "@/components/fenetre";
import { CheckCircle2 } from "@/components/icons";
import { SAlert, SBtn, SField, SInput, STitreSection } from "@/components/sneat";
import type { MembreEquipe } from "@/lib/donnees-cantine";
import { MOT_DE_PASSE_MIN } from "@/lib/equipe";
import { nomDuRole } from "@/lib/roles";
import { activerResponsable, ajouterUnResponsable, changerMotDePasse } from "./equipe-actions";

// L'équipe de la cantine, dans les Réglages (demande du propriétaire du 21/11/2026) : l'admin voit qui a accès, crée
// un responsable de cantine (il tient le comptoir : scanner, espèces, sa caisse du jour), le désactive quand il part, ou
// lui donne un nouveau mot de passe. Ce qu'un responsable a encaissé et servi reste à son nom.

const VIDE = { nom: "", email: "", motDePasse: "" };
const PANNE = { ok: false as const, erreur: "Le serveur ne répond pas, réessaie" };

export function EquipeClient({ membres, moiId }: { membres: MembreEquipe[]; moiId: string }) {
  const [nouveau, setNouveau] = useState(VIDE);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [changement, setChangement] = useState<{ id: string; motDePasse: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const { confirmer, fenetre } = useConfirmation();

  const dire = (ok: boolean, texte: string) => setMessage({ ok, texte });

  const ajouter = () => demarrer(async () => {
    const r = await ajouterUnResponsable(nouveau).catch(() => PANNE);
    if (r.ok) { dire(true, `${nouveau.nom.trim()} peut se connecter avec ${nouveau.email.trim().toLowerCase()} et le mot de passe que tu lui donnes`); setNouveau(VIDE); }
    else dire(false, r.erreur);
  });

  const basculer = async (m: MembreEquipe) => {
    if (m.actif && !(await confirmer({
      titre: `Désactiver ${m.nom} ?`,
      message: "Ses sessions se ferment tout de suite et il ne peut plus se connecter. Ce qu'il a encaissé et servi reste à son nom. Tu pourras le réactiver.",
      libelle: "Désactiver", corbeille: false,
    }))) return;
    demarrer(async () => {
      const r = await activerResponsable(m.id, !m.actif).catch(() => PANNE);
      dire(r.ok, r.ok ? (m.actif ? `${m.nom} est désactivé` : `${m.nom} peut de nouveau se connecter`) : r.erreur);
    });
  };

  const enregistrerMotDePasse = (m: MembreEquipe) => demarrer(async () => {
    if (!changement) return;
    const r = await changerMotDePasse(m.id, changement.motDePasse).catch(() => PANNE);
    if (r.ok) { setChangement(null); dire(true, `Nouveau mot de passe enregistré pour ${m.nom} : ses sessions sont fermées`); }
    else dire(false, r.erreur);
  });

  return (
    <section id="equipe" className="max-w-[720px] scroll-mt-6 space-y-4">
      <STitreSection>L&apos;équipe de la cantine</STitreSection>
      <p className="text-[14px] leading-5 text-texte-2">
        Le responsable de cantine tient le comptoir : il scanne les tickets, encaisse les espèces et voit sa caisse du jour.
        Il ne voit ni l&apos;argent de la cantine, ni les menus, ni les réglages.
      </p>

      <ul className="divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
        {membres.map((m) => (
          <li key={m.id} className="px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="min-w-0">
                <p className="text-[15px] leading-5 text-encre/95">
                  {m.nom}{m.id === moiId && <span className="text-texte-2"> (toi)</span>}
                </p>
                <p className="text-[13px] leading-5 text-texte-2">{nomDuRole(m.role)}, {m.email}{m.actif ? "" : ", désactivé"}</p>
              </div>
              {m.role === "responsable" && (
                <div className="flex flex-wrap gap-2">
                  <SBtn variant="outlined" tone="secondary" size="sm" disabled={enCours}
                    onClick={() => setChangement(changement?.id === m.id ? null : { id: m.id, motDePasse: "" })}>
                    Nouveau mot de passe
                  </SBtn>
                  <SBtn variant="outlined" tone="secondary" size="sm" disabled={enCours} onClick={() => void basculer(m)}>
                    {m.actif ? "Désactiver" : "Réactiver"}
                  </SBtn>
                </div>
              )}
            </div>
            {changement?.id === m.id && (
              <div className="mt-3 flex flex-wrap items-end gap-2">
                <SField label={`Nouveau mot de passe de ${m.nom}`} hint={`Au moins ${MOT_DE_PASSE_MIN} caractères ; donne-le lui de vive voix`} className="min-w-[240px] flex-1">
                  <SInput type="text" autoComplete="new-password" value={changement.motDePasse}
                    onChange={(e) => setChangement({ id: m.id, motDePasse: e.target.value })} />
                </SField>
                <SBtn tone="secondary" disabled={enCours || changement.motDePasse.length < MOT_DE_PASSE_MIN} onClick={() => enregistrerMotDePasse(m)}>
                  {enCours ? "Un instant" : "Enregistrer"}
                </SBtn>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="space-y-4 rounded-[16px] border border-[color:var(--h-filet)] p-4">
        <p className="text-[15px] leading-5 font-medium text-encre/95">Ajouter un responsable de cantine</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SField label="Son nom">
            <SInput value={nouveau.nom} autoComplete="off" onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })} />
          </SField>
          <SField label="Son e-mail">
            <SInput type="email" inputMode="email" autoComplete="off" value={nouveau.email} onChange={(e) => setNouveau({ ...nouveau, email: e.target.value })} />
          </SField>
          <SField label="Son mot de passe" hint={`Au moins ${MOT_DE_PASSE_MIN} caractères ; donne-le lui de vive voix`} className="sm:col-span-2">
            <SInput type="text" autoComplete="new-password" value={nouveau.motDePasse} onChange={(e) => setNouveau({ ...nouveau, motDePasse: e.target.value })} />
          </SField>
        </div>
        <SBtn tone="secondary" disabled={enCours || !nouveau.nom.trim() || !nouveau.email.trim() || nouveau.motDePasse.length < MOT_DE_PASSE_MIN} onClick={ajouter}>
          {enCours ? "Un instant" : "Ajouter le responsable"}
        </SBtn>
      </div>

      <div aria-live="polite">
        {message && (message.ok ? <SAlert tone="success" Icon={CheckCircle2}>{message.texte}</SAlert> : <SAlert tone="error">{message.texte}</SAlert>)}
      </div>
      {fenetre}
    </section>
  );
}
