"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "@/components/icons";
import { SAlert, SBtn, SCheckbox, SField, SInput } from "@/components/sneat";
import { ALLERGENES, REGIMES } from "@/lib/listes";
import { MARQUE } from "@/lib/marque";
import { RATE } from "@/app/(espace)/menu/annulation";
import { enregistrerProfil, enregistrerSeuil } from "./actions";

// Les réglages du compte : le profil alimentaire en cases à cocher, le seuil d'alerte, le code famille à copier.
// Chaque bloc enregistre à part, et dit en mots si c'est fait.

const CARTE = "rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4";
const majuscule = (texte: string) => texte.charAt(0).toUpperCase() + texte.slice(1);

type Retour = { ok: boolean; texte: string } | null;

/** Le bouton d'un bloc et ce qui s'est passé : « C'est noté », ou la raison du refus. */
function Enregistrer({ envoi, retour, type = "button", onClick }: { envoi: boolean; retour: Retour; type?: "button" | "submit"; onClick?: () => void }) {
  return (
    <div className="mt-4">
      <div aria-live="polite" className="empty:hidden">
        {retour && !retour.ok && <div className="mb-4"><SAlert tone="error">{retour.texte}</SAlert></div>}
      </div>
      <div className="flex items-center gap-3">
        <SBtn type={type} tone="secondary" disabled={envoi} onClick={onClick}>{envoi ? "Un instant" : "Enregistrer"}</SBtn>
        <p aria-live="polite" className="flex items-center gap-1 text-[14px] leading-5 text-texte-2">
          {retour?.ok && <><Check className="size-5" strokeWidth={1.8} aria-hidden="true" /> {retour.texte}</>}
        </p>
      </div>
    </div>
  );
}

export function ProfilAlimentaire({ allergenes, regimes }: { allergenes: string[]; regimes: string[] }) {
  const [coches, setCoches] = useState({ allergenes, regimes });
  const [retour, setRetour] = useState<Retour>(null);
  const [envoi, lancer] = useTransition();

  const basculer = (liste: "allergenes" | "regimes", id: string, oui: boolean) => {
    setRetour(null);
    setCoches((c) => ({ ...c, [liste]: oui ? [...c[liste], id] : c[liste].filter((v) => v !== id) }));
  };
  const enregistrer = () => lancer(async () => {
    try {
      const r = await enregistrerProfil(coches);
      setRetour(r.ok ? { ok: true, texte: "C'est noté" } : { ok: false, texte: r.erreur });
    } catch {
      setRetour({ ok: false, texte: RATE });
    }
  });

  return (
    <div className={CARTE}>
      <fieldset>
        <legend className="text-[14px] leading-5 font-semibold text-encre/95">Allergènes</legend>
        <div className="mt-1 grid grid-cols-2 gap-x-4">
          {ALLERGENES.map((a) => (
            <div key={a.id} className="[&>label]:h-11">
              <SCheckbox checked={coches.allergenes.includes(a.id)} onChange={(oui) => basculer("allergenes", a.id, oui)} label={majuscule(a.nom)} />
            </div>
          ))}
        </div>
      </fieldset>
      <fieldset className="mt-3">
        <legend className="text-[14px] leading-5 font-semibold text-encre/95">Régimes</legend>
        <div className="mt-1 grid grid-cols-2 gap-x-4">
          {REGIMES.map((r) => (
            <div key={r.id} className="[&>label]:h-11">
              <SCheckbox checked={coches.regimes.includes(r.id)} onChange={(oui) => basculer("regimes", r.id, oui)} label={majuscule(r.nom)} />
            </div>
          ))}
        </div>
      </fieldset>
      <p className="mt-3 text-[14px] leading-5 text-texte-2">
        D&apos;après ce que la cantine a déclaré : {MARQUE.nom} répète sa liste, elle ne garantit pas la composition des plats
      </p>
      <Enregistrer envoi={envoi} retour={retour} onClick={enregistrer} />
    </div>
  );
}

export function SeuilAlerte({ seuil }: { seuil: number }) {
  const [valeur, setValeur] = useState(String(seuil));
  const [retour, setRetour] = useState<Retour>(null);
  const [envoi, lancer] = useTransition();

  const enregistrer = () => {
    if (valeur === "") { setRetour({ ok: false, texte: "Écris un montant, ou zéro pour ne pas avoir d'alerte" }); return; }
    lancer(async () => {
      try {
        const r = await enregistrerSeuil(Number(valeur));
        setRetour(r.ok ? { ok: true, texte: "C'est noté" } : { ok: false, texte: r.erreur });
      } catch {
        setRetour({ ok: false, texte: RATE });
      }
    });
  };

  return (
    <form className={CARTE} onSubmit={(e) => { e.preventDefault(); enregistrer(); }} noValidate>
      <SField label="Préviens-moi quand mon solde passe sous" hint="Ton parent est prévenu lui aussi">
        <span className="relative block">
          <SInput name="seuil" inputMode="numeric" autoComplete="off" value={valeur} className="chiffres pr-20"
            onChange={(e) => { setRetour(null); setValeur(e.target.value.replace(/\D/g, "").slice(0, 6)); }} />
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] leading-5 text-texte-2">F CFA</span>
        </span>
      </SField>
      <Enregistrer envoi={envoi} retour={retour} type="submit" />
    </form>
  );
}

export function CodeFamille({ code }: { code: string }) {
  const [etat, setEtat] = useState<"repos" | "copie" | "echec">("repos");

  const copier = async () => {
    // Le presse-papiers ne répond qu'en https ou sur localhost : sinon, on le dit et le code se recopie à la main.
    try { await navigator.clipboard.writeText(code); setEtat("copie"); } catch { setEtat("echec"); }
    setTimeout(() => setEtat("repos"), 2500);
  };

  return (
    <div className={CARTE}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[24px] leading-8 font-medium tracking-[0.2em] text-encre/95 select-all">{code}</p>
        <SBtn variant="outlined" size="sm" onClick={copier}>
          {etat === "copie" ? <><Check className="size-4" strokeWidth={1.8} aria-hidden="true" /> Copié</> : <><Copy className="size-4" strokeWidth={1.8} aria-hidden="true" /> Copier</>}
        </SBtn>
      </div>
      <p aria-live="polite" className="mt-2 text-[14px] leading-5 text-texte-2">
        {etat === "echec" ? "La copie n'a pas marché, recopie-le à la main" : "Donne ce code à ton parent pour qu'il suive ton compte"}
      </p>
    </div>
  );
}
