import { lirePeriode } from "@/app/admin/recharges/periode";
import {
  MOYENS_RECHARGE, bilan, depensesDe, enCsv, libelleCategorie, libelleMoyenDepense, periodeLisible, soldes, ventes,
} from "@/lib/comptabilite";
import { donneesCompta, soldesDesConvives } from "@/lib/donnees-compta";
import { maintenant } from "@/lib/horloge";
import { jourIso } from "@/lib/jours";
import { autorise } from "@/lib/session";

// Les comptes de la cantine en CSV, pour le comptable (demande du propriétaire du 21/11/2026) : la même période que la
// page (`p`, `j`, `du`, `au`), une vue par fichier. Les montants sont en francs CFA entiers, sans séparateur.
export const dynamic = "force-dynamic";

const ETATS: Record<string, string> = { servie: "Servi", annulee: "Annulé" };

export async function GET(req: Request) {
  if (!(await autorise("admin"))) return Response.json({ erreur: "Réservé à la cantine" }, { status: 401 });
  const params = new URL(req.url).searchParams;
  const vue = params.get("vue") ?? "";
  const aujourdhui = jourIso(maintenant());
  const p = lirePeriode(Object.fromEntries(params), aujourdhui);
  let lignes: (string | number | null)[][];
  let nom = `${vue}-${p.debut}-au-${p.fin}`;

  if (vue === "soldes") {
    const s = soldes(await soldesDesConvives());
    lignes = [["Nom", "Classe ou service", "Solde (F CFA)"], ...s.comptes.map((c) => [c.nom, c.groupe, c.solde]), ["Total en dépôt", "", s.total]];
    nom = `soldes-${aujourdhui}`;
  } else {
    const d = await donneesCompta(p);
    if (vue === "encaissements") {
      lignes = [["Confirmée le", "Moyen", "Montant (F CFA)"],
        ...d.entrees.map((r) => [r.confirmeeLe.slice(0, 10), MOYENS_RECHARGE.find((m) => m.id === r.moyen)?.libelle ?? r.moyen, r.montant])];
    } else if (vue === "ventes") {
      lignes = [["Jour", "Plat", "État", "Prix (F CFA)"],
        ...d.repas.map((r) => [r.jour, r.plat, ETATS[r.etat] ?? (r.paiement === "a_payer" ? (r.jour < aujourdhui ? "Non retiré, jamais payé" : "Réservé, à payer au comptoir") : r.jour < aujourdhui ? "Non retiré" : "Payé, pas encore servi"), r.prix])];
    } else if (vue === "depenses") {
      lignes = [["Jour", "Catégorie", "Ce qui a été payé", "Fournisseur", "Payée en", "Montant (F CFA)", "Notée par"],
        ...d.depenses.map((x) => [x.jour, libelleCategorie(x.categorie), x.libelle, x.fournisseur, libelleMoyenDepense(x.moyen), x.montant, x.noteePar])];
    } else if (vue === "bilan") {
      const v = ventes(d.repas, p, aujourdhui);
      const dep = depensesDe(d.depenses, p);
      const b = bilan(v.gagne, dep.total);
      lignes = [["Bilan", periodeLisible(p)], ["Rubrique", "Montant (F CFA)"],
        ["Repas servis", v.servis.montant], ["Repas non retirés", v.nonRetires.montant], ["Gagné", b.gagne],
        ...dep.parCategorie.map((c) => [`Dépenses : ${c.libelle}`, c.montant]), ["Dépensé", b.depense],
        [b.resultat >= 0 ? "Il reste" : "Il manque", Math.abs(b.resultat)]];
    } else {
      return Response.json({ erreur: "Vue inconnue" }, { status: 400 });
    }
  }
  return new Response(enCsv(lignes), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nom}.csv"`,
      "cache-control": "no-store",
    },
  });
}
