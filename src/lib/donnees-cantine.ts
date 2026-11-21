import "server-only";
import { prisma } from "@/lib/db";
import { bilan, depensesDe, encaissements, periodeDe, periodeLisible, soldes, ventes } from "@/lib/comptabilite";
import { donneesCompta, soldesDesConvives } from "@/lib/donnees-compta";
import { ajouterJours, jourIso, lundiDe } from "@/lib/jours";
import { lireListe } from "@/lib/listes";
import { etiquettesEnCause } from "@/lib/profil-alimentaire";
import { estCantine, lireRole, type RoleCantine } from "@/lib/roles";
import { soldeBas } from "@/lib/solde";
import { caisses, moisCompare } from "@/lib/tableau";

// Les lectures de l'espace de la cantine ajoutées le 21/11/2026 (demande du propriétaire) : l'équipe et ses caisses,
// et ce que l'accueil de l'admin montre en plus du tableau de bord (l'argent, les convives, ce qui attend). Rien n'écrit
// ici, et les calculs viennent d'ailleurs (src/lib/comptabilite.ts, src/lib/tableau.ts) : l'accueil dit les mêmes
// chiffres que la rubrique Recharges. Ces fonctions ne vérifient pas QUI appelle : la page fait `exiger(...)`.

const jourDe = (d: Date) => d.toISOString().slice(0, 10);
/** Abidjan vit à l'heure UTC : un jour va de minuit à minuit UTC. */
const duJour = (jour: string) => ({ gte: new Date(`${jour}T00:00:00.000Z`), lte: new Date(`${jour}T23:59:59.999Z`) });

/* ── L'équipe ──────────────────────────────────────────────────────────────── */

export type MembreEquipe = { id: string; nom: string; email: string; role: RoleCantine; actif: boolean; depuis: string };

