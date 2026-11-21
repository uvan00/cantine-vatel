import { configCartflox, verifierRecharge } from "@/lib/cartflox-serveur";
import { Identifiant, rechargeEnDirect, rechargeVisiblePar } from "@/lib/donnees-parent";
import { de, fcfa } from "@/lib/format";
import { erreur, refus, reponse } from "@/lib/mobile";
import { pispiAvecMontant, qrRecharge } from "@/lib/pispi";
import { LIBELLE_ETAT_RECHARGE, proposerQrUniversel } from "@/lib/recharge";
import { autorise, prenomDe } from "@/lib/session";

// La page d'une recharge, comme /recharger/<id> du site (un checkout) : pour qui, le montant, la référence, l'état et
// le nouveau solde, le QR universel en SVG (fabriqué ici, comme sur le site) et ce que l'écran sait du paiement en
// ligne : son mode, jamais une clé. Seulement pour celui qui l'a demandée ou pour son bénéficiaire.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

export async function GET(requete: Request, { params }: { params: Promise<{ id: string }> }) {
  const moi = await autorise("convive", "parent");
  if (!moi) return refus(requete);
  const id = Identifiant.safeParse((await params).id);
  let r = id.success ? await rechargeVisiblePar(id.data, moi.id) : null;
  if (!r) return erreur(requete, "Recharge introuvable", 404);
  // Un paiement Cartflox en cours : on le relit chez Cartflox (sans clé, rien ne part), comme la route relue du site.
  if (r.etat === "en_attente" && (await verifierRecharge(r.id)) === "confirmee") r = (await rechargeVisiblePar(r.id, moi.id)) ?? r;

  const pourMoi = r.beneficiaireId === moi.id;
  const aMoi = r.demandeurId === moi.id;
  const [direct, qr] = await Promise.all([
    rechargeEnDirect(r),
    proposerQrUniversel(r.etat)
      ? qrRecharge({ montant: r.montant, reference: r.reference }).catch((e: unknown) => { console.error("QR de recharge impossible :", e); return null; })
      : null,
  ]);
  const cfg = r.etat === "en_attente" ? configCartflox() : null;
  return reponse(requete, {
    id: r.id,
    montant: r.montant,
    reference: r.reference,
    titre: pourMoi ? "Recharge de ton compte" : `Recharge pour ${r.beneficiaire}`,
    demandePar: pourMoi && !aMoi ? `demandée par ${prenomDe(r.demandeur)}` : null,
    etat: direct.etat,
    libelleEtat: LIBELLE_ETAT_RECHARGE[direct.etat],
    solde: direct.solde,
    soldeDeQui: pourMoi ? "Ton nouveau solde" : `Nouveau solde ${de(prenomDe(r.beneficiaire))}`,
    aMoi,
    beneficiaireId: r.beneficiaireId,
    pourMoi,
    qr,
    /** Le montant à taper quand le QR ne le porte pas ; null s'il le porte. */
    montantATaper: pispiAvecMontant() ? null : fcfa(r.montant),
    cartflox: cfg ? { mode: cfg.mode } : null,
  });
}
