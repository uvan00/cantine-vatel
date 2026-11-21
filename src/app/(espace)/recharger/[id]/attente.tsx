"use client";

import { useState, useTransition } from "react";
import { useConfirmation } from "@/components/fenetre";
import { Check, Info } from "@/components/icons";
import { PaiementMobileMoney } from "@/components/paiement-mobile-money";
import { QrRecharge } from "@/components/qr-recharge";
import { SAlert, SBtn, SBtnLink, SChip } from "@/components/sneat";
import { useDirect } from "@/hooks/use-direct";
import type { RechargeEnDirect } from "@/lib/donnees-parent";
import { fcfa } from "@/lib/format";
import { LIBELLE_ETAT_RECHARGE } from "@/lib/recharge";
import { annulerMaRecharge } from "../actions";

// La page d'une recharge, comme un checkout, relue toutes les 3 secondes : tant qu'elle attend, la liste des moyens de
// paiement (le Mobile Money par Cartflox quand il est branché, comme dans LinkAfr, et le QR universel en dernière ligne),
// puis « Annuler la demande », en discret ; dès que le paiement est confirmé, « C'est payé » et le nouveau solde.
// Le montant, pour qui et la référence sont en tête de page (page.tsx). Rien ici ne décide : l'état vient du serveur,
// qui relit chaque paiement.

/** Ce que la page sait du paiement en ligne : son mode, jamais une clé. */
export type CartfloxPage = { mode: "test" | "live" };

export function Attente({ id, initial, montant, reference, qr, qrAvecMontant, cartflox, aMoi, soldeDeQui, retour, nouvelle }: {
  id: string;
  initial: RechargeEnDirect;
  montant: number;
  reference: string;
  /** Le QR de paiement en SVG ; null si la cantine n'a pas encore posé son adresse de paiement. */
  qr: string | null;
  /** Faux : le QR ne porte pas le montant, le payeur le tape. */
  qrAvecMontant: boolean;
  /** Le paiement Mobile Money par Cartflox ; null quand il n'est pas branché (le QR universel reste alors seul). */
  cartflox: CartfloxPage | null;
  /** Vrai pour celui qui a demandé la recharge : lui seul peut l'annuler. */
  aMoi: boolean;
  /** « Ton nouveau solde », « Nouveau solde d'Ismaël » */
  soldeDeQui: string;
  retour: { href: string; libelle: string };
  /** Où refaire une demande, après une annulation. */
  nouvelle: string;
}) {
  const [direct, relire] = useDirect<RechargeEnDirect>(`/api/recharge/${id}`, initial, 3000);
  const { confirmer, fenetre } = useConfirmation();
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();
  const { etat } = direct;

  const annuler = async () => {
    const oui = await confirmer({
      titre: "Annuler cette demande ?",
      message: "Si tu as déjà payé, ne l'annule pas : la cantine ne pourrait plus la confirmer, et l'argent n'arriverait pas sur le compte.",
      libelle: "Oui, annuler",
      refus: "Non, je la garde",
      corbeille: false,
    });
    if (!oui) return;
    setErreur(null);
    demarrer(async () => {
      const r = await annulerMaRecharge(id);
      if (!r.ok) setErreur(r.erreur);
      await relire();
    });
  };

  const qrUniversel = qr ? <QrRecharge svg={qr} reference={reference} montantATaper={qrAvecMontant ? undefined : fcfa(montant)} /> : null;

  return (
    <>
      {/* Toujours là, pour qu'un lecteur d'écran entende la fin : « C'est payé », « Demande annulée ». */}
      <p className="sr-only" aria-live="polite">{etat === "confirmee" ? "C'est payé, le paiement est arrivé sur le compte" : etat === "annulee" ? "Demande annulée" : ""}</p>

      {etat === "en_attente" && cartflox && (
        <section className="px-4" aria-label="Payer">
          {cartflox.mode === "test" && <div className="mb-4"><SChip tone="warning" size="sm">Mode essai, aucun argent réel</SChip></div>}
          <PaiementMobileMoney rechargeId={id} montant={montant} onVerifie={relire} qr={qrUniversel} />
        </section>
      )}

      {etat === "en_attente" && !cartflox && (
        <>
          <section className="px-4" aria-live="polite">
            <SChip tone="warning">{LIBELLE_ETAT_RECHARGE.en_attente}</SChip>
            <p className="mt-2 text-[15px] leading-6 text-texte-2">La cantine confirme à la main, après avoir vu le paiement arriver. Cette page se met à jour toute seule.</p>
          </section>
          {qrUniversel ? (
            <section className="mt-6 bg-[var(--h-fond-2)] px-4 py-6">{qrUniversel}</section>
          ) : (
            <section className="mt-6 px-4">
              <SAlert Icon={Info}>
                Paie en espèces au comptoir de la cantine en donnant la référence <span className="font-mono font-medium">{reference}</span> : elle crédite le compte tout de suite.
              </SAlert>
            </section>
          )}
        </>
      )}

      {etat === "en_attente" && aMoi && (
        <section className="mt-8 px-4 text-center">
          {erreur && <div className="mb-3 text-left"><SAlert tone="error">{erreur}</SAlert></div>}
          <SBtn type="button" tone="secondary" variant="text" size="sm" className="text-texte-2" disabled={enCours} onClick={annuler}>
            {enCours ? "Un instant" : "Annuler la demande"}
          </SBtn>
        </section>
      )}

      {etat === "confirmee" && (
        <section className="sn-fondu px-4">
          <div className="flex flex-col items-center rounded-[16px] bg-surface px-4 py-8 text-center shadow-[inset_0_0_0_1px_var(--h-filet)]">
            <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-[rgb(var(--h-marque-teinte)/var(--h-teinte))] text-marque-texte">
              <Check className="size-7" strokeWidth={1.8} />
            </span>
            <p className="mt-4 text-[20px] leading-7 font-medium text-encre/95">C&apos;est payé</p>
            <p className="mt-1 text-[15px] leading-6 text-texte-2">Le paiement est arrivé, c&apos;est sur le compte</p>
            <div className="mt-6 w-full border-t border-[color:var(--h-filet)] pt-5">
              <p className="text-[14px] leading-5 text-texte-2">{soldeDeQui}</p>
              <p className="chiffres mt-1 text-[32px] leading-10 font-medium text-encre/95">{fcfa(direct.solde)}</p>
            </div>
          </div>
          <SBtnLink href={retour.href} tone="secondary" block className="mt-4 min-h-12 text-[16px]">{retour.libelle}</SBtnLink>
        </section>
      )}

      {etat === "annulee" && (
        <section className="px-4">
          <div className="rounded-[16px] bg-surface p-4 shadow-[inset_0_0_0_1px_var(--h-filet)]">
            <p className="text-[16px] leading-6 font-medium text-encre/95">Demande annulée</p>
            <p className="mt-1 text-[14px] leading-5 text-texte-2">La cantine ne confirmera pas cette demande. Si tu avais déjà payé, passe au comptoir avec la référence.</p>
          </div>
          <div className="mt-4 grid gap-2">
            <SBtnLink href={nouvelle} tone="secondary" block className="min-h-12 text-[16px]">Faire une autre demande</SBtnLink>
            <SBtnLink href={retour.href} tone="secondary" variant="text" block>{retour.libelle}</SBtnLink>
          </div>
        </section>
      )}

      {fenetre}
    </>
  );
}
