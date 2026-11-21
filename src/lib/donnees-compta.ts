import "server-only";
import { prisma } from "@/lib/db";
import type { DepenseCompta, Periode, RechargeCompta, RepasCompta } from "@/lib/comptabilite";

// Les lectures de la comptabilité (src/lib/comptabilite.ts fait les calculs). Rien n'écrit ici.

/**
 * Ce qui sert à compter une période : les recharges confirmées, les repas réservés, les dépenses. `entrees` : tout
 * l'argent entré, les recharges et les repas payés à la caisse (espèces, Mobile Money), datés du service.
 */
export async function donneesCompta(p: Periode) {
  const [recharges, reservations, depenses] = await Promise.all([
    prisma.recharge.findMany({
      where: { etat: "confirmee", confirmeeLe: { gte: new Date(`${p.debut}T00:00:00.000Z`), lte: new Date(`${p.fin}T23:59:59.999Z`) } },
      select: { montant: true, moyen: true, confirmeeLe: true },
    }),
    prisma.reservation.findMany({
      where: { jour: { gte: p.debut, lte: p.fin } },
      select: { jour: true, prix: true, etat: true, paiement: true, serviLe: true, menuJour: { select: { plat: { select: { nom: true } } } } },
    }),
    prisma.depense.findMany({ where: { jour: { gte: p.debut, lte: p.fin } }, orderBy: [{ jour: "desc" }, { creeLe: "desc" }] }),
  ]);
  const confirmees = recharges.flatMap((r): RechargeCompta[] => (r.confirmeeLe ? [{ montant: r.montant, moyen: r.moyen, confirmeeLe: r.confirmeeLe.toISOString() }] : []));
  // Un repas payé à la caisse est servi dans le même geste : l'argent entre à l'heure du service.
  const aLaCaisse = reservations.flatMap((r): RechargeCompta[] =>
    r.etat === "servie" && (r.paiement === "especes" || r.paiement === "mobile_money")
      ? [{ montant: r.prix, moyen: `repas_${r.paiement}`, confirmeeLe: (r.serviLe ?? new Date(`${r.jour}T12:00:00.000Z`)).toISOString() }]
      : []);
  return {
    recharges: confirmees,
    entrees: [...confirmees, ...aLaCaisse],
    repas: reservations.map((r): RepasCompta => ({ jour: r.jour, prix: r.prix, etat: r.etat, plat: r.menuJour.plat.nom, paiement: r.paiement })),
    depenses: depenses.map((d) => ({ ...d, creeLe: d.creeLe.toISOString() })) satisfies DepenseCompta[],
  };
}

export type LigneDepense = Awaited<ReturnType<typeof donneesCompta>>["depenses"][number];

/** Le solde de chaque élève ou employé, d'après son journal (la somme de ses mouvements), avec sa classe ou son service. */
export async function soldesDesConvives() {
  const [sommes, convives] = await Promise.all([
    prisma.mouvement.groupBy({ by: ["conviveId"], _sum: { montant: true } }),
    prisma.user.findMany({ where: { role: "convive" }, select: { id: true, name: true, profil: { select: { classe: true } } } }),
  ]);
  const parConvive = new Map(sommes.map((s) => [s.conviveId, s._sum.montant ?? 0]));
  return convives.map((c) => ({ id: c.id, nom: c.name, groupe: c.profil?.classe ?? "", solde: parConvive.get(c.id) ?? 0 }));
}
