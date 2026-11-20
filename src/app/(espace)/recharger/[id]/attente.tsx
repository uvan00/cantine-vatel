"use client";

import { useState, useTransition } from "react";
import { useConfirmation } from "@/components/fenetre";
import { Check, Copy, Info } from "@/components/icons";
import { PaiementMobileMoney } from "@/components/paiement-mobile-money";
import { QrRecharge } from "@/components/qr-recharge";
import { SAlert, SBtn, SBtnLink, SChip, type Ton } from "@/components/sneat";
import { useDirect } from "@/hooks/use-direct";
import type { RechargeEnDirect } from "@/lib/donnees-parent";
import { fcfa } from "@/lib/format";
import { LIBELLE_ETAT_RECHARGE, type EtatRecharge } from "@/lib/recharge";
import { annulerMaRecharge } from "../actions";

// La page d'une recharge, relue toutes les 3 secondes : tant qu'elle attend, le paiement Mobile Money natif par Cartflox
// (quand il est branché, comme dans LinkAfr), le QR universel en second choix, et de quoi l'annuler ; dès que le paiement
// est confirmé, « Reçue » et le nouveau solde. Rien ici ne décide : l'état vient du serveur, qui relit chaque paiement.

const TON: Record<EtatRecharge, Ton> = { en_attente: "warning", confirmee: "success", annulee: "secondary" };

/** Copie par une zone de texte : sans https (le wifi en essai), le presse-papiers moderne n'existe pas. */
function copierParZone(texte: string) {
  const zone = document.createElement("textarea");
  zone.value = texte;
  zone.style.position = "fixed";
  zone.style.opacity = "0";
  document.body.appendChild(zone);
  zone.select();
  const fait = document.execCommand("copy");
  zone.remove();
  return fait;
}

