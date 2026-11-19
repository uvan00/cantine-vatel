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
