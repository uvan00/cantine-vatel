import "server-only";
import { prisma } from "@/lib/db";
import { plafondDe } from "@/lib/donnees";
import { lireReglages } from "@/lib/donnees";
import { aujourdhui } from "@/lib/horloge";
import { ajouterJours, jourIso } from "@/lib/jours";
import { lireListe, type Etiquette } from "@/lib/listes";
import { etiquettesEnCause, incompatibilites } from "@/lib/profil-alimentaire";
import { estimationSansReservation, lireFile, peutReserver, portionsRestantes, SERVICES_POUR_L_ESTIMATION } from "@/lib/reservation";

// Les lectures du comptoir ajoutées le 21/11/2026 (demande du propriétaire) : les plats du jour pour un badge sans
// réservation (la file classique), les convives à badge, et l'estimation des repas sans réservation. Les règles
// sont pures (src/lib/reservation.ts) ; rien n'écrit ici.

export type PlatAuComptoir = {
  /** L'identifiant du plat au menu de ce jour (MenuJour). */
  id: string;
  nom: string;
  prix: number;
  photo: string;
  /** Portions encore libres ; null : pas de limite. */
  restantes: number | null;
  /** Pourquoi ce convive ne peut pas le prendre (complet, profil, plafond, déjà un repas), en une phrase ; null : il peut. */
  refus: string | null;
  /** Ce que ce plat contient et que ce convive ne mange pas. */
  enCause: Etiquette[];
};

/**
 * Les plats d'aujourd'hui pour ce convive, au comptoir : chacun avec ce qui l'empêche de le prendre. Les mêmes règles
 * que la réservation, sans regarder le solde (la caisse choisit le moyen ensuite) ni la clôture (il est sur place).
 */
export async function platsAuComptoir(conviveId: string, maintenant: number): Promise<PlatAuComptoir[]> {
  const jour = jourIso(maintenant);
  const [menus, profil, dejaReserve, plafond, reglages] = await Promise.all([
    prisma.menuJour.findMany({
      where: { jour },
      orderBy: [{ prix: "desc" }, { id: "asc" }],
      include: { plat: { select: { nom: true, photo: true, allergenes: true, porc: true, vegetarien: true } }, _count: { select: { reservations: { where: { etat: { not: "annulee" } } } } } },
    }),
    prisma.profil.findUnique({ where: { userId: conviveId }, select: { allergenes: true, regimes: true } }),
    prisma.reservation.count({ where: { conviveId, jour, etat: { not: "annulee" } } }),
    plafondDe(conviveId, jour),
    lireReglages(),
  ]);
  const mange = { allergenes: lireListe(profil?.allergenes ?? ""), regimes: lireListe(profil?.regimes ?? "") };
  return menus.map((m) => {
    const plat = { allergenes: lireListe(m.plat.allergenes), porc: m.plat.porc, vegetarien: m.plat.vegetarien };
    const verdict = peutReserver({
      maintenant, jour, dejaReserve: dejaReserve > 0, epuise: m.epuise, portions: m.portions, reservees: m._count.reservations,
      incompatibilites: incompatibilites(mange, plat), solde: 0, prix: m.prix, parLaCantine: true, horsDelai: true, sansSolde: true,
      heureCloture: reglages.heureCloture, plafond: { max: plafond.plafond, depense: plafond.depense },
    });
    return {
      id: m.id, nom: m.plat.nom, prix: m.prix, photo: m.plat.photo,
      restantes: portionsRestantes({ portions: m.portions, reservees: m._count.reservations }),
      refus: verdict.ok ? null : verdict.phrase,
      enCause: etiquettesEnCause(mange, plat),
    };
  });
}

/* ── Les badges ─────────────────────────────────────────────────────────────── */

export type ConviveABadge = { id: string; nom: string; photo: string | null; classe: string; genre: string; carte: string | null };

/** Chaque élève ou employé actif, avec le jeton de sa carte de cantine, par classe puis par nom. */
export async function convivesABadge(): Promise<ConviveABadge[]> {
  const profils = await prisma.profil.findMany({ select: { userId: true, classe: true, genre: true, carte: true, user: { select: { name: true, image: true } } } });
  return profils
    .map((p) => ({ id: p.userId, nom: p.user.name, photo: p.user.image ?? null, classe: p.classe, genre: p.genre, carte: p.carte }))
    .sort((a, b) => a.classe.localeCompare(b.classe, "fr") || a.nom.localeCompare(b.nom, "fr"));
}

/* ── L'estimation des repas sans réservation ─────────────────────────────────── */

/**
 * L'estimation des repas sans réservation pour ce jour : la moyenne des repas de la file classique sur les derniers
 * jours de service d'avant (les jours où la cantine a servi au moins un repas, cinq au plus). Le service en cours ne
 * compte pas : pour demain, on s'arrête à hier, comme pour aujourd'hui. `services` : sur combien de jours elle s'appuie ;
 * null tant qu'aucun service n'a eu lieu.
 */
export async function estimationDuJour(jour: string): Promise<{ estimation: number | null; services: number }> {
  const ceJour = aujourdhui();
  const avant = jour < ceJour ? jour : ceJour;
  const servis = await prisma.reservation.groupBy({
    by: ["jour", "file"],
    where: { etat: "servie", jour: { lt: avant, gte: ajouterJours(avant, -60) } },
    _count: { _all: true },
  });
  const jours = [...new Set(servis.map((s) => s.jour))].sort().reverse().slice(0, SERVICES_POUR_L_ESTIMATION);
  const parJour = jours.map((j) => servis.filter((s) => s.jour === j && lireFile(s.file) === "classique").reduce((n, s) => n + s._count._all, 0));
  return { estimation: estimationSansReservation(parJour), services: jours.length };
}