/** La référence en chasse fixe, et de quoi la copier (pour la donner à la cantine). */
function Reference({ reference }: { reference: string }) {
  const [etat, setEtat] = useState<"repos" | "copiee" | "echec">("repos");
  const copier = async () => {
    let fait: boolean;
    try { await navigator.clipboard.writeText(reference); fait = true; } catch { fait = copierParZone(reference); }
    setEtat(fait ? "copiee" : "echec");
    setTimeout(() => setEtat("repos"), 2500);
  };
  return (
    <div className="mt-3">
      <div className="flex items-center gap-3">
        <span className="text-[14px] leading-5 text-texte-2">Référence</span>
        <span className="font-mono text-[18px] leading-6 font-medium text-encre/95 select-all">{reference}</span>
        <SBtn type="button" size="sm" tone="secondary" variant="outlined" className="px-3" onClick={copier}>
          {etat === "copiee" ? <Check className="size-4" strokeWidth={1.8} aria-hidden="true" /> : <Copy className="size-4" strokeWidth={1.8} aria-hidden="true" />}
          {etat === "copiee" ? "Copiée" : "Copier"}
        </SBtn>
      </div>
      <p aria-live="polite" className={`text-[14px] leading-5 text-texte-2 ${etat === "echec" ? "mt-2" : ""}`}>
        {etat === "copiee" && <span className="sr-only">Référence copiée</span>}
        {etat === "echec" && "La copie n'a pas marché, recopie-la à la main"}
      </p>
    </div>
  );
}

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

  return (
    <>
      <section className="px-4">
        <p className="chiffres text-[40px] leading-[48px] font-medium text-encre/95">{fcfa(montant)}</p>
        <Reference reference={reference} />
        <div className="mt-5" aria-live="polite">
          <SChip tone={TON[etat]}>{etat === "en_attente" && cartflox ? "En attente du paiement" : LIBELLE_ETAT_RECHARGE[etat]}</SChip>
          <p className="mt-2 text-[15px] leading-6 text-texte-2">
            {etat === "en_attente" && (cartflox
              ? "Paie ci-dessous avec ton Mobile Money : dès que le paiement passe, le compte est crédité tout seul."
              : "La cantine confirme à la main, après avoir vu le paiement arriver. Cette page se met à jour toute seule.")}
            {etat === "confirmee" && "Le paiement est arrivé, c'est sur le compte"}
            {etat === "annulee" && "La cantine ne confirmera pas cette demande. Si tu avais déjà payé, passe au comptoir avec la référence."}
          </p>
        </div>
      </section>

      {etat === "en_attente" && cartflox && (
        <section className="mt-6 px-4" aria-label="Payer avec ton Mobile Money">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[18px] leading-6">Payer avec ton Mobile Money</h2>
            {cartflox.mode === "test" && <SChip tone="warning" size="sm">Mode essai, aucun argent réel</SChip>}
          </div>
          <p className="mt-1 text-[14px] leading-5 text-texte-2">Avec un numéro de Côte d&apos;Ivoire : la demande de paiement arrive sur ton téléphone</p>
          <div className="mt-4 rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4">
            <PaiementMobileMoney rechargeId={id} montant={montant} onVerifie={relire} />
          </div>
        </section>
      )}

      {etat === "en_attente" && cartflox && qr && (
        <details className="group mt-6 px-4">
          <summary className="flex h-12 cursor-pointer list-none items-center justify-between rounded-[12px] px-4 text-[15px] font-medium text-encre/90 shadow-[inset_0_0_0_1px_var(--h-filet)] transition-colors hover:bg-[color:var(--h-survol)] [&::-webkit-details-marker]:hidden">
            Payer plutôt avec le QR universel
            <span aria-hidden="true" className="text-texte-2 transition-transform group-open:rotate-90">›</span>
          </summary>
          <div className="mt-4 rounded-[16px] bg-[var(--h-fond-2)] px-4 py-6">
            <p className="mb-4 text-[14px] leading-5 text-texte-2">Avec le QR universel, la cantine confirme à la main, après avoir vu le paiement arriver</p>
            <QrRecharge svg={qr} reference={reference} montantATaper={qrAvecMontant ? undefined : fcfa(montant)} />
          </div>
        </details>
      )}

      {etat === "en_attente" && !cartflox && (
        qr ? (
          <section className="mt-6 bg-[var(--h-fond-2)] px-4 py-6">
            <QrRecharge svg={qr} reference={reference} montantATaper={qrAvecMontant ? undefined : fcfa(montant)} />
          </section>
        ) : (
          <section className="mt-6 px-4">
            <SAlert Icon={Info}>
              La cantine n&apos;a pas encore branché son QR de paiement. Donne la référence <span className="font-mono font-medium">{reference}</span> au comptoir pour payer en espèces.
            </SAlert>
          </section>
        )
      )}

      {etat === "en_attente" && aMoi && (
        <section className="mt-6 px-4">
          {erreur && <div className="mb-3"><SAlert tone="error">{erreur}</SAlert></div>}
          <SBtn type="button" tone="error" variant="text" block disabled={enCours} onClick={annuler}>{enCours ? "Un instant" : "Annuler cette demande"}</SBtn>
        </section>
      )}

      {etat === "confirmee" && (
        <section className="sn-fondu mt-6 px-4">
          <div className="rounded-[16px] border border-[color:var(--h-filet)] bg-surface p-4">
            <p className="text-[14px] leading-5 text-texte-2">{soldeDeQui}</p>
            <p className="chiffres mt-1 text-[36px] leading-[44px] font-medium text-marque-texte">{fcfa(direct.solde)}</p>
          </div>
          <SBtnLink href={retour.href} tone="secondary" block className="mt-4 min-h-12 text-[16px]">{retour.libelle}</SBtnLink>
        </section>
      )}

      {etat === "annulee" && (
        <section className="mt-6 grid gap-2 px-4">
          <SBtnLink href={nouvelle} tone="secondary" block className="min-h-12 text-[16px]">Faire une autre demande</SBtnLink>
          <SBtnLink href={retour.href} tone="secondary" variant="text" block>{retour.libelle}</SBtnLink>
        </section>
      )}

      {fenetre}
    </>
  );
}
