import { verifierRechargesEnAttente } from "@/lib/cartflox-serveur";
import { vueRecharges } from "@/lib/donnees-admin";
import { caisseDuJour } from "@/lib/donnees-cantine";
import { depuis } from "@/lib/format";
import { maintenant } from "@/lib/horloge";
import { jourIso, jourProche } from "@/lib/jours";
import { refus, reponse } from "@/lib/mobile";
import { LIBELLE_ETAT_RECHARGE, LIBELLE_MOYEN } from "@/lib/recharge";
import { heureH } from "@/lib/reservation";
import { CANTINE, autorise } from "@/lib/session";

// Les recharges qui attendent la cantine et les dernières closes, comme /api/admin/recharges du site : avant de lire,
// les paiements Cartflox en cours sont relus chez Cartflox. Les dates et les états arrivent en mots. `caisse` (ajouté le
// 21/11/2026) : les espèces que la personne connectée (admin ou responsable de cantine) a encaissées aujourd'hui.
export const dynamic = "force-dynamic";
export { OPTIONS } from "@/lib/mobile";

/** Ce que dit le dernier paiement Cartflox d'une demande, avec les mots de la page des recharges du site. */
function etatCartflox(statut: string): { texte: string; ton: "attention" | "erreur" | "succes" | "neutre" } {
  if (statut === "SUCCESS") return { texte: "Payé chez Cartflox", ton: "succes" };
  if (["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"].includes(statut)) return { texte: "Paiement Cartflox non abouti", ton: "erreur" };
  if (statut === "INCONNUE") return { texte: "Inconnu chez Cartflox", ton: "neutre" };
  return { texte: "Paiement Cartflox en cours", ton: "attention" };
}

export async function GET(requete: Request) {
  const qui = await autorise(...CANTINE);
  if (!qui) return refus(requete);
  await verifierRechargesEnAttente().catch(() => {});
  const instant = maintenant();
  const [v, caisse] = await Promise.all([vueRecharges(instant), caisseDuJour(qui.id, instant)]);
  return reponse(requete, {
    enAttente: v.enAttente.map((r) => ({
      id: r.id,
      reference: r.reference,
      beneficiaire: r.beneficiaire,
      photo: r.photo,
      groupe: r.groupe,
      demandeur: r.demandeur,
      montant: r.montant,
      depuis: depuis(r.creeLe, instant),
      cartflox: r.cartflox ? { ...etatCartflox(r.cartflox.statut), remarque: r.cartflox.remarque } : null,
    })),
    aRegarder: v.aVerifier.length,
    dernieres: v.dernieres.map((r) => ({
      id: r.id,
      reference: r.reference,
      beneficiaire: r.beneficiaire,
      photo: r.photo,
      montant: r.montant,
      moyen: LIBELLE_MOYEN[r.moyen],
      etat: r.etat,
      libelleEtat: LIBELLE_ETAT_RECHARGE[r.etat],
      quand: `${jourProche(jourIso(new Date(r.quand).getTime()), instant)} à ${heureH(r.quand)}`,
    })),
    caisse: {
      total: caisse.total,
      lignes: caisse.lignes.map((l) => ({ id: l.id, heure: heureH(l.heure), convive: l.convive, montant: l.montant, reference: l.reference })),
    },
  });
}
