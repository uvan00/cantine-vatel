"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fenetre, useConfirmation } from "@/components/fenetre";
import { Plus, Trash2 } from "@/components/icons";
import { SAlert, SBtn, SField, SInput, SSelect } from "@/components/sneat";
import { CATEGORIES, MOYENS_DEPENSE, libelleCategorie, libelleMoyenDepense } from "@/lib/comptabilite";
import type { LigneDepense } from "@/lib/donnees-compta";
import { fcfa } from "@/lib/format";
import { jourLong } from "@/lib/jours";
import { noterDepense, supprimerDepense } from "./actions";

// Les dépenses de la période : « Noter une dépense » ouvre la fenêtre de saisie ; chaque dépense se retire si elle a
// été notée par erreur (avec confirmation).

export function DepensesClient({ depenses, aujourdhui }: { depenses: LigneDepense[]; aujourdhui: string }) {
  const router = useRouter();
  const [ouverte, setOuverte] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const { confirmer, fenetre } = useConfirmation();

  const retirer = async (d: LigneDepense) => {
    const ok = await confirmer({ titre: "Retirer cette dépense ?", message: `« ${d.libelle} », ${fcfa(d.montant)}, du ${jourLong(d.jour)}. Elle sort du bilan.`, libelle: "Retirer" });
    if (!ok) return;
    demarrer(async () => {
      const r = await supprimerDepense(d.id).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
      if (r.ok) router.refresh(); else setErreur(r.erreur);
    });
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[18px] leading-6">Les dépenses notées</h2>
        <SBtn size="sm" tone="secondary" className="print:hidden" onClick={() => setOuverte(true)}><Plus className="size-4" strokeWidth={1.8} />Noter une dépense</SBtn>
      </div>
      <div aria-live="polite" className="empty:hidden">{erreur && <SAlert tone="error">{erreur}</SAlert>}</div>
      {depenses.length === 0 ? (
        <p className="rounded-[16px] border border-dashed border-[color:var(--h-filet)] px-4 py-8 text-center text-[14px] leading-5 text-texte-2">
          Aucune dépense notée sur cette période. Note chaque achat ici : il entre tout seul dans le bilan.
        </p>
      ) : (
        <ul className={`divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface ${enCours ? "opacity-60" : ""}`}>
          {depenses.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] leading-5 font-medium text-encre/95">{d.libelle}</p>
                <p className="truncate text-[13px] leading-5 text-texte-2 first-letter:uppercase">
                  {jourLong(d.jour)}, {libelleCategorie(d.categorie).toLocaleLowerCase("fr")}, {libelleMoyenDepense(d.moyen).toLocaleLowerCase("fr")}{d.fournisseur && `, ${d.fournisseur}`}
                </p>
              </div>
              <p className="chiffres shrink-0 text-[15px] leading-5 font-semibold text-encre/95">{fcfa(d.montant)}</p>
              <SBtn size="sm" variant="text" tone="secondary" className="shrink-0 px-2 print:hidden" aria-label={`Retirer la dépense « ${d.libelle} »`} onClick={() => void retirer(d)}>
                <Trash2 className="size-4" strokeWidth={1.8} />
              </SBtn>
            </li>
          ))}
        </ul>
      )}
      {ouverte && <FenetreDepense aujourdhui={aujourdhui} onClose={() => setOuverte(false)} onFait={() => { setOuverte(false); router.refresh(); }} />}
      {fenetre}
    </section>
  );
}

function FenetreDepense({ aujourdhui, onClose, onFait }: { aujourdhui: string; onClose: () => void; onFait: () => void }) {
  const [jour, setJour] = useState(aujourdhui);
  const [categorie, setCategorie] = useState<string>("ingredients");
  const [libelle, setLibelle] = useState("");
  const [montant, setMontant] = useState("");
  const [fournisseur, setFournisseur] = useState("");
  const [moyen, setMoyen] = useState<string>("especes");
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  const noter = () => demarrer(async () => {
    setErreur(null);
    const r = await noterDepense({ jour, categorie, libelle, montant: Number(montant), fournisseur, moyen })
      .catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
    if (r.ok) onFait(); else setErreur(r.erreur);
  });

  return (
    <Fenetre titre="Noter une dépense" sousTitre="Ce que la cantine a payé : elle entre tout de suite dans le bilan" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SField label="Payée le"><SInput type="date" value={jour} max={aujourdhui} onChange={(e) => setJour(e.target.value)} /></SField>
          <SField label="Catégorie">
            <SSelect value={categorie} onChange={(e) => setCategorie(e.target.value)}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.libelle}</option>)}
            </SSelect>
          </SField>
        </div>
        <SField label="Ce qui a été payé"><SInput value={libelle} maxLength={120} placeholder="Riz, sac de 25 kg" onChange={(e) => setLibelle(e.target.value)} /></SField>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SField label="Montant, en F CFA">
            <SInput inputMode="numeric" className="chiffres" value={montant} placeholder="18500" onChange={(e) => setMontant(e.target.value.replace(/\D/g, "").slice(0, 8))} />
          </SField>
          <SField label="Payée en">
            <SSelect value={moyen} onChange={(e) => setMoyen(e.target.value)}>
              {MOYENS_DEPENSE.map((m) => <option key={m.id} value={m.id}>{m.libelle}</option>)}
            </SSelect>
          </SField>
        </div>
        <SField label="Fournisseur" hint="Tu peux laisser vide"><SInput value={fournisseur} maxLength={80} placeholder="Marché d'Adjamé" onChange={(e) => setFournisseur(e.target.value)} /></SField>
        <div aria-live="polite" className="empty:hidden">{erreur && <SAlert tone="error">{erreur}</SAlert>}</div>
        <SBtn tone="secondary" block disabled={enCours || !libelle.trim() || !montant} onClick={noter}>{enCours ? "Un instant" : "Noter la dépense"}</SBtn>
      </div>
    </Fenetre>
  );
}
