"use client";

import { useState, useTransition } from "react";
import { BadgeCantine, type DonneesBadge } from "@/components/badge-cantine";
import { EnTetePage, useConfirmation } from "@/components/fenetre";
import { IdCard, Printer } from "@/components/icons";
import { SAlert, SBtn, SEmpty, SField, SInput, SSelect } from "@/components/sneat";
import { pluriel } from "@/lib/format";
import { refaireBadge } from "./actions";

// Les badges à l'écran et à l'impression : on choisit une classe ou une personne, « Imprimer » sort les badges choisis,
// quatre par feuille A4 couchée, recto et verso côte à côte à plier sur le pointillé.

const TOUTES = "__toutes__";

export function BadgesClient({ badges }: { badges: DonneesBadge[] }) {
  const [classe, setClasse] = useState(TOUTES);
  const [cherche, setCherche] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [, demarrer] = useTransition();
  const { confirmer, fenetre } = useConfirmation();

  const classes = [...new Set(badges.map((b) => b.classe).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  const mot = cherche.trim().toLocaleLowerCase("fr");
  const choisis = badges.filter((b) => (classe === TOUTES || b.classe === classe) && (!mot || b.nom.toLocaleLowerCase("fr").includes(mot)));

  // La question d'abord, hors transition : une transition n'affiche rien avant sa fin.
  const refaire = async (b: DonneesBadge) => {
    const oui = await confirmer({
      titre: "Refaire ce badge ?",
      message: `Le badge de ${b.nom} est perdu, prêté ou abîmé : son ancien QR ne passera plus au comptoir, et un nouveau badge sera à imprimer.`,
      libelle: "Refaire le badge",
      corbeille: false,
    });
    if (!oui) return;
    demarrer(async () => {
      setErreur(null);
      const r = await refaireBadge(b.id).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
      if (!r.ok) setErreur(r.erreur);
    });
  };

  return (
    <div className="w-full space-y-6">
      {/* Quatre badges par feuille A4 couchée ; seule cette page règle la feuille. */}
      <style>{"@media print { @page { size: A4 landscape; margin: 8mm; } }"}</style>
      <div className="space-y-6 print:hidden">
        <EnTetePage titre="Badges" sousTitre="Le badge de chaque élève et de chaque employé : au comptoir, un scan et il est servi, avec ou sans réservation"
          actions={<SBtn size="sm" tone="secondary" disabled={choisis.length === 0} onClick={() => window.print()}><Printer className="size-4" strokeWidth={1.8} />Imprimer {pluriel(choisis.length, "badge")}</SBtn>} />
        <div className="grid grid-cols-1 gap-4 @xl/page:grid-cols-[minmax(0,240px)_minmax(0,320px)]">
          <SField label="Classe ou service">
            <SSelect value={classe} onChange={(e) => setClasse(e.target.value)}>
              <option value={TOUTES}>Tout le monde</option>
              {classes.map((c) => <option key={c} value={c}>{c}</option>)}
            </SSelect>
          </SField>
          <SField label="Chercher quelqu'un">
            <SInput value={cherche} onChange={(e) => setCherche(e.target.value)} placeholder="Awa" autoComplete="off" />
          </SField>
        </div>
        <p className="text-[14px] leading-5 text-texte-2">
          Imprime en taille réelle, découpe autour, plie sur le pointillé : les deux faces tiennent dans un porte-badge de 54 mm sur 86 mm.
        </p>
        <div aria-live="polite" className="empty:hidden">{erreur && <SAlert tone="error">{erreur}</SAlert>}</div>
      </div>

      {choisis.length === 0 ? (
        <div className="sn-card print:hidden"><SEmpty Icon={IdCard} title="Aucun badge ici" hint="Change de classe, ou efface la recherche" /></div>
      ) : (
        <ul className="flex flex-wrap gap-6 print:gap-[6mm]">
          {choisis.map((b) => (
            <li key={b.id} className="break-inside-avoid">
              <BadgeCantine badge={b} />
              <div className="mt-2 flex justify-end print:hidden">
                <SBtn size="sm" variant="text" tone="secondary" onClick={() => void refaire(b)} aria-label={`Refaire le badge de ${b.nom}`}>Badge perdu : le refaire</SBtn>
              </div>
            </li>
          ))}
        </ul>
      )}
      {fenetre}
    </div>
  );
}
