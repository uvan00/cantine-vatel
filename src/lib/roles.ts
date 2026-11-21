// Les rôles du logiciel et ce que chacun ouvre. À la cantine, deux rôles (demande du propriétaire du 21/11/2026) :
// l'admin voit tout ; le responsable de cantine tient le comptoir (scanner, espèces, sa caisse du jour, borne, commandes,
// demandes hors délai) et ne voit ni l'argent de la cantine, ni les menus et leurs prix, ni les réglages.
// Pur et testé (roles.test.ts) : la coque, la page « Plus », le menu de l'argent et les contrôles d'accès
// (src/lib/session.ts) lisent la même liste. Chaque page et chaque action revérifient côté serveur.

export const ROLES = ["convive", "parent", "responsable", "admin"] as const;
export type Role = (typeof ROLES)[number];
export type RoleCantine = "admin" | "responsable";

/** Les deux rôles de la cantine, pour `exiger(...CANTINE)` et `autorise(...CANTINE)`. */
export const CANTINE: RoleCantine[] = ["admin", "responsable"];

export const estCantine = (role: string | null | undefined): role is RoleCantine => role === "admin" || role === "responsable";

/** Un rôle lu en base ; inconnu, il ne donne que les droits d'un convive. */
export const lireRole = (valeur: string | null | undefined): Role =>
  (ROLES as readonly string[]).includes(valeur ?? "") ? (valeur as Role) : "convive";

/** La page d'accueil de chaque rôle. */
export const accueilDe = (role: Role) => (estCantine(role) ? "/admin" : role === "parent" ? "/parent" : "/menu");

/** Le nom d'un rôle de la cantine, à l'écran. */
export const nomDuRole = (role: RoleCantine) => (role === "admin" ? "Admin" : "Responsable de cantine");

/**
 * Les pages de la cantine que seul l'admin ouvre : l'argent de la cantine, les menus et leurs prix, les messages, les
 * achats, les réglages et l'équipe, le rapport de la semaine, l'assistant. Le reste de /admin est aussi au responsable.
 */
export const RESERVE_A_L_ADMIN = [
  "/admin/menus", "/admin/messages", "/admin/besoins", "/admin/badges", "/admin/reglages", "/admin/rapport", "/admin/assistant",
  "/admin/recharges/encaissements", "/admin/recharges/ventes", "/admin/recharges/depenses", "/admin/recharges/bilan", "/admin/recharges/soldes",
];

/** Ce rôle ouvre-t-il cette page de la cantine (ou la borne, ou la feuille du jour) ? */
export function peutOuvrir(role: Role, chemin: string): boolean {
  if (role === "admin") return true;
  if (role !== "responsable") return false;
  const page = chemin.split(/[?#]/)[0];
  return !RESERVE_A_L_ADMIN.some((p) => page === p || page.startsWith(`${p}/`));
}
