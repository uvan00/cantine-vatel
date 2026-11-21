// Les comptes de démonstration, créés par `npm run demo`. Ils servent au jury et aux essais : rien de réel dedans.
// Sur l'accueil, « Essayer comme… » ne s'affiche que si MODE_DEMO vaut "1". À couper pour un vrai service.

export const MOT_DE_PASSE_DEMO = "cantine-demo-2026";

export const COMPTES_DEMO = {
  convive: { email: "awa@cantine.test", nom: "Awa Koné", libelle: "Awa, élève" },
  parent: { email: "mariam@cantine.test", nom: "Mariam Koné", libelle: "Mariam, sa maman" },
  admin: { email: "cantine@cantine.test", nom: "Aminata Bamba", libelle: "Aminata, la cantine" },
} as const;

export type RoleDemo = keyof typeof COMPTES_DEMO;

export const modeDemo = () => process.env.MODE_DEMO === "1";

/**
 * Les rôles qu'on peut essayer en un clic. Le compte de la cantine n'en fait partie que sur un ordinateur de
 * développement : sur un serveur en ligne (construction de production), aucun bouton n'ouvre l'administration, même en
 * mode démonstration. La cantine s'y connecte avec son e-mail et son mot de passe.
 */
export const rolesDemo = (production: boolean = process.env.NODE_ENV === "production"): RoleDemo[] =>
  production ? ["convive", "parent"] : ["convive", "parent", "admin"];
