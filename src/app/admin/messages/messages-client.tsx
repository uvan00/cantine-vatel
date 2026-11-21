"use client";

import { useState, useTransition } from "react";
import { EnTetePage, useConfirmation } from "@/components/fenetre";
import { CheckCircle2, Trash2 } from "@/components/icons";
import { SAlert, SBtn, SChip, SField, SIconBtn, SInput, SSelect, SSwitch, STextarea, STitreSection } from "@/components/sneat";
import type { MessageEnvoye } from "@/lib/donnees-messages";
import { pluriel } from "@/lib/format";
import { CIBLES, LIBELLE_CIBLE, TEXTE_MAX, TITRE_MAX, refusMessage, type Cible } from "@/lib/messages";
import { envoyer, retirer } from "./actions";

// Les messages de la cantine (bonus du lot 2) : écrire aux élèves, au
// personnel et aux parents, épingler ce qui doit rester en haut, voir combien de personnes l'ont lu. Ils le lisent dans
// l'onglet « Messages » de l'application, avec une pastille tant qu'ils ne l'ont pas ouvert.

const VIDE = { titre: "", texte: "", cible: "tous" as Cible, epingle: false };
const RATE = "Le serveur ne répond pas, réessaie";

export function MessagesClient({ messages }: { messages: MessageEnvoye[] }) {
  const [m, setM] = useState(VIDE);
  const [retour, setRetour] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, demarrer] = useTransition();
  const { confirmer, fenetre } = useConfirmation();
  const changer = (p: Partial<typeof VIDE>) => { setM((avant) => ({ ...avant, ...p })); setRetour(null); };

  const envoyerMessage = () => {
    const refus = refusMessage(m);
    if (refus) { setRetour({ ok: false, texte: refus }); return; }
    demarrer(async () => {
      const r = await envoyer(m).catch(() => ({ ok: false as const, erreur: RATE }));
      if (r.ok) { setM(VIDE); setRetour({ ok: true, texte: "Message envoyé : il est dans l'onglet Messages de l'application" }); }
      else setRetour({ ok: false, texte: r.erreur });
    });
  };

  const retirerMessage = async (x: MessageEnvoye) => {
    const oui = await confirmer({ titre: "Retirer ce message ?", message: `« ${x.titre} » disparaît de l'onglet Messages de chacun.`, libelle: "Retirer", refus: "Le garder" });
    if (!oui) return;
    demarrer(async () => {
      const r = await retirer(x.id).catch(() => ({ ok: false as const, erreur: RATE }));
      setRetour(r.ok ? { ok: true, texte: "Message retiré" } : { ok: false, texte: r.erreur });
    });
  };

  return (
    <div className="max-w-[720px] space-y-8">
      <EnTetePage titre="Messages" sousTitre="Écris aux élèves, au personnel et aux parents : ils le lisent dans l'onglet Messages de l'application" />

      <section className="space-y-4">
        <STitreSection>Écrire un message</STitreSection>
        <SField label="Titre">
          <SInput value={m.titre} maxLength={TITRE_MAX} onChange={(e) => changer({ titre: e.target.value })} />
        </SField>
        <SField label="Message">
          <STextarea value={m.texte} maxLength={TEXTE_MAX} rows={4} onChange={(e) => changer({ texte: e.target.value })} />
        </SField>
        <SField label="Pour qui">
          <SSelect value={m.cible} onChange={(e) => changer({ cible: e.target.value as Cible })}>
            {CIBLES.map((c) => <option key={c} value={c}>{LIBELLE_CIBLE[c]}</option>)}
          </SSelect>
        </SField>
        <SSwitch checked={m.epingle} onChange={(v) => changer({ epingle: v })} label="Épingler en haut" hint="Il reste au-dessus des autres messages tant que tu ne le retires pas" />
        <div className="space-y-3" aria-live="polite">
          {retour && (retour.ok ? <SAlert tone="success" Icon={CheckCircle2}>{retour.texte}</SAlert> : <SAlert tone="error">{retour.texte}</SAlert>)}
          <SBtn tone="secondary" disabled={enCours} onClick={envoyerMessage}>{enCours ? "Un instant" : "Envoyer"}</SBtn>
        </div>
      </section>

      <section className="space-y-4">
        <STitreSection>Messages envoyés</STitreSection>
        {messages.length === 0 ? (
          <p className="text-[14px] leading-5 text-texte-2">Aucun message pour l&apos;instant</p>
        ) : (
          <ul className="divide-y divide-[color:var(--h-filet)] overflow-hidden rounded-[16px] border border-[color:var(--h-filet)] bg-surface">
            {messages.map((x) => (
              <li key={x.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[16px] leading-6">{x.titre}</h3>
                      {x.epingle && <SChip size="sm" tone="secondary">Épinglé</SChip>}
                    </div>
                    <p className="chiffres mt-0.5 text-[13px] leading-5 text-texte-2">{x.quand}, pour {LIBELLE_CIBLE[x.cible].toLowerCase()}</p>
                  </div>
                  <SIconBtn label="Retirer ce message" disabled={enCours} onClick={() => retirerMessage(x)}><Trash2 className="size-5" strokeWidth={1.8} /></SIconBtn>
                </div>
                <p className="mt-2 text-[14px] leading-5 whitespace-pre-line text-encre/90">{x.texte}</p>
                <p className="chiffres mt-2 text-[13px] leading-5 text-texte-2">{x.lus === 0 ? "Personne ne l'a encore lu" : `Lu par ${pluriel(x.lus, "personne")}`}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {fenetre}
    </div>
  );
}
