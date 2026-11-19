import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EnTeteEspace } from "@/components/coque-espace";
import { Identifiant, rechargeEnDirect, rechargeVisiblePar } from "@/lib/donnees-parent";
import { de } from "@/lib/format";
import { pispiAvecMontant, qrRecharge } from "@/lib/pispi";
import { exiger, prenomDe } from "@/lib/session";
import { Attente } from "./attente";

export const metadata: Metadata = { title: "Recharge" };

// La page d'une recharge : son montant, sa référence, le QR universel de paiement, et l'état relu en direct.
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
    r.etat === "en_attente"
      ? qrRecharge({ montant: r.montant, reference: r.reference }).catch((e: unknown) => { console.error("QR de recharge impossible :", e); return null; })
      : null,
  ]);

  return (
    <>
      <EnTeteEspace titre="Recharge" retour={{ href: "/recharger", libelle: "Recharger" }}
        sousTitre={pourMoi ? (aMoi ? "Pour ton compte" : `Pour ton compte, demandée par ${prenomDe(r.demandeur)}`) : `Pour ${r.beneficiaire}`} />
      <Attente id={r.id} initial={initial} montant={r.montant} reference={r.reference} qr={qr} qrAvecMontant={pispiAvecMontant()} aMoi={aMoi}
        soldeDeQui={pourMoi ? "Ton nouveau solde" : `Nouveau solde ${de(prenomDe(r.beneficiaire))}`}
        retour={m.role === "parent" ? { href: "/parent", libelle: "Revenir à mes enfants" } : { href: "/compte", libelle: "Revenir à mon compte" }}
        nouvelle={pourMoi ? "/recharger" : `/recharger?pour=${r.beneficiaireId}`} />
    </>
  );
}
