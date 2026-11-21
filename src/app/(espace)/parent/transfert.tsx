"use client";

import { useState, useTransition } from "react";
import { CheckCircle2 } from "@/components/icons";
import { SAlert, SBtn, SField, SInput, SSelect } from "@/components/sneat";
import { fcfa } from "@/lib/format";
import { refusTransfert } from "@/lib/solde";
import { transferer } from "./actions";

// Faire passer de l'argent du compte d'un enfant à celui d'un autre (bonus du lot 2), sans
// nouvelle recharge. Le serveur relit les soldes et refuse ce qui ne passe pas, par la
// même règle (refusTransfert de src/lib/solde.ts).

export type EnfantSolde = { id: string; prenom: string; solde: number };

export function Transfert({ enfants }: { enfants: EnfantSolde[] }) {
  const [de, setDe] = useState(enfants[0].id);
  const [vers, setVers] = useState(enfants[1].id);
  const [montant, setMontant] = useState("");
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [envoi, lancer] = useTransition();
  const source = enfants.find((e) => e.id === de) ?? enfants[0];

  const changerDe = (id: string) => {
    setDe(id);
    if (id === vers) setVers(enfants.find((e) => e.id !== id)?.id ?? vers);
    setRetour(null);
  };

  const envoyer = () => {
    const n = Number(montant);
    const refus = refusTransfert({ montant: n, soldeSource: source.solde, memeCompte: de === vers });
    if (refus) { setRetour({ ok: false, texte: refus }); return; }
    lancer(async () => {
      const r = await transferer({ deId: de, versId: vers, montant: n }).catch(() => ({ ok: false as const, erreur: "Le serveur ne répond pas, réessaie" }));
      if (r.ok) { setMontant(""); setRetour({ ok: true, texte: r.message }); } else setRetour({ ok: false, texte: r.erreur });
    });
  };

  return (
    <form className="rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4" onSubmit={(e) => { e.preventDefault(); envoyer(); }} noValidate>
      <div className="grid grid-cols-2 gap-3">
        <SField label="Depuis">
          <SSelect value={de} onChange={(e) => changerDe(e.target.value)}>
            {enfants.map((e) => <option key={e.id} value={e.id}>{e.prenom}</option>)}
          </SSelect>
        </SField>
        <SField label="Vers">
          <SSelect value={vers} onChange={(e) => { setVers(e.target.value); setRetour(null); }}>
            {enfants.filter((e) => e.id !== de).map((e) => <option key={e.id} value={e.id}>{e.prenom}</option>)}
          </SSelect>
        </SField>
      </div>
      <SField label="Montant" className="mt-4" hint={<span className="chiffres">{source.prenom} a {fcfa(source.solde)}</span>}>
        <span className="relative block">
          <SInput name="montant" inputMode="numeric" autoComplete="off" value={montant} className="chiffres pr-20"
            onChange={(e) => { setRetour(null); setMontant(e.target.value.replace(/\D/g, "").slice(0, 7)); }} />
          <span aria-hidden="true" className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-[14px] leading-5 text-texte-2">F CFA</span>
        </span>
      </SField>
      <div aria-live="polite" className="mt-4 empty:hidden">
        {retour && (retour.ok ? <SAlert tone="success" Icon={CheckCircle2}>{retour.texte}</SAlert> : <SAlert tone="error">{retour.texte}</SAlert>)}
      </div>
      <SBtn type="submit" tone="secondary" block className="mt-4" disabled={envoi || montant === ""}>
        {envoi ? "Un instant" : montant ? <span className="chiffres">Faire passer {fcfa(Number(montant))}</span> : "Faire passer"}
      </SBtn>
    </form>
  );
}
