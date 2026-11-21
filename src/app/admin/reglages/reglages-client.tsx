"use client";

import { useState, useTransition } from "react";
import { EnTetePage } from "@/components/fenetre";
import { CheckCircle2 } from "@/components/icons";
import { SAlert, SBtn, SField, SInput, SSelect, SSwitch, STitreSection } from "@/components/sneat";
import { creneauLisible, creneauxEntre } from "@/lib/creneaux";
import { liste } from "@/lib/format";
import { HEURES_CLOTURE, PAS_CRENEAUX, erreurReglages, type Reglages } from "@/lib/reglages";
import { enregistrer } from "./actions";

// Les réglages de la cantine. L'heure de clôture (l'heure limite de commande) et les heures de passage
// (une capacité par créneau). Le serveur revalide tout avant d'écrire.

/** Les heures proposées pour le service : de 10 h à 15 h, tous les quarts d'heure. */
const HEURES_SERVICE = Array.from({ length: 21 }, (_, i) => {
  const m = 10 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

export function ReglagesClient({ initial }: { initial: Reglages }) {
  const [r, setR] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const changer = (p: Partial<Reglages>) => { setR((avant) => ({ ...avant, ...p })); setMessage(null); };

  const heures = creneauxEntre(r.creneauDebut, r.creneauFin, r.creneauMinutes);
  const erreur = erreurReglages(r);

  const enregistrerTout = () => demarrer(async () => {
    const res = await enregistrer(r).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
    setMessage(res.ok ? { ok: true, texte: "Réglages enregistrés : ils comptent dès maintenant" } : { ok: false, texte: res.erreur });
  });

  return (
    <div className="max-w-[720px] space-y-8">
      <EnTetePage titre="Réglages" sousTitre="L'heure de clôture des réservations et les heures de passage" />

      <section className="space-y-4">
        <STitreSection>Réservations</STitreSection>
        <SField label="Les réservations du jour ferment à" hint="La cuisine sait alors combien de repas préparer. Après cette heure, l'élève peut encore demander un repas, que tu acceptes ou refuses">
          <SSelect value={String(r.heureCloture)} onChange={(e) => changer({ heureCloture: Number(e.target.value) })}>
            {HEURES_CLOTURE.map((h) => <option key={h} value={h}>{h} h</option>)}
          </SSelect>
        </SField>
      </section>

      <section className="space-y-4">
        <STitreSection>Heures de passage</STitreSection>
        <SSwitch checked={r.creneauxActifs} onChange={(v) => changer({ creneauxActifs: v })} label="Proposer des heures de passage"
          hint="En réservant, l'élève choisit quand il passe : la file s'étale sur tout le service" />
        {r.creneauxActifs && (
          <div className="grid gap-4 sm:grid-cols-2">
            <SField label="Premier passage">
              <SSelect value={r.creneauDebut} onChange={(e) => changer({ creneauDebut: e.target.value })}>
                {HEURES_SERVICE.map((h) => <option key={h} value={h}>{creneauLisible(h)}</option>)}
              </SSelect>
            </SField>
            <SField label="Fin du service">
              <SSelect value={r.creneauFin} onChange={(e) => changer({ creneauFin: e.target.value })}>
                {HEURES_SERVICE.map((h) => <option key={h} value={h}>{creneauLisible(h)}</option>)}
              </SSelect>
            </SField>
            <SField label="Un passage toutes les">
              <SSelect value={String(r.creneauMinutes)} onChange={(e) => changer({ creneauMinutes: Number(e.target.value) })}>
                {PAS_CRENEAUX.map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </SSelect>
            </SField>
            <SField label="Élèves au plus par passage">
              <SInput inputMode="numeric" value={String(r.creneauCapacite)} className="chiffres"
                onChange={(e) => changer({ creneauCapacite: Number(e.target.value.replace(/\D/g, "").slice(0, 4) || "0") })} />
            </SField>
            <p className="chiffres text-[14px] leading-5 text-texte-2 sm:col-span-2">
              {heures.length > 0
                ? `${heures.length} passages : ${liste(heures.map(creneauLisible))}, soit ${(heures.length * r.creneauCapacite).toLocaleString("fr-FR")} élèves au plus`
                : "Le service doit finir après son premier passage"}
            </p>
          </div>
        )}
      </section>

      <div className="space-y-3" aria-live="polite">
        {message && (message.ok ? <SAlert tone="success" Icon={CheckCircle2}>{message.texte}</SAlert> : <SAlert tone="error">{message.texte}</SAlert>)}
        {!message && erreur && <SAlert tone="warning">{erreur}</SAlert>}
        <SBtn tone="secondary" disabled={enCours || erreur !== null} onClick={enregistrerTout}>{enCours ? "Un instant" : "Enregistrer"}</SBtn>
      </div>
    </div>
  );
}