/** Les gens de la cantine : les admins d'abord, puis les responsables, par nom. */
export async function equipe(): Promise<MembreEquipe[]> {
  const gens = await prisma.user.findMany({
    where: { role: { in: ["admin", "responsable"] } },
    select: { id: true, name: true, email: true, role: true, actif: true, createdAt: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
  return gens.flatMap((g) => {
    const role = lireRole(g.role);
    return estCantine(role) ? [{ id: g.id, nom: g.name, email: g.email, role, actif: g.actif, depuis: jourDe(g.createdAt) }] : [];
  });
}

/* ── Les caisses ───────────────────────────────────────────────────────────── */

export type LigneCaisse = { id: string; heure: string; convive: string; montant: number; reference: string };

/**
 * Les espèces encaissées aujourd'hui par cette personne, de la plus récente à la plus ancienne : les recharges en
 * espèces qu'elle a confirmées, et les repas payés en espèces qu'elle a encaissés au scan (leur référence est le code
 * du ticket). C'est ce qu'elle doit avoir dans sa caisse.
 */
export async function caisseDuJour(personneId: string, maintenant: number): Promise<{ total: number; lignes: LigneCaisse[] }> {
  const jour = jourIso(maintenant);
  const [recharges, repas] = await Promise.all([
    prisma.recharge.findMany({
      where: { etat: "confirmee", moyen: "especes", confirmeePar: personneId, confirmeeLe: duJour(jour) },
      select: { id: true, montant: true, reference: true, confirmeeLe: true, beneficiaire: { select: { name: true } } },
    }),
    prisma.reservation.findMany({
      where: { jour, etat: "servie", paiement: "especes", serviPar: personneId },
      select: { id: true, prix: true, code: true, serviLe: true, convive: { select: { name: true } } },
    }),
  ]);
  const lignes = [
    ...recharges.map((r) => ({ id: r.id, heure: (r.confirmeeLe ?? new Date(maintenant)).toISOString(), convive: r.beneficiaire.name, montant: r.montant, reference: r.reference })),
    ...repas.map((r) => ({ id: r.id, heure: (r.serviLe ?? new Date(maintenant)).toISOString(), convive: r.convive.name, montant: r.prix, reference: `Repas ${r.code}` })),
  ].sort((x, y) => y.heure.localeCompare(x.heure));
  return { total: lignes.reduce((s, l) => s + l.montant, 0), lignes };
}

/** La journée de l'équipe : pour chacun, ses espèces et ses repas servis ; la borne et le Mobile Money à part. */
export async function equipeDuJour(maintenant: number) {
  const jour = jourIso(maintenant);
  const [membres, recharges, servis] = await Promise.all([
    equipe(),
    prisma.recharge.findMany({ where: { etat: "confirmee", confirmeeLe: duJour(jour) }, select: { confirmeePar: true, montant: true, moyen: true } }),
    prisma.reservation.findMany({ where: { jour, etat: "servie" }, select: { serviPar: true, paiement: true, prix: true } }),
  ]);
  // Un repas payé en espèces au scan entre dans la caisse de celui qui l'a servi, comme une recharge en espèces.
  const repasEnEspeces = servis.filter((s) => s.paiement === "especes").map((s) => ({ confirmeePar: s.serviPar, montant: s.prix, moyen: "especes" }));
  const r = caisses(membres, [...recharges, ...repasEnEspeces], servis.map((s) => s.serviPar));
  // Un responsable désactivé ne reste dans la liste que s'il a encaissé ou servi aujourd'hui.
  return { ...r, membres: r.membres.filter((m) => m.actif || m.especes.nombre > 0 || m.servis > 0) };
}

/* ── Ce qui attend ─────────────────────────────────────────────────────────── */

export type ATraiter = {
  /** Recharges demandées, pas encore confirmées. */
  recharges: number;
  /** Repas demandés après la clôture, pour aujourd'hui ou plus tard, sans réponse. */
  demandes: number;
  /** Repas encore à servir dont le plat ne convient plus au profil du convive (allergie, régime). */
  aVerifier: { aujourdhui: number; demain: number };
};

export async function aTraiter(maintenant: number): Promise<ATraiter> {
  const aujourdhui = jourIso(maintenant);
  const demain = ajouterJours(aujourdhui, 1);
  const [recharges, demandes, repas] = await Promise.all([
    prisma.recharge.count({ where: { etat: "en_attente" } }),
    prisma.demandeRepas.count({ where: { etat: "en_attente", jour: { gte: aujourdhui } } }),
    prisma.reservation.findMany({
      where: { jour: { in: [aujourdhui, demain] }, etat: "reservee" },
      select: {
        jour: true,
        convive: { select: { profil: { select: { allergenes: true, regimes: true } } } },
        menuJour: { select: { plat: { select: { allergenes: true, porc: true, vegetarien: true } } } },
      },
    }),
  ]);
  const enCause = (r: (typeof repas)[number]) => etiquettesEnCause(
    { allergenes: lireListe(r.convive.profil?.allergenes ?? ""), regimes: lireListe(r.convive.profil?.regimes ?? "") },
    { allergenes: lireListe(r.menuJour.plat.allergenes), porc: r.menuJour.plat.porc, vegetarien: r.menuJour.plat.vegetarien },
  ).length > 0;
  return {
    recharges,
    demandes,
    aVerifier: { aujourdhui: repas.filter((r) => r.jour === aujourdhui && enCause(r)).length, demain: repas.filter((r) => r.jour === demain && enCause(r)).length },
  };
}

/* ── L'argent ──────────────────────────────────────────────────────────────── */

export type CompteMois = { periode: string; gagne: number; depense: number; resultat: number };
export type VueArgent = {
  /** Les recharges confirmées aujourd'hui, par moyen de paiement. */
  aujourdhui: { total: number; parMoyen: { id: string; libelle: string; nombre: number; montant: number }[] };
  /** Le mois en cours jusqu'à aujourd'hui, et les mêmes jours du mois d'avant (src/lib/tableau.ts, moisCompare). */
  mois: CompteMois;
  avant: CompteMois;
  /** L'argent des convives en dépôt : il leur appartient tant qu'ils n'ont pas mangé. */
  enDepot: number;
};

export async function argentDuTableau(maintenant: number): Promise<VueArgent> {
  const aujourdhui = jourIso(maintenant);
  const { mois, avant } = moisCompare(aujourdhui);
  const [d, comptes] = await Promise.all([donneesCompta({ type: "dates", debut: avant.debut, fin: aujourdhui }), soldesDesConvives()]);
  const compter = (p: typeof mois): CompteMois => ({ periode: periodeLisible(p), ...bilan(ventes(d.repas, p, aujourdhui).gagne, depensesDe(d.depenses, p).total) });
  const enc = encaissements(d.entrees, periodeDe("jour", aujourdhui));
  return { aujourdhui: { total: enc.total, parMoyen: enc.parMoyen }, mois: compter(mois), avant: compter(avant), enDepot: soldes(comptes).total };
}

/* ── Les convives ──────────────────────────────────────────────────────────── */

export type VueConvives = {
  inscrits: number; eleves: number; employes: number;
  /** Ceux qui ont réservé au moins un repas cette semaine (du lundi au dimanche). */
  actifs: number;
  /** Comptes créés ces sept derniers jours, aujourd'hui compris. */
  nouveaux: number;
  /** Ceux dont le solde est sous leur seuil d'alerte (la règle de src/lib/solde.ts, soldeBas). */
  sousSeuil: number;
};

export async function convivesDuTableau(maintenant: number): Promise<VueConvives> {
  const aujourdhui = jourIso(maintenant);
  const lundi = lundiDe(aujourdhui);
  const [profils, actifs, nouveaux, comptes] = await Promise.all([
    prisma.profil.findMany({ where: { user: { role: "convive" } }, select: { userId: true, genre: true, seuilAlerte: true } }),
    prisma.reservation.findMany({ where: { jour: { gte: lundi, lte: ajouterJours(lundi, 6) }, etat: { not: "annulee" } }, distinct: ["conviveId"], select: { conviveId: true } }),
    prisma.user.count({ where: { role: "convive", createdAt: { gte: new Date(`${ajouterJours(aujourdhui, -6)}T00:00:00.000Z`) } } }),
    soldesDesConvives(),
  ]);
  const solde = new Map(comptes.map((c) => [c.id, c.solde]));
  const employes = profils.filter((p) => p.genre === "employe").length;
  return {
    inscrits: profils.length,
    eleves: profils.length - employes,
    employes,
    actifs: actifs.length,
    nouveaux,
    sousSeuil: profils.filter((p) => soldeBas(solde.get(p.userId) ?? 0, p.seuilAlerte)).length,
  };
}
