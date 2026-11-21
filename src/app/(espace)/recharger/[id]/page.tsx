import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "@/components/icons";
import { configCartflox } from "@/lib/cartflox-serveur";
import { Identifiant, rechargeEnDirect, rechargeVisiblePar } from "@/lib/donnees-parent";
import { de, fcfa } from "@/lib/format";
import { pispiAvecMontant, qrRecharge } from "@/lib/pispi";
import { proposerQrUniversel } from "@/lib/recharge";
import { exiger, prenomDe } from "@/lib/session";
import { Attente } from "./attente";

export const metadata: Metadata = { title: "Recharge" };

// La page d'une recharge, comme un checkout : en tête, pour qui, le montant et la référence ; dessous, les moyens de
// paiement (Mobile Money par Cartflox quand il est branché, le QR universel), et l'état relu en direct. Sans les onglets
// du bas (coque-espace.tsx) : le retour en haut suffit.
// Seulement pour celui qui l'a demandée ou pour son bénéficiaire : pour tout autre, elle est introuvable.
export default async function PageRecharge({ params }: { params: Promise<{ id: string }> }) {
  const m = await exiger("convive", "parent");
  const id = Identifiant.safeParse((await params).id);
  const r = id.success ? await rechargeVisiblePar(id.data, m.id) : null;
  if (!r) notFound();

  const pourMoi = r.beneficiaireId === m.id;
  const aMoi = r.demandeurId === m.id;
  const [initial, qr] = await Promise.all([
    rechargeEnDirect(r),
    // Le QR ne sert que tant que la recharge attend. Si la bibliothèque refuse l'adresse de paiement, on retombe sur
    // le paiement au comptoir plutôt que de casser la page.
    proposerQrUniversel(r.etat)
      ? qrRecharge({ montant: r.montant, reference: r.reference }).catch((e: unknown) => { console.error("QR de recharge impossible :", e); return null; })
      : null,
  ]);

  const cfg = r.etat === "en_attente" ? configCartflox() : null;
  const cartflox = cfg ? { mode: cfg.mode } : null;

  return (
    <>
      <header className="px-4 pt-6 pb-6">
        <Link href="/recharger" className="-ml-2 mb-4 inline-flex h-8 items-center gap-1 rounded-[8px] px-2 text-[14px] font-medium text-encre/75 transition-colors hover:bg-[color:var(--h-survol)]">
          <ChevronLeft className="size-4" strokeWidth={1.8} />
          Recharger
        </Link>
        <h1 className="text-[16px] leading-6">{pourMoi ? "Recharge de ton compte" : `Recharge pour ${r.beneficiaire}`}</h1>
        <p className="chiffres mt-1 text-[40px] leading-[48px] font-medium text-encre/95">{fcfa(r.montant)}</p>
        <p className="mt-1 text-[14px] leading-5 text-texte-2">
          Référence <span className="font-mono text-encre/90 select-all">{r.reference}</span>
          {pourMoi && !aMoi && <>, demandée par {prenomDe(r.demandeur)}</>}
        </p>
      </header>
      <Attente id={r.id} initial={initial} montant={r.montant} reference={r.reference} qr={qr} qrAvecMontant={pispiAvecMontant()} cartflox={cartflox} aMoi={aMoi}
        soldeDeQui={pourMoi ? "Ton nouveau solde" : `Nouveau solde ${de(prenomDe(r.beneficiaire))}`}
        retour={m.role === "parent" ? { href: "/parent", libelle: "Revenir à mes enfants" } : { href: "/compte", libelle: "Revenir à mon compte" }}
        nouvelle={pourMoi ? "/recharger" : `/recharger?pour=${r.beneficiaireId}`} />
    </>
  );
}
